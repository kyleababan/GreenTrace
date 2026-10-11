import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import PostLocationModal from "../../components/PostLocationModal";
import {
  formatLocationWithPurok,
  normalizePurok,
} from "../../constants/locationFormat";
import {
  formatWasteLabel,
  getWasteCategoryColor,
} from "../../constants/wasteCategories";
import { db } from "../../firebaseConfig";
import { deleteRelatedDocuments } from "../../utils/deletePostHelper";
import { notifyPostModerated } from "../../utils/notificationHelpers";
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

  // Batch Selection & Report Management States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [batchTab, setBatchTab] = useState("all"); // 'all' | 'duplicates' | 'selected'
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState(
    "Duplicate report in same vicinity",
  );
  const [notifyUsersOnDelete, setNotifyUsersOnDelete] = useState(true);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const handleSaveReportLocation = async ({
    locationName,
    street,
    purok,
    barangay,
    municipality,
    coordinates,
  }) => {
    if (!selectedPost?.id) return;
    try {
      const postRef = doc(db, "posts", selectedPost.id);
      const updates = {
        locationName,
        street: street || null,
        purok: normalizePurok(purok) || null,
        barangay: barangay || null,
        municipality: municipality || "Pinamungajan",
      };
      if (coordinates) {
        updates.coordinates = coordinates;
      }
      await updateDoc(postRef, updates);

      setSelectedPost((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
            }
          : null,
      );
      setShowLocationModal(false);
      Alert.alert("Success", "Report location updated successfully.");
    } catch (err) {
      console.error("Error updating report location:", err);
      Alert.alert("Error", "Could not update location. Please try again.");
    }
  };

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
            formatLocationWithPurok(post) ||
            post.locationName ||
            "Pinamungajan, Cebu",
          authorName,
          authorPoints,
          isDuplicate: Boolean(
            post.isDuplicate || post.isPointEligible === false,
          ),
          isPointEligible: post.isPointEligible !== false,
          linkedReportId: post.linkedReportId || null,
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

  // Flagged duplicate pins
  const duplicatePins = useMemo(() => {
    return mappedPins.filter((pin) => pin.isDuplicate || !pin.isPointEligible);
  }, [mappedPins]);

  // Filtered pins for the batch modal
  const batchListPins = useMemo(() => {
    if (batchTab === "duplicates") {
      return duplicatePins;
    }
    if (batchTab === "selected") {
      return mappedPins.filter((pin) => selectedPostIds.includes(pin.id));
    }
    return mappedPins;
  }, [mappedPins, duplicatePins, batchTab, selectedPostIds]);

  const toggleSelectPost = (postId) => {
    setSelectedPostIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId],
    );
  };

  const selectAllDuplicates = () => {
    const dupIds = duplicatePins.map((p) => p.id);
    setSelectedPostIds((prev) => Array.from(new Set([...prev, ...dupIds])));
  };

  const selectAllCurrentBatch = () => {
    const ids = batchListPins.map((p) => p.id);
    setSelectedPostIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => {
    setSelectedPostIds([]);
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedPostIds.length === 0 || deletingBatch) return;

    setDeletingBatch(true);
    try {
      const reasonToUse =
        deleteReason.trim() || "Duplicate report removed by LGU administrator";
      const postsToDelete = posts.filter((p) => selectedPostIds.includes(p.id));

      for (const p of postsToDelete) {
        if (notifyUsersOnDelete && p.userId) {
          try {
            await notifyPostModerated({
              post: p,
              postId: p.id,
              reason: reasonToUse,
            });
          } catch (notifErr) {
            console.warn("Could not notify user for post deletion:", notifErr);
          }
        }
        await deleteRelatedDocuments(p.id);
      }

      const count = selectedPostIds.length;
      setSelectedPostIds([]);
      setShowDeleteReasonModal(false);
      setShowBatchModal(false);
      Alert.alert(
        "Reports Deleted",
        `Successfully deleted ${count} report(s) and notified affected residents.`,
      );
    } catch (err) {
      console.error("Batch delete error:", err);
      Alert.alert(
        "Error",
        "Could not delete reports: " + (err.message || "Please try again."),
      );
    } finally {
      setDeletingBatch(false);
    }
  };

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
            \${!p.isPointEligible ? '<span style="background: #EF4444; color: #fff; padding: 2px 5px; border-radius: 4px; font-weight: 700; font-size: 8px;">DUPLICATE (0 PTS)</span>' : ''}
            \${p.linkedReportId ? '<span style="background: #0284C7; color: #fff; padding: 2px 5px; border-radius: 4px; font-weight: 700; font-size: 8px;">LINKED SITE</span>' : ''}
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

          <View style={styles.titleRightActions}>
            <TouchableOpacity
              style={[
                styles.batchListBtn,
                duplicatePins.length > 0 && styles.batchListBtnHasDuplicates,
                isMobile && styles.batchListBtnMobile,
              ]}
              onPress={() => setShowBatchModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="albums-outline"
                size={isMobile ? 14 : 16}
                color={duplicatePins.length > 0 ? "#DC2626" : "#2E6944"}
              />
              <Text
                style={[
                  styles.batchListBtnText,
                  duplicatePins.length > 0 &&
                    styles.batchListBtnTextHasDuplicates,
                  isMobile && styles.batchListBtnTextMobile,
                ]}
              >
                {duplicatePins.length > 0
                  ? `Batch (${duplicatePins.length} Duplicates)`
                  : "Batch List"}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.summaryBadge,
                isMobile && styles.summaryBadgeMobile,
              ]}
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
        </View>

        {/* SEARCH & FILTERS BAR */}
        <View
          style={[styles.controlsRow, isMobile && styles.controlsRowMobile]}
        >
          <View style={[styles.searchBox, isMobile && styles.searchBoxMobile]}>
            <Ionicons name="search" size={isMobile ? 20 : 18} color="#78847C" />
            <TextInput
              style={[styles.searchInput, isMobile && styles.searchInputMobile]}
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

                {selectedPost?.isPointEligible === false && (
                  <View
                    style={[
                      styles.wasteBadgeOverlay,
                      {
                        top: 40,
                        backgroundColor: "#DC2626",
                      },
                    ]}
                  >
                    <Text style={styles.wasteBadgeText}>
                      ⚠️ Duplicate (0 Pts)
                    </Text>
                  </View>
                )}

                {Boolean(selectedPost?.linkedReportId) && (
                  <View
                    style={[
                      styles.wasteBadgeOverlay,
                      {
                        top: selectedPost?.isPointEligible === false ? 70 : 40,
                        backgroundColor: "#0284C7",
                      },
                    ]}
                  >
                    <Text style={styles.wasteBadgeText}>🔗 Linked Site</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* REPORT DETAILS */}
              <View style={styles.detailsBody}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleRedirectToPostDetail}
                >
                  <Text style={styles.reportTitle} numberOfLines={2}>
                    {selectedPost?.title || "Environmental Concern Report"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.locationRowClickable}
                  onPress={() => setShowLocationModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.locationRowLeft}>
                    <Image
                      source={require("../../assets/images/location.png")}
                      style={{ width: 14, height: 14, marginRight: 6 }}
                      resizeMode="contain"
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {formatLocationWithPurok(selectedPost) ||
                        selectedPost?.locationName ||
                        "Pinamungajan, Cebu"}
                    </Text>
                  </View>
                  <View style={styles.locationAdjustBadge}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color="#276344"
                    />
                    <Text style={styles.locationAdjustBadgeText}>Adjust</Text>
                  </View>
                </TouchableOpacity>

                {!!selectedPost?.caption && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleRedirectToPostDetail}
                  >
                    <Text style={styles.captionText} numberOfLines={2}>
                      {selectedPost.caption}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ACTION BUTTONS */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.adjustLocationBtn}
                  onPress={() => setShowLocationModal(true)}
                >
                  <Ionicons name="map-outline" size={16} color="#276344" />
                  <Text style={styles.adjustLocationBtnText}>
                    Set / Adjust Location
                  </Text>
                </TouchableOpacity>

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

      {/* BATCH REPORT MANAGEMENT MODAL */}
      <Modal
        visible={showBatchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBatchModal(false)}
      >
        <View style={styles.batchOverlay}>
          <View
            style={[
              styles.batchModalCard,
              isMobile && styles.batchModalCardMobile,
            ]}
          >
            {/* MODAL HEADER */}
            <View style={styles.batchHeaderRow}>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons name="albums" size={22} color="#276344" />
                  <Text style={styles.batchTitle}>Batch Report Management</Text>
                </View>
                <Text style={styles.batchSubtitle}>
                  Multi-select duplicate or active reports to batch delete with
                  user notices.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.batchCloseBtn}
                onPress={() => setShowBatchModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#4A5568" />
              </TouchableOpacity>
            </View>

            {/* TABS & QUICK SELECTION BAR */}
            <View style={styles.batchControlsBar}>
              <View style={styles.batchTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.batchTabBtn,
                    batchTab === "all" && styles.batchTabBtnActive,
                  ]}
                  onPress={() => setBatchTab("all")}
                >
                  <Text
                    style={[
                      styles.batchTabBtnText,
                      batchTab === "all" && styles.batchTabBtnTextActive,
                    ]}
                  >
                    All ({mappedPins.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.batchTabBtn,
                    batchTab === "duplicates" && styles.batchTabBtnActive,
                    duplicatePins.length > 0 && { borderColor: "#FCA5A5" },
                  ]}
                  onPress={() => setBatchTab("duplicates")}
                >
                  <Text
                    style={[
                      styles.batchTabBtnText,
                      batchTab === "duplicates" && styles.batchTabBtnTextActive,
                      duplicatePins.length > 0 && {
                        color: batchTab === "duplicates" ? "#fff" : "#DC2626",
                      },
                    ]}
                  >
                    Duplicates ({duplicatePins.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.batchTabBtn,
                    batchTab === "selected" && styles.batchTabBtnActive,
                  ]}
                  onPress={() => setBatchTab("selected")}
                >
                  <Text
                    style={[
                      styles.batchTabBtnText,
                      batchTab === "selected" && styles.batchTabBtnTextActive,
                    ]}
                  >
                    Selected ({selectedPostIds.length})
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.batchQuickActionsRow}>
                {duplicatePins.length > 0 && (
                  <TouchableOpacity
                    style={styles.batchQuickBtnDuplicate}
                    onPress={selectAllDuplicates}
                  >
                    <Ionicons name="flash" size={14} color="#B91C1C" />
                    <Text style={styles.batchQuickBtnDuplicateText}>
                      Select All Duplicates
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.batchQuickBtn}
                  onPress={selectAllCurrentBatch}
                >
                  <Text style={styles.batchQuickBtnText}>
                    Select All Filtered
                  </Text>
                </TouchableOpacity>

                {selectedPostIds.length > 0 && (
                  <TouchableOpacity
                    style={styles.batchQuickBtn}
                    onPress={clearSelection}
                  >
                    <Text style={styles.batchQuickBtnText}>
                      Clear ({selectedPostIds.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* SCROLLABLE REPORTS LIST */}
            <ScrollView
              style={styles.batchListScroll}
              contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
            >
              {batchListPins.length === 0 ? (
                <View style={styles.batchEmptyBox}>
                  <Ionicons
                    name="document-text-outline"
                    size={36}
                    color="#A0AEC0"
                  />
                  <Text style={styles.batchEmptyText}>
                    {batchTab === "duplicates"
                      ? "No duplicate reports detected in current view."
                      : batchTab === "selected"
                        ? "No reports selected yet."
                        : "No reports found."}
                  </Text>
                </View>
              ) : (
                batchListPins.map((pin) => {
                  const isSelected = selectedPostIds.includes(pin.id);
                  const isDup = pin.isDuplicate || !pin.isPointEligible;

                  return (
                    <TouchableOpacity
                      key={pin.id}
                      style={[
                        styles.batchItemCard,
                        isSelected && styles.batchItemCardSelected,
                        isDup && !isSelected && styles.batchItemCardDuplicate,
                      ]}
                      onPress={() => toggleSelectPost(pin.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? "#2E6944" : "#A0AEC0"}
                        style={{ marginRight: 10 }}
                      />

                      {pin.imageUrl ? (
                        <Image
                          source={{ uri: pin.imageUrl }}
                          style={styles.batchItemThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.batchItemThumbPlaceholder}>
                          <Ionicons
                            name="image-outline"
                            size={18}
                            color="#999"
                          />
                        </View>
                      )}

                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <Text style={styles.batchItemTitle} numberOfLines={1}>
                          {pin.title}
                        </Text>
                        <Text
                          style={styles.batchItemLocation}
                          numberOfLines={1}
                        >
                          📍 {pin.locationName}
                        </Text>
                        <Text style={styles.batchItemAuthor} numberOfLines={1}>
                          By {pin.authorName}
                        </Text>
                      </View>

                      <View style={styles.batchItemBadgesCol}>
                        {isDup ? (
                          <View style={styles.batchBadgeDuplicate}>
                            <Text style={styles.batchBadgeDuplicateText}>
                              DUPLICATE (0 PTS)
                            </Text>
                          </View>
                        ) : pin.linkedReportId ? (
                          <View style={styles.batchBadgeLinked}>
                            <Text style={styles.batchBadgeLinkedText}>
                              LINKED SITE
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.batchBadgeOriginal}>
                            <Text style={styles.batchBadgeOriginalText}>
                              ORIGINAL
                            </Text>
                          </View>
                        )}

                        <View
                          style={[
                            styles.batchBadgeStatus,
                            { backgroundColor: pin.statusColor },
                          ]}
                        >
                          <Text style={styles.batchBadgeStatusText}>
                            {pin.statusLabel}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* BOTTOM STICKY ACTION BAR */}
            <View style={styles.batchBottomActionBar}>
              <Text style={styles.batchSelectedCountText}>
                {selectedPostIds.length}{" "}
                {selectedPostIds.length === 1 ? "report" : "reports"} selected
              </Text>

              <TouchableOpacity
                style={[
                  styles.batchDeleteBtn,
                  selectedPostIds.length === 0 && styles.batchDeleteBtnDisabled,
                ]}
                disabled={selectedPostIds.length === 0}
                onPress={() => setShowDeleteReasonModal(true)}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <Text style={styles.batchDeleteBtnText}>
                  Delete Selected ({selectedPostIds.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* BATCH DELETE REASON & NOTICE MODAL */}
      <Modal
        visible={showDeleteReasonModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingBatch) setShowDeleteReasonModal(false);
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteConfirmCard} accessibilityRole="alert">
            <View style={styles.deleteConfirmIconWrapper}>
              <Ionicons name="trash-outline" size={28} color="#DC2626" />
            </View>
            <Text style={styles.deleteConfirmTitle}>
              Delete {selectedPostIds.length} Report(s)?
            </Text>
            <Text style={styles.deleteConfirmMessage}>
              This will permanently delete the selected reports. Affected
              resident users will receive an official notification notice
              explaining the deletion.
            </Text>

            {/* QUICK PRESET REASONS */}
            <View style={styles.presetReasonsContainer}>
              <Text style={styles.presetLabel}>
                Select or customize reason:
              </Text>
              <View style={styles.presetChipsRow}>
                {[
                  "Duplicate report in same vicinity",
                  "Already cleaned / resolved",
                  "Inaccurate location / false report",
                  "Spam or invalid content",
                ].map((reasonOption) => (
                  <TouchableOpacity
                    key={reasonOption}
                    style={[
                      styles.presetChip,
                      deleteReason === reasonOption && styles.presetChipActive,
                    ]}
                    onPress={() => setDeleteReason(reasonOption)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        deleteReason === reasonOption &&
                          styles.presetChipTextActive,
                      ]}
                    >
                      {reasonOption}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.deleteReasonInput}
              placeholder="Reason for deletion..."
              placeholderTextColor="#8FA396"
              value={deleteReason}
              onChangeText={setDeleteReason}
              multiline
              numberOfLines={2}
            />

            {/* NOTIFY USERS TOGGLE */}
            <TouchableOpacity
              style={styles.notifyToggleRow}
              onPress={() => setNotifyUsersOnDelete((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={notifyUsersOnDelete ? "checkbox" : "square-outline"}
                size={20}
                color={notifyUsersOnDelete ? "#276344" : "#999"}
              />
              <Text style={styles.notifyToggleText}>
                Send notification notice to affected users in app
              </Text>
            </TouchableOpacity>

            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setShowDeleteReasonModal(false)}
                disabled={deletingBatch}
              >
                <Text style={styles.deleteCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deleteSubmitBtn,
                  deletingBatch && styles.disabledBtn,
                ]}
                onPress={handleConfirmBatchDelete}
                disabled={deletingBatch}
              >
                {deletingBatch ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.deleteSubmitBtnText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.deleteSubmitBtnText}>Confirm Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POST LOCATION MODAL FOR ADMIN TO SET / ADJUST REPORT LOCATION */}
      <PostLocationModal
        key={
          showLocationModal
            ? `admin-loc-${selectedPost?.id}-open`
            : "admin-loc-closed"
        }
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        initialLocation={selectedPost?.locationName}
        initialCoords={selectedPost?.coordinates}
        post={selectedPost}
        onSelectLocation={handleSaveReportLocation}
      />
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
    gap: 10,
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
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: "100%",
    width: "100%",
    height: 46,
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 14,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: "#24352A",
    paddingVertical: 0,
    outlineStyle: "none",
  },

  searchInputMobile: {
    fontSize: 14,
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

  locationRowClickable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F8F5",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2ECE5",
    marginBottom: 8,
  },

  locationRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },

  locationAdjustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F4EC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },

  locationAdjustBadgeText: {
    color: "#276344",
    fontSize: 11,
    fontWeight: "700",
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
    flexWrap: "wrap",
    gap: 10,
  },

  adjustLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F4EC",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CDE3D4",
    gap: 6,
  },

  adjustLocationBtnText: {
    color: "#276344",
    fontSize: 13,
    fontWeight: "700",
  },

  viewDetailBtn: {
    flex: 1,
    minWidth: 140,
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

  /* BATCH MANAGEMENT STYLES */
  titleRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  batchListBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "#C2DFC9",
  },

  batchListBtnHasDuplicates: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },

  batchListBtnMobile: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },

  batchListBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E6944",
  },

  batchListBtnTextHasDuplicates: {
    color: "#DC2626",
  },

  batchListBtnTextMobile: {
    fontSize: 11,
  },

  batchOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  batchModalCard: {
    width: "100%",
    maxWidth: 680,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    display: "flex",
    flexDirection: "column",
  },

  batchModalCardMobile: {
    maxWidth: "98%",
    maxHeight: "94%",
    padding: 14,
  },

  batchHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  batchTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },

  batchSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  batchCloseBtn: {
    padding: 4,
  },

  batchControlsBar: {
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  batchTabsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },

  batchTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  batchTabBtnActive: {
    backgroundColor: "#2E6944",
    borderColor: "#2E6944",
  },

  batchTabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },

  batchTabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  batchQuickActionsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  batchQuickBtnDuplicate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  batchQuickBtnDuplicateText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B91C1C",
  },

  batchQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },

  batchQuickBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },

  batchListScroll: {
    flex: 1,
    marginVertical: 8,
  },

  batchEmptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },

  batchEmptyText: {
    fontSize: 13,
    color: "#9CA3AF",
  },

  batchItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  batchItemCardSelected: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },

  batchItemCardDuplicate: {
    backgroundColor: "#FFFBFB",
    borderColor: "#FED7D7",
  },

  batchItemThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
  },

  batchItemThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  batchItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },

  batchItemLocation: {
    fontSize: 11,
    color: "#4B5563",
  },

  batchItemAuthor: {
    fontSize: 10,
    color: "#9CA3AF",
  },

  batchItemBadgesCol: {
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 8,
  },

  batchBadgeDuplicate: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#FEE2E2",
  },

  batchBadgeDuplicateText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#DC2626",
  },

  batchBadgeLinked: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#E0F2FE",
  },

  batchBadgeLinkedText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#0284C7",
  },

  batchBadgeOriginal: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#DCFCE7",
  },

  batchBadgeOriginalText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#16A34A",
  },

  batchBadgeStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  batchBadgeStatusText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  batchBottomActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  batchSelectedCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },

  batchDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  batchDeleteBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },

  batchDeleteBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  presetReasonsContainer: {
    width: "100%",
    marginTop: 12,
    marginBottom: 8,
  },

  presetLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 6,
  },

  presetChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  presetChipActive: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },

  presetChipText: {
    fontSize: 11,
    color: "#4B5563",
  },

  presetChipTextActive: {
    color: "#DC2626",
    fontWeight: "700",
  },

  deleteReasonInput: {
    width: "100%",
    minHeight: 60,
    padding: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    fontSize: 12,
    color: "#1F2937",
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },

  notifyToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    marginBottom: 16,
  },

  notifyToggleText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },

  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 99999,
  },

  deleteConfirmCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 100000,
  },

  deleteConfirmIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  deleteConfirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 6,
  },

  deleteConfirmMessage: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 14,
  },

  deleteConfirmActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 6,
  },

  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },

  deleteSubmitBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteSubmitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  disabledBtn: {
    opacity: 0.6,
  },
});
