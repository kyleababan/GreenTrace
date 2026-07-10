import { useRouter } from "expo-router";
import {
    doc,
    getDoc,
    updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Navbar from "../components/navbar";

import { auth, db } from "../firebaseConfig";

export default function EditProfile() {
  const router = useRouter();

  const currentUser = auth.currentUser;

const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");
const [email, setEmail] = useState("");
const [cellNumber, setcellNumber] = useState("");

const [editable, setEditable] = useState({
    firstName: false,
    lastName: false,
    email: false,
    cellNumber: false,
});

const loadCurrentUser = async () => {

    if (!currentUser) return;

    const snapshot = await getDoc(
        doc(db, "users", currentUser.uid)
    );

    if (snapshot.exists()) {

        const data = snapshot.data();

        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setEmail(data.email || "");
        setcellNumber(data.cellNumber || "");

    }

};

const saveProfile = async () => {

    if (!currentUser) return;

    setSaving(true);

    try {

        await updateDoc(
            doc(db, "users", currentUser.uid),
            {
                firstName,
                lastName,
                email,
                cellNumber,
            }
        );

        setEditable({
            firstName: false,
            lastName: false,
            email: false,
            cellNumber: false,
        });

    } catch (error) {

        console.log(error);

    } finally {

        setSaving(false);

    }

};

useEffect(() => {

    loadCurrentUser();

}, []);

const [saving, setSaving] = useState(false);
  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER */}
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

        {/* FORM */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Edit Profile</Text>

          <View style={styles.inputGroup}>

    <Text style={styles.label}>
        First Name
    </Text>

    <View style={styles.inputWrapper}>

        <TextInput
            style={[
                styles.input,
                editable.firstName && styles.inputEditing,
            ]}
            value={firstName}
            onChangeText={setFirstName}
            editable={editable.firstName}
        />

        <TouchableOpacity
            onPress={() =>
                setEditable(prev => ({
                    ...prev,
                    firstName: !prev.firstName,
                }))
            }
        >

            <Image
                source={require("../assets/images/editlabel.png")}
                style={styles.fieldEditIcon}
            />

        </TouchableOpacity>

    </View>

</View>

{/* LAST NAME */}

<View style={styles.inputGroup}>

    <Text style={styles.label}>
        Last Name
    </Text>

    <View style={styles.inputWrapper}>

        <TextInput
            style={[
                styles.input,
                editable.lastName && styles.inputEditing,
            ]}
            value={lastName}
            onChangeText={setLastName}
            editable={editable.lastName}
        />

        <TouchableOpacity
            onPress={() =>
                setEditable(prev => ({
                    ...prev,
                    lastName: !prev.lastName,
                }))
            }
        >

            <Image
                source={require("../assets/images/editlabel.png")}
                style={styles.fieldEditIcon}
            />

        </TouchableOpacity>

    </View>

</View>

{/* EMAIL */}

<View style={styles.inputGroup}>

    <Text style={styles.label}>
        Email
    </Text>

    <View style={styles.inputWrapper}>

        <TextInput
            style={[
                styles.input,
                editable.email && styles.inputEditing,
            ]}
            value={email}
            onChangeText={setEmail}
            editable={editable.email}
        />

        <TouchableOpacity
            onPress={() =>
                setEditable(prev => ({
                    ...prev,
                    email: !prev.email,
                }))
            }
        >

            <Image
                source={require("../assets/images/editlabel.png")}
                style={styles.fieldEditIcon}
            />

        </TouchableOpacity>

    </View>

</View>

{/* PHONE */}

<View style={styles.inputGroup}>

    <Text style={styles.label}>
        Phone Number
    </Text>

    <View style={styles.inputWrapper}>

        <TextInput
            style={[
                styles.input,
                editable.cellNumber && styles.inputEditing,
            ]}
            value={cellNumber}
            onChangeText={setcellNumber}
            editable={editable.cellNumber}
        />

        <TouchableOpacity
            onPress={() =>
                setEditable(prev => ({
                    ...prev,
                    cellNumber: !prev.cellNumber,
                }))
            }
        >

            <Image
                source={require("../assets/images/editlabel.png")}
                style={styles.fieldEditIcon}
            />

        </TouchableOpacity>

    </View>

</View>

          {/* BUTTON */}
         <TouchableOpacity
    style={styles.confirmButton}
    onPress={saveProfile}
    disabled={saving}
>

    <Text style={styles.confirmButtonText}>
        {saving
            ? "Saving..."
            : "Confirm Changes"}
    </Text>

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
    alignItems: "center", // ✅ prevents stretch
    backgroundColor: "#ffffff",
  },

  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500, // ✅ consistent with your app
    backgroundColor: "#F2F2F2",
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
    width: 70,
    height: 70,
    borderRadius: 30,
    backgroundColor: "#5F9C76",
  },

  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  editIcon: {
    width: 25,
    height: 25,
  },

  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    marginLeft: 12,
  },

  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 15,
  },

  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  inputGroup: {
    marginBottom: 12,
  },

  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    color: "#333",
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D9D9D9",
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
  },

 input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
},

  fieldEditIcon: {
    width: 14,
    height: 14,
    opacity: 0.6,
  },

  confirmButton: {
    backgroundColor: "#5F9C76",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },

  confirmButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },

  navbarContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  inputEditing: {
    color: "#666",
},
fieldEditIcon: {
    width: 22,
    height: 22,
    marginLeft: 10,
    resizeMode: "contain",
},

});