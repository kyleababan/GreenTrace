import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
import { normalizePurok } from "../constants/locationFormat";
import {
  formatWasteLabel,
  getWasteCategoryColor,
} from "../constants/wasteCategories";
import { auth, db } from "../firebaseConfig";
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
  const [locationChoiceModal, setLocationChoiceModal] = useState(false);
  const [manualLocationModal, setManualLocationModal] = useState(false);
  const [barangayDropdownOpen, setBarangayDropdownOpen] = useState(false);
  const [locationName, setLocationName] = useState("");
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

      setOriginalImageUrl(data.imageUrl || null);
      setImage({ uri: data.imageUrl, isNew: false });
    } catch (error) {
      console.log(error);
      setErrors({ form: "Unable to load the post." });
    } finally {
      setLoadingPost(false);
    }
  };

  // -------------------------------------------------------------------------
  // Image picker — mirrors create_post.jsx logic
  // -------------------------------------------------------------------------
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    if (asset.type === "video") {
      setErrors((prev) => ({ ...prev, image: "Videos are not supported." }));
      return;
    }

    // 2.5 MB limit
    if (asset.fileSize && asset.fileSize > 2.5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        image: "Image must be smaller than 2.5 MB.",
      }));
      return;
    }

    setImage({ ...asset, isNew: true });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Location validation (barangay + purok required)
  // -------------------------------------------------------------------------
  const validateLocation = () => ({
    ...(!manualBarangay ? { barangay: "Select a barangay." } : {}),
    ...(!normalizePurok(manualPurok) ? { purok: "Purok is required." } : {}),
  });

  // -------------------------------------------------------------------------
  // Save / update the post
  // -------------------------------------------------------------------------
  const updatePost = async () => {
    if (uploading) return;

    const nextErrors = {
      ...(!image ? { image: "Please select an image." } : {}),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

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
        imageUrl,
      };

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
              onPress={() => setLocationChoiceModal(true)}
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
                    onPress={pickImage}
                  >
                    <Text style={styles.changePhotoText}>Change photo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.imagePlaceholderContent}
                  onPress={pickImage}
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

        {/* LOCATION CHOICE MODAL */}
        <Modal
          visible={locationChoiceModal}
          transparent
          animationType="fade"
          onRequestClose={() => setLocationChoiceModal(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Choose Location Method</Text>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setLocationChoiceModal(false);
                  setManualLocationModal(true);
                }}
              >
                <Text style={styles.modalButtonText}>Add Manually</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setLocationChoiceModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MANUAL LOCATION MODAL — barangay + purok, same as create_post */}
        <Modal
          visible={manualLocationModal}
          transparent
          animationType="fade"
          onRequestClose={() => setManualLocationModal(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Enter Location</Text>

              <TouchableOpacity
                style={[styles.dropdown, errors.barangay && styles.inputError]}
                onPress={() => setBarangayDropdownOpen((open) => !open)}
              >
                <Text
                  style={
                    manualBarangay
                      ? styles.dropdownText
                      : styles.placeholderText
                  }
                >
                  {manualBarangay || "Select Barangay"}
                </Text>
                <Text style={styles.dropdownArrow}>
                  {barangayDropdownOpen ? "^" : "v"}
                </Text>
              </TouchableOpacity>

              {barangayDropdownOpen && (
                <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                  {BARANGAYS.map((barangay) => (
                    <TouchableOpacity
                      key={barangay}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setManualBarangay(barangay);
                        setBarangayDropdownOpen(false);
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.barangay;
                          delete next.location;
                          return next;
                        });
                      }}
                    >
                      <Text>{barangay}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {!!errors.barangay && (
                <Text style={styles.fieldError}>{errors.barangay}</Text>
              )}

              <View style={styles.purokInputRow}>
                <Text style={styles.purokPrefix}>Pk.</Text>
                <TextInput
                  placeholder="Example: 3"
                  value={manualPurok}
                  onChangeText={(value) => {
                    setManualPurok(value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      if (normalizePurok(value)) {
                        delete next.purok;
                      } else {
                        next.purok = "Purok is required.";
                      }
                      delete next.location;
                      return next;
                    });
                  }}
                  style={[
                    styles.purokTextInput,
                    errors.purok && styles.inputError,
                  ]}
                />
              </View>
              {!!errors.purok && (
                <Text style={styles.fieldError}>{errors.purok}</Text>
              )}

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  const nextErrors = validateLocation();
                  setErrors(nextErrors);
                  if (Object.values(nextErrors).some(Boolean)) return;

                  const purok = normalizePurok(manualPurok);
                  setManualPurok(purok);
                  setLocationName(`${manualBarangay}, Pk. ${purok}`);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.location;
                    return next;
                  });
                  setManualLocationModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setManualLocationModal(false)}
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

  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },

  dropdownText: {
    color: "#24352A",
    fontSize: 14,
  },

  placeholderText: {
    color: "#999",
    fontSize: 14,
  },

  dropdownArrow: {
    color: "#405047",
    fontSize: 12,
  },

  dropdownList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 4,
  },

  dropdownOption: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },

  purokInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  purokPrefix: {
    fontWeight: "700",
    color: "#24352A",
    marginRight: 6,
    fontSize: 14,
  },

  purokTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#24352A",
  },
});
