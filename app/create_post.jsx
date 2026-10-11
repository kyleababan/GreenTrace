import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { uploadToCloudinary } from "../cloudinary";
import Navbar from "../components/navbar";
import NsfwWarningModal from "../components/nsfw-warning-modal";
import DuplicateReportModal from "../components/duplicate-report-modal";
import PostLocationModal from "../components/PostLocationModal";
import { checkVicinity } from "../constants/geoUtils";
import { normalizePurok } from "../constants/locationFormat";
import { auth, db } from "../firebaseConfig";
import { getCurrentCoordinates } from "../utils/getCurrentCoordinates";
import { getNameInitials } from "../utils/getNameInitials";
import { hideBadWords } from "../utils/hideBadWords";
import { notifyUserAccountWarning } from "../utils/notificationHelpers";

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";

export default function CreateReport() {
  const [uploading, setUploading] = useState(false);
  const [userName, setUserName] = useState("");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");

  const [image, setImage] = useState(null);

  const [manualBarangay, setManualBarangay] = useState("");
  const [manualPurok, setManualPurok] = useState("");
  const [manualStreet, setManualStreet] = useState("");
  const [manualMunicipality, setManualMunicipality] = useState("Pinamungajan");
  const [gpsModalVisible, setGpsModalVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [locationName, setLocationName] = useState("");

  // NSFW Warning & Ban Modal States
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningIsBanned, setWarningIsBanned] = useState(false);
  const [warningsCount, setWarningsCount] = useState(1);
  const [warningReason, setWarningReason] = useState("");

  // Duplicate Report & Vicinity Warning Modal States
  const [duplicateModalConfig, setDuplicateModalConfig] = useState({
    visible: false,
    mode: "warning", // 'warning' (same user) | 'notice' (different user)
    existingReport: null,
    extraFields: {},
  });
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);

  const validateLocation = () => ({
    ...(!manualBarangay ? { barangay: "Barangay is required." } : {}),
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.role === "admin") {
            Alert.alert(
              "Access Restricted",
              "Administrators cannot post waste reports. Please use the administrative portal.",
            );
            router.replace("/admin/dashboard");
            return;
          }
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

  // Camera & GPS State
  const [imageSourceModalVisible, setImageSourceModalVisible] = useState(false);
  const [postCoordinates, setPostCoordinates] = useState(null);

  // Report Posting Guidelines & Instructions Modal States
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [locationStatus, setLocationStatus] = useState(null); // 'checking' | 'granted' | 'denied'
  const [locationMessage, setLocationMessage] = useState("");

  const testAndRequestLocationPermission = async () => {
    setLocationStatus("checking");
    setLocationMessage("Checking and requesting location access...");

    try {
      const currentCoordinates = await getCurrentCoordinates();
      setLocationStatus("granted");
      setLocationMessage(
        `✅ Location allowed & active! (GPS: ${currentCoordinates.latitude}, ${currentCoordinates.longitude})`,
      );
      setPostCoordinates(currentCoordinates);
    } catch (err) {
      setLocationStatus("denied");
      setLocationMessage(`⚠️ ${err.message || "Could not retrieve GPS location."}`);
    }
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

  const processSelectedImage = (asset) => {
    if (asset.type === "video") {
      setErrors((previous) => ({
        ...previous,
        image: "Videos are not supported.",
      }));
      return;
    }

    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      setErrors((previous) => ({
        ...previous,
        image: "Image must be smaller than 10 MB.",
      }));
      return;
    }

    setImage(asset);
    setErrors((previous) => {
      const next = { ...previous };
      delete next.image;
      return next;
    });
  };



  const performPostSubmission = async (extraFields = {}) => {
    try {
      setUploading(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setErrors({ form: "You must be signed in to create a post." });
        setUploading(false);
        setDuplicateSubmitting(false);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", currentUser.uid));

      const userData = userSnap.data() || {};

      if (userData.role === "admin") {
        Alert.alert(
          "Access Restricted",
          "Administrators cannot post waste reports. Please use the administrative portal.",
        );
        setUploading(false);
        setDuplicateSubmitting(false);
        router.replace("/admin/dashboard");
        return;
      }

      const uploadRes = await uploadToCloudinary(image, {
        classifyWaste: true,
      });
      const imageUrl =
        typeof uploadRes === "string" ? uploadRes : uploadRes.secureUrl;
      const wasteClassification =
        typeof uploadRes === "object" ? uploadRes.classification : null;

      await addDoc(
        collection(db, "posts"),
        {
          userId: currentUser.uid,

          firstName: userData.firstName,

          lastName: userData.lastName,

          points: userData.points || 0,

          title: hideBadWords(title.trim()),

          caption: hideBadWords(caption.trim()),

          imageUrl,

          locationName,

          barangay: manualBarangay || null,

          purok: normalizePurok(manualPurok) || null,
          street: manualStreet || null,
          municipality: manualMunicipality || "Pinamungajan",
          coordinates:
            postCoordinates,

          status: "moderate",

          wasteClassification: wasteClassification || null,

          reactionCount: 0,

          commentCount: 0,

          createdAt: serverTimestamp(),

          // Duplicate report prevention fields
          isDuplicate: extraFields.isDuplicate ?? false,
          isPointEligible: extraFields.isPointEligible ?? true,
          ...(extraFields.duplicateOf
            ? { duplicateOf: extraFields.duplicateOf }
            : {}),
          ...(extraFields.linkedReportId
            ? { linkedReportId: extraFields.linkedReportId }
            : {}),
          ...(extraFields.vicinityGroupId
            ? { vicinityGroupId: extraFields.vicinityGroupId }
            : {}),
        },
      );

      setDuplicateModalConfig((prev) => ({ ...prev, visible: false }));
      router.replace("/home");
    } catch (error) {
      console.log(error);
      const msg = error.message || "Could not create the post.";

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

            // Record violation log in changeLogs subcollection
            try {
              const cleanedReason = msg.replace(/^Image rejected:\s*/i, "").trim();
              await addDoc(collection(userRef, "changeLogs"), {
                type: "violation",
                field: "nsfw_violation",
                violationType: "nsfw",
                warningNumber: newCount,
                maxWarnings: 3,
                reason: cleanedReason || "Uploaded inappropriate/NSFW content.",
                actionTaken: banned
                  ? "Account Banned (Reached 3 Warnings)"
                  : `Warning ${newCount} of 3 issued`,
                source: "create_post",
                changedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
              });
              await notifyUserAccountWarning({
                userId: currentUser.uid,
                warningNumber: newCount,
                maxWarnings: 3,
                reason: cleanedReason || "Uploaded inappropriate/NSFW content.",
              });
            } catch (logErr) {
              console.warn("Could not write violation log:", logErr);
            }

            setWarningsCount(newCount);
            setWarningIsBanned(banned);
            setWarningReason(msg.replace(/^Image rejected:\s*/i, ""));
            setImage(null); // Clear the violating photo
            setWarningModalVisible(true);
          }
        } catch (dbErr) {
          console.warn("Could not record warning:", dbErr);
          setWarningsCount(1);
          setWarningIsBanned(false);
          setWarningReason(msg.replace(/^Image rejected:\s*/i, ""));
          setImage(null);
          setWarningModalVisible(true);
        }
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setUploading(false);
      setDuplicateSubmitting(false);
    }
  };

  const createPost = async () => {
    if (uploading || duplicateSubmitting) return;

    const locationErrors = validateLocation();
    const nextErrors = {
      ...locationErrors,
      ...(Object.keys(locationErrors).length
        ? { location: "Please set your location using GPS map before posting." }
        : {}),
      ...(!image ? { image: "Please select an image." } : {}),
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      if (Object.keys(locationErrors).length) setGpsModalVisible(true);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrors({ form: "You must be signed in to create a post." });
      return;
    }

    try {
      setUploading(true);

      // Pre-check for active uncleaned reports in vicinity
      const postsSnapshot = await getDocs(
        query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(80)),
      );

      const candidateReport = {
        coordinates: postCoordinates,
        barangay: manualBarangay,
        purok: manualPurok,
      };

      const nearbyReports = [];
      postsSnapshot.forEach((docSnap) => {
        const postData = docSnap.data();
        const postStatus = (postData.status || "moderate").toLowerCase();
        if (postStatus === "cleaned") return;

        const vicResult = checkVicinity(candidateReport, postData);
        if (vicResult.isVicinity) {
          nearbyReports.push({
            id: docSnap.id,
            ...postData,
            distanceMeters: vicResult.distanceMeters,
          });
        }
      });

      if (nearbyReports.length > 0) {
        // 1. If the SAME user already submitted in this vicinity -> Warning Modal (No Points)
        const sameUserReport = nearbyReports.find(
          (p) => p.userId === currentUser.uid,
        );

        if (sameUserReport) {
          setUploading(false);
          setDuplicateModalConfig({
            visible: true,
            mode: "warning",
            existingReport: sameUserReport,
            extraFields: {
              isDuplicate: true,
              isPointEligible: false,
              duplicateOf: sameUserReport.id,
              vicinityGroupId:
                sameUserReport.vicinityGroupId || sameUserReport.id,
            },
          });
          return;
        }

        // 2. If a DIFFERENT user reported in this same vicinity -> Notice Modal (Point Eligible on Cleaned)
        const existingNearby = nearbyReports[0];
        setUploading(false);
        setDuplicateModalConfig({
          visible: true,
          mode: "notice",
          existingReport: existingNearby,
          extraFields: {
            isDuplicate: false,
            isPointEligible: true,
            linkedReportId: existingNearby.id,
            vicinityGroupId:
              existingNearby.vicinityGroupId || existingNearby.id,
          },
        });
        return;
      }

      // 3. No existing report in vicinity -> normal submission
      await performPostSubmission({ isDuplicate: false, isPointEligible: true });
    } catch (err) {
      console.warn("Vicinity pre-check skipped due to error, proceeding:", err);
      await performPostSubmission({ isDuplicate: false, isPointEligible: true });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/signin");
    } catch (_e) {
      router.replace("/signin");
    }
  };

  const guideSteps = [
    {
      stepNumber: 1,
      title: "1. Turn On & Allow Location",
      subtitle: "Precise GPS coordinates are required for community response",
      image: require("../assets/images/guide/step_location.jpg"),
      badge: "Location & GPS",
      badgeColor: "#2E7D32",
      badgeBg: "#E8F5E9",
      content: (
        <View style={styles.guideStepContent}>
          <Text style={styles.guideParagraph}>
            GreenTrace requires GPS location so LGU personnel and waste
            collection teams can find the exact area in Pinamungajan.
          </Text>
          <Text style={styles.guideParagraph}>
            Your device GPS must be turned{" "}
            <Text style={{ fontWeight: "700" }}>ON</Text> and location
            permissions must be{" "}
            <Text style={{ fontWeight: "700" }}>ALLOWED</Text>.
          </Text>

          {/* INTERACTIVE LOCATION PERMISSION CHECKER */}
          <View style={styles.locationHelpBox}>
            <View style={styles.locationHelpHeader}>
              <Ionicons name="location" size={18} color="#276344" />
              <Text style={styles.locationHelpTitle}>
                Location Permission Check
              </Text>
            </View>
            <Text style={styles.locationHelpDesc}>
              Tap below to request or test your browser/device location access:
            </Text>

            <TouchableOpacity
              style={styles.locationCheckBtn}
              onPress={testAndRequestLocationPermission}
              disabled={locationStatus === "checking"}
            >
              {locationStatus === "checking" ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="locate" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.locationCheckBtnText}>
                {locationStatus === "checking"
                  ? "Checking Location..."
                  : locationStatus === "granted"
                    ? "Location Active (Re-check)"
                    : "Ask / Check Location Permission"}
              </Text>
            </TouchableOpacity>

            {locationMessage ? (
              <View
                style={[
                  styles.locationStatusMsgBox,
                  locationStatus === "granted"
                    ? styles.locationStatusGranted
                    : styles.locationStatusDenied,
                ]}
              >
                <Ionicons
                  name={
                    locationStatus === "granted"
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={18}
                  color={locationStatus === "granted" ? "#1B5E20" : "#B71C1C"}
                />
                <Text
                  style={[
                    styles.locationStatusMsgText,
                    {
                      color:
                        locationStatus === "granted" ? "#1B5E20" : "#B71C1C",
                    },
                  ]}
                >
                  {locationMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.locationTipsBox}>
              <Text style={styles.locationTipItem}>
                • <Text style={{ fontWeight: "700" }}>Browser:</Text> If
                prompted, click &apos;Allow&apos;. If blocked, click the lock/settings
                icon next to the URL bar and enable Location.
              </Text>
              <Text style={styles.locationTipItem}>
                • <Text style={{ fontWeight: "700" }}>Device:</Text> Ensure your
                phone&apos;s GPS / Location switch is turned ON.
              </Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      stepNumber: 2,
      title: "2. Take Clear, Landscape Photos",
      subtitle: "Wide horizontal shots give crucial environmental context",
      image: require("../assets/images/guide/step_landscape.jpg"),
      badge: "Photo Quality",
      badgeColor: "#0284C7",
      badgeBg: "#E0F2FE",
      content: (
        <View style={styles.guideStepContent}>
          <Text style={styles.guideParagraph}>
            Clear environmental photos help LGU responders evaluate waste
            volume, severity, and needed equipment:
          </Text>

          <View style={styles.guidelineCard}>
            <View style={styles.guidelineItem}>
              <Ionicons
                name="phone-landscape-outline"
                size={20}
                color="#0284C7"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>
                  Hold Phone in Landscape
                </Text>
                <Text style={styles.guidelineDesc}>
                  Always shoot horizontally (landscape orientation). Wide photos
                  capture landmarks (roads, trees, waterways) to help teams
                  navigate directly to the site.
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Ionicons name="sunny-outline" size={20} color="#0284C7" />
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>Clear & Good Lighting</Text>
                <Text style={styles.guidelineDesc}>
                  Take photos in good daytime lighting. Avoid blurry, shaky, or
                  dark pictures where waste cannot be identified.
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Ionicons name="scan-outline" size={20} color="#0284C7" />
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>
                  Capture the Entire Pile
                </Text>
                <Text style={styles.guidelineDesc}>
                  Stand at a safe distance to frame the entire pile or site
                  rather than extreme close-ups of single items.
                </Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
    {
      stepNumber: 3,
      title: "3. Avoid Selfies, Unrelated & NSFW Pictures",
      subtitle: "Strict rules to prevent automatic Gemini AI rejection",
      image: require("../assets/images/guide/step_avoid.jpg"),
      badge: "Strict AI Rules",
      badgeColor: "#DC2626",
      badgeBg: "#FEE2E2",
      content: (
        <View style={styles.guideStepContent}>
          <Text style={styles.guideParagraph}>
            GreenTrace uses <Text style={{ fontWeight: "700" }}>Gemini AI</Text>{" "}
            to automatically inspect every upload. Ineligible photos will be
            flagged and rejected:
          </Text>

          <View style={styles.guidelineCard}>
            <View style={styles.guidelineItem}>
              <Ionicons
                name="person-remove-outline"
                size={20}
                color="#DC2626"
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.guidelineTitle, { color: "#DC2626" }]}>
                  Avoid Selfies & People
                </Text>
                <Text style={styles.guidelineDesc}>
                  Do NOT take selfies or photos containing people. The camera
                  must focus strictly on the waste or environmental concern.
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Ionicons name="images-outline" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.guidelineTitle, { color: "#DC2626" }]}>
                  No Unrelated Photos
                </Text>
                <Text style={styles.guidelineDesc}>
                  Memes, pets, screenshots, personal items, food, or random
                  indoor items will be flagged by Gemini AI as unrelated.
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Ionicons name="ban" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.guidelineTitle, { color: "#DC2626" }]}>
                  Zero Tolerance for NSFW
                </Text>
                <Text style={styles.guidelineDesc}>
                  Uploading inappropriate, graphic, or adult content triggers
                  account warnings and immediate permanent banning.
                </Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
    {
      stepNumber: 4,
      title: "4. Provide Accurate Details",
      subtitle: "Helpful titles and descriptions ensure quick action",
      image: require("../assets/images/guide/step_details.jpg"),
      badge: "Best Practices",
      badgeColor: "#059669",
      badgeBg: "#D1FAE5",
      content: (
        <View style={styles.guideStepContent}>
          <Text style={styles.guideParagraph}>
            Accurate reports help Gemini AI categorize waste types and enable
            fast dispatch of community volunteer drives:
          </Text>

          <View style={styles.guidelineCard}>
            <View style={styles.guidelineItem}>
              <Ionicons name="text-outline" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>Descriptive Title</Text>
                <Text style={styles.guidelineDesc}>
                  Provide a concise title, e.g., &apos;Illegal plastic dump along
                  creek&apos; or &apos;Trash pile behind public market&apos;.
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Ionicons name="map-outline" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>
                  Verify Barangay & Purok
                </Text>
                <Text style={styles.guidelineDesc}>
                  Confirm that the Barangay and Street / Purok are accurate. You
                  can adjust the pin on the map if needed.
                </Text>
              </View>
            </View>

            <View style={styles.guidelineItem}>
              <Ionicons name="sparkles-outline" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.guidelineTitle}>
                  Mention Specific Materials
                </Text>
                <Text style={styles.guidelineDesc}>
                  Describing the waste (e.g. plastics, metal cans, broken glass,
                  biodegradable) aids Gemini AI in automated categorization.
                </Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
  ];

  const currentGuideStep = guideSteps[guideStep];

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        {/* CONTENT WRAPPER */}
        <View style={styles.contentWrapper}>
          {/* HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={() => router.back()}>
                  <Image
                    source={require("../assets/images/close.png")}
                    style={styles.closeIcon}
                  />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Create Post</Text>
              </View>

              {/* SMALL CIRCLE EXCLAMATION MARK INSTRUCTION BUTTON */}
              <TouchableOpacity
                style={styles.circleExclamationBtn}
                onPress={() => {
                  setGuideStep(0);
                  setGuideModalVisible(true);
                }}
                accessibilityLabel="How to post a report instructions"
              >
                <View style={styles.circleExclamation}>
                  <Text style={styles.circleExclamationText}>!</Text>
                </View>
              </TouchableOpacity>
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getNameInitials(userName)}
                  </Text>
                </View>
                <Text style={styles.username}>{userName}</Text>
              </View>

              <TouchableOpacity
                style={[styles.postButton, uploading && { opacity: 0.6 }]}
                onPress={createPost}
                disabled={uploading}
              >
                <Text style={styles.postText}>
                  {uploading ? "POSTING..." : "POST"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* LOCATION */}
            <TouchableOpacity
              style={[
                styles.locationRow,
                errors.location && styles.errorBorder,
              ]}
              onPress={() => setGpsModalVisible(true)}
            >
              <Image
                source={require("../assets/images/location.png")}
                style={styles.locationIcon}
              />
              <Text style={styles.locationText}>
                {locationName || "Set Location..."}
              </Text>
            </TouchableOpacity>
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

            {/* IMAGE PICKER */}
            <View style={[styles.imageBox, errors.image && styles.inputError]}>
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
          </ScrollView>
        </View>

        {/* POST LOCATION MODAL */}
        <PostLocationModal
          key={gpsModalVisible ? "create-gps-open" : "create-gps-closed"}
          visible={gpsModalVisible}
          onClose={() => setGpsModalVisible(false)}
          initialLocation={locationName}
          initialCoords={postCoordinates}
          post={{
            locationName,
            street: manualStreet,
            purok: manualPurok,
            barangay: manualBarangay,
            municipality: manualMunicipality,
            coordinates: postCoordinates,
          }}
          onSelectLocation={({
            locationName: finalLocation,
            street,
            purok,
            barangay,
            municipality,
            coordinates,
          }) => {
            setLocationName(finalLocation);
            setManualStreet(street);
            setManualPurok(purok);
            setManualBarangay(barangay);
            setManualMunicipality(municipality || "Pinamungajan");
            setPostCoordinates(coordinates);
            setErrors((prev) => {
              const next = { ...prev };
              delete next.location;
              delete next.barangay;
              delete next.purok;
              return next;
            });
            setGpsModalVisible(false);
          }}
        />

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

        {/* Duplicate Report & Vicinity Warning Modal */}
        <DuplicateReportModal
          visible={duplicateModalConfig.visible}
          mode={duplicateModalConfig.mode}
          existingReport={duplicateModalConfig.existingReport}
          loading={duplicateSubmitting}
          onCancel={() => {
            setDuplicateModalConfig((prev) => ({ ...prev, visible: false }));
            setUploading(false);
          }}
          onConfirm={async () => {
            setDuplicateSubmitting(true);
            await performPostSubmission(duplicateModalConfig.extraFields);
          }}
        />

        {/* HOW TO POST REPORT - STEP BY STEP GUIDE MODAL */}
        <Modal
          visible={guideModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGuideModalVisible(false)}
        >
          <View style={styles.guideModalBackdrop}>
            <View style={styles.guideModalContainer}>
              {/* MODAL HEADER */}
              <View style={styles.guideHeader}>
                <View style={styles.guideHeaderLeft}>
                  <View
                    style={[
                      styles.guideBadge,
                      { backgroundColor: currentGuideStep.badgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.guideBadgeText,
                        { color: currentGuideStep.badgeColor },
                      ]}
                    >
                      {currentGuideStep.badge}
                    </Text>
                  </View>
                  <Text style={styles.guideStepCounter}>
                    Step {guideStep + 1} of {guideSteps.length}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setGuideModalVisible(false)}
                  style={styles.guideCloseBtn}
                  accessibilityLabel="Close guide"
                >
                  <Ionicons name="close" size={22} color="#555" />
                </TouchableOpacity>
              </View>

              {/* SCROLLABLE BODY */}
              <ScrollView
                style={styles.guideBodyScroll}
                contentContainerStyle={styles.guideBodyContent}
                showsVerticalScrollIndicator={false}
              >
                {/* CORPORATE MEMPHIS ILLUSTRATION */}
                <View style={styles.guideImageContainer}>
                  <Image
                    source={currentGuideStep.image}
                    style={styles.guideImage}
                    resizeMode="cover"
                  />
                </View>

                {/* STEP TITLE & SUBTITLE */}
                <Text style={styles.guideStepTitle}>
                  {currentGuideStep.title}
                </Text>
                <Text style={styles.guideStepSubtitle}>
                  {currentGuideStep.subtitle}
                </Text>

                {/* STEP CONTENT */}
                {currentGuideStep.content}
              </ScrollView>

              {/* MODAL FOOTER */}
              <View style={styles.guideFooter}>
                {guideStep > 0 ? (
                  <TouchableOpacity
                    style={styles.guideBackBtn}
                    onPress={() =>
                      setGuideStep((prev) => Math.max(0, prev - 1))
                    }
                  >
                    <Ionicons name="chevron-back" size={18} color="#276344" />
                    <Text style={styles.guideBackText}>Back</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.guideSkipBtn}
                    onPress={() => setGuideModalVisible(false)}
                  >
                    <Text style={styles.guideSkipText}>Skip</Text>
                  </TouchableOpacity>
                )}

                {/* STEP DOTS */}
                <View style={styles.guideDotsRow}>
                  {guideSteps.map((_, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.guideDot,
                        idx === guideStep && styles.guideDotActive,
                      ]}
                      onPress={() => setGuideStep(idx)}
                    />
                  ))}
                </View>

                {guideStep < guideSteps.length - 1 ? (
                  <TouchableOpacity
                    style={styles.guideNextBtn}
                    onPress={() =>
                      setGuideStep((prev) =>
                        Math.min(guideSteps.length - 1, prev + 1),
                      )
                    }
                  >
                    <Text style={styles.guideNextText}>Next</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.guideFinishBtn}
                    onPress={() => setGuideModalVisible(false)}
                  >
                    <Text style={styles.guideFinishText}>
                      Got it, Let&apos;s Post!
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
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
  contentWrapper: {
    flex: 1, // 👈 THIS PUSHES NAVBAR DOWN
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
    justifyContent: "space-between",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  circleExclamationBtn: {
    top: 10,
    padding: 4,
    cursor: "pointer",
  },
  circleExclamation: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleExclamationText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
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
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
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

  locationIcon: {
    width: 16,
    height: 16,
    marginRight: 5,
  },
  locationText: {
    color: "#405047",
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
  titleInput: {
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    fontWeight: "600",
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

  gpsModalBox: {
    width: "92%",
    maxWidth: 820,
    padding: 24,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },

  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  modalCancelText: {
    color: "#405047",
    fontSize: 14,
    fontWeight: "600",
  },

  gpsPlaceholder: {
    height: 240,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8E4",
    backgroundColor: "#FAFCFB",
    overflow: "hidden",
  },

  gpsCurrentLocationBtn: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },

  gpsCurrentLocationText: {
    color: "#276344",
    fontSize: 13,
    fontWeight: "700",
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

  gpsLocationError: {
    color: "#B42318",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
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

  modalButton: {
    backgroundColor: "#5F9C76",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },

  modalCancel: {
    padding: 12,
    alignItems: "center",
    marginTop: 6,
  },

  manualInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

  dropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dropdownText: {
    color: "#222",
  },

  placeholderText: {
    color: "#888",
  },

  dropdownArrow: {
    color: "#555",
    fontWeight: "700",
  },

  dropdownList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginTop: -6,
    marginBottom: 10,
  },

  dropdownOption: {
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  inputError: {
    borderColor: "#D93025",
    borderWidth: 1.5,
  },

  purokInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
  },
  purokPrefix: {
    paddingLeft: 10,
    fontWeight: "600",
    color: "#333",
  },
  purokTextInput: {
    flex: 1,
    padding: 10,
  },

  /* GUIDE MODAL STYLES */
  guideModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  guideModalContainer: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2EE",
    backgroundColor: "#FFFFFF",
  },
  guideHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  guideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  guideBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  guideStepCounter: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7E72",
  },
  guideCloseBtn: {
    padding: 4,
    cursor: "pointer",
  },
  guideBodyScroll: {
    flex: 1,
  },
  guideBodyContent: {
    padding: 18,
    paddingBottom: 24,
  },
  guideImageContainer: {
    width: "100%",
    height: 190,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F7F4",
    marginBottom: 14,
  },
  guideImage: {
    width: "100%",
    height: "100%",
  },
  guideStepTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B3B28",
    marginBottom: 4,
  },
  guideStepSubtitle: {
    fontSize: 12,
    color: "#5C7364",
    marginBottom: 14,
    lineHeight: 16,
  },
  guideStepContent: {
    gap: 10,
  },
  guideParagraph: {
    fontSize: 13,
    color: "#334D3C",
    lineHeight: 18,
  },
  guidelineCard: {
    backgroundColor: "#F9FBFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3ECE6",
    padding: 12,
    gap: 12,
    marginTop: 6,
  },
  guidelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  guidelineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E382B",
    marginBottom: 2,
  },
  guidelineDesc: {
    fontSize: 12,
    color: "#546E60",
    lineHeight: 16,
  },
  locationHelpBox: {
    backgroundColor: "#F2F8F4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C6DFD0",
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  locationHelpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationHelpTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E3B29",
  },
  locationHelpDesc: {
    fontSize: 12,
    color: "#50695B",
    lineHeight: 16,
  },
  locationCheckBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#276344",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    cursor: "pointer",
  },
  locationCheckBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  locationStatusMsgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  locationStatusGranted: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  locationStatusDenied: {
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  locationStatusMsgText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  locationTipsBox: {
    marginTop: 4,
    gap: 4,
  },
  locationTipItem: {
    fontSize: 11,
    color: "#576F61",
    lineHeight: 15,
  },
  guideFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EDF2EE",
    backgroundColor: "#FFFFFF",
  },
  guideBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
    cursor: "pointer",
  },
  guideBackText: {
    color: "#276344",
    fontSize: 13,
    fontWeight: "700",
  },
  guideSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    cursor: "pointer",
  },
  guideSkipText: {
    color: "#7E9386",
    fontSize: 13,
    fontWeight: "600",
  },
  guideDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  guideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D0DCD5",
    cursor: "pointer",
  },
  guideDotActive: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#276344",
  },
  guideNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#276344",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
    cursor: "pointer",
  },
  guideNextText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  guideFinishBtn: {
    backgroundColor: "#276344",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    cursor: "pointer",
  },
  guideFinishText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
