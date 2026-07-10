import { useEffect, useState } from "react";

import {
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import Navbar from "../components/navbar";

import { auth, db } from "../firebaseConfig";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

export default function Security() {
  const router = useRouter();

  const currentUser = auth.currentUser;

const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [repeatPassword, setRepeatPassword] = useState("");
const [editCurrent, setEditCurrent] = useState(false);
const [editNew, setEditNew] = useState(false);
const [editRepeat, setEditRepeat] = useState(false);
const [showCurrent, setShowCurrent] = useState(false);
const [showNew, setShowNew] = useState(false);
const [showRepeat, setShowRepeat] = useState(false);
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");

useEffect(() => {
  loadCurrentUser();
}, []);

  // Labels for the password fields
 
const loadCurrentUser = async () => {

    if (!currentUser) return;

    try {

        const snapshot = await getDoc(
            doc(db, "users", currentUser.uid)
        );

        if (snapshot.exists()) {

            const data = snapshot.data();

            setFirstName(data.firstName || "");
            setLastName(data.lastName || "");

        }

    } catch (error) {

        console.log(error);

    }

};

  const changePassword = async () => {

    if (!currentPassword || !newPassword || !repeatPassword) {
        Alert.alert("Error", "Please fill in all fields.");
        return;
    }

    if (newPassword !== repeatPassword) {
        Alert.alert("Error", "Passwords do not match.");
        return;
    }

    try {

        const credential = EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );

        await reauthenticateWithCredential(
            currentUser,
            credential
        );

        await updatePassword(
            currentUser,
            newPassword
        );

        Alert.alert(
            "Success",
            "Password updated successfully."
        );

        setCurrentPassword("");
        setNewPassword("");
        setRepeatPassword("");

    } catch (error) {

        Alert.alert(
            "Error",
            error.message
        );

    }

};
  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER SECTION */}
        <View style={styles.header}>

    <TouchableOpacity onPress={() => router.back()}>
        <Image
            source={require("../assets/images/back.png")}
            style={styles.backIcon}
        />
    </TouchableOpacity>

    <View style={styles.userInfoContainer}>

        <View style={styles.avatarWrapper}>

            <Image
                source={require("../assets/images/profile.png")}
                style={styles.profileAvatar}
            />
        </View>

        <Text style={styles.userName}>
            {firstName} {lastName}
        </Text>

    </View>

</View>
        {/* FORM SECTION */}


        <View style={styles.formContainer}>

          
        <Text style={styles.label}>
Current Password
</Text>

<View style={styles.inputWrapper}>
<TextInput
style={styles.input}
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry={!showCurrent}
/>

 <TouchableOpacity
    onPress={() => setShowCurrent(!showCurrent)}
>

<Image
    source={
        showCurrent
            ? require("../assets/images/show.png")
            : require("../assets/images/hide.png")
    }
    style={[
        styles.eyeIcon,
        showCurrent && { opacity: 0.4 }
    ]}
/>

</TouchableOpacity>
</View>
          <Text style={styles.label}>
New Password
</Text>

<View style={styles.inputWrapper}>
 <TextInput
        style={styles.input}
        secureTextEntry
  
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry={!showNew}
    />

    <TouchableOpacity
        onPress={() => setShowNew(!showNew)}
    >

        <Image
    source={
        showNew
            ? require("../assets/images/show.png")
            : require("../assets/images/hide.png")
    }
    style={[
        styles.eyeIcon,
        showNew && { opacity: 0.4 }
    ]}
/>

</TouchableOpacity>
</View>

<Text style={styles.label}>
Repeat Password
</Text>

<View style={styles.inputWrapper}>
<TextInput
        style={styles.input}
        secureTextEntry

        value={repeatPassword}
        onChangeText={setRepeatPassword}
        secureTextEntry={!showRepeat}
    />

    <TouchableOpacity
        onPress={() => setShowRepeat(!showRepeat)}
    >

        <Image
    source={
        showRepeat
            ? require("../assets/images/show.png")
            : require("../assets/images/hide.png")
    }
    style={[
        styles.eyeIcon,
        showRepeat && { opacity: 0.4 }
    ]}
/>

</TouchableOpacity>
</View>

          {/* CONFIRM BUTTON */}
          <TouchableOpacity
style={styles.confirmButton}
onPress={changePassword}
>
            <Text style={styles.confirmButtonText}>Confirm Changes?</Text>
          </TouchableOpacity>
        </View>

        {/* NAVBAR */}
        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#ffffff", // Matches the top header color
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F2F2F2", // Light grey background
  },
 header: {
    backgroundColor: "#5F9C76",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 25,
},

  backButton: {
    backgroundColor: "#FFF",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  backIcon: {
    width: 45,
    height: 45,
    resizeMode: "contain",
},

 userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 15,
    flex: 1,
},

  avatarWrapper: {
    position: "relative",

  },
  
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#5F9C76",
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#666",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#5F9C76",
  },
  editIcon: {
    width: 14,
    height: 14,
    tintColor: "#fff",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
    marginLeft: 15,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 35,
    paddingTop: 25,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#000",
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#000",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D9D9D9", // Matches the darker grey in your image
    borderRadius: 5,
    paddingHorizontal: 12,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  

   eyeIcon: {
    width: 20,
    height: 20,
    opacity: 0.7,
  },
  confirmButton: {
    backgroundColor: "#5F9C76",
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 40,
    alignItems: "center",
    // Matches the shadow/elevation in your image
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  confirmButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  navbarContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
});