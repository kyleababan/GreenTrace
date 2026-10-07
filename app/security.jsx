import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FormError from "../components/form-error";
import Navbar from "../components/navbar";
import { auth, db } from "../firebaseConfig";
import { getAuthErrorMessage } from "../utils/authErrors";

export default function Security() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [displayEmail, setDisplayEmail] = useState(currentUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailUpdating, setEmailUpdating] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSyncError, setEmailSyncError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let isSyncing = false;

      const syncVerifiedEmail = async () => {
        if (!currentUser || isSyncing) return;

        isSyncing = true;
        try {
          await reload(currentUser);
          if (!isActive || !currentUser.email) return;
          setDisplayEmail(currentUser.email);
          setEmailSyncError("");

          const profileRef = doc(db, "users", currentUser.uid);
          const profile = await getDoc(profileRef);
          if (
            isActive &&
            profile.exists() &&
            profile.data().email !== currentUser.email
          ) {
            const oldEmail = String(profile.data().email || "");
            const batch = writeBatch(db);
            batch.update(profileRef, { email: currentUser.email });
            batch.set(doc(collection(profileRef, "changeLogs")), {
              field: "email",
              oldValue: oldEmail,
              newValue: currentUser.email,
              source: "verified_email_change",
              changedAt: serverTimestamp(),
            });
            await batch.commit();
          }
        } catch (error) {
          console.error("Could not sync verified account email:", error);
          if (isActive) {
            setEmailSyncError(
              "Your verified sign-in email could not be synced to your profile. Reopen this screen when you have a connection.",
            );
          }
        } finally {
          isSyncing = false;
        }
      };

      syncVerifiedEmail();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") syncVerifiedEmail();
      });
      return () => {
        isActive = false;
        subscription.remove();
      };
    }, [currentUser]),
  );

  const changeEmail = async () => {
    const normalizedEmail = newEmail.trim();
    if (!normalizedEmail || !emailPassword) {
      setEmailError("Enter the new email address and your current password.");
      return;
    }

    if (!currentUser?.email) {
      setEmailError(
        "Your account email could not be found. Please sign in again.",
      );
      return;
    }

    if (normalizedEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      setEmailError("Enter an email address different from your current one.");
      return;
    }

    setEmailUpdating(true);
    setEmailError("");
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        emailPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await verifyBeforeUpdateEmail(currentUser, normalizedEmail);

      setEmailModalVisible(false);
      setNewEmail("");
      setEmailPassword("");
      Alert.alert(
        "Verification sent",
        `A verification link was sent to ${normalizedEmail}. Your sign-in email will change only after you verify it.`,
      );
    } catch (error) {
      console.error("Error requesting email change:", error);
      setEmailError(
        getAuthErrorMessage(
          error,
          "Could not request the email change. Please try again.",
        ),
      );
    } finally {
      setEmailUpdating(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !repeatPassword) {
      Alert.alert("Missing Fields", "Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        "Weak Password",
        "New password must be at least 8 characters long.",
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

              {/* EMAIL FORM CARD */}
              <View style={styles.formCard}>
                <Text style={styles.cardSectionTitle}>Sign-in Email</Text>
                <Text style={styles.currentEmail}>
                  {displayEmail || "No email address found"}
                </Text>
                {emailSyncError ? <FormError message={emailSyncError} /> : null}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setEmailError("");
                    setEmailModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mail-outline" size={18} color="#4B7F5F" />
                  <Text style={styles.secondaryButtonText}>Change Email</Text>
                </TouchableOpacity>
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
                      placeholder="At least 8 characters"
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

          <Modal
            visible={emailModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              if (!emailUpdating) setEmailModalVisible(false);
            }}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.emailModal}>
                <View style={styles.modalHeading}>
                  <View style={styles.modalIcon}>
                    <Ionicons
                      name="mail-unread-outline"
                      size={22}
                      color="#4B7F5F"
                    />
                  </View>
                  <Text style={styles.modalTitle}>Change sign-in email</Text>
                </View>
                <Text style={styles.modalWarning}>
                  This will replace the email you use to sign in after you
                  verify the new address. You can request another change later,
                  but you will need to verify this address before it takes
                  effect.
                </Text>
                <Text style={styles.label}>New Email Address</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEmail}
                  onChangeText={(value) => {
                    setNewEmail(value);
                    setEmailError("");
                  }}
                  placeholder="Enter new email address"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                />
                <Text style={styles.label}>Current Password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={emailPassword}
                  onChangeText={(value) => {
                    setEmailPassword(value);
                    setEmailError("");
                  }}
                  placeholder="Confirm your current password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  textContentType="password"
                />
                <FormError message={emailError} />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setEmailModalVisible(false)}
                    disabled={emailUpdating}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      styles.modalConfirmButton,
                      emailUpdating && styles.confirmButtonDisabled,
                    ]}
                    onPress={changeEmail}
                    disabled={emailUpdating}
                    activeOpacity={0.8}
                  >
                    {emailUpdating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        Send Verification
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
  currentEmail: {
    color: "#334155",
    fontSize: 15,
    marginBottom: 4,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#4B7F5F",
    fontSize: 14,
    fontWeight: "700",
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  emailModal: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
  },
  modalHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
  },
  modalTitle: {
    flex: 1,
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "700",
  },
  modalWarning: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#1E293B",
    fontSize: 14,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  modalConfirmButton: {
    marginTop: 0,
    paddingHorizontal: 14,
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
