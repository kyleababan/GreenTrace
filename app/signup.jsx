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

import FormError from "../components/form-error";
import { auth, db } from "../firebaseConfig";
import { getAuthErrorMessage } from "../utils/authErrors";

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
  const [formError, setFormError] = useState("");

  const [loading, setLoading] = useState(false);

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const isValidPhone = (phone) => {
    return /^09\d{9}$/.test(phone.trim());
  };

  const formatBirthDate = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);

    if (digits.length >= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    return digits;
  };

  const handleBirthDateChange = (value) => {
    const removedAutoSlash =
      value.length < birthDate.length &&
      birthDate.endsWith("/") &&
      value === birthDate.slice(0, -1);

    if (removedAutoSlash) {
      setBirthDate(formatBirthDate(value.slice(0, -1)));
      return;
    }

    setBirthDate(formatBirthDate(value));
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
    if (loading) return;

    if (!acceptedTerms) {
      setFormError("You must agree to the Terms and Agreement.");
      return;
    }

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password.trim() ||
      !cellNumber.trim() ||
      !birthDate.trim()
    ) {
      setFormError("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    if (!isValidPhone(cellNumber)) {
      setFormError("Phone number must be 11 digits and start with 09.");
      return;
    }

    if (!isValidBirthDate(birthDate)) {
      setFormError("Birth date must be a valid date in MM/DD/YYYY format.");
      return;
    }

    setFormError("");
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

      router.replace("/home");
    } catch (error) {
      setFormError(
        getAuthErrorMessage(
          error,
          "Could not create your account. Please try again.",
        ),
      );
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
              <FormError message={formError} light />

              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  setFormError("");
                }}
                placeholder="First Name"
                placeholderTextColor="#888"
              />
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={(value) => {
                  setLastName(value);
                  setFormError("");
                }}
                placeholder="Last Name"
                placeholderTextColor="#888"
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setFormError("");
                }}
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
                onChangeText={(value) => {
                  setPassword(value);
                  setFormError("");
                }}
              />
              <TextInput
                style={styles.input}
                value={cellNumber}
                onChangeText={(value) => {
                  setCellNumber(value);
                  setFormError("");
                }}
                placeholder="Phone Number (e.g. 09123456789)"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                maxLength={11}
              />
              <TextInput
                style={styles.input}
                value={birthDate}
                onChangeText={(value) => {
                  handleBirthDateChange(value);
                  setFormError("");
                }}
                placeholder="Birth Date (MM/DD/YYYY)"
                placeholderTextColor="#888"
                keyboardType="number-pad"
                maxLength={10}
              />

              {/* Terms Checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                activeOpacity={0.8}
                onPress={() => {
                  setAcceptedTerms(!acceptedTerms);
                  setFormError("");
                }}
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
                <Link href="/signin" asChild>
                  <Text style={styles.loginLink}>Sign In</Text>
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
  },
});
