import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { formatLocationWithPurok } from "../constants/locationFormat";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../constants/wasteCategories";

// Pinamungajan barangay coordinates fallback
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

const STATUS_DETAILS = {
  critical: { label: "Critical", color: "#FF5B5B", badgeBg: "#FFEBEB" },
  moderate: { label: "Moderate", color: "#ff8c40", badgeBg: "#FFF3E8" },
  ongoing: { label: "On-going", color: "#FFC940", badgeBg: "#FFF9E6" },
  cleaned: { label: "Cleaned", color: "#34C759", badgeBg: "#EAF9EE" },
  pending: { label: "Pending", color: "#A5A5A5", badgeBg: "#F0F0F0" },
};

const LOCATION_ICON_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAAAQBJREFUeAGFU7sNwkAMfQkwAIxBhmAF6GACWACJmgaxA+PQJlJoESWioeBTUPAJNvgO5+4SLD1d5M/zs+8ClK0p54iwJbwID8KOMHRyPDOBsxQyCoEhukhOyy2O5OSEuyoqnG+OnQLNPwQT6VLImRO6hISQqRiTjVVTawclPRVfLIAQmvgxpKJQSJwOkfj0SLaDJgh9A75cTz5ElpG4gT9CpuJ7BBhnKG87Fdm8yBy/23kSpkZFpAi4k9l0pE4Icax8doSGo4ITem6SQzQnrOHvySZdlVwN9t3wx/g5t1H9EjuO6qBxQj9QPEDNjxQaZ4HvxplgiYq7ryNgWwm0r2RvqGhfQgsI7XsAAAAASUVORK5CYII=";

