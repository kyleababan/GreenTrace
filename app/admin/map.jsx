import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { formatLocationWithPurok } from "../../constants/locationFormat";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../../constants/wasteCategories";
import { db } from "../../firebaseConfig";
import { useAdminSidebar } from "./_layout";

// Coordinates for Pinamungajan barangays (fallback if post has no GPS coordinates saved)
const BARANGAY_COORDINATES = {
  anislag: { lat: 10.285, lng: 123.57 },
  anopog: { lat: 10.292, lng: 123.615 },
  binabag: { lat: 10.26, lng: 123.575 },
  buhingtubig: { lat: 10.252, lng: 123.602 },
  busay: { lat: 10.28, lng: 123.63 },
  butong: { lat: 10.245, lng: 123.58 },
  cabiangon: { lat: 10.275, lng: 123.61 },
  camugao: { lat: 10.295, lng: 123.59 },
  duangan: { lat: 10.24, lng: 123.62 },
  guimbawian: { lat: 10.265, lng: 123.635 },
  lamac: { lat: 10.3, lng: 123.64 },
  lutod: { lat: 10.31, lng: 123.61 },
  "lut-od": { lat: 10.31, lng: 123.61 },
  mangoto: { lat: 10.285, lng: 123.56 },
  opao: { lat: 10.27, lng: 123.57 },
  poblacion: { lat: 10.2705, lng: 123.5855 },
  punod: { lat: 10.29, lng: 123.575 },
  rizal: { lat: 10.26, lng: 123.62 },
  sacsac: { lat: 10.255, lng: 123.63 },
  sambagon: { lat: 10.282, lng: 123.6 },
  sibago: { lat: 10.298, lng: 123.58 },
  tajao: { lat: 10.305, lng: 123.565 },
  tangub: { lat: 10.25, lng: 123.565 },
  tanibag: { lat: 10.275, lng: 123.565 },
  tupas: { lat: 10.265, lng: 123.56 },
  tutay: { lat: 10.278, lng: 123.588 },
};

// Base64 data URI of assets/images/location.png for Leaflet iframe tooltip
const LOCATION_ICON_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAAAQBJREFUeAGFU7sNwkAMfQkwAIxBhmAF6GACWACJmgaxA+PQJlJoESWioeBTUPAJNvgO5+4SLD1d5M/zs+8ClK0p54iwJbwID8KOMHRyPDOBsxQyCoEhukhOyy2O5OSEuyoqnG+OnQLNPwQT6VLImRO6hISQqRiTjVVTawclPRVfLIAQmvgxpKJQSJwOkfj0SLaDJgh9A75cTz5ElpG4gT9CpuJ7BBhnKG87Fdm8yBy/23kSpkZFpAi4k9l0pE4Icax8doSGo4ITem6SQzQnrOHvySZdlVwN9t3wx/g5t1H9EjuO6qBxQj9QPEDNjxQaZ4HvxplgiYq7ryNgWwm0r2RvqGhfQgsI7XsAAAAASUVORK5CYII=";

const STATUS_DETAILS = {
  critical: { label: "Critical", color: "#FF5B5B", badgeBg: "#FFEBEB" },
  moderate: { label: "Moderate", color: "#ff8c40", badgeBg: "#FFF3E8" },
  ongoing: { label: "On-going", color: "#FFC940", badgeBg: "#FFF9E6" },
};

const formatPostedDate = (timestamp) => {
  if (!timestamp) return "Recently";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Recently";

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400)
    return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
};

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

