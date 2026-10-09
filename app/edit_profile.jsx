import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
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

import { auth, db } from "../firebaseConfig";

export default function EditProfile() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [cellNumber, setcellNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editable, setEditable] = useState({
    firstName: false,
    lastName: false,
    cellNumber: false,
  });

  const loadCurrentUser = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setUserEmail(data.email || currentUser.email || "");
        setcellNumber(data.cellNumber || "");
      }
    } catch (error) {
      console.log("Error loading current user:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async () => {
    if (!currentUser) return;

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(
        "Required Fields",
        "First name and last name cannot be empty.",
      );
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnapshot = await getDoc(userRef);
      if (!userSnapshot.exists()) {
        throw new Error("The user profile no longer exists.");
      }

      const previousProfile = userSnapshot.data();
      const nextProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        cellNumber: cellNumber.trim(),
      };
      const batch = writeBatch(db);
      batch.update(userRef, nextProfile);

      ["firstName", "lastName", "cellNumber"].forEach((field) => {
        const oldValue = String(previousProfile[field] || "");
        const newValue = nextProfile[field];
        if (oldValue !== newValue) {
          batch.set(doc(collection(userRef, "changeLogs")), {
            field,
            oldValue,
            newValue,
            source: "profile",
            changedAt: serverTimestamp(),
          });
        }
      });

      await batch.commit();

      setEditable({
        firstName: false,
        lastName: false,
        cellNumber: false,
      });

      Alert.alert("Success", "Your profile has been updated successfully.");
    } catch (error) {
      console.log("Error saving profile:", error);
      Alert.alert("Error", "Could not save profile changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    const f = (firstName || "").charAt(0).toUpperCase();
    const l = (lastName || "").charAt(0).toUpperCase();
    return f || l ? `${f}${l}` : "GT";
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
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <Text style={styles.headerSubtitle}>
                  Update your personal details
                </Text>
              </View>
            </View>
          </View>

          {/* MAIN FORM */}
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#5F9C76" />
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* AVATAR PREVIEW CARD */}
                <View style={styles.avatarCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{getInitials()}</Text>
                  </View>
                  <Text style={styles.avatarName}>
                    {firstName || lastName
                      ? `${firstName} ${lastName}`.trim()
                      : "GreenTrace User"}
                  </Text>
                  <Text style={styles.avatarEmail}>
                    {userEmail || "No email address provided"}
                  </Text>
                </View>

                {/* FORM FIELDS CARD */}
                <View style={styles.formCard}>
                  <Text style={styles.cardSectionTitle}>
                    Personal Information
                  </Text>

                  {/* FIRST NAME */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>First Name</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        editable.firstName && styles.inputWrapperActive,
                      ]}
                    >
                      <TextInput
                        style={styles.input}
                        value={firstName}
                        onChangeText={setFirstName}
                        editable={editable.firstName}
                        placeholder="Enter first name"
                        placeholderTextColor="#94A3B8"
                        selectionColor="#5F9C76"
                        cursorColor="#5F9C76"
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity
                        style={styles.fieldActionBtn}
                        onPress={() =>
                          setEditable((prev) => ({
                            ...prev,
                            firstName: !prev.firstName,
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={editable.firstName ? "checkmark" : "pencil"}
                          size={16}
                          color={editable.firstName ? "#2E7D32" : "#5F9C76"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* LAST NAME */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Last Name</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        editable.lastName && styles.inputWrapperActive,
                      ]}
                    >
                      <TextInput
                        style={styles.input}
                        value={lastName}
                        onChangeText={setLastName}
                        editable={editable.lastName}
                        placeholder="Enter last name"
                        placeholderTextColor="#94A3B8"
                        selectionColor="#5F9C76"
                        cursorColor="#5F9C76"
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity
                        style={styles.fieldActionBtn}
                        onPress={() =>
                          setEditable((prev) => ({
                            ...prev,
                            lastName: !prev.lastName,
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={editable.lastName ? "checkmark" : "pencil"}
                          size={16}
                          color={editable.lastName ? "#2E7D32" : "#5F9C76"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>


                  {/* PHONE NUMBER */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        editable.cellNumber && styles.inputWrapperActive,
                      ]}
                    >
                      <TextInput
                        style={styles.input}
                        value={cellNumber}
                        onChangeText={setcellNumber}
                        editable={editable.cellNumber}
                        placeholder="e.g. 09123456789"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        selectionColor="#5F9C76"
                        cursorColor="#5F9C76"
                        underlineColorAndroid="transparent"
                      />
                      <TouchableOpacity
                        style={styles.fieldActionBtn}
                        onPress={() =>
                          setEditable((prev) => ({
                            ...prev,
                            cellNumber: !prev.cellNumber,
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={editable.cellNumber ? "checkmark" : "pencil"}
                          size={16}
                          color={editable.cellNumber ? "#2E7D32" : "#5F9C76"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* SAVE BUTTON */}
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      saving && styles.saveButtonDisabled,
                    ]}
                    onPress={saveProfile}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="save-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.saveButtonText}>
                          Confirm Changes
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

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
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F5F5F5",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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

  /* AVATAR CARD */
  avatarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E4F1E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#B9D3C5",
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2E7D32",
  },
  avatarName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F3326",
  },
  avatarEmail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },

  /* FORM CARD */
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
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
    outlineStyle: "none",
  },
  inputWrapperActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#5F9C76",
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1E293B",
    outlineStyle: "none",
  },
  fieldActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },

  /* SAVE BUTTON */
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5F9C76",
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  /* NAVBAR */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
