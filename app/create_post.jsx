import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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
import { normalizePurok } from "../constants/locationFormat";
import { auth, db } from "../firebaseConfig";
import { hideBadWords } from "../utils/hideBadWords";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

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
].sort((first, second) => first.localeCompare(second));

export default function CreateReport() {
  const [uploading, setUploading] = useState(false);

  const [userName, setUserName] = useState("");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");

  const [image, setImage] = useState(null);

  const [manualBarangay, setManualBarangay] = useState("");
  const [manualPurok, setManualPurok] = useState("");
  const [manualLocationModal, setManualLocationModal] = useState(false);
  const [barangayDropdownOpen, setBarangayDropdownOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [locationName, setLocationName] = useState("");

  const validateLocation = () => ({
    ...(!manualBarangay ? { barangay: "Select a barangay." } : {}),
    ...(!normalizePurok(manualPurok) ? { purok: "Purok is required." } : {}),
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName(`${data.firstName} ${data.lastName}`);
        }
      } catch (error) {
        console.log(error);
      }
    };

    loadUser();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    // Reject videos
    if (asset.type === "video") {
      setErrors((previous) => ({
        ...previous,
        image: "Videos are not supported.",
      }));
      return;
    }

    // 2.5 MB limit
    if (asset.fileSize && asset.fileSize > 2.5 * 1024 * 1024) {
      setErrors((previous) => ({
        ...previous,
        image: "Image must be smaller than 2.5 MB.",
      }));
      return;
    }

    setImage(asset);
    setErrors((previous) => ({ ...previous, image: "" }));
  };

  const createPost = async () => {
    if (uploading) return;

    const locationErrors = validateLocation();
    const nextErrors = {
      ...locationErrors,
      ...(Object.keys(locationErrors).length
        ? { location: "Set a barangay and Pk. before posting." }
        : {}),
      ...(!image ? { image: "Please select an image." } : {}),
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      if (Object.keys(locationErrors).length) setManualLocationModal(true);
      return;
    }

    try {
      setUploading(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setErrors({ form: "You must be signed in to create a post." });
        return;
      }

      const userSnap = await getDoc(doc(db, "users", currentUser.uid));

      const userData = userSnap.data();

      const imageUrl = await uploadToCloudinary(image);

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

          purok: normalizePurok(manualPurok) || null,

          status: "moderate",

          reactionCount: 0,

          commentCount: 0,

          createdAt: serverTimestamp(),
        },
      );

      router.replace("/home");
    } catch (error) {
      console.log(error);
      setErrors({ form: error.message || "Could not create the post." });
    } finally {
      setUploading(false);
    }
  };

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

              <Text style={styles.headerTitle}>Create Post</Text>
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
              onPress={() => setManualLocationModal(true)}
            >
              <Image
                source={require("../assets/images/location.png")}
                style={styles.locationIcon}
              />
              <Text style={styles.locationText}>
                {locationName || "Set Location..."}
              </Text>
            </TouchableOpacity>
            {errors.location && (
              <Text style={styles.fieldError}>{errors.location}</Text>
            )}
            {errors.image && (
              <Text style={styles.fieldError}>{errors.image}</Text>
            )}
            {errors.form && <Text style={styles.formError}>{errors.form}</Text>}

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

        {/* NAVBAR (ALWAYS AT BOTTOM) */}
        <Modal visible={manualLocationModal} transparent animationType="fade">
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
                        setErrors((previous) => ({
                          ...previous,
                          barangay: "",
                          location: "",
                        }));
                      }}
                    >
                      <Text>{barangay}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {errors.barangay && (
                <Text style={styles.fieldError}>{errors.barangay}</Text>
              )}

              <View style={styles.purokInputRow}>
                <Text style={styles.purokPrefix}>Pk.</Text>
                <TextInput
                  placeholder="Example: 3"
                  value={manualPurok}
                  onChangeText={(value) => {
                    setManualPurok(value);
                    setErrors((previous) => ({
                      ...previous,
                      purok: normalizePurok(value) ? "" : "Purok is required.",
                      location: "",
                    }));
                  }}
                  style={[
                    styles.purokTextInput,
                    errors.purok && styles.inputError,
                  ]}
                />
              </View>
              {errors.purok && (
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
                  setErrors((previous) => ({ ...previous, location: "" }));
                  setManualLocationModal(false);
                }}
              >
                <Text>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setManualLocationModal(false)}
              >
                <Text>Cancel</Text>
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
    color: "#555",
  },

  captionInput: {
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
    padding: 10,
    height: 80,
    marginTop: 10,
    textAlignVertical: "top",
  },
  titleInput: {
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    fontWeight: "600",
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

  modalCancel: {
    padding: 12,
    alignItems: "center",
    marginTop: 10,
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
});