export default function AdminMap() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { toggleSidebar, isMobile: sidebarIsMobile } = useAdminSidebar();
  const isMobile = width < 700 || Boolean(sidebarIsMobile);

  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedPost, setSelectedPost] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapSession, setMapSession] = useState(0);

  // 1. Fetch uncleaned posts from Firestore
  useEffect(() => {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const uncleanedList = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const status = (data.status || "pending").toLowerCase();
          // Filter: only display posts that aren't cleaned
          if (status !== "cleaned") {
            uncleanedList.push({ id: docSnap.id, ...data });
          }
        });
        setPosts(uncleanedList);
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load map posts:", error);
        setLoading(false);
      },
    );

    // 2. Fetch users for live author names and points
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const userMap = {};
        snapshot.forEach((userDoc) => {
          userMap[userDoc.id] = userDoc.data();
        });
        setUsers(userMap);
      },
      (error) => console.error("Unable to load users:", error),
    );

    return () => {
      unsubscribePosts();
      unsubscribeUsers();
    };
  }, []);

  // 3. Listen for Leaflet pin click postMessages from iframe
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleWindowMessage = (event) => {
        try {
          const data =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
          if (data && data.type === "POST_PIN_CLICKED" && data.postId) {
            const found = posts.find((p) => p.id === data.postId);
            if (found) {
              setSelectedPost(found);
            }
          }
        } catch {
          // Ignore non-JSON postMessages
        }
      };

      window.addEventListener("message", handleWindowMessage);
      return () => {
        window.removeEventListener("message", handleWindowMessage);
      };
    }
  }, [posts]);

  // Compute pins data with coordinates
  const mappedPins = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return posts
      .map((post) => {
        let lat = null;
        let lng = null;

        if (post.coordinates?.latitude && post.coordinates?.longitude) {
          lat = Number(post.coordinates.latitude);
          lng = Number(post.coordinates.longitude);
        } else {
          // Robust fallback: check barangay, or search locationName for any barangay name, or use Poblacion center
          let bKey = (post.barangay || "").toLowerCase().trim();
          if (!bKey || !BARANGAY_COORDINATES[bKey]) {
            const loc = (post.locationName || "").toLowerCase();
            for (const name of Object.keys(BARANGAY_COORDINATES)) {
              if (loc.includes(name)) {
                bKey = name;
                break;
              }
            }
          }

          const base =
            BARANGAY_COORDINATES[bKey] || BARANGAY_COORDINATES.poblacion;
          let hash = 0;
          for (let i = 0; i < (post.id || "").length; i++) {
            hash = (hash * 31 + post.id.charCodeAt(i)) % 1000;
          }
          const jitterLat = ((hash % 20) - 10) * 0.0004;
          const jitterLng = ((((hash / 20) | 0) % 20) - 10) * 0.0004;
          lat = base.lat + jitterLat;
          lng = base.lng + jitterLng;
        }

        if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
          return null;
        }

        const rawStatus = (post.status || "moderate").toLowerCase();
        const statusKey =
          rawStatus === "on-going"
            ? "ongoing"
            : STATUS_DETAILS[rawStatus]
              ? rawStatus
              : "moderate";
        const statusMeta = STATUS_DETAILS[statusKey] || STATUS_DETAILS.moderate;

        const userObj = users[post.userId] || {};
        const authorName =
          [userObj.firstName, userObj.lastName].filter(Boolean).join(" ") ||
          post.userName ||
          "Resident";
        const authorPoints = userObj.points ?? post.points ?? 0;

        return {
          id: post.id,
          lat,
          lng,
          title: post.title || "Waste Report",
          imageUrl: post.imageUrl || "",
          status: statusKey,
          statusLabel: statusMeta.label,
          statusColor: statusMeta.color,
          locationName:
            formatLocationWithPurok(post.locationName, post.purok) ||
            post.locationName ||
            "Pinamungajan",
          authorName,
          authorPoints,
          post,
        };
      })
      .filter(Boolean)
      .filter((pin) => {
        // Status tab filter
        if (activeFilter !== "all") {
          if (pin.status !== activeFilter) return false;
        }

        // Search filter
        if (keyword) {
          const matchTitle = (pin.title || "").toLowerCase().includes(keyword);
          const matchLocation = (pin.locationName || "")
            .toLowerCase()
            .includes(keyword);
          const matchAuthor = (pin.authorName || "")
            .toLowerCase()
            .includes(keyword);
          return matchTitle || matchLocation || matchAuthor;
        }

        return true;
      });
  }, [posts, users, activeFilter, search]);

  // Counts for each status tab
  const statusCounts = useMemo(() => {
    const counts = {
      all: posts.length,
      critical: 0,
      moderate: 0,
      ongoing: 0,
    };
    posts.forEach((p) => {
      const s = (p.status || "moderate").toLowerCase();
      const key = s === "on-going" ? "ongoing" : s;
      if (counts[key] !== undefined) counts[key]++;
      else counts.moderate++;
    });
    return counts;
  }, [posts]);

  // Generate Leaflet HTML for web iframe
  const leafletHtml = useMemo(() => {
    const sanitize = (str) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const pinsJson = JSON.stringify(
      mappedPins.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        title: sanitize(p.title),
        imageUrl: p.imageUrl,
        status: p.status,
        statusLabel: p.statusLabel,
        statusColor: p.statusColor,
        locationName: sanitize(p.locationName),
        authorName: sanitize(p.authorName),
        authorPoints: p.authorPoints,
      })),
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef2f0; }

    .custom-pin-container {
      background: none;
      border: none;
    }

    .pin-wrapper {
      position: relative;
      width: 48px;
      height: 56px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .pin-wrapper:hover {
      transform: scale(1.18);
      z-index: 99999 !important;
    }

    .pin-bubble {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border-width: 3.5px;
      border-style: solid;
    }

    .pin-bubble img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .pin-arrow {
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-top-width: 9px;
      border-top-style: solid;
      margin-top: -1px;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));
    }

    .pin-pulse {
      position: absolute;
      top: -4px;
      left: -1px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 3px solid #FF5B5B;
      animation: pulse 1.8s infinite ease-out;
      pointer-events: none;
    }

    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.9; }
      70% { transform: scale(1.35); opacity: 0; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    .leaflet-tooltip {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border-radius: 8px;
      padding: 8px 12px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      border: none;
      background: rgba(36, 53, 42, 0.95);
      color: #fff;
    }

    .leaflet-tooltip-top:before {
      border-top-color: rgba(36, 53, 42, 0.95);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var pins = ${pinsJson};
    var centerLat = 10.2705;
    var centerLng = 123.5855;

    var map = L.map('map', {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    var markersGroup = L.featureGroup();

    pins.forEach(function(p) {
      var icon = L.divIcon({
        className: 'custom-pin-container',
        html: \`
          <div class="pin-wrapper">
            \${p.status === 'critical' ? '<div class="pin-pulse"></div>' : ''}
            <div class="pin-bubble" style="border-color: \${p.statusColor};">
              <img src="\${p.imageUrl || 'https://via.placeholder.com/60?text=Waste'}" onerror="this.src='https://via.placeholder.com/60?text=Waste'" alt="Waste Photo" />
            </div>
            <div class="pin-arrow" style="border-top-color: \${p.statusColor};"></div>
          </div>
        \`,
        iconSize: [48, 56],
        iconAnchor: [24, 54],
        popupAnchor: [0, -54]
      });

      var marker = L.marker([p.lat, p.lng], { icon: icon });

      marker.bindTooltip(\`
        <div style="font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
            <span style="background: \${p.statusColor}; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase;">\${p.statusLabel}</span>
            <span style="color: #A3E635; font-weight: 600;">🪙 \${p.authorPoints} pts</span>
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #fff; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">\${p.title}</div>
          <div style="display: flex; align-items: center; gap: 5px; color: #E2E8E4; font-size: 11px; margin-top: 3px;">
            <img src="${LOCATION_ICON_BASE64}" style="width: 12px; height: 12px; object-fit: contain; filter: brightness(0) invert(1);" alt="" />
            <span>\${p.locationName}</span>
          </div>
          <div style="color: #CBD5E1; font-size: 10px; margin-top: 3px; font-weight: 500;">By \${p.authorName}</div>
        </div>
      \`, { direction: 'top', offset: [0, -48] });

      marker.on('click', function() {
        if (window.parent) {
          window.parent.postMessage(JSON.stringify({ type: 'POST_PIN_CLICKED', postId: p.id }), '*');
        }
      });

      markersGroup.addLayer(marker);
    });

    markersGroup.addTo(map);

    if (pins.length > 0) {
      try {
        if (pins.length === 1) {
          map.setView([pins[0].lat, pins[0].lng], 15);
        } else {
          map.fitBounds(markersGroup.getBounds().pad(0.12), { maxZoom: 16 });
        }
      } catch (e) {
        map.setView([centerLat, centerLng], 13);
      }
    } else {
      map.setView([centerLat, centerLng], 13);
    }
  </script>
</body>
</html>
    `;
  }, [mappedPins]);

  // Navigate to PostDetail component / screen
  const handleRedirectToPostDetail = () => {
    if (!selectedPost) return;
    const postId = selectedPost.id;
    setSelectedPost(null);
    router.push({
      pathname: "/admin/assessments/post_view/PostDetail",
      params: { postId },
    });
  };

  // Selected post user information
  const selectedUser = selectedPost ? users[selectedPost.userId] || {} : {};
  const selectedAuthorName =
    [selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(" ") ||
    selectedPost?.userName ||
    "Resident Reporter";
  const selectedAuthorPoints = selectedUser.points ?? selectedPost?.points ?? 0;
  const selectedRawStatus = (selectedPost?.status || "moderate").toLowerCase();
  const selectedStatusKey =
    selectedRawStatus === "on-going"
      ? "ongoing"
      : STATUS_DETAILS[selectedRawStatus]
        ? selectedRawStatus
        : "moderate";
  const selectedStatusMeta =
    STATUS_DETAILS[selectedStatusKey] || STATUS_DETAILS.moderate;

  return (
    <View style={styles.container}>
      {/* HEADER SECTION */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            {isMobile && (
              <TouchableOpacity
                style={styles.hamburgerBtn}
                onPress={toggleSidebar}
                accessibilityLabel="Open Navigation Menu"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="menu" size={26} color="#24352A" />
              </TouchableOpacity>
            )}
            <View style={styles.titleTextCol}>
              <Text
                style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}
              >
                Reports Map
              </Text>
              {!isMobile && (
                <Text style={styles.pageSubtitle}>
                  Geographic overview of active uncleaned reports in
                  Pinamungajan
                </Text>
              )}
            </View>
          </View>

          <View
            style={[styles.summaryBadge, isMobile && styles.summaryBadgeMobile]}
          >
            <Ionicons
              name="location"
              size={isMobile ? 14 : 16}
              color="#599A74"
            />
            <Text
              style={[
                styles.summaryBadgeText,
                isMobile && styles.summaryBadgeTextMobile,
              ]}
            >
              {mappedPins.length}{" "}
              {isMobile
                ? "Active"
                : mappedPins.length === 1
                  ? "Active Pin"
                  : "Active Pins"}
            </Text>
          </View>
        </View>

        {/* SEARCH & FILTERS BAR */}
        <View
          style={[styles.controlsRow, isMobile && styles.controlsRowMobile]}
        >
          <View style={[styles.searchBox, isMobile && styles.searchBoxMobile]}>
            <Ionicons name="search" size={18} color="#78847C" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                isMobile
                  ? "Search reports..."
                  : "Search reports by title, resident, or barangay..."
              }
              placeholderTextColor="#8A9A8F"
              value={search}
              onChangeText={setSearch}
            />
            {!!search && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* STATUS TABS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.filterTabs,
              isMobile && styles.filterTabsMobile,
            ]}
            style={isMobile ? { width: "100%" } : undefined}
          >
            <TouchableOpacity
              style={[
                styles.tabBtn,
                isMobile && styles.tabBtnMobile,
                activeFilter === "all" && styles.tabBtnActive,
              ]}
              onPress={() => setActiveFilter("all")}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  isMobile && styles.tabBtnTextMobile,
                  activeFilter === "all" && styles.tabBtnTextActive,
                ]}
              >
                All ({statusCounts.all})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                isMobile && styles.tabBtnMobile,
                activeFilter === "critical" && [
                  styles.tabBtnActive,
                  { backgroundColor: "#FF5B5B" },
                ],
              ]}
              onPress={() => setActiveFilter("critical")}
            >
              <View
                style={[styles.statusDot, { backgroundColor: "#FF5B5B" }]}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  isMobile && styles.tabBtnTextMobile,
                  activeFilter === "critical" && styles.tabBtnTextActive,
                ]}
              >
                Critical ({statusCounts.critical})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                isMobile && styles.tabBtnMobile,
                activeFilter === "moderate" && [
                  styles.tabBtnActive,
                  { backgroundColor: "#ff8c40" },
                ],
              ]}
              onPress={() => setActiveFilter("moderate")}
            >
              <View
                style={[styles.statusDot, { backgroundColor: "#ff8c40" }]}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  isMobile && styles.tabBtnTextMobile,
                  activeFilter === "moderate" && styles.tabBtnTextActive,
                ]}
              >
                Moderate ({statusCounts.moderate})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                isMobile && styles.tabBtnMobile,
                activeFilter === "ongoing" && [
                  styles.tabBtnActive,
                  { backgroundColor: "#FFC940" },
                ],
              ]}
              onPress={() => setActiveFilter("ongoing")}
            >
              <View
                style={[styles.statusDot, { backgroundColor: "#FFC940" }]}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  isMobile && styles.tabBtnTextMobile,
                  activeFilter === "ongoing" && styles.tabBtnTextActive,
                ]}
              >
                On-going ({statusCounts.ongoing})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* MAP CONTAINER */}
      <View style={[styles.mapCard, isMobile && styles.mapCardMobile]}>
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#599A74" />
            <Text style={styles.loadingText}>Loading reports map...</Text>
          </View>
        ) : Platform.OS === "web" ? (
          <iframe
            key={`admin-map-${activeFilter}-${search}-${mappedPins.length}`}
            srcDoc={leafletHtml}
            style={styles.iframeMap}
            title="GreenTrace Admin Waste Map"
          />
        ) : (
          <View style={styles.centerLoading}>
            <Text style={styles.loadingText}>
              Interactive Map is available on Web.
            </Text>
          </View>
        )}

        {/* MAP LEGEND OVERLAY */}
        <View style={[styles.mapLegend, isMobile && styles.mapLegendMobile]}>
          <TouchableOpacity
            style={styles.legendHeaderBtn}
            onPress={() => setLegendOpen((prev) => !prev)}
            activeOpacity={0.8}
            disabled={!isMobile}
          >
            <View style={styles.legendHeaderLeft}>
              <Ionicons name="map-outline" size={13} color="#24352A" />
              <Text style={styles.legendTitle}>Map Legend</Text>
            </View>
            {isMobile && (
              <Ionicons
                name={legendOpen ? "chevron-down" : "chevron-up"}
                size={14}
                color="#52675A"
              />
            )}
          </TouchableOpacity>

          {(!isMobile || legendOpen) && (
            <View
              style={[styles.legendItems, isMobile && styles.legendItemsMobile]}
            >
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#FF5B5B" }]}
                />
                <Text style={styles.legendLabel}>Critical</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#ff8c40" }]}
                />
                <Text style={styles.legendLabel}>Moderate</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#FFC940" }]}
                />
                <Text style={styles.legendLabel}>On-going</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* SMALL MODAL: Who's report, Image, Points, & Redirect to PostDetail */}
      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setSelectedPost(null)}
          />

          <View style={[styles.modalBox, isMobile && styles.modalBoxMobile]}>
            {/* MODAL HEADER */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Report Details</Text>
              <TouchableOpacity
                style={styles.closeIconBtn}
                onPress={() => setSelectedPost(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
              style={isMobile ? { maxHeight: 420 } : undefined}
            >
              {/* REPORTER INFORMATION (WHO'S REPORT & POINTS) */}
              <View style={styles.reporterCard}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(selectedAuthorName)}
                  </Text>
                </View>

                <View style={styles.reporterMeta}>
                  <Text style={styles.reporterName} numberOfLines={1}>
                    {selectedAuthorName}
                  </Text>
                  <Text style={styles.reportedTime}>
                    Reported {formatPostedDate(selectedPost?.createdAt)}
                  </Text>
                </View>

                {/* POINTS BADGE */}
                <View style={styles.pointsBadge}>
                  <Ionicons name="ribbon-outline" size={15} color="#27734D" />
                  <Text style={styles.pointsBadgeText}>
                    {selectedAuthorPoints} pts
                  </Text>
                </View>
              </View>

              {/* REPORT IMAGE WITH OVERLAY BADGES */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleRedirectToPostDetail}
                style={[
                  styles.imageContainer,
                  isMobile && styles.imageContainerMobile,
                ]}
              >
                {selectedPost?.imageUrl ? (
                  <Image
                    source={{ uri: selectedPost.imageUrl }}
                    style={styles.reportImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noImagePlaceholder}>
                    <Ionicons name="image-outline" size={40} color="#999" />
                    <Text style={styles.noImageText}>No photo attached</Text>
                  </View>
                )}

                {/* STATUS BADGE OVERLAY */}
                <View
                  style={[
                    styles.imageStatusBadge,
                    { backgroundColor: selectedStatusMeta.color },
                  ]}
                >
                  <Text style={styles.imageStatusBadgeText}>
                    {selectedStatusMeta.label}
                  </Text>
                </View>

                {/* WASTE CLASSIFICATION BADGE */}
                {Boolean(
                  formatWasteLabel(selectedPost?.wasteClassification),
                ) && (
                  <View
                    style={[
                      styles.wasteBadgeOverlay,
                      {
                        backgroundColor: getWasteCategoryColor(
                          selectedPost?.wasteClassification?.category,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.wasteBadgeText}>
                      {formatWasteLabel(selectedPost?.wasteClassification)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* REPORT DETAILS */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleRedirectToPostDetail}
                style={styles.detailsBody}
              >
                <Text style={styles.reportTitle} numberOfLines={2}>
                  {selectedPost?.title || "Environmental Concern Report"}
                </Text>

                <View style={styles.locationRow}>
                  <Image
                    source={require("../../assets/images/location.png")}
                    style={{ width: 14, height: 14, marginRight: 6 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {formatLocationWithPurok(
                      selectedPost?.locationName,
                      selectedPost?.purok,
                    ) ||
                      selectedPost?.locationName ||
                      "Pinamungajan, Cebu"}
                  </Text>
                </View>

                {!!selectedPost?.caption && (
                  <Text style={styles.captionText} numberOfLines={2}>
                    {selectedPost.caption}
                  </Text>
                )}
              </TouchableOpacity>

              {/* ACTION BUTTONS */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.viewDetailBtn}
                  onPress={handleRedirectToPostDetail}
                >
                  <Text style={styles.viewDetailBtnText}>
                    View Post Details
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setSelectedPost(null)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  header: {
    marginBottom: 14,
  },

  headerMobile: {
    marginBottom: 10,
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },

  titleTextCol: {
    flexShrink: 1,
  },

  hamburgerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#24352A",
  },

  pageTitleMobile: {
    fontSize: 18,
  },

  pageSubtitle: {
    fontSize: 13,
    color: "#6B7C72",
    marginTop: 2,
  },

  summaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF4EE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },

  summaryBadgeMobile: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },

  summaryBadgeText: {
    color: "#3B7A54",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryBadgeTextMobile: {
    fontSize: 11,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },

  controlsRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },

  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    gap: 8,
  },

  searchBoxMobile: {
    minWidth: "100%",
    width: "100%",
    height: 38,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: "#24352A",
    outlineStyle: "none",
  },

  filterTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  filterTabsMobile: {
    paddingVertical: 2,
  },

  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    gap: 6,
  },

  tabBtnMobile: {
    height: 36,
    paddingHorizontal: 10,
    gap: 5,
  },

  tabBtnActive: {
    backgroundColor: "#599A74",
    borderColor: "transparent",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#52675A",
  },

  tabBtnTextMobile: {
    fontSize: 11,
  },

  tabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  mapCard: {
    flex: 1,
    minHeight: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    overflow: "hidden",
    position: "relative",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
  },

  mapCardMobile: {
    minHeight: 340,
    borderRadius: 10,
  },

  iframeMap: {
    width: "100%",
    height: "100%",
    border: "none",
  },

  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  loadingText: {
    color: "#52675A",
    fontSize: 14,
    marginTop: 10,
    fontWeight: "600",
  },

  mapLegend: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    zIndex: 1000,
  },

  mapLegendMobile: {
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  legendHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  legendHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  legendTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#24352A",
    textTransform: "uppercase",
  },

  legendItems: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },

  legendItemsMobile: {
    gap: 8,
    flexWrap: "wrap",
    marginTop: 6,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  legendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#52675A",
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  modalBackdropTouch: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  modalBox: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
    zIndex: 100,
  },

  modalBoxMobile: {
    maxWidth: "94%",
    padding: 14,
    borderRadius: 12,
    maxHeight: "88%",
  },

  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#24352A",
  },

  closeIconBtn: {
    padding: 4,
    borderRadius: 6,
  },

  reporterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAF8",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EFEA",
  },

  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#599A74",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  reporterMeta: {
    flex: 1,
  },

  reporterName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#24352A",
  },

  reportedTime: {
    fontSize: 11,
    color: "#788C80",
    marginTop: 1,
  },

  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2F2E7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },

  pointsBadgeText: {
    color: "#27734D",
    fontSize: 12,
    fontWeight: "700",
  },

  imageContainer: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F2F4F3",
    marginBottom: 12,
  },

  imageContainerMobile: {
    height: 140,
    marginBottom: 10,
  },

  reportImage: {
    width: "100%",
    height: "100%",
  },

  noImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F3F1",
  },

  noImageText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },

  imageStatusBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  },

  imageStatusBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  wasteBadgeOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  },

  wasteBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  detailsBody: {
    marginBottom: 14,
  },

  reportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#24352A",
    lineHeight: 20,
    marginBottom: 6,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },

  locationText: {
    fontSize: 12,
    color: "#52675A",
    fontWeight: "500",
    flex: 1,
  },

  captionText: {
    fontSize: 12,
    color: "#6B7C72",
    lineHeight: 16,
  },

  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  viewDetailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#599A74",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },

  viewDetailBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D4DDD6",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: "#52675A",
    fontSize: 13,
    fontWeight: "600",
  },
});
