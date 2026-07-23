import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

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

import { Link, useRouter } from "expo-router";

import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

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

  const openResetModal = () => {
    setResetEmail(email.trim());
    setShowResetModal(true);
  };

  const sendResetEmail = async () => {
    const normalizedEmail = resetEmail.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      alert("Enter a valid email address.");
      return;
    }

    setSendingResetEmail(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetEmail(normalizedEmail);
      setShowResetModal(false);
      setShowResetSentModal(true);
    } catch (error) {
      console.log("Unable to send password reset email:", error);
      alert("We couldn't send a reset email. Please check the address and try again.");
    } finally {
      setSendingResetEmail(false);
    }
  };

  const loginUser = async () => {
    if (loggingIn) return;

    if (!email.trim()) {
      alert("Please enter your email");

      return;
    }
    //sd
    if (!password.trim()) {
      alert("Please enter your password");

      return;
    }

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
        alert("User data not found");

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
    } catch (_error) {
      alert("Invalid email or password");
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
            {/* <Image
                      source={require("../assets/images/minicon.png")}
                      style={styles.logo}
                  /> */}
            <View style={styles.logo} />

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

        {/* Form Container (Width Controlled) */}
        <View style={styles.formWrapper}>
          <View style={styles.form}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#888"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

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

            <TextInput
              placeholder="Email address"
              placeholderTextColor="#888"
              style={styles.modalInput}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.modalPrimaryButton, sendingResetEmail && styles.disabledButton]}
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
              A password reset email has been sent to {resetEmail}. Check your spam folder too.
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

      <Modal
        visible={showBannedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBannedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} accessibilityRole="alert">
            <Ionicons name="ban-outline" size={52} color="#bf3030" style={styles.bannedIcon} />
            <Text style={styles.bannedTitle}>Your account is banned</Text>
            <Text style={styles.modalDescription}>Reason: {banReason}</Text>
            <TouchableOpacity style={styles.modalPrimaryButton} onPress={() => setShowBannedModal(false)}>
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
    paddingHorizontal: 24,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: 20,
  },

  logoText: {
    flexShrink: 1,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tagline: {
    fontSize: 12,
    color: "#E6E6E6",
    marginTop: 2,
  },

  /* Welcome */
  welcome: {
    alignItems: "center",
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#E6E6E6",
    marginTop: 4,
  },

  /* Form width control */
  formWrapper: {
    alignItems: "center",
  },
  form: {
    width: "100%",
    maxWidth: 360, // 👈 prevents stretching on web
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 14,
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
  bannedTitle: { color: "#bf3030", fontSize: 22, fontWeight: "700", textAlign: "center" },
});
