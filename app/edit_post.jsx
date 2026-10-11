import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { deleteFromCloudinary, uploadToCloudinary } from "../cloudinary";
import Navbar from "../components/navbar";
import NsfwWarningModal from "../components/nsfw-warning-modal";
import PostLocationModal from "../components/PostLocationModal";
import {
  formatLocationWithPurok,
  normalizePurok,
  splitLocationDetails,
} from "../constants/locationFormat";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../constants/wasteCategories";
import { auth, db } from "../firebaseConfig";
import { hideBadWords } from "../utils/hideBadWords";


const formatPostedAt = (timestamp) => {
  if (!timestamp) return "Posted just now";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Posted just now";
  return `Posted ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
};

const isPostEditLocked = (postStatus) =>
  ["ongoing", "on-going", "cleaned"].includes(
    String(postStatus || "")
      .trim()
      .toLowerCase(),
  );

export default function EditPost() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [loadingPost, setLoadingPost] = useState(true);
  const [postLocked, setPostLocked] = useState(false);

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
  const [manualStreet, setManualStreet] = useState("");
  const [manualMunicipality, setManualMunicipality] = useState("Pinamungajan");
  const [locationName, setLocationName] = useState("");
  const [gpsModalVisible, setGpsModalVisible] = useState(false);
  const [postCoordinates, setPostCoordinates] = useState(null);
  const [imageSourceModalVisible, setImageSourceModalVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [wasteClassification, setWasteClassification] = useState(null);

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

  useEffect(() => {
    let isMounted = true;
    const fetchPost = async () => {
      try {
        const snapshot = await getDoc(doc(db, "posts", id));

        if (!isMounted) return;
        if (!snapshot.exists()) {
          setErrors({ form: "Post not found." });
          router.back();
          return;
        }

        const data = snapshot.data();
        if (isPostEditLocked(data.status)) {
          setPostLocked(true);
          return;
        }

        setTitle(data.title || "");
        setCaption(data.caption || "");
        setCreatedAt(data.createdAt || null);
        setLocationName(data.locationName || "");
        setStatus((data.status || "moderate").toLowerCase());
        setWasteClassification(data.wasteClassification || null);

        const parsedLoc = splitLocationDetails(
          data.locationName,
          data.purok,
          data.barangay,
          data.municipality || "Pinamungajan",
        );
        setManualBarangay(parsedLoc.barangay);
        setManualPurok(parsedLoc.purokOrSitio);
        setManualStreet(parsedLoc.street || data.street || "");
        setManualMunicipality(
          parsedLoc.municipality || data.municipality || "Pinamungajan",
        );
        setLocationName(
          formatLocationWithPurok(
            parsedLoc.street || data.street,
            parsedLoc.purokOrSitio,
            parsedLoc.barangay,
            parsedLoc.municipality || data.municipality || "Pinamungajan",
          ) || data.locationName || "",
        );

        if (
          Number.isFinite(Number(data.coordinates?.latitude)) &&
          Number.isFinite(Number(data.coordinates?.longitude)) &&
          data.coordinates?.latitude != null &&
          data.coordinates?.longitude != null
        ) {
          const lat = parseFloat(Number(data.coordinates.latitude).toFixed(6));
          const lng = parseFloat(Number(data.coordinates.longitude).toFixed(6));
          setPostCoordinates({ latitude: lat, longitude: lng });
        }

        setOriginalImageUrl(data.imageUrl || null);
        setImage({ uri: data.imageUrl, isNew: false });
      } catch (error) {
        console.log(error);
        if (isMounted) setErrors({ form: "Unable to load the post." });
      } finally {
        if (isMounted) setLoadingPost(false);
      }
    };

    fetchPost();
    return () => {
      isMounted = false;
    };
  }, [id, router]);

  const detectGpsLocation = () => {
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

    setImage({ ...asset, isNew: true });
    setErrors((previous) => {
      const next = { ...previous };
      delete next.image;
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Location validation (barangay is required; street, purok are optional)
  // -------------------------------------------------------------------------
  const validateLocation = () => ({
    ...(!manualBarangay ? { barangay: "Barangay is required." } : {}),
  });

  // -------------------------------------------------------------------------
  // Save / update the post
  // -------------------------------------------------------------------------
  const updatePost = async () => {
    if (uploading) return;
    if (postLocked) return;

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

      const latestPost = await getDoc(doc(db, "posts", id));
      if (!latestPost.exists()) {
        throw new Error("This report is no longer available.");
      }
      if (isPostEditLocked(latestPost.data().status)) {
        setPostLocked(true);
        return;
      }

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
        street: manualStreet || null,
        barangay: manualBarangay || null,
        purok: normalizePurok(manualPurok) || null,
        municipality: manualMunicipality || "Pinamungajan",
        imageUrl,
      };

      if (postCoordinates) {
        updates.coordinates = postCoordinates;
      }

      if (newClassification) {
        updates.wasteClassification = newClassification;
        setWasteClassification(newClassification);
      }

      updates.status = status;

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
                source: "edit_post",
                changedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
              });
            } catch (logErr) {
              console.warn("Could not write violation log:", logErr);
            }

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
    } catch (_e) {
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

  if (postLocked) {
    return (
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.container}>
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()}>
                <Image
                  source={require("../assets/images/close.png")}
                  style={styles.closeIcon}
                />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Post Locked</Text>
            </View>
          </View>
          <View style={styles.lockedPostState}>
            <Text style={styles.lockedPostTitle}>
              This report can’t be changed
            </Text>
            <Text style={styles.lockedPostMessage}>
              Reports marked On-going or Cleaned can’t be edited or deleted.
            </Text>
            <TouchableOpacity
              style={styles.lockedPostButton}
              onPress={() => router.back()}
            >
              <Text style={styles.lockedPostButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
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
                {formatLocationWithPurok(locationName) || locationName || "Set Location..."}
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

          </ScrollView>
        </View>

        {/* POST LOCATION MODAL */}
        <PostLocationModal
          key={gpsModalVisible ? "edit-gps-open" : "edit-gps-closed"}
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
  lockedPostState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  lockedPostTitle: {
    color: "#24352A",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  lockedPostMessage: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  lockedPostButton: {
    marginTop: 6,
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  lockedPostButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
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
    height: 150,
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

});
