import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import Navbar from "../components/navbar";

export default function EditProfile() {
  const router = useRouter();

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

              {/* EDIT BADGE */}
              <TouchableOpacity style={styles.editAvatarBadge}>
                <Image
                  source={require("../assets/images/edit.png")} // 👈 replace later
                  style={styles.editIcon}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>Lois Token</Text>
          </View>
        </View>

        {/* FORM */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Edit Profile</Text>

          {["Name", "Email", "Phone Number", "Address"].map((label) => (
            <View key={label} style={styles.inputGroup}>
              <Text style={styles.label}>{label}</Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={`Enter ${label}`}
                />

                {/* <Image
                  source={require("../assets/images/edit.png")} // 👈 replace later
                  style={styles.fieldEditIcon}
                /> */}
              </View>
            </View>
          ))}

          {/* BUTTON */}
          <TouchableOpacity style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>
              Confirm Changes
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
    paddingHorizontal: 20,
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
    top: 66,
  },

  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    right: -70,
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
    fontSize: 13,
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
});