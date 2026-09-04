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
  const [errors, setErrors] = useState({});

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

  const validateField = (fieldName, value) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "This field is required.";
    }

    if (fieldName === "email" && !isValidEmail(value)) {
      return "Enter a valid email address.";
    }

    if (fieldName === "password" && value.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (fieldName === "cellNumber" && !isValidPhone(value)) {
      return "Use 11 digits starting with 09.";
    }

    if (fieldName === "birthDate" && !isValidBirthDate(value)) {
      return "Use a valid date in MM/DD/YYYY format.";
    }

    return "";
  };

  const updateField = (fieldName, value, setter) => {
    setter(value);
    setErrors((prev) => ({
      ...prev,
      [fieldName]: validateField(fieldName, value),
    }));
    setFormError("");
  };

  const renderFieldError = (fieldName) =>
    errors[fieldName] ? (
      <Text style={styles.fieldError} accessibilityRole="alert">
        {errors[fieldName]}
      </Text>
    ) : null;

  const registerUser = async () => {
    if (loading) return;

    const fieldValues = {
      firstName,
      lastName,
      email,
      password,
      cellNumber,
      birthDate,
    };
    const nextErrors = Object.fromEntries(
      Object.entries(fieldValues).map(([fieldName, value]) => [
        fieldName,
        validateField(fieldName, value),
      ]),
    );

    if (!acceptedTerms) {
      nextErrors.terms = "You must agree to the Terms and Agreement.";
    }

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      setFormError("");
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
                style={[styles.input, errors.firstName && styles.inputError]}
                value={firstName}
                onChangeText={(value) => {
                  updateField("firstName", value, setFirstName);
                }}
                placeholder="First Name"
                placeholderTextColor="#888"
                accessibilityState={{ invalid: Boolean(errors.firstName) }}
              />
              {renderFieldError("firstName")}
              <TextInput
                style={[styles.input, errors.lastName && styles.inputError]}
                value={lastName}
                onChangeText={(value) => {
                  updateField("lastName", value, setLastName);
                }}
                placeholder="Last Name"
                placeholderTextColor="#888"
                accessibilityState={{ invalid: Boolean(errors.lastName) }}
              />
              {renderFieldError("lastName")}
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={(value) => {
                  updateField("email", value, setEmail);
                }}
                placeholder="Email"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityState={{ invalid: Boolean(errors.email) }}
              />
              {renderFieldError("email")}
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="#888"
                secureTextEntry
                value={password}
                onChangeText={(value) => {
                  updateField("password", value, setPassword);
                }}
                accessibilityState={{ invalid: Boolean(errors.password) }}
              />
              {renderFieldError("password")}
              <TextInput
                style={[styles.input, errors.cellNumber && styles.inputError]}
                value={cellNumber}
                onChangeText={(value) => {
                  updateField("cellNumber", value, setCellNumber);
                }}
                placeholder="Phone Number (e.g. 09123456789)"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                maxLength={11}
                accessibilityState={{ invalid: Boolean(errors.cellNumber) }}
              />
              {renderFieldError("cellNumber")}
              <TextInput
                style={[styles.input, errors.birthDate && styles.inputError]}
                value={birthDate}
                onChangeText={(value) => {
                  updateField(
                    "birthDate",
                    formatBirthDate(value),
                    setBirthDate,
                  );
                }}
                placeholder="Birth Date (MM/DD/YYYY)"
                placeholderTextColor="#888"
                keyboardType="number-pad"
                maxLength={10}
                accessibilityState={{ invalid: Boolean(errors.birthDate) }}
              />
              {renderFieldError("birthDate")}

              {/* Terms Checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                activeOpacity={0.8}
                onPress={() => {
                  setAcceptedTerms(!acceptedTerms);
                  setErrors((prev) => ({ ...prev, terms: "" }));
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
              {renderFieldError("terms")}

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
    marginBottom: 3,
    fontSize: 14,
  },
  inputError: {
    borderColor: "#F04438",
    borderWidth: 1.5,
  },
  fieldError: {
    color: "#FFE0DE",
    fontSize: 12,
    marginBottom: 7,
    marginLeft: 2,
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
