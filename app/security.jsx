import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";
import { auth } from "../firebaseConfig";

export default function Security() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [updating, setUpdating] = useState(false);

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !repeatPassword) {
      Alert.alert("Missing Fields", "Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        "Weak Password",
        "New password must be at least 6 characters long.",
      );
      return;
    }

    if (newPassword !== repeatPassword) {
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }

    if (!currentUser?.email) {
      Alert.alert("Error", "User account email not found.");
      return;
    }

    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      Alert.alert("Success", "Your password has been updated successfully.");

      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (error) {
      console.log("Error updating password:", error);
      let errorMsg = error.message;
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        errorMsg = "Your current password is incorrect. Please try again.";
      }
      Alert.alert("Update Failed", errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* TOP HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTextWrapper}>
                <Text style={styles.headerTitle}>Security</Text>
                <Text style={styles.headerSubtitle}>
                  Update your password and secure your account
                </Text>
              </View>
            </View>
          </View>

          {/* MAIN FORM */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* SECURITY INFO BANNER */}
              <View style={styles.securityBanner}>
                <View style={styles.securityBannerIcon}>
                  <Ionicons name="shield-checkmark" size={24} color="#2E7D32" />
                </View>
                <View style={styles.securityBannerText}>
                  <Text style={styles.bannerTitle}>Account Security</Text>
                  <Text style={styles.bannerSubtitle}>
                    Ensure your account stays protected by using a strong,
                    unique password.
                  </Text>
                </View>
              </View>

              {/* PASSWORD FORM CARD */}
              <View style={styles.formCard}>
                <Text style={styles.cardSectionTitle}>Change Password</Text>

                {/* CURRENT PASSWORD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Current Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      secureTextEntry={!showCurrent}
                      placeholder="Enter current password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowCurrent(!showCurrent)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showCurrent ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* NEW PASSWORD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNew}
                      placeholder="At least 6 characters"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowNew(!showNew)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showNew ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* REPEAT PASSWORD */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={repeatPassword}
                      onChangeText={setRepeatPassword}
                      secureTextEntry={!showRepeat}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowRepeat(!showRepeat)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showRepeat ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SUBMIT BUTTON */}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    updating && styles.confirmButtonDisabled,
                  ]}
                  onPress={changePassword}
                  disabled={updating}
                  activeOpacity={0.8}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.confirmButtonText}>
                        Update Password
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* TIPS CARD */}
              <View style={styles.tipsCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#5F9C76"
                />
                <Text style={styles.tipsText}>
                  After changing your password, keep it confidential and avoid
                  sharing it with others.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* NAVBAR */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#5F9C76",
  },
  wrapper: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F5F5F5",
  },
  topSection: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    color: "#E8F3EC",
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },

  /* SECURITY BANNER */
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    gap: 12,
  },
  securityBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  securityBannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F3326",
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "#4B6B58",
    lineHeight: 16,
  },

  /* FORM CARD */
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1E293B",
  },
  eyeButton: {
    padding: 8,
  },

  /* CONFIRM BUTTON */
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5F9C76",
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  /* TIPS */
  tipsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tipsText: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },

  /* NAVBAR */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
