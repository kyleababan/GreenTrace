import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  BARANGAY_COORDINATES,
  MUNICIPALITY_OR_PROVINCE_NAMES,
  PINAMUNGAJAN_BARANGAYS,
  findMatchingBarangay,
  findNearestBarangay,
  formatLocationWithPurok,
  formatPurokOrSitio,
  splitLocationDetails,
} from "../constants/locationFormat";
import {
  formatWasteLabel,
  getWasteCategoryColor,
} from "../constants/wasteCategories";

const STATUS_DETAILS = {
  critical: { label: "Critical", color: "#FF5B5B", badgeBg: "#FFEBEB" },
  moderate: { label: "Moderate", color: "#ff8c40", badgeBg: "#FFF3E8" },
  ongoing: { label: "On-going", color: "#FFC940", badgeBg: "#FFF9E6" },
  cleaned: { label: "Cleaned", color: "#34C759", badgeBg: "#EAF9EE" },
  pending: { label: "Pending", color: "#A5A5A5", badgeBg: "#F0F0F0" },
};

const LOCATION_ICON_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAAAQBJREFUeAGFU7sNwkAMfQkwAIxBhmAF6GACWACJmgaxA+PQJlJoESWioeBTUPAJNvgO5+4SLD1d5M/zs+8ClK0p54iwJbwID8KOMHRyPDOBsxQyCoEhukhOyy2O5OSEuyoqnG+OnQLNPwQT6VLImRO6hISQqRiTjVVTawclPRVfLIAQmvgxpKJQSJwOkfj0SLaDJgh9A75cTz5ElpG4gT9CpuJ7BBhnKG87Fdm8yBy/23kSpkZFpAi4k9l0pE4Icax8doSGo4ITem6SQzQnrOHvySZdlVwN9t3wx/g5t1H9EjuO6qBxQj9QPEDNjxQaZ4HvxplgiYq7ryNgWwm0r2RvqGhfQgsI7XsAAAAASUVORK5CYII=";

