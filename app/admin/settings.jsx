import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

// ---------------------------------------------------------------------------
// Default EcoPoints values (fallback when Firestore doc doesn't exist yet)
// ---------------------------------------------------------------------------
const DEFAULT_ECOPOINTS = {
  reportCleaned: "5",
  volunteerCleanup: "10",
  volunteerEvent: "8",
};

// ---------------------------------------------------------------------------
// Default Notification values
// ---------------------------------------------------------------------------
const DEFAULT_APP_CONFIG = {
  pushNotificationsEnabled: true,
  emailAlertsEnabled: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSettings() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pagePadding = width < 768 ? 12 : width < 1024 ? 16 : 22;

  // ---- Global loading state (initial data fetch) ----
  const [initialLoading, setInitialLoading] = useState(true);

  // ---- Account ----
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // Edit Profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Change Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // ---- EcoPoints Config ----
  const [ecoPoints, setEcoPoints] = useState({ ...DEFAULT_ECOPOINTS });
  const [ecoPointsSaving, setEcoPointsSaving] = useState(false);
  const [ecoPointsStatus, setEcoPointsStatus] = useState(null); // { type: "success"|"error", msg }

  // ---- Notifications ----
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);

  // ---------------------------------------------------------------------------
  // On mount — load settings + admin profile in parallel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setInitialLoading(true);
    try {
      const user = auth.currentUser;

      const promises = [
        getDoc(doc(db, "settings", "ecopoints")),
        getDoc(doc(db, "settings", "appConfig")),
        user ? getDoc(doc(db, "users", user.uid)) : Promise.resolve(null),
      ];

      const [ecoSnap, appSnap, userSnap] = await Promise.all(promises);

      // EcoPoints
      if (ecoSnap.exists()) {
        const data = ecoSnap.data();
        setEcoPoints({
          reportCleaned: String(
            data.reportCleaned ?? DEFAULT_ECOPOINTS.reportCleaned,
          ),
          volunteerCleanup: String(
            data.volunteerCleanup ?? DEFAULT_ECOPOINTS.volunteerCleanup,
          ),
          volunteerEvent: String(
            data.volunteerEvent ?? DEFAULT_ECOPOINTS.volunteerEvent,
          ),
        });
      }

      // Notifications
      if (appSnap.exists()) {
        const data = appSnap.data();
        setPushEnabled(
          data.pushNotificationsEnabled ??
            DEFAULT_APP_CONFIG.pushNotificationsEnabled,
        );
        setEmailAlertsEnabled(
          data.emailAlertsEnabled ?? DEFAULT_APP_CONFIG.emailAlertsEnabled,
        );
      }

      // Admin profile
      if (user) {
        setAdminEmail(user.email || "");
        if (userSnap && userSnap.exists()) {
          const userData = userSnap.data();
          const firstName = userData.firstName || "";
          const lastName = userData.lastName || "";
          setAdminName(`${firstName} ${lastName}`.trim() || user.email);
          setEditFirstName(firstName);
          setEditLastName(lastName);
        }
      }
    } catch (error) {
      console.error("AdminSettings: failed to load settings:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Account — Edit Profile
  // ---------------------------------------------------------------------------
  const openProfileModal = () => {
    setProfileError("");
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (profileSaving) return;
    const firstName = editFirstName.trim();
    const lastName = editLastName.trim();
    if (!firstName || !lastName) {
      setProfileError("First name and last name are required.");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");
      await updateDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        updatedAt: serverTimestamp(),
      });
      setAdminName(`${firstName} ${lastName}`);
      setShowProfileModal(false);
    } catch (error) {
      setProfileError(
        error?.message || "Could not update profile. Please try again.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Account — Change Password
  // ---------------------------------------------------------------------------
  const openPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const changePassword = async () => {
    if (passwordSaving) return;
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Not signed in.");

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setShowPasswordModal(false);
      Alert.alert("Success", "Password changed successfully.");
    } catch (error) {
      if (
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-credential"
      ) {
        setPasswordError("Current password is incorrect.");
      } else {
        setPasswordError(
          error?.message || "Could not change password. Please try again.",
        );
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EcoPoints Config — Save
  // ---------------------------------------------------------------------------
  const saveEcoPoints = async () => {
    if (ecoPointsSaving) return;
    setEcoPointsStatus(null);

    // Validate — all must be whole positive integers
    const fields = [
      { key: "reportCleaned", label: "Report Cleaned" },
      { key: "volunteerCleanup", label: "Volunteer Cleanup" },
      { key: "volunteerEvent", label: "Volunteer Event" },
    ];

    for (const { key, label } of fields) {
      const val = ecoPoints[key];
      if (!/^\d+$/.test(val.trim()) || parseInt(val, 10) < 1) {
        setEcoPointsStatus({
          type: "error",
          msg: `"${label}" must be a whole positive number.`,
        });
        return;
      }
    }

    setEcoPointsSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "ecopoints"),
        {
          reportOngoing: deleteField(),
          reportCleaned: parseInt(ecoPoints.reportCleaned, 10),
          volunteerCleanup: parseInt(ecoPoints.volunteerCleanup, 10),
          volunteerEvent: parseInt(ecoPoints.volunteerEvent, 10),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setEcoPointsStatus({
        type: "success",
        msg: "EcoPoints configuration saved.",
      });
    } catch (error) {
      setEcoPointsStatus({
        type: "error",
        msg: error?.message || "Failed to save EcoPoints config.",
      });
    } finally {
      setEcoPointsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Notifications — Toggle helpers (save immediately)
  // ---------------------------------------------------------------------------
  const togglePushNotifications = async (value) => {
    setPushEnabled(value);
    try {
      await setDoc(
        doc(db, "settings", "appConfig"),
        { pushNotificationsEnabled: value, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      console.error("Failed to save push notification setting:", error);
      setPushEnabled(!value); // revert on failure
    }
  };

  const toggleEmailAlerts = async (value) => {
    setEmailAlertsEnabled(value);
    try {
      await setDoc(
        doc(db, "settings", "appConfig"),
        { emailAlertsEnabled: value, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      console.error("Failed to save email alerts setting:", error);
      setEmailAlertsEnabled(!value); // revert on failure
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  if (initialLoading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color="#599A74" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { padding: pagePadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Text style={styles.pageHeading}>Settings</Text>
      <Text style={styles.pageSubheading}>
        Manage your account, EcoPoints rewards, and app preferences.
      </Text>

      {/* ================================================================== */}
      {/* SECTION 1 — Account                                                 */}
      {/* ================================================================== */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={22} color="#234B33" />
          <Text style={styles.sectionTitle}>Account</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Your admin profile and login credentials.
        </Text>

        {/* Admin info display */}
        <View style={styles.accountInfoBox}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>
              {adminName ? adminName.charAt(0).toUpperCase() : "A"}
            </Text>
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.accountName}>{adminName || "Admin"}</Text>
            <Text style={styles.accountEmail}>{adminEmail}</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={openProfileModal}
          >
            <Ionicons name="create-outline" size={16} color="#599A74" />
            <Text style={styles.outlineButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={openPasswordModal}
          >
            <Ionicons name="lock-closed-outline" size={16} color="#599A74" />
            <Text style={styles.outlineButtonText}>Change Password</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================================================================== */}
      {/* SECTION 2 — EcoPoints Configuration                                 */}
      {/* ================================================================== */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="leaf-outline" size={22} color="#234B33" />
          <Text style={styles.sectionTitle}>EcoPoints Configuration</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Set the number of points awarded for each user action.
        </Text>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#599A74"
          />
          <Text style={styles.infoBannerText}>
            These values affect{" "}
            <Text style={styles.infoBannerBold}>future</Text> point awards only.
            Existing awarded points are not changed.
          </Text>
        </View>

        {/* Fields */}
        <EcoPointsField
          label="Report set to Cleaned"
          description="Points given to the reporter when their waste report is marked as cleaned."
          value={ecoPoints.reportCleaned}
          onChangeText={(val) =>
            setEcoPoints((prev) => ({ ...prev, reportCleaned: val }))
          }
        />
        <EcoPointsField
          label="Volunteer Cleanup Participation"
          description="Points given to each volunteer who joins and completes a cleanup event."
          value={ecoPoints.volunteerCleanup}
          onChangeText={(val) =>
            setEcoPoints((prev) => ({ ...prev, volunteerCleanup: val }))
          }
        />
        <EcoPointsField
          label="Volunteer Event Participation"
          description="Points given to each joined volunteer when a standalone event is completed."
          value={ecoPoints.volunteerEvent}
          onChangeText={(val) =>
            setEcoPoints((prev) => ({ ...prev, volunteerEvent: val }))
          }
        />

        {/* Status message */}
        {ecoPointsStatus && (
          <View
            style={[
              styles.statusBox,
              ecoPointsStatus.type === "success"
                ? styles.statusBoxSuccess
                : styles.statusBoxError,
            ]}
          >
            <Ionicons
              name={
                ecoPointsStatus.type === "success"
                  ? "checkmark-circle"
                  : "alert-circle"
              }
              size={16}
              color={ecoPointsStatus.type === "success" ? "#15803D" : "#DC2626"}
            />
            <Text
              style={[
                styles.statusText,
                ecoPointsStatus.type === "success"
                  ? styles.statusTextSuccess
                  : styles.statusTextError,
              ]}
            >
              {ecoPointsStatus.msg}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, ecoPointsSaving && styles.disabledButton]}
          onPress={saveEcoPoints}
          disabled={ecoPointsSaving}
        >
          {ecoPointsSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save EcoPoints Config</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ================================================================== */}
      {/* SECTION 3 — Notifications                                           */}
      {/* ================================================================== */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="notifications-outline" size={22} color="#234B33" />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Control how the app communicates with residents.
        </Text>

        <View style={[styles.toggleRow, styles.rowSeparator]}>
          <View style={styles.toggleRowText}>
            <Text style={styles.toggleLabel}>Push Notifications</Text>
            <Text style={styles.toggleDescription}>
              Send push alerts to residents for new announcements and status
              updates.
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={togglePushNotifications}
            trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
            thumbColor={pushEnabled ? "#599A74" : "#F3F4F6"}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleRowText}>
            <Text style={styles.toggleLabel}>Email Alerts</Text>
            <Text style={styles.toggleDescription}>
              Send email notifications to residents for important updates.
            </Text>
          </View>
          <Switch
            value={emailAlertsEnabled}
            onValueChange={toggleEmailAlerts}
            trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
            thumbColor={emailAlertsEnabled ? "#599A74" : "#F3F4F6"}
          />
        </View>
      </View>

      {/* ================================================================== */}
      {/* SECTION 4 — About                                                   */}
      {/* ================================================================== */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#234B33"
          />
          <Text style={styles.sectionTitle}>About</Text>
        </View>

        <AboutRow label="App Name" value="GreenTrace" />
        <AboutRow label="Version" value="1.0.0" />
        <AboutRow label="Support Email" value="greentrace.support@email.com" />

        <View style={styles.rowDivider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() =>
            Alert.alert("Privacy Policy", "Opening Privacy Policy...")
          }
        >
          <Text style={styles.linkRowText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() =>
            Alert.alert("Terms of Service", "Opening Terms of Service...")
          }
        >
          <Text style={styles.linkRowText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* ================================================================== */}
      {/* MODAL — Edit Profile                                                */}
      {/* ================================================================== */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowProfileModal(false)}
                >
                  <Ionicons name="close" size={20} color="#52675A" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Enter last name"
                placeholderTextColor="#9CA3AF"
              />

              {Boolean(profileError) && (
                <View style={styles.formErrorBox}>
                  <Text style={styles.formErrorText}>{profileError}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowProfileModal(false)}
                  disabled={profileSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    profileSaving && styles.disabledButton,
                  ]}
                  onPress={saveProfile}
                  disabled={profileSaving}
                >
                  {profileSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL — Change Password                                             */}
      {/* ================================================================== */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Ionicons name="close" size={20} color="#52675A" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="At least 8 characters"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
              />

              {Boolean(passwordError) && (
                <View style={styles.formErrorBox}>
                  <Text style={styles.formErrorText}>{passwordError}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowPasswordModal(false)}
                  disabled={passwordSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    passwordSaving && styles.disabledButton,
                  ]}
                  onPress={changePassword}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>
                      Change Password
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Small reusable sub-components
// ---------------------------------------------------------------------------

/**
 * A labelled numeric input row for an EcoPoints config field.
 */
function EcoPointsField({ label, description, value, onChangeText }) {
  return (
    <View style={styles.ecoPointsRow}>
      <View style={styles.ecoPointsRowText}>
        <Text style={styles.ecoPointsLabel}>{label}</Text>
        <Text style={styles.ecoPointsDescription}>{description}</Text>
      </View>
      <TextInput
        style={styles.ecoPointsInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        maxLength={4}
        placeholder="pts"
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

/**
 * A simple label + value row for the About section.
 */
function AboutRow({ label, value }) {
  return (
    <View style={[styles.toggleRow, styles.rowSeparator]}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Layout
  container: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: "#F5F6FA",
  },
  fullCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F6FA",
  },

  // Page header
  pageHeading: {
    color: "#599A74",
    fontSize: 32,
    fontWeight: "800",
  },
  pageSubheading: {
    color: "#64748B",
    fontSize: 15,
    marginTop: 6,
    marginBottom: 22,
  },

  // Section card
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    marginBottom: 18,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#234B33",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 16,
  },

  // Account section
  accountInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#EDF7F0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8E6DC",
  },
  accountAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#599A74",
    justifyContent: "center",
    alignItems: "center",
  },
  accountAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "700",
  },
  accountEmail: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },

  // Outline button (used in Account + Data Management export)
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#599A74",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F7FBF8",
  },
  outlineButtonText: {
    color: "#599A74",
    fontSize: 14,
    fontWeight: "600",
  },

  // Info banner (EcoPoints)
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EDF7F0",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
    lineHeight: 19,
  },
  infoBannerBold: {
    fontWeight: "700",
    color: "#234B33",
  },

  // EcoPoints field rows
  ecoPointsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBE6",
    gap: 12,
  },
  ecoPointsRowText: {
    flex: 1,
  },
  ecoPointsLabel: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
  ecoPointsDescription: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  ecoPointsInput: {
    width: 68,
    height: 40,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    borderRadius: 8,
    paddingHorizontal: 10,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#234B33",
    backgroundColor: "#F7FBF8",
  },

  // Status boxes (success / error inline)
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  statusBoxSuccess: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  statusBoxError: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  statusText: {
    flex: 1,
    fontSize: 13,
  },
  statusTextSuccess: {
    color: "#15803D",
  },
  statusTextError: {
    color: "#DC2626",
  },

  // Primary save button (green)
  saveButton: {
    backgroundColor: "#599A74",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.55,
  },

  // Fields — shared input
  input: {
    borderWidth: 1,
    borderColor: "#D8E6DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#F7FBF8",
    marginTop: 6,
  },
  fieldLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  fieldDescription: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
    marginBottom: 2,
    lineHeight: 17,
  },

  // Notification toggles
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBE6",
  },
  toggleRowText: {
    flex: 1,
    paddingRight: 14,
  },
  toggleLabel: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleDescription: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#E3EBE6",
  },

  // About section
  aboutLabel: {
    color: "#64748B",
    fontSize: 14,
  },
  aboutValue: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBE6",
  },
  linkRowText: {
    color: "#599A74",
    fontSize: 14,
    fontWeight: "600",
  },

  // Modal — shared
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    maxHeight: "90%",
  },
  modalContent: {
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    color: "#234B33",
    fontSize: 18,
    fontWeight: "800",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EDF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#D8E6DC",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: "#F7FBF8",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSaveButton: {
    backgroundColor: "#599A74",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  modalSaveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Form error box (inside modals)
  formErrorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  formErrorText: {
    color: "#DC2626",
    fontSize: 13,
  },
});
