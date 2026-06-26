import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Navbar from "../components/navbar";

import * as Location from "expo-location";

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

  

  useEffect(() => {

  const loadUser = async () => {

    try {

      const currentUser = auth.currentUser;

      if (!currentUser) return;

      const userSnap = await getDoc(
        doc(db, "users", currentUser.uid)
      );

      if (userSnap.exists()) {

        const data = userSnap.data();

        setUserName(
          `${data.firstName} ${data.lastName}`
        );

      }

    }

    catch (error) {

      console.log(error);

    }

  };

  loadUser();

}, []);

  const [uploading, setUploading] = useState(false);

  const [userName, setUserName] = useState("");
  const router = useRouter();
  const [status, setStatus] = useState("red");
  const [caption, setCaption] = useState("");

const [image, setImage] = useState(null);


const [locationModalVisible, setLocationModalVisible] = useState(false);
const [manualLocation, setManualLocation] = useState("");
const [manualLocationModal, setManualLocationModal] = useState(false);
const [locationName, setLocationName] =
  useState("Set Location...");

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

const getCurrentLocation = async () => {

  try {

    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {

      alert("Location permission denied");

      return;

    }

    const location =
      await Location.getCurrentPositionAsync({});

    const address =
      await Location.reverseGeocodeAsync({

        latitude:
          location.coords.latitude,

        longitude:
          location.coords.longitude,

      });

    if (address.length > 0) {

        const place = [
  address[0].name,
  address[0].street,
  address[0].district,
  address[0].subregion,
  address[0].city,
]
.filter(Boolean)
.join(", ");

      setLocationName(place);

    }

  }

  catch (error) {

    console.log(error);

  }

};

const createPost = async () => {
  if (uploading) return;
  try {
    setUploading(true);
    if (!caption.trim()) {

      alert("Caption is required");

      return;

    }

    if (!image) {

      alert("Please select an image");

      return;

    }

    const currentUser = auth.currentUser;

    if (!currentUser) {

      alert("User not logged in");

      return;

    }

    const userSnap =
      await getDoc(
        doc(
          db,
          "users",
          currentUser.uid
        )
      );

    const userData =
      userSnap.data();

    const imageUrl = await uploadToCloudinary(image);



    await addDoc(
      collection(db, "posts"),

      {

        userId:
          currentUser.uid,

        firstName:
          userData.firstName,

        lastName:
          userData.lastName,

        points:
          userData.points || 0,

        caption,

        imageUrl,

        locationName,

        status:
          status === "red"
            ? "critical"
            : "moderate",

        reactionCount: 0,

        commentCount: 0,

        createdAt:
          serverTimestamp(),

      }
    );

    alert("Post created");

    router.replace("/home");

  }

  catch (error) {

    console.log(error);

    alert(error.message);

  }

  finally {
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
          <View style={styles.content}>

            {/* USER + POST BUTTON */}
            <View style={styles.userRow}>
              <View style={styles.userInfo}>
                <Image
                  source={require("../assets/images/profile2.png")}
                  style={styles.avatar}
                />
                <Text style={styles.username}>
  {userName}
</Text>
              </View>

              <TouchableOpacity
  style={[
    styles.postButton,
    uploading && { opacity: 0.6 },
  ]}
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
  onPress={() => setLocationModalVisible(true)}
>
              <Image
                source={require("../assets/images/location.png")}
                style={styles.locationIcon}
              />
              <Text style={styles.locationText}>
  {locationName}
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
            <TouchableOpacity
  style={styles.imageBox}
  onPress={pickImage}
>
              
              {/* STATUS DOT */}
              <TouchableOpacity
  onPress={() =>
    setStatus(status === "red" ? "yellow" : "red")
  }
  style={[
    styles.statusDot,
    status === "red"
      ? styles.statusRed
      : styles.statusYellow,
  ]}
/>

  {image ? (

    <Image
  source={{ uri: image.uri }}
  style={{
    width: "100%",
    height: "100%",
    borderRadius: 10,
  }}
  resizeMode="cover"
/>

  ) : (

    <View style={styles.imagePlaceholderContent}>
      <Image
        source={require("../assets/images/image.png")}
        style={styles.imageIcon}
      />
      <Text style={styles.imageText}>
        Choose Image or Video
      </Text>
    </View>

  )}

</TouchableOpacity>

          </View>
        </View>

        {/* NAVBAR (ALWAYS AT BOTTOM) */}
        <Modal
  visible={locationModalVisible}
  transparent
  animationType="fade"
>
  <View style={styles.modalBackground}>
    <View style={styles.modalBox}>

      <Text style={styles.modalTitle}>
        Choose Location
      </Text>

      <TouchableOpacity
        style={styles.modalButton}
        onPress={() => {
          setLocationModalVisible(false);
          getCurrentLocation();
        }}
      >
        <Text>📍 Use Current GPS</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modalButton}
        onPress={() => {
          setLocationModalVisible(false);
          setManualLocationModal(true);
        }}
      >
        <Text>✏ Type Manually</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modalCancel}
        onPress={() => setLocationModalVisible(false)}
      >
        <Text>Cancel</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>

<Modal
  visible={manualLocationModal}
  transparent
  animationType="fade"
>
  <View style={styles.modalBackground}>
    <View style={styles.modalBox}>

      <Text style={styles.modalTitle}>
        Enter Location
      </Text>

      <TextInput
        placeholder="Example: Poblacion, Pinamungajan"
        value={manualLocation}
        onChangeText={setManualLocation}
        style={styles.manualInput}
      />

      <TouchableOpacity
        style={styles.modalButton}
        onPress={() => {

          if (manualLocation.trim()) {
            setLocationName(manualLocation);
          }

          setManualLocation("");
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
    padding: 15,
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
    height: 200,
    backgroundColor: "#F2F2F2",
    borderRadius: 10,
    marginTop: 15,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  imagePlaceholderContent: {
    alignItems: "center",
  },

  imageIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },

  imageText: {
    fontSize: 12,
    color: "#555",
  },

  statusDot: {
  width: 30,
  height: 30,
  borderRadius: 20,
  position: "absolute",
  top: 10,
  right: 10,

  zIndex: 999,
  elevation: 999,
},
    
statusRed: {
  backgroundColor: "red",
},

statusYellow: {
  backgroundColor: "yellow",
},

modalBackground: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(0,0,0,0.4)",
},

modalBox: {
  width: "85%",
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
},

});