export default function PostLocationModal({
  post,
  visible,
  onClose,
  initialLocation = "",
  initialCoords = null,
  onSelectLocation,
}) {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 480;
  const isTablet = width >= 600 && width < 1024;
  const isDesktop = width >= 1024;
  const isSelectingLocation = typeof onSelectLocation === "function";
  const initialAddress = useMemo(() => {
    const loc =
      initialLocation ||
      (post
        ? formatLocationWithPurok(post) || post.locationName || ""
        : "");
    const parsed = splitLocationDetails(
      loc,
      post?.purok,
      post?.barangay,
      post?.municipality || post?.city || post?.municipal,
    );
    return {
      street:
        parsed.street ||
        (typeof post?.street === "string" ? post.street : ""),
      purokOrSitio:
        parsed.purokOrSitio ||
        (typeof post?.purok === "string" ? formatPurokOrSitio(post.purok) : ""),
      barangay:
        parsed.barangay ||
        (typeof post?.barangay === "string" ? post.barangay : ""),
      municipality:
        parsed.municipality ||
        (typeof post?.municipality === "string"
          ? post.municipality
          : "Pinamungajan"),
    };
  }, [initialLocation, post]);

  const [selectionBarangay, setSelectionBarangay] = useState(
    initialAddress.barangay,
  );
  const [selectionPurok, setSelectionPurok] = useState(
    initialAddress.purokOrSitio,
  );
  const [selectionStreet, setSelectionStreet] = useState(
    initialAddress.street,
  );
  const [selectionMunicipality, setSelectionMunicipality] = useState(
    initialAddress.municipality,
  );
  const [barangayDropdownOpen, setBarangayDropdownOpen] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState(
    initialCoords ||
      (post?.coordinates?.latitude && post?.coordinates?.longitude
        ? {
            latitude: Number(post.coordinates.latitude),
            longitude: Number(post.coordinates.longitude),
          }
        : null),
  );
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [reverseGeocodeLoading, setReverseGeocodeLoading] = useState(false);
  const [selectionErrors, setSelectionErrors] = useState({});
  const [mapCenterCoords, setMapCenterCoords] = useState(
    initialCoords ||
      (post?.coordinates?.latitude && post?.coordinates?.longitude
        ? {
            latitude: Number(post.coordinates.latitude),
            longitude: Number(post.coordinates.longitude),
          }
        : { latitude: 10.2705, longitude: 123.5855 }),
  );
  const [mapSessionId, setMapSessionId] = useState(0);

  const [prevSyncKey, setPrevSyncKey] = useState(
    () => `${visible}_${initialLocation}_${post?.id}`,
  );
  const currentSyncKey = `${visible}_${initialLocation}_${post?.id}`;

  if (prevSyncKey !== currentSyncKey) {
    setPrevSyncKey(currentSyncKey);
    if (visible) {
      setSelectionBarangay(initialAddress.barangay);
      setSelectionPurok(initialAddress.purokOrSitio);
      setSelectionStreet(initialAddress.street);
      setSelectionMunicipality(initialAddress.municipality || "Pinamungajan");

      const resolvedCoords =
        initialCoords ||
        (post?.coordinates?.latitude && post?.coordinates?.longitude
          ? {
              latitude: Number(post.coordinates.latitude),
              longitude: Number(post.coordinates.longitude),
            }
          : null);

      if (resolvedCoords) {
        setSelectionCoords(resolvedCoords);
        setMapCenterCoords(resolvedCoords);
        setMapSessionId((id) => id + 1);
      }
      setSelectionErrors({});
      setBarangayDropdownOpen(false);
    }
  }

  const previewModalWidthStyle = useMemo(() => {
    if (isDesktop) {
      return {
        maxWidth: 780,
        padding: 22,
        borderRadius: 18,
      };
    }
    if (isTablet) {
      return {
        maxWidth: 620,
        padding: 18,
        borderRadius: 16,
      };
    }
    return {
      maxWidth: 440,
      padding: isSmallScreen ? 12 : 16,
      borderRadius: 16,
    };
  }, [isDesktop, isTablet, isSmallScreen]);

  const mapHeightStyle = useMemo(() => {
    if (isDesktop) {
      return { height: Math.min(460, Math.round(height * 0.52)) };
    }
    if (isTablet) {
      return { height: Math.min(380, Math.round(height * 0.46)) };
    }
    return { height: 260 };
  }, [isDesktop, isTablet, height]);

  const selectionMapCardHeightStyle = useMemo(() => {
    if (isDesktop) return { height: 320 };
    if (isTablet) return { height: 280 };
    return { height: 240 };
  }, [isDesktop, isTablet]);

  const selectionMapHtml = useMemo(
    () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${Number(mapCenterCoords.latitude)};
    var lng = ${Number(mapCenterCoords.longitude)};
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([lat, lng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    function notify(position) {
      window.parent.postMessage(JSON.stringify({
        type: 'MEETUP_GPS_PIN_MOVED',
        lat: position.lat,
        lng: position.lng
      }), '*');
    }
    marker.on('dragend', function() { notify(marker.getLatLng()); });
    map.on('click', function(event) {
      marker.setLatLng(event.latlng);
      notify(event.latlng);
    });
  </script>
</body>
</html>
    `,
    [mapCenterCoords],
  );

  const reverseGeocodeCoordinates = useCallback(
    async (latitude, longitude) => {
      try {
        setReverseGeocodeLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) {
          throw new Error(`Reverse geocoding failed (${response.status}).`);
        }
        const data = await response.json();
        const address = data?.address;

        const candidateBarangay =
          address?.suburb ||
          address?.village ||
          address?.quarter ||
          address?.neighbourhood ||
          address?.hamlet ||
          "";

        const matchedBarangay = findMatchingBarangay(candidateBarangay);
        // If OpenStreetMap does not detect a known Pinamungajan barangay,
        // use GPS distance to identify the nearest barangay automatically!
        const resolvedBarangay =
          matchedBarangay || findNearestBarangay(latitude, longitude);

        const rawStreet =
          address?.road ||
          address?.pedestrian ||
          address?.street ||
          address?.residential ||
          "";

        // Never assign municipality / province names like Pinamungajan to street!
        const cleanStreet =
          rawStreet &&
          !MUNICIPALITY_OR_PROVINCE_NAMES.has(
            rawStreet.toLowerCase().replace(/[^a-z]/g, ""),
          )
            ? rawStreet
            : "";

        const detectedMuni =
          address?.town ||
          address?.municipality ||
          address?.city ||
          "Pinamungajan";

        if (resolvedBarangay) setSelectionBarangay(resolvedBarangay);
        if (cleanStreet) setSelectionStreet(cleanStreet);
        if (detectedMuni) setSelectionMunicipality(detectedMuni);
        // Note: selectionPurok is kept blank if OpenStreetMap has no purok/sitio data!
      } catch (error) {
        console.warn("Unable to reverse geocode location:", error);
        // Fallback to nearest barangay by coordinates even if reverse geocode fails
        const nearest = findNearestBarangay(latitude, longitude);
        if (nearest) setSelectionBarangay(nearest);
      } finally {
        setReverseGeocodeLoading(false);
      }
    },
    [],
  );

  const filteredBarangays = useMemo(() => {
    if (!selectionBarangay) return PINAMUNGAJAN_BARANGAYS;
    const query = selectionBarangay.toLowerCase().trim();
    const matched = PINAMUNGAJAN_BARANGAYS.filter((b) =>
      b.toLowerCase().includes(query),
    );
    return matched.length > 0 ? matched : PINAMUNGAJAN_BARANGAYS;
  }, [selectionBarangay]);

  useEffect(() => {
    if (
      !visible ||
      !isSelectingLocation ||
      Platform.OS !== "web" ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    const handleMapMessage = (event) => {
      try {
        const payload =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const latitude = Number(payload?.lat);
        const longitude = Number(payload?.lng);
        if (
          payload?.type !== "MEETUP_GPS_PIN_MOVED" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return;
        }
        setSelectionCoords({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
        });
        reverseGeocodeCoordinates(
          Number(latitude.toFixed(6)),
          Number(longitude.toFixed(6)),
        );
      } catch {
        // Ignore unrelated messages sent to the window.
      }
    };

    window.addEventListener("message", handleMapMessage);
    return () => window.removeEventListener("message", handleMapMessage);
  }, [visible, isSelectingLocation, reverseGeocodeCoordinates]);

  const getCurrentLocation = useCallback(async () => {
    setLoadingLocation(true);

    try {
      let latitude;
      let longitude;

      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 10000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location permission required",
            "Allow GreenTrace to access your location to set the meetup GPS coordinates.",
          );
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const currentCoordinates = {
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
      };
      setSelectionCoords(currentCoordinates);
      setMapCenterCoords(currentCoordinates);
      setMapSessionId((currentId) => currentId + 1);
      await reverseGeocodeCoordinates(
        currentCoordinates.latitude,
        currentCoordinates.longitude,
      );
    } catch (error) {
      console.error("Unable to get current GPS location:", error);
      Alert.alert(
        "Unable to get location",
        error.message || "Check your location settings and try again.",
      );
    } finally {
      setLoadingLocation(false);
    }
  }, [reverseGeocodeCoordinates]);

  // Resolve coordinates for this single post
  const postCoords = useMemo(() => {
    if (!post) return { lat: 10.2705, lng: 123.5855, isExact: false };

    if (post.coordinates?.latitude && post.coordinates?.longitude) {
      return {
        lat: Number(post.coordinates.latitude),
        lng: Number(post.coordinates.longitude),
        isExact: true,
      };
    }
    if (post.latitude && post.longitude) {
      return {
        lat: Number(post.latitude),
        lng: Number(post.longitude),
        isExact: true,
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
      isExact: false,
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
    ? formatLocationWithPurok(post) ||
      post.meetingLocation ||
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
      isExact: postCoords.isExact,
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
      background: #FFFFFF;
      color: #1F2937;
      border-radius: 10px;
      padding: 0;
      box-shadow: 0 6px 20px rgba(0,0,0,0.18);
      border: 1px solid #E2E8E4;
    }

    .leaflet-popup-content {
      margin: 12px 14px 10px 14px;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .leaflet-container a.leaflet-popup-close-button {
      top: 6px;
      right: 8px;
      padding: 0;
      color: #9CA3AF;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
    }

    .leaflet-container a.leaflet-popup-close-button:hover {
      color: #374151;
    }

    .leaflet-popup-tip {
      background: #FFFFFF;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${pin.lat};
    var lng = ${pin.lng};

    var map = L.map('map', {
      center: [lat + 0.0006, lng],
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
      <div style="font-size: 11px; min-width: 165px; padding-top: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; padding-right: 18px;">
          <span style="background: ${pin.statusColor}; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase;">${pin.statusLabel}</span>
          <span style="color: #2E7D32; font-weight: 700; font-size: 10px; white-space: nowrap;">🪙 ${pin.points} pts</span>
        </div>
        <div style="font-weight: 700; font-size: 13px; color: #172119; margin-bottom: 3px;">${pin.title}</div>
        <div style="display: flex; align-items: center; gap: 4px; color: #4B5563; font-size: 11px; margin-bottom: 2px;">
          <img src="${LOCATION_ICON_BASE64}" style="width: 12px; height: 12px; object-fit: contain;" alt="" />
          <span>${pin.locationName}</span>
        </div>
        <div style="color: #2E7D32; font-size: 10px; font-weight: 600; margin-bottom: 2px;">
          GPS: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}
        </div>
        <div style="color: #6B7280; font-size: 10px;">By ${pin.authorName}</div>
      </div>
    \`, {
      autoPan: true,
      autoPanPadding: [15, 15]
    });

    // Auto open popup for this single post pin
    marker.openPopup();
  </script>
</body>
</html>
    `;
  }, [post, postCoords, statusKey, statusMeta, displayLocation, authorName]);

  if (!visible || (!isSelectingLocation && !post)) return null;

  if (isSelectingLocation) {
    const hasSelectionCoords =
      selectionCoords?.latitude !== null &&
      selectionCoords?.latitude !== undefined &&
      selectionCoords?.longitude !== null &&
      selectionCoords?.longitude !== undefined &&
      Number.isFinite(Number(selectionCoords.latitude)) &&
      Number.isFinite(Number(selectionCoords.longitude));

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
          <ScrollView
            style={[styles.gpsModalBox, isSmallScreen && styles.gpsModalBoxSmall]}
            contentContainerStyle={styles.gpsModalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.gpsModalTitle}>GPS Tracking</Text>

            <View style={[styles.selectionMapCard, selectionMapCardHeightStyle]}>
              {loadingLocation ? (
                <View style={styles.gpsLoadingCenter}>
                  <ActivityIndicator size="large" color="#5F9C76" />
                  <Text style={styles.gpsLoadingText}>
                    Acquiring GPS location...
                  </Text>
                </View>
              ) : Platform.OS === "web" ? (
                <iframe
                  key={`meetup-gps-map-${mapSessionId}`}
                  srcDoc={selectionMapHtml}
                  style={styles.iframe}
                  title="GPS Location Map"
                />
              ) : (
                <View style={styles.gpsLoadingCenter}>
                  <Text style={styles.gpsNativePin}>
                    Pin: {selectionCoords?.latitude ?? "--"},{" "}
                    {selectionCoords?.longitude ?? "--"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.gpsInstruction}>
              Drag the pin or tap on the map to adjust location if inaccurate.
            </Text>
            <TouchableOpacity
              style={styles.gpsLocateButton}
              onPress={getCurrentLocation}
              disabled={loadingLocation}
              accessibilityRole="button"
            >
              {loadingLocation ? (
                <ActivityIndicator size="small" color="#5F9C76" />
              ) : (
                <Ionicons name="locate-outline" size={17} color="#405047" />
              )}
              <Text style={styles.gpsLocateButtonText}>
                {loadingLocation ? "Acquiring GPS location..." : "Use current GPS location"}
              </Text>
            </TouchableOpacity>

            <View style={styles.gpsDetails}>
              <View style={styles.gpsCoordinateRow}>
                <View style={styles.gpsDetailItem}>
                  <Text style={styles.gpsDetailLabel}>Latitude</Text>
                  <Text style={styles.gpsDetailValue}>
                    {hasSelectionCoords
                      ? Number(selectionCoords.latitude).toFixed(6)
                      : "--"}
                  </Text>
                </View>
                <View style={styles.gpsDetailItem}>
                  <Text style={styles.gpsDetailLabel}>Longitude</Text>
                  <Text style={styles.gpsDetailValue}>
                    {hasSelectionCoords
                      ? Number(selectionCoords.longitude).toFixed(6)
                      : "--"}
                  </Text>
                </View>
              </View>

              <View style={styles.osmNoticeBox}>
                <Ionicons name="information-circle-outline" size={18} color="#2F5C3E" style={{ marginTop: 1 }} />
                <Text style={styles.osmNoticeText}>
                  OpenStreetMap detects roads and GPS coordinates, but cannot identify local Sitios or Puroks. Barangay is estimated automatically from your pin. Purok or Sitio is optional.
                </Text>
              </View>

              {/* 1. STREET / LANDMARK (OPTIONAL) */}
              <View style={styles.gpsAddressRow}>
                <Text style={styles.gpsDetailLabel}>
                  Street / Landmark (Optional)
                </Text>
                <TextInput
                  style={styles.gpsInput}
                  value={selectionStreet}
                  onChangeText={(value) => {
                    setSelectionStreet(value);
                    setSelectionErrors((current) => ({
                      ...current,
                      street: "",
                    }));
                  }}
                  placeholder="e.g. Rizal Street, Near Public Market"
                  placeholderTextColor="#8C9A91"
                />
                {selectionErrors.street ? (
                  <Text style={styles.selectionErrorText}>
                    {selectionErrors.street}
                  </Text>
                ) : null}
              </View>

              {/* 2. SITIO OR PUROK (OPTIONAL) */}
              <View style={styles.gpsAddressRow}>
                <View style={styles.gpsLabelRow}>
                  <Text style={styles.gpsDetailLabel}>
                    Sitio or Purok (Optional)
                  </Text>
                </View>
                <TextInput
                  style={styles.gpsInput}
                  value={selectionPurok}
                  onChangeText={(value) => {
                    setSelectionPurok(value);
                    setSelectionErrors((current) => ({
                      ...current,
                      purok: "",
                    }));
                  }}
                  placeholder="e.g. Purok 3 / Sitio Bato (Optional)"
                  placeholderTextColor="#8C9A91"
                />
                {selectionErrors.purok ? (
                  <Text style={styles.selectionErrorText}>
                    {selectionErrors.purok}
                  </Text>
                ) : null}
              </View>

              {/* 3. BARANGAY (REQUIRED - SEARCHABLE SELECTOR) */}
              <View style={[styles.gpsAddressRow, styles.barangayRowContainer]}>
                <View style={styles.gpsLabelRow}>
                  <Text style={styles.gpsDetailLabel}>
                    Barangay <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  {reverseGeocodeLoading && (
                    <View style={styles.detectingBadge}>
                      <ActivityIndicator size="small" color="#5F9C76" />
                      <Text style={styles.detectingText}>Detecting...</Text>
                    </View>
                  )}
                </View>
                <View style={styles.barangayInputWrapper}>
                  <TextInput
                    style={[styles.gpsInput, { flex: 1 }]}
                    value={selectionBarangay}
                    onChangeText={(value) => {
                      setSelectionBarangay(value);
                      setBarangayDropdownOpen(true);
                      setSelectionErrors((current) => ({
                        ...current,
                        barangay: "",
                      }));
                    }}
                    onFocus={() => setBarangayDropdownOpen(true)}
                    placeholder="Select or type Barangay"
                    placeholderTextColor="#8C9A91"
                  />
                  <TouchableOpacity
                    style={styles.dropdownToggle}
                    onPress={() => setBarangayDropdownOpen((prev) => !prev)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={barangayDropdownOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#52675A"
                    />
                  </TouchableOpacity>
                </View>

                {barangayDropdownOpen && (
                  <ScrollView
                    style={styles.barangayDropdownMenu}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredBarangays.map((bName) => (
                      <TouchableOpacity
                        key={bName}
                        style={[
                          styles.barangayDropdownItem,
                          selectionBarangay.toLowerCase() === bName.toLowerCase() &&
                            styles.barangayDropdownItemSelected,
                        ]}
                        onPress={() => {
                          setSelectionBarangay(bName);
                          setBarangayDropdownOpen(false);
                          setSelectionErrors((current) => ({
                            ...current,
                            barangay: "",
                          }));
                        }}
                      >
                        <Text
                          style={[
                            styles.barangayDropdownItemText,
                            selectionBarangay.toLowerCase() === bName.toLowerCase() &&
                              styles.barangayDropdownItemTextSelected,
                          ]}
                        >
                          {bName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {filteredBarangays.length === 0 && (
                      <Text style={styles.noBarangayMatch}>
                        No matching barangay found in Pinamungajan.
                      </Text>
                    )}
                  </ScrollView>
                )}

                {selectionErrors.barangay ? (
                  <Text style={styles.selectionErrorText}>
                    {selectionErrors.barangay}
                  </Text>
                ) : null}
              </View>

              {/* 4. MUNICIPALITY OR CITY */}
              <View style={styles.gpsAddressRow}>
                <View style={styles.gpsLabelRow}>
                  <Text style={styles.gpsDetailLabel}>Municipality or City</Text>
                </View>
                <TextInput
                  style={styles.gpsInput}
                  value={selectionMunicipality}
                  onChangeText={(value) => {
                    setSelectionMunicipality(value);
                  }}
                  placeholder="Pinamungajan"
                  placeholderTextColor="#8C9A91"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmLocationBtn}
              onPress={() => {
                const formattedPurok = formatPurokOrSitio(selectionPurok);
                const nextErrors = {
                  ...(!selectionBarangay.trim()
                    ? { barangay: "Barangay is required." }
                    : {}),
                  ...(!hasSelectionCoords
                    ? { coordinates: "Set GPS coordinates on the map." }
                    : {}),
                };
                setSelectionErrors(nextErrors);
                if (Object.keys(nextErrors).length) {
                  Alert.alert(
                    "Location details required",
                    "Set the GPS pin and select a Barangay.",
                  );
                  return;
                }
                const muni = selectionMunicipality.trim() || "Pinamungajan";
                const formattedLocation = [
                  selectionStreet.trim(),
                  formattedPurok,
                  selectionBarangay.trim(),
                  muni,
                ]
                  .filter(Boolean)
                  .join(", ");

                onSelectLocation({
                  locationName: formattedLocation,
                  street: selectionStreet.trim(),
                  purok: formattedPurok,
                  barangay: selectionBarangay.trim(),
                  municipality: muni,
                  coordinates: {
                    latitude: Number(selectionCoords.latitude),
                    longitude: Number(selectionCoords.longitude),
                  },
                });
              }}
              accessibilityRole="button"
            >
              <Text style={styles.confirmLocationText}>Confirm Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    );
  }

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

        <View style={[styles.modalBox, previewModalWidthStyle]}>
          {/* HEADER */}
          <View
            style={[
              styles.header,
              (isTablet || isDesktop) && styles.headerLarge,
            ]}
          >
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.locationIconBadge,
                  (isTablet || isDesktop) && styles.locationIconBadgeLarge,
                ]}
              >
                <Ionicons
                  name="location"
                  size={isDesktop ? 22 : isTablet ? 20 : 18}
                  color="#2E7D32"
                />
              </View>
              <View style={styles.headerTextCol}>
                <Text
                  style={[
                    styles.headerSubtitle,
                    (isTablet || isDesktop) && styles.headerSubtitleLarge,
                  ]}
                >
                  Pinned Location
                </Text>
                <Text
                  style={[
                    styles.headerTitle,
                    (isTablet || isDesktop) && styles.headerTitleLarge,
                  ]}
                  numberOfLines={1}
                >
                  {displayLocation}
                </Text>
                <Text
                  style={[
                    styles.coordsSubtitle,
                    (isTablet || isDesktop) && styles.coordsSubtitleLarge,
                  ]}
                >
                  GPS: {postCoords.lat.toFixed(5)}, {postCoords.lng.toFixed(5)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.closeBtn,
                (isTablet || isDesktop) && styles.closeBtnLarge,
              ]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close"
                size={isDesktop ? 22 : isTablet ? 21 : 20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {/* MAP DISPLAY (SHOWING ONLY THIS POST'S PIN) */}
          <View style={[styles.mapCard, mapHeightStyle]}>
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
          <View
            style={[
              styles.postMetaRow,
              (isTablet || isDesktop) && styles.postMetaRowLarge,
            ]}
          >
            <View style={styles.postMetaLeft}>
              <Text
                style={[
                  styles.postTitle,
                  (isTablet || isDesktop) && styles.postTitleLarge,
                ]}
                numberOfLines={1}
              >
                {post.title || "Waste Report"}
              </Text>
              <Text
                style={[
                  styles.reportedByText,
                  (isTablet || isDesktop) && styles.reportedByTextLarge,
                ]}
                numberOfLines={1}
              >
                Reported by{" "}
                <Text style={{ fontWeight: "700" }}>{authorName}</Text>
              </Text>
            </View>

            <View style={styles.badgesRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusMeta.color },
                  (isTablet || isDesktop) && styles.statusBadgeLarge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    (isTablet || isDesktop) && styles.statusBadgeTextLarge,
                  ]}
                >
                  {statusMeta.label}
                </Text>
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
                    (isTablet || isDesktop) && styles.wasteBadgeLarge,
                  ]}
                >
                  <Text
                    style={[
                      styles.wasteBadgeText,
                      (isTablet || isDesktop) && styles.wasteBadgeTextLarge,
                    ]}
                  >
                    {formatWasteLabel(post.wasteClassification)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* FOOTER ACTIONS */}
          <View
            style={[
              styles.actionsRow,
              (isTablet || isDesktop) && styles.actionsRowLarge,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.doneBtn,
                (isTablet || isDesktop) && styles.doneBtnLarge,
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.doneBtnText,
                  (isTablet || isDesktop) && styles.doneBtnTextLarge,
                ]}
              >
                Close
              </Text>
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

  headerLarge: {
    marginBottom: 16,
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

  locationIconBadgeLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
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

  headerSubtitleLarge: {
    fontSize: 12,
  },

  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#24352A",
    marginTop: 1,
  },

  headerTitleLarge: {
    fontSize: 17,
    marginTop: 2,
  },

  coordsSubtitle: {
    fontSize: 11,
    color: "#2E7D32",
    fontWeight: "600",
    marginTop: 2,
  },

  coordsSubtitleLarge: {
    fontSize: 13,
    marginTop: 3,
  },

  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F2F5F3",
  },

  closeBtnLarge: {
    padding: 9,
    borderRadius: 10,
  },

  mapCard: {
    width: "100%",
    height: 260,
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

  postMetaRowLarge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  postMetaLeft: {
    flex: 1,
  },

  postTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#24352A",
  },

  postTitleLarge: {
    fontSize: 15,
  },

  reportedByText: {
    fontSize: 11,
    color: "#6B7C72",
    marginTop: 2,
  },

  reportedByTextLarge: {
    fontSize: 12,
    marginTop: 3,
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

  statusBadgeLarge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
  },

  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  statusBadgeTextLarge: {
    fontSize: 11,
  },

  wasteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  wasteBadgeLarge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
  },

  wasteBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  wasteBadgeTextLarge: {
    fontSize: 11,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 14,
  },

  actionsRowLarge: {
    marginTop: 16,
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

  doneBtnLarge: {
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 10,
  },

  doneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D32",
  },

  doneBtnTextLarge: {
    fontSize: 14,
  },
  selectionMapCard: {
    width: "100%",
    height: 240,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    backgroundColor: "#EEF2F0",
  },
  gpsModalBox: {
    width: "92%",
    maxWidth: 820,
    maxHeight: "94%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
  },
  gpsModalBoxSmall: {
    width: "96%",
  },
  gpsModalContent: {
    padding: 24,
  },
  gpsModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#24352A",
    marginBottom: 15,
  },
  gpsLoadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  gpsLoadingText: {
    color: "#52675A",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
  },
  gpsNativePin: {
    color: "#24352A",
    fontWeight: "600",
  },
  gpsInstruction: {
    fontSize: 12,
    color: "#52675A",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  gpsLocateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    alignSelf: "flex-end",
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: "#F4F8F5",
  },
  gpsLocateButtonText: {
    color: "#405047",
    fontSize: 12,
    fontWeight: "600",
  },
  gpsDetails: {
    marginTop: 12,
    gap: 10,
  },
  gpsCoordinateRow: {
    flexDirection: "row",
    gap: 10,
  },
  gpsDetailItem: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F4F8F5",
  },
  gpsAddressRow: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F4F8F5",
  },
  gpsLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gpsDetailLabel: {
    color: "#52675A",
    fontSize: 12,
    fontWeight: "700",
  },
  requiredMark: {
    color: "#D93025",
  },
  gpsDetailValue: {
    color: "#24352A",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "600",
  },
  gpsInput: {
    color: "#24352A",
    fontSize: 14,
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 0,
    fontWeight: "500",
    outlineStyle: "none",
  },
  selectionErrorText: {
    color: "#B42318",
    fontSize: 12,
    marginTop: 4,
  },
  confirmLocationBtn: {
    backgroundColor: "#5F9C76",
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    alignItems: "center",
  },
  confirmLocationText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalCancel: {
    alignItems: "center",
    padding: 12,
    marginTop: 4,
  },
  modalCancelText: {
    color: "#405047",
    fontSize: 14,
    fontWeight: "600",
  },
  osmNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EDF5F0",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D2E6D9",
    gap: 8,
    marginVertical: 4,
  },
  osmNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#2D5A3F",
    lineHeight: 16,
  },
  barangayRowContainer: {
    position: "relative",
    zIndex: 10,
  },
  barangayInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownToggle: {
    padding: 6,
    marginLeft: 4,
  },
  barangayDropdownMenu: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginTop: 8,
  },
  barangayDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F3",
  },
  barangayDropdownItemSelected: {
    backgroundColor: "#EAF5EE",
  },
  barangayDropdownItemText: {
    fontSize: 13,
    color: "#24352A",
  },
  barangayDropdownItemTextSelected: {
    fontWeight: "700",
    color: "#2E7D32",
  },
  noBarangayMatch: {
    padding: 12,
    fontSize: 12,
    color: "#7A8A80",
    textAlign: "center",
  },
  detectingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detectingText: {
    fontSize: 11,
    color: "#5F9C76",
    fontWeight: "600",
  },
});
