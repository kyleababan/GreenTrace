import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { deleteFromCloudinary, uploadToCloudinary } from "../cloudinary";
import Navbar from "../components/navbar";
import NsfwWarningModal from "../components/nsfw-warning-modal";
import { normalizePurok } from "../constants/locationFormat";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../constants/wasteCategories";
import { auth, db } from "../firebaseConfig";
import { deleteRelatedDocuments } from "../utils/deletePostHelper";
import { hideBadWords } from "../utils/hideBadWords";

const BARANGAYS = [
  "Anislag",
  "Anopog",
  "Binabag",
  "Buhingtubig",
  "Busay",
  "Butong",
  "Cabiangon",
  "Camugao",
  "Duangan",
  "Guimbawian",
  "Lamac",
  "Lut-od",
  "Mangoto",
  "Opao",
  "Poblacion",
  "Punod",
  "Rizal",
  "Sacsac",
  "Sambagon",
  "Sibago",
  "Tajao",
  "Tangub",
  "Tanibag",
  "Tupas",
  "Tutay",
].sort((a, b) => a.localeCompare(b));

const formatPostedAt = (timestamp) => {
  if (!timestamp) return "Posted just now";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Posted just now";
  return `Posted ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
};

export default function EditPost() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [loadingPost, setLoadingPost] = useState(true);

  const [userName, setUserName] = useState("");
  const [status, setStatus] = useState("moderate");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [createdAt, setCreatedAt] = useState(null);

  // image.uri is always set; image.isNew = true means user picked a new file
  const [image, setImage] = useState(null);
  // URL of the photo already stored in Cloudinary (from Firestore)
  const [originalImageUrl, setOriginalImageUrl] = useState(null);

  const [manualBarangay, setManualBarangay] = useState("");
  const [manualPurok, setManualPurok] = useState("");
  const [locationName, setLocationName] = useState("");
  const [gpsModalVisible, setGpsModalVisible] = useState(false);
  const [coords, setCoords] = useState({
    latitude: 10.2705,
    longitude: 123.5855,
  });
  const [postCoordinates, setPostCoordinates] = useState(null);
  const [gpsBarangay, setGpsBarangay] = useState("");
  const [gpsStreet, setGpsStreet] = useState("");
  const [gpsReverseLoading, setGpsReverseLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsErrors, setGpsErrors] = useState({});
  const [mapSessionId, setMapSessionId] = useState(0);
  const [imageSourceModalVisible, setImageSourceModalVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [wasteClassification, setWasteClassification] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  // NSFW Warning & Ban Modal States
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningIsBanned, setWarningIsBanned] = useState(false);
  const [warningsCount, setWarningsCount] = useState(1);
  const [warningReason, setWarningReason] = useState("");

  // -------------------------------------------------------------------------
  // Load user name & check ban status
  // -------------------------------------------------------------------------
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.isBanned) {
            setWarningIsBanned(true);
            setWarningsCount(data.nsfwWarnings || 3);
            setWarningReason(
              data.banReason ||
                "Account banned for violating Terms and Policy.",
            );
            setWarningModalVisible(true);
            return;
          }
          setUserName(`${data.firstName} ${data.lastName}`);
        }
      } catch (error) {
        console.log(error);
      }
    };
    loadUser();
  }, []);

  // -------------------------------------------------------------------------
  // Load the post being edited
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadPost();
  }, []);

  const loadPost = async () => {
    try {
      const snapshot = await getDoc(doc(db, "posts", id));

      if (!snapshot.exists()) {
        setErrors({ form: "Post not found." });
        router.back();
        return;
      }

      const data = snapshot.data();

      setTitle(data.title || "");
      setCaption(data.caption || "");
      setCreatedAt(data.createdAt || null);
      setLocationName(data.locationName || "");
      setStatus((data.status || "moderate").toLowerCase());
      setWasteClassification(data.wasteClassification || null);

      if (data.barangay) {
        setManualBarangay(data.barangay);
        setGpsBarangay(data.barangay);
      } else if (data.locationName) {
        const parts = data.locationName
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts[0]) {
          setManualBarangay(parts[0]);
          setGpsBarangay(parts[0]);
        }
      }

      if (data.purok) {
        setManualPurok(data.purok);
        setGpsStreet(data.purok);
      } else if (data.locationName) {
        const parts = data.locationName
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length > 1) {
          setManualPurok(parts.slice(1).join(", "));
          setGpsStreet(parts.slice(1).join(", "));
        }
      }

      if (data.coordinates?.latitude && data.coordinates?.longitude) {
        const lat = parseFloat(Number(data.coordinates.latitude).toFixed(6));
        const lng = parseFloat(Number(data.coordinates.longitude).toFixed(6));
        setCoords({ latitude: lat, longitude: lng });
        setPostCoordinates({ latitude: lat, longitude: lng });
      }

      setOriginalImageUrl(data.imageUrl || null);
      setImage({ uri: data.imageUrl, isNew: false });
    } catch (error) {
      console.log(error);
      setErrors({ form: "Unable to load the post." });
    } finally {
      setLoadingPost(false);
    }
  };

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleWindowMessage = (event) => {
        try {
          const data =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
          if (data && data.type === "GPS_PIN_MOVED") {
            const nextLat = parseFloat(Number(data.lat).toFixed(6));
            const nextLng = parseFloat(Number(data.lng).toFixed(6));
            setCoords({ latitude: nextLat, longitude: nextLng });
            reverseGeocodeCoordinates(nextLat, nextLng);
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
  }, []);

  const reverseGeocodeCoordinates = async (lat, lng) => {
    setGpsReverseLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "GreenTraceApp/1.0",
          },
        },
      );
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const candidateBarangay =
          addr.suburb ||
          addr.village ||
          addr.quarter ||
          addr.neighbourhood ||
          addr.hamlet ||
          "";

        const matched = BARANGAYS.find(
          (b) => b.toLowerCase() === candidateBarangay.toLowerCase().trim(),
        );

        const barangayVal =
          matched || candidateBarangay || manualBarangay || "Poblacion";
        const roadVal =
          addr.road || addr.pedestrian || addr.street || addr.residential || "";

        setGpsBarangay(barangayVal);
        setGpsStreet(
          roadVal ||
            (addr.town || addr.city ? `${addr.town || addr.city}` : ""),
        );
      }
    } catch (err) {
      console.warn("Reverse geocode error:", err);
    } finally {
      setGpsReverseLoading(false);
    }
  };

  const detectGpsLocation = async () => {
    setGpsErrors({});
    setGpsLoading(true);
    let lat = coords?.latitude || 10.2705;
    let lng = coords?.longitude || 123.5855;

    if (!postCoordinates) {
      try {
        if (
          Platform.OS === "web" &&
          typeof navigator !== "undefined" &&
          navigator.geolocation
        ) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 10000,
            });
          });
          lat = parseFloat(pos.coords.latitude.toFixed(6));
          lng = parseFloat(pos.coords.longitude.toFixed(6));
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = parseFloat(loc.coords.latitude.toFixed(6));
            lng = parseFloat(loc.coords.longitude.toFixed(6));
          }
        }
      } catch (locErr) {
        console.warn("Could not get GPS, using default:", locErr);
      }
    }

    setCoords({ latitude: lat, longitude: lng });
    setMapSessionId((prev) => prev + 1);
    if (!gpsBarangay && !gpsStreet) {
      await reverseGeocodeCoordinates(lat, lng);
    }
    setGpsLoading(false);
    setGpsModalVisible(true);
  };

  const handleUseCamera = async () => {
    setImageSourceModalVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrors((prev) => ({
          ...prev,
          image: "Camera permission is required to take a photo.",
        }));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) return;
      await processSelectedImage(result.assets[0]);
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const handleUploadGallery = async () => {
    setImageSourceModalVisible(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) return;
      await processSelectedImage(result.assets[0]);
    } catch (err) {
      console.error("Gallery error:", err);
    }
  };

  const processSelectedImage = async (asset) => {
    if (asset.type === "video") {
      setErrors((previous) => ({
        ...previous,
        image: "Videos are not supported.",
      }));
      return;
    }

    if (asset.fileSize && asset.fileSize > 2.5 * 1024 * 1024) {
      setErrors((previous) => ({
        ...previous,
        image: "Image must be smaller than 2.5 MB.",
      }));
      return;
    }

    setImage({ ...asset, isNew: true });
    setErrors((previous) => {
      const next = { ...previous };
      delete next.image;
      return next;
    });

    // Automatically trigger GPS tracking detection & show map
    await detectGpsLocation();
  };

  const handleConfirmGpsLocation = () => {
    const barangay = gpsBarangay.trim();
    const street = gpsStreet.trim();

    const newGpsErrors = {};
    if (!barangay) {
      newGpsErrors.barangay = "Barangay is required.";
    }
    if (!street) {
      newGpsErrors.street = "Street / Purok is required.";
    }

    if (Object.keys(newGpsErrors).length > 0) {
      setGpsErrors(newGpsErrors);
      return;
    }

    setGpsErrors({});

    let purokVal = street;
    const purokMatch = street.match(/(?:pk\.?|purok)\s*(\d+|[a-zA-Z0-9]+)/i);
    if (purokMatch) {
      purokVal = purokMatch[1];
    }

    setManualBarangay(barangay);
    setManualPurok(purokVal);
    setLocationName(`${barangay}, ${street}`);
    setPostCoordinates({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next.location;
      delete next.barangay;
      delete next.purok;
      return next;
    });

    setGpsModalVisible(false);
  };

  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${coords.latitude || 10.2705};
    var lng = ${coords.longitude || 123.5855};
    var map = L.map('map', {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    var marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    function notify(pos) {
      window.parent.postMessage(JSON.stringify({ type: 'GPS_PIN_MOVED', lat: pos.lat, lng: pos.lng }), '*');
    }

    marker.on('dragend', function() {
      notify(marker.getLatLng());
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      notify(e.latlng);
    });
  </script>
</body>
</html>
`;

  // -------------------------------------------------------------------------
  // Location validation (barangay + purok required)
  // -------------------------------------------------------------------------
  const validateLocation = () => ({
    ...(!manualBarangay ? { barangay: "Barangay is required." } : {}),
    ...(!manualPurok ? { purok: "Street / Purok is required." } : {}),
  });

  // -------------------------------------------------------------------------
  // Save / update the post
  // -------------------------------------------------------------------------
  const updatePost = async () => {
    if (uploading) return;

    const locationErrors = validateLocation();
    const nextErrors = {
      ...(!image ? { image: "Please select an image." } : {}),
      ...locationErrors,
      ...(Object.keys(locationErrors).length
        ? { location: "Please set your location using GPS map before saving." }
        : {}),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      if (Object.keys(locationErrors).length) detectGpsLocation();
      return;
    }

    try {
      setUploading(true);

      const statusIsLocked =
        status === "ongoing" || status === "on-going" || status === "cleaned";

      let imageUrl = originalImageUrl;

      // If the user picked a new photo: upload the new one first (with moderation & classification check),
      // and only delete the old one if the new upload succeeds
      let newClassification = null;
      if (image?.isNew) {
        const uploadRes = await uploadToCloudinary(image, {
          classifyWaste: true,
        });
        const newImageUrl =
          typeof uploadRes === "string" ? uploadRes : uploadRes.secureUrl;
        await deleteFromCloudinary(originalImageUrl);
        imageUrl = newImageUrl;
        newClassification =
          typeof uploadRes === "object" ? uploadRes.classification : null;
      }

      const updates = {
        title: hideBadWords(title.trim()),
        caption: hideBadWords(caption.trim()),
        locationName,
        barangay: manualBarangay || null,
        purok: normalizePurok(manualPurok) || null,
        imageUrl,
      };

      if (postCoordinates) {
        updates.coordinates = postCoordinates;
      }

      if (newClassification) {
        updates.wasteClassification = newClassification;
        setWasteClassification(newClassification);
      }

      if (!statusIsLocked) {
        updates.status = status;
      }

      await updateDoc(doc(db, "posts", id), updates);

      router.back();
    } catch (error) {
      console.log(error);
      const msg = error.message || "Could not update the post.";

      if (
        msg.toLowerCase().includes("image rejected") ||
        msg.toLowerCase().includes("nsfw") ||
        msg.toLowerCase().includes("inappropriate") ||
        msg.toLowerCase().includes("suggestive") ||
        msg.toLowerCase().includes("flagged")
      ) {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);
            const curData = userSnap.exists() ? userSnap.data() : {};
            const curWarnings = curData.nsfwWarnings || 0;
            const newCount = curWarnings + 1;
            const banned = newCount >= 3;

            await updateDoc(userRef, {
              nsfwWarnings: newCount,
              ...(banned
                ? {
                    isBanned: true,
                    banReason:
                      "Violated Terms and Policy: Uploaded inappropriate/NSFW content after 3 warnings.",
                  }
                : {}),
            });

            setWarningsCount(newCount);
            setWarningIsBanned(banned);
            setWarningReason(msg.replace(/^Image rejected:\s*/i, ""));
            // Reset to original image if new image was violating
            if (originalImageUrl) {
              setImage({ uri: originalImageUrl, isNew: false });
            } else {
              setImage(null);
            }
            setWarningModalVisible(true);
          }
        } catch (dbErr) {
          console.warn("Could not record warning:", dbErr);
          setWarningsCount(1);
          setWarningIsBanned(false);
          setWarningReason(msg.replace(/^Image rejected:\s*/i, ""));
          setWarningModalVisible(true);
        }
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/signin");
    } catch (e) {
      router.replace("/signin");
    }
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loadingPost) {
    return (
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#5F9C76" />
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        {/* CONTENT WRAPPER */}
        <View style={styles.contentWrapper}>
          {/* HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()}>
                <Image
                  source={require("../assets/images/close.png")}
                  style={styles.closeIcon}
                />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Post</Text>
            </View>
          </View>

          {/* MAIN CONTENT */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* USER + POST BUTTON */}
            <View style={styles.userRow}>
              <View style={styles.userInfo}>
                <Image
                  source={require("../assets/images/profile2.png")}
                  style={styles.avatar}
                />
                <Text style={styles.username}>{userName}</Text>
              </View>

              <TouchableOpacity
                style={[styles.postButton, uploading && { opacity: 0.6 }]}
                onPress={updatePost}
                disabled={uploading}
              >
                <Text style={styles.postText}>
                  {uploading ? "SAVING..." : "SAVE"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* LOCATION */}
            <TouchableOpacity
              style={[
                styles.locationRow,
                errors.location && styles.errorBorder,
              ]}
              onPress={() => detectGpsLocation()}
            >
              <Image
                source={require("../assets/images/location.png")}
                style={styles.locationIcon}
              />
              <Text style={styles.locationText}>
                {locationName || "Set Location..."}
              </Text>
            </TouchableOpacity>
            <Text style={styles.postedAt}>{formatPostedAt(createdAt)}</Text>

            {!!errors.location && (
              <Text style={styles.fieldError}>{errors.location}</Text>
            )}
            {!!errors.image && (
              <Text style={styles.fieldError}>{errors.image}</Text>
            )}
            {!!errors.form && (
              <Text style={styles.formError}>{errors.form}</Text>
            )}

            {/* TITLE */}
            <TextInput
              placeholder="Report title"
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              maxLength={90}
            />

            {/* CAPTION */}
            <TextInput
              placeholder="Write Something..."
              multiline
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
            />

            {/* IMAGE PICKER — same style as create_post.jsx */}
            <View style={[styles.imageBox, errors.image && styles.inputError]}>
              {/* Status & Waste Badges */}
              <View style={styles.badgesRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        status === "critical"
                          ? "#FF5B5B"
                          : status === "moderate"
                            ? "#FFC940"
                            : status === "cleaned"
                              ? "#34C759"
                              : status === "ongoing"
                                ? "#7DD3FC"
                                : "#A5A5A5",
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {status === "critical"
                      ? "Critical"
                      : status === "moderate"
                        ? "Moderate"
                        : status === "ongoing"
                          ? "On-going"
                          : status === "cleaned"
                            ? "Cleaned"
                            : "Pending"}
                  </Text>
                </View>

                {Boolean(formatWasteLabel(wasteClassification)) && (
                  <View
                    style={[
                      styles.wasteDot,
                      {
                        backgroundColor: getWasteCategoryColor(
                          wasteClassification?.category,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {formatWasteLabel(wasteClassification)}
                    </Text>
                  </View>
                )}
              </View>

              {image ? (
                <>
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.changePhotoButton}
                    onPress={() => setImageSourceModalVisible(true)}
                  >
                    <Text style={styles.changePhotoText}>Change photo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.imagePlaceholderContent}
                  onPress={() => setImageSourceModalVisible(true)}
                >
                  <Image
                    source={require("../assets/images/image.png")}
                    style={styles.imageIcon}
                  />
                  <Text style={styles.imageText}>Choose Image</Text>
                  <Text style={styles.imageHint}>
                    Add a clear photo of the concern
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* DELETE POST BUTTON */}
            <TouchableOpacity
              style={[
                styles.deletePostButton,
                (uploading || deletingPost) && { opacity: 0.5 },
              ]}
              disabled={uploading || deletingPost}
              onPress={() => setShowDeleteModal(true)}
            >
              <Text style={styles.deletePostButtonText}>Delete Post</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* GPS TRACKING MODAL */}
        <Modal
          visible={gpsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGpsModalVisible(false)}
        >
          <View style={styles.modalBackground}>
            <View style={[styles.modalBox, styles.gpsModalBox]}>
              <Text style={styles.modalTitle}>GPS Tracking</Text>

              {/* INTERACTIVE LEAFLET / OPENSTREETMAP */}
              <View style={styles.gpsPlaceholder}>
                {gpsLoading ? (
                  <View style={styles.gpsLoadingCenter}>
                    <ActivityIndicator size="large" color="#5F9C76" />
                    <Text style={styles.gpsLoadingText}>
                      Acquiring GPS location...
                    </Text>
                  </View>
                ) : Platform.OS === "web" ? (
                  <iframe
                    key={`gps-map-${mapSessionId}`}
                    srcDoc={leafletHtml}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      borderRadius: 8,
                    }}
                    title="GPS Location Map"
                  />
                ) : (
                  <View style={styles.gpsLoadingCenter}>
                    <Text style={{ color: "#24352A", fontWeight: "600" }}>
                      📍 Pin: {coords.latitude}, {coords.longitude}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.gpsInstruction}>
                📍 Drag the pin or tap on the map to adjust location if
                inaccurate.
              </Text>

              <View style={styles.gpsDetails}>
                <View style={styles.gpsCoordinateRow}>
                  <View style={styles.gpsDetailItem}>
                    <Text style={styles.gpsDetailLabel}>Latitude</Text>
                    <Text style={styles.gpsDetailValue}>
                      {coords.latitude ? coords.latitude.toFixed(6) : "--"}
                    </Text>
                  </View>
                  <View style={styles.gpsDetailItem}>
                    <Text style={styles.gpsDetailLabel}>Longitude</Text>
                    <Text style={styles.gpsDetailValue}>
                      {coords.longitude ? coords.longitude.toFixed(6) : "--"}
                    </Text>
                  </View>
                </View>

                {/* Barangay */}
                <View style={styles.gpsAddressRow}>
                  <View style={styles.gpsLabelRow}>
                    <Text style={styles.gpsDetailLabel}>
                      Barangay <Text style={{ color: "#D93025" }}>*</Text>
                    </Text>
                    {gpsReverseLoading && (
                      <ActivityIndicator size="small" color="#5F9C76" />
                    )}
                  </View>
                  <TextInput
                    style={[
                      styles.gpsInput,
                      gpsErrors.barangay && styles.inputError,
                    ]}
                    value={gpsBarangay}
                    onChangeText={(text) => {
                      setGpsBarangay(text);
                      if (gpsErrors.barangay) {
                        setGpsErrors((prev) => {
                          const next = { ...prev };
                          delete next.barangay;
                          return next;
                        });
                      }
                    }}
                    placeholder="Barangay"
                    placeholderTextColor="#999"
                  />
                  {!!gpsErrors.barangay && (
                    <Text style={styles.fieldError}>{gpsErrors.barangay}</Text>
                  )}
                </View>

                {/* Street / Purok */}
                <View style={styles.gpsAddressRow}>
                  <Text style={styles.gpsDetailLabel}>
                    Street / Purok <Text style={{ color: "#D93025" }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.gpsInput,
                      gpsErrors.street && styles.inputError,
                    ]}
                    value={gpsStreet}
                    onChangeText={(text) => {
                      setGpsStreet(text);
                      if (gpsErrors.street) {
                        setGpsErrors((prev) => {
                          const next = { ...prev };
                          delete next.street;
                          return next;
                        });
                      }
                    }}
                    placeholder="e.g. Pinya / Pk. 2"
                    placeholderTextColor="#999"
                  />
                  {!!gpsErrors.street && (
                    <Text style={styles.fieldError}>{gpsErrors.street}</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmLocationBtn}
                onPress={handleConfirmGpsLocation}
              >
                <Text style={styles.confirmLocationText}>Confirm Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setGpsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* IMAGE SOURCE MODAL: Use Camera or Upload */}
        <Modal
          visible={imageSourceModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageSourceModalVisible(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Add Waste Photo</Text>
              <Text style={styles.imageSourceSubtitle}>
                Select how you would like to add a photo:
              </Text>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleUseCamera}
              >
                <Text style={styles.modalButtonText}>📷 Use Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#4A7C59" }]}
                onPress={handleUploadGallery}
              >
                <Text style={styles.modalButtonText}>📁 Upload</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setImageSourceModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* NSFW Warning / Ban Modal */}
        <NsfwWarningModal
          visible={warningModalVisible}
          isBanned={warningIsBanned}
          warningsCount={warningsCount}
          reason={warningReason}
          onClose={() => setWarningModalVisible(false)}
          onSignOut={handleSignOut}
        />

        {/* DELETE CONFIRMATION MODAL */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showDeleteModal}
          onRequestClose={() => !deletingPost && setShowDeleteModal(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.deleteModalBox}>
              <Text style={styles.deleteTitle}>Delete Post</Text>

              <Text style={styles.deleteMessage}>
                Are you sure you want to delete this post? This action cannot be
                undone.
              </Text>

              <TouchableOpacity
                style={[
                  styles.confirmDeleteBtn,
                  deletingPost && { opacity: 0.6 },
                ]}
                disabled={deletingPost}
                onPress={async () => {
                  if (deletingPost) return;
                  try {
                    setDeletingPost(true);
                    if (originalImageUrl) {
                      await deleteFromCloudinary(originalImageUrl);
                    }
                    await deleteRelatedDocuments(id);
                    setShowDeleteModal(false);
                    router.replace("/home");
                  } catch (error) {
                    console.log(error);
                    setDeletingPost(false);
                  }
                }}
              >
                {deletingPost ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmDeleteText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCancel, deletingPost && { opacity: 0.5 }]}
                disabled={deletingPost}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  contentWrapper: {
    flex: 1,
  },

  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },

  wrapper: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
  },

  container: {
    width: "100%",
    maxWidth: 500,
    flex: 1,
    backgroundColor: "#fff",
  },

  topSection: {
    backgroundColor: "#5F9C76",
    padding: 31,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  closeIcon: {
    width: 42,
    height: 42,
    marginRight: 10,
    top: 10,
    right: 5,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
    top: 10,
  },

  content: {
    flex: 1,
  },

  contentContainer: {
    padding: 15,
    paddingBottom: 24,
  },

  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },

  username: {
    fontWeight: "600",
    fontSize: 14,
    color: "#24352A",
  },

  postButton: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 6,
  },

  postText: {
    color: "#fff",
    fontWeight: "600",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },

  errorBorder: {
    borderColor: "#D93025",
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 4,
  },

  locationIcon: {
    width: 16,
    height: 16,
    marginRight: 5,
  },

  locationText: {
    color: "#405047",
    fontSize: 14,
  },

  postedAt: {
    color: "#8A8A8A",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 21,
  },

  fieldError: {
    color: "#D93025",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },

  formError: {
    color: "#D93025",
    fontSize: 13,
    marginTop: 10,
  },

  titleInput: {
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    fontWeight: "600",
    color: "#24352A",
    fontSize: 14,
  },

  captionInput: {
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
    padding: 10,
    height: 80,
    marginTop: 10,
    textAlignVertical: "top",
    color: "#24352A",
    fontSize: 14,
  },

  imageBox: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#F2F2F2",
    borderRadius: 10,
    marginTop: 15,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  inputError: {
    borderWidth: 1.5,
    borderColor: "#D93025",
  },

  imagePlaceholderContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  imageIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },

  imageText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#555",
  },

  imageHint: {
    fontSize: 12,
    color: "#8A8A8A",
    marginTop: 4,
  },

  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },

  changePhotoButton: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  changePhotoText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  badgesRow: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 999,
    elevation: 999,
  },

  statusDot: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  wasteDot: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  modalBox: {
    width: "80%",
    maxWidth: 760,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },

  modalButton: {
    backgroundColor: "#5F9C76",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },

  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  modalCancel: {
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },

  modalCancelText: {
    color: "#405047",
    fontSize: 14,
    fontWeight: "600",
  },

  gpsModalBox: {
    width: "92%",
    maxWidth: 820,
    padding: 24,
  },

  gpsPlaceholder: {
    height: 240,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    backgroundColor: "#FAFCFB",
    overflow: "hidden",
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

  gpsInstruction: {
    fontSize: 12,
    color: "#52675A",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
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

  imageSourceSubtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },

  deletePostButton: {
    marginTop: 24,
    marginBottom: 40,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF4D4D",
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  deletePostButtonText: {
    color: "#FF4D4D",
    fontSize: 15,
    fontWeight: "bold",
  },

  deleteModalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 360,
    alignItems: "center",
  },

  deleteTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 10,
  },

  deleteMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },

  confirmDeleteBtn: {
    width: "100%",
    backgroundColor: "#FF5B5B",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  confirmDeleteText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
