import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import FormError from "../components/form-error";
import { auth, db } from "../firebaseConfig";
import { getAuthErrorMessage } from "../utils/authErrors";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetSentModal, setShowResetSentModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [resetError, setResetError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const validateEmail = (value) => {
    if (!value.trim()) return "Please enter your email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return "Enter a valid email address.";
    }
    return "";
  };

  const validatePassword = (value) =>
    value.trim() ? "" : "Please enter your password.";

  const updateField = (field, value, setter) => {
    setter(value);
    setFieldErrors((current) => ({
      ...current,
      [field]:
        field === "email" ? validateEmail(value) : validatePassword(value),
    }));
    setFormError("");
  };

  const openResetModal = () => {
    setResetEmail(email.trim());
    setResetError("");
    setShowResetModal(true);
  };

  const sendResetEmail = async () => {
    const normalizedEmail = resetEmail.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setResetError("Enter a valid email address.");
      return;
    }

    setResetError("");

    setSendingResetEmail(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetEmail(normalizedEmail);
      setShowResetModal(false);
      setShowResetSentModal(true);
    } catch (error) {
      console.log("Unable to send password reset email:", error);
      setResetError(
        getAuthErrorMessage(
          error,
          "We couldn't send a reset email. Check the address and try again.",
        ),
      );
    } finally {
      setSendingResetEmail(false);
    }
  };

  const loginUser = async () => {
    if (loggingIn) return;

    const nextFieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(nextFieldErrors);

    if (!email.trim()) {
      setFormError("Please enter your email.");
      return;
    }

    if (!password.trim()) {
      setFormError("Please enter your password.");
      return;
    }

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFormError("Please enter a valid email and password.");
      return;
    }

    setFormError("");
    setLoggingIn(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const uid = userCredential.user.uid;
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        setFormError(
          "This account is incomplete. Contact support or sign up again.",
        );
        return;
      }

      const userData = userSnap.data();

      if (userData.isBanned) {
        await signOut(auth);
        setBanReason(userData.banReason || "No reason was provided.");
        setShowBannedModal(true);
        return;
      }

      if (userData.role === "admin") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/home");
      }
    } catch (error) {
      setFormError(
        getAuthErrorMessage(error, "Email or password is incorrect."),
      );
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Welcome Text */}
        <View style={styles.welcome}>
          {/* Logo + App Name (Row) */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
              />
            </View>

            <View style={styles.logoText}>
              <Text style={styles.appName}>GreenTrace</Text>
              <Text style={styles.tagline}>
                What we do today shapes tomorrow’s green.
              </Text>
            </View>
          </View>

          <Text style={styles.welcomeTitle}>Welcome to GreenTrace</Text>
          <Text style={styles.welcomeSubtitle}>
            Act Now for a Greener Tomorrow
          </Text>
        </View>

        {/* Form Container */}
        <View style={styles.formWrapper}>
          <View style={styles.form}>
            <FormError message={formError} light />

            <TextInput
              placeholder="Email"
              placeholderTextColor="#888"
              style={[styles.input, fieldErrors.email && styles.inputError]}
              value={email}
              onChangeText={(value) => {
                updateField("email", value, setEmail);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityState={{ invalid: Boolean(fieldErrors.email) }}
            />
            {fieldErrors.email && (
              <Text style={styles.fieldError}>{fieldErrors.email}</Text>
            )}

            <TextInput
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={password}
              onChangeText={(value) => {
                updateField("password", value, setPassword);
              }}
              style={[styles.input, fieldErrors.password && styles.inputError]}
              accessibilityState={{ invalid: Boolean(fieldErrors.password) }}
            />
            {fieldErrors.password && (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            )}

            <TouchableOpacity
              style={[styles.button, loggingIn && styles.disabledButton]}
              onPress={loginUser}
              disabled={loggingIn}
            >
              <Text style={styles.buttonText}>
                {loggingIn ? "Logging in..." : "LOG IN"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.signupText}>
              Don’t have an account?{" "}
              <Link href="/signup" asChild>
                <Text style={styles.signupLink}>Sign Up</Text>
              </Link>
            </Text>

            <TouchableOpacity onPress={openResetModal}>
              <Text style={styles.forgotPasswordLink}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Password Reset Modal */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setShowResetModal(false)}
              accessibilityLabel="Close password reset"
            >
              <Image
                source={require("../assets/images/backG.png")}
                style={styles.modalBackIcon}
              />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Reset password</Text>
            <Text style={styles.modalDescription}>
              Confirm the email address registered to your GreenTrace account.
            </Text>

            <FormError message={resetError} />

            <TextInput
              placeholder="Email address"
              placeholderTextColor="#888"
              style={styles.modalInput}
              value={resetEmail}
              onChangeText={(value) => {
                setResetEmail(value);
                setResetError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.modalPrimaryButton,
                sendingResetEmail && styles.disabledButton,
              ]}
              onPress={sendResetEmail}
              disabled={sendingResetEmail}
            >
              <Text style={styles.modalPrimaryButtonText}>
                {sendingResetEmail ? "SENDING..." : "SEND RESET EMAIL"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Password Reset Sent Modal */}
      <Modal
        visible={showResetSentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetSentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image
              source={require("../assets/images/backG.png")}
              style={styles.modalSuccessIcon}
            />
            <Text style={styles.modalTitle}>Check your inbox</Text>
            <Text style={styles.modalDescription}>
              A password reset email has been sent to {resetEmail}. Check your
              spam folder too.
            </Text>

            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={() => setShowResetSentModal(false)}
            >
              <Text style={styles.modalPrimaryButtonText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Banned Modal */}
      <Modal
        visible={showBannedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBannedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} accessibilityRole="alert">
            <Ionicons
              name="ban-outline"
              size={52}
              color="#bf3030"
              style={styles.bannedIcon}
            />
            <Text style={styles.bannedTitle}>Your account is banned</Text>
            <Text style={styles.modalDescription}>Reason: {banReason}</Text>
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={() => setShowBannedModal(false)}
            >
              <Text style={styles.modalPrimaryButtonText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#5F9C76",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  /* Header & Welcome Container */
  welcome: {
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    width: "100%",
  },
  logoContainer: {},
  logo: {
    width: 100,
    height: 100,
    resizeMode: "contain",
    tintColor: "#fff",
  },
  logoText: {
    justifyContent: "center",
  },
  appName: {
    fontSize: 42,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 44,
  },
  tagline: {
    fontSize: 12,
    color: "#E6E6E6",
    maxWidth: 360,
  },

  /* Welcome Subtitles */
  welcomeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#E6E6E6",
    textAlign: "center",
    marginTop: 2,
  },

  /* Form width control */
  formWrapper: {
    width: "100%",
    alignItems: "center",
  },
  form: {
    width: "100%",
    maxWidth: 360,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 14,
  },
  inputError: {
    borderColor: "#D93025",
    borderWidth: 1.5,
  },
  fieldError: {
    color: "#FFE0DE",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 10,
    marginLeft: 2,
  },
  button: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#5F9C76",
    fontWeight: "700",
    fontSize: 14,
  },
  signupText: {
    textAlign: "center",
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 12,
  },
  signupLink: {
    fontWeight: "700",
  },
  forgotPasswordLink: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  modalBackButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  modalBackIcon: {
    width: 42,
    height: 42,
  },
  modalSuccessIcon: {
    width: 52,
    height: 52,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#276749",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  modalDescription: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: "center",
  },
  modalInput: {
    borderColor: "#D4DDD7",
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#5F9C76",
    borderRadius: 8,
    marginTop: 18,
    paddingVertical: 13,
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  bannedIcon: { alignSelf: "center", marginBottom: 12 },
  bannedTitle: {
    color: "#bf3030",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});
