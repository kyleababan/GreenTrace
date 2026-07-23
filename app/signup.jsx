import { Link, useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "../firebaseConfig";

export default function Signup() {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const router = useRouter();

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cellNumber, setCellNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [loading, setLoading] = useState(false);

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const isValidPhone = (phone) => {
    return /^09\d{9}$/.test(phone.trim());
  };

  const isValidBirthDate = (date) => {
    if (
      !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(date.trim())
    ) {
      return false;
    }

    const [month, day, year] = date.split("/");
    const parsedDate = new Date(year, month - 1, day);

    return (
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === Number(day)
    );
  };

  const registerUser = async () => {
    if (!acceptedTerms) {
      alert("You must agree to the Terms and Agreement.");
      return;
    }

    if (loading) return;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password.trim() ||
      !cellNumber.trim() ||
      !birthDate.trim()
    ) {
      alert("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      alert("Invalid email address.");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    if (!isValidPhone(cellNumber)) {
      alert("Phone number must be 11 digits and start with 09.");
      return;
    }

    if (!isValidBirthDate(birthDate)) {
      alert("Birth date must be MM/DD/YYYY");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        cellNumber: cellNumber.trim(),
        birthDate: birthDate.trim(),
        role: "resident",
        points: 0,
        createdAt: serverTimestamp(),
      });

      alert("Registration successful");
      router.replace("/home");
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header & Branding */}
          <View style={styles.welcome}>
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

          {/* Form */}
          <View style={styles.formWrapper}>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First Name"
                placeholderTextColor="#888"
              />
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last Name"
                placeholderTextColor="#888"
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#888"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={styles.input}
                value={cellNumber}
                onChangeText={setCellNumber}
                placeholder="Cell Number (e.g. 09123456789)"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                maxLength={11}
              />
              <TextInput
                style={styles.input}
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="Birth Date (MM/DD/YYYY)"
                placeholderTextColor="#888"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              {/* Terms Checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                activeOpacity={0.8}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptedTerms && styles.checkboxChecked,
                  ]}
                >
                  {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>Terms and Agreement</Text>
              </TouchableOpacity>

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.disabledButton]}
                onPress={registerUser}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Creating account..." : "SIGN UP"}
                </Text>
              </TouchableOpacity>

              {/* Switch to Login */}
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Link href="/login" asChild>
                  <Text style={styles.loginLink}>Log In</Text>
                </Link>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#5F9C76",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  /* Header & Branding */
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
  logoContainer: {
    marginRight: 12,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: "contain",
    tintColor: "#fff",
  },
  logoText: {
    justifyContent: "center",
  },
  appName: {
    fontSize: 38,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 44,
  },
  tagline: {
    fontSize: 11,
    color: "#E6E6E6",
    maxWidth: 200,
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

  /* Form Layout */
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
    marginBottom: 10,
    fontSize: 14,
  },

  /* Terms Checkbox */
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#FFFFFF",
  },
  checkmark: {
    color: "#5F9C76",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  termsText: {
    color: "#FFFFFF",
    fontSize: 13,
  },

  /* Action Buttons */
  button: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#5F9C76",
    fontWeight: "700",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },

  /* Navigation Link */
  loginText: {
    textAlign: "center",
    color: "#FFFFFF",
    marginTop: 18,
    fontSize: 12,
  },
  loginLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
