import React, { useState } from "react";
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

export default function Security() {
  const router = useRouter();

  // Labels for the password fields
  const fields = ["Current Password", "New Password", "Repeat Password"];

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER SECTION */}
        <View style={styles.header}>
          

          {/* CENTERED USER INFO */}
          <View style={styles.userInfoContainer}>
            <TouchableOpacity onPress={() => router.back()}>
            <Image
              source={require("../assets/images/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
            <View style={styles.avatarWrapper}>
              <Image
                source={require("../assets/images/profile.png")}
                style={styles.profileAvatar}
              />
            </View>
            <Text style={styles.userName}>Lois Token</Text>
          </View>
        </View>

        {/* FORM SECTION */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Change Password</Text>

          {fields.map((label) => (
            <View key={label} style={styles.inputGroup}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={true} // Hides the password
                  placeholder=""
                />
              </View>
            </View>
          ))}

          {/* CONFIRM BUTTON */}
          <TouchableOpacity style={styles.confirmButton}>
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
    paddingHorizontal: 20,
    paddingBottom: 50,
    alignItems: "center", // Centers items in the header
  },
 backIcon: {
    width: 45,
    height: 45,
    resizeMode: "contain",
    top: 3,
    right: 35,
    
  },
  
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    top: 35,
    right: 30,
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