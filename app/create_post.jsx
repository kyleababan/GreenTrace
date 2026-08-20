import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";
import { normalizePurok } from "../constants/locationFormat";

import { auth, db } from "../firebaseConfig";

import { uploadToCloudinary } from "../cloudinary";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function CreateReport() {
  const [uploading, setUploading] = useState(false);

  const [userName, setUserName] = useState("");
  const router = useRouter();
  const [caption, setCaption] = useState("");

  const [image, setImage] = useState(null);

  const [manualProvince, setManualProvince] = useState("");
  const [manualBarangay, setManualBarangay] = useState("");
  const [manualPurok, setManualPurok] = useState("");
  const [manualLocationModal, setManualLocationModal] = useState(false);
  const [locationName, setLocationName] = useState("");

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
      alert("Videos are not supported.");
      return;
    }

    // 2.5 MB limit
    if (asset.fileSize && asset.fileSize > 2.5 * 1024 * 1024) {
      alert("Image must be smaller than 2.5 MB.");
      return;
    }

    setImage(asset);
  };

  const createPost = async () => {
    if (uploading) return;

    if (!image) {
      alert("Please select an image");

      return;
    }

    if (!locationName.trim()) {
      alert("Please set a location before posting.");

      return;
    }

    if (!manualPurok.trim()) {
      alert("Please enter the Purok for this report.");

      return;
    }

    try {
      setUploading(true);

      const currentUser = auth.currentUser;

      if (!currentUser) {
        alert("User not logged in");

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

          caption,

          imageUrl,

          locationName,

          purok: normalizePurok(manualPurok) || null,

          status: "moderate",

          reactionCount: 0,

          commentCount: 0,

          createdAt: serverTimestamp(),
        },
      );

      alert("Post created");

      router.replace("/home");
    } catch (error) {
      console.log(error);

      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
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
              style={styles.locationRow}
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

            {/* CAPTION */}
            <TextInput
              placeholder="Write Something..."
              multiline
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
            />

            {/* IMAGE PICKER */}
            <View style={styles.imageBox}>
              {image ? (
                <>
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage}>
                    <Text style={styles.changePhotoText}>Change photo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.imagePlaceholderContent} onPress={pickImage}>
                  <Image
                    source={require("../assets/images/image.png")}
                    style={styles.imageIcon}
                  />
                  <Text style={styles.imageText}>Choose Image</Text>
                  <Text style={styles.imageHint}>Add a clear photo of the concern</Text>
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

              <TextInput
                placeholder="Province"
                value={manualProvince}
                onChangeText={setManualProvince}
                style={styles.manualInput}
              />

              <TextInput
                placeholder="Barangay"
                value={manualBarangay}
                onChangeText={setManualBarangay}
                style={styles.manualInput}
              />

              <View style={styles.purokInputRow}>
                <Text style={styles.purokPrefix}>Pk.</Text>
                <TextInput
                  placeholder="Example: 3"
                  value={manualPurok}
                  onChangeText={setManualPurok}
                  style={styles.purokTextInput}
                />
              </View>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  const purok = normalizePurok(manualPurok);

                  if (!manualProvince.trim()) {
                    alert("Please enter the Province for this report.");
                    return;
                  }
                  if (!manualBarangay.trim()) {
                    alert("Please enter the Barangay for this report.");
                    return;
                  }
                  if (!purok) {
                    alert("Please enter the Purok for this report.");
                    return;
                  }

                  setManualPurok(purok);
                  setLocationName(
                    `${manualProvince.trim()}, ${manualBarangay.trim()}, Pk. ${purok}`,
                  );
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
    </View>
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