export default function PostLocationModal({ post, visible, onClose }) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 480;

  // Resolve coordinates for this single post
  const postCoords = useMemo(() => {
    if (!post) return { lat: 10.2705, lng: 123.5855 };

    if (post.coordinates?.latitude && post.coordinates?.longitude) {
      return {
        lat: Number(post.coordinates.latitude),
        lng: Number(post.coordinates.longitude),
      };
    }
    if (post.latitude && post.longitude) {
      return {
        lat: Number(post.latitude),
        lng: Number(post.longitude),
      };
    }

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

    const base = BARANGAY_COORDINATES[bKey] || BARANGAY_COORDINATES.poblacion;
    let hash = 0;
    for (let i = 0; i < (post.id || "").length; i++) {
      hash = (hash * 31 + post.id.charCodeAt(i)) % 1000;
    }
    const jitterLat = ((hash % 20) - 10) * 0.0004;
    const jitterLng = ((((hash / 20) | 0) % 20) - 10) * 0.0004;
    return {
      lat: base.lat + jitterLat,
      lng: base.lng + jitterLng,
    };
  }, [post]);

  const rawStatus = (post?.status || "moderate").toLowerCase();
  const statusKey =
    rawStatus === "on-going"
      ? "ongoing"
      : STATUS_DETAILS[rawStatus]
        ? rawStatus
        : "moderate";
  const statusMeta = STATUS_DETAILS[statusKey] || STATUS_DETAILS.moderate;

  const displayLocation = post
    ? formatLocationWithPurok(post.locationName, post.purok) ||
      post.locationName ||
      "Pinamungajan, Cebu"
    : "";

  const authorName = post
    ? [post.firstName, post.lastName].filter(Boolean).join(" ") ||
      post.userName ||
      "Resident Reporter"
    : "";

  // Generate Leaflet HTML showing ONLY THIS SINGLE PIN
  const leafletHtml = useMemo(() => {
    if (!post) return "";

    const sanitize = (str) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const pin = {
      lat: postCoords.lat,
      lng: postCoords.lng,
      title: sanitize(post.title || "Waste Report"),
      imageUrl: post.imageUrl || "",
      status: statusKey,
      statusLabel: statusMeta.label,
      statusColor: statusMeta.color,
      locationName: sanitize(displayLocation),
      authorName: sanitize(authorName),
      points: post.points ?? 0,
    };

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
      transform: scale(1.15);
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

    .leaflet-popup-content-wrapper {
      background: rgba(36, 53, 42, 0.96);
      color: #fff;
      border-radius: 8px;
      padding: 0;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
    }

    .leaflet-popup-content {
      margin: 10px 12px;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .leaflet-popup-tip {
      background: rgba(36, 53, 42, 0.96);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${pin.lat};
    var lng = ${pin.lng};

    var map = L.map('map', {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    var icon = L.divIcon({
      className: 'custom-pin-container',
      html: \`
        <div class="pin-wrapper">
          \${'${pin.status}' === 'critical' ? '<div class="pin-pulse"></div>' : ''}
          <div class="pin-bubble" style="border-color: ${pin.statusColor};">
            <img src="${pin.imageUrl || "https://via.placeholder.com/60?text=Waste"}" onerror="this.src='https://via.placeholder.com/60?text=Waste'" alt="Waste Photo" />
          </div>
          <div class="pin-arrow" style="border-top-color: ${pin.statusColor};"></div>
        </div>
      \`,
      iconSize: [48, 56],
      iconAnchor: [24, 54],
      popupAnchor: [0, -50]
    });

    var marker = L.marker([lat, lng], { icon: icon }).addTo(map);

    marker.bindPopup(\`
      <div style="font-size: 11px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="background: ${pin.statusColor}; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase;">${pin.statusLabel}</span>
          <span style="color: #A3E635; font-weight: 600;">🪙 ${pin.points} pts</span>
        </div>
        <div style="font-weight: 700; font-size: 13px; color: #fff; margin-bottom: 3px;">${pin.title}</div>
        <div style="display: flex; align-items: center; gap: 5px; color: #E2E8E4; font-size: 11px; margin-top: 2px;">
          <img src="${LOCATION_ICON_BASE64}" style="width: 12px; height: 12px; object-fit: contain; filter: brightness(0) invert(1);" alt="" />
          <span>${pin.locationName}</span>
        </div>
        <div style="color: #CBD5E1; font-size: 10px; margin-top: 3px;">By ${pin.authorName}</div>
      </div>
    \`);

    // Auto open popup for this single post pin
    marker.openPopup();
  </script>
</body>
</html>
    `;
  }, [post, postCoords, statusKey, statusMeta, displayLocation, authorName]);

  if (!visible || !post) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.modalBox, isSmallScreen && styles.modalBoxSmall]}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.locationIconBadge}>
                <Ionicons name="location" size={18} color="#2E7D32" />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.headerSubtitle}>Pinned Location</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {displayLocation}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* MAP DISPLAY (SHOWING ONLY THIS POST'S PIN) */}
          <View style={styles.mapCard}>
            {Platform.OS === "web" ? (
              <iframe
                key={`post-loc-map-${post.id}-${postCoords.lat}-${postCoords.lng}`}
                srcDoc={leafletHtml}
                style={styles.iframe}
                title="GreenTrace Post Location"
              />
            ) : (
              <View style={styles.nativeFallback}>
                <Ionicons name="map-outline" size={40} color="#599A74" />
                <Text style={styles.nativeFallbackText}>
                  Interactive map is ready on Web.
                </Text>
              </View>
            )}
          </View>

          {/* POST SUMMARY CHIP */}
          <View style={styles.postMetaRow}>
            <View style={styles.postMetaLeft}>
              <Text style={styles.postTitle} numberOfLines={1}>
                {post.title || "Waste Report"}
              </Text>
              <Text style={styles.reportedByText} numberOfLines={1}>
                Reported by{" "}
                <Text style={{ fontWeight: "700" }}>{authorName}</Text>
              </Text>
            </View>

            <View style={styles.badgesRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusMeta.color },
                ]}
              >
                <Text style={styles.statusBadgeText}>{statusMeta.label}</Text>
              </View>

              {Boolean(formatWasteLabel(post.wasteClassification)) && (
                <View
                  style={[
                    styles.wasteBadge,
                    {
                      backgroundColor: getWasteCategoryColor(
                        post.wasteClassification?.category,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.wasteBadgeText}>
                    {formatWasteLabel(post.wasteClassification)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* FOOTER ACTIONS */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },

  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  modalBox: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 10px 32px rgba(0, 0, 0, 0.22)",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    zIndex: 10000,
  },

  modalBoxSmall: {
    maxWidth: "96%",
    padding: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },

  locationIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EAF5EE",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTextCol: {
    flex: 1,
  },

  headerSubtitle: {
    fontSize: 11,
    color: "#6B7C72",
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#24352A",
    marginTop: 1,
  },

  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F2F5F3",
  },

  mapCard: {
    width: "100%",
    height: 270,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCE5E0",
    backgroundColor: "#EEF2F0",
    position: "relative",
  },

  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
  },

  nativeFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  nativeFallbackText: {
    fontSize: 13,
    color: "#52675A",
    marginVertical: 10,
    textAlign: "center",
  },

  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAF9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAEFEA",
    gap: 8,
  },

  postMetaLeft: {
    flex: 1,
  },

  postTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#24352A",
  },

  reportedByText: {
    fontSize: 11,
    color: "#6B7C72",
    marginTop: 2,
  },

  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  wasteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  wasteBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 14,
  },

  doneBtn: {
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#D4E8DC",
    alignItems: "center",
    justifyContent: "center",
  },

  doneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D32",
  },
});
