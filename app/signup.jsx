import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";

import React, { useState } from "react";

import { Link, useRouter } from "expo-router";

import { createUserWithEmailAndPassword } from "firebase/auth";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

export default function Signup() {

const [acceptedTerms, setAcceptedTerms] = useState(false);
const router = useRouter();

const [firstName, setFirstName] = useState("");

const [middleName, setMiddleName] = useState("");

const [lastName, setLastName] = useState("");

const [email, setEmail] = useState("");

const [password, setPassword] = useState("");

const [cellNumber, setCellNumber] = useState("");

const [birthDate, setBirthDate] = useState("");

const [loading, setLoading] = useState(false);


const isValidEmail = (email) => {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(

    email.trim()

  );

};



const isValidPhone = (phone) => {

  return /^09\d{9}$/.test(

    phone.trim()

  );

};



const isValidBirthDate = (date) => {

  if (

    !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(

      date.trim()

    )

  ) {

    return false;

  }



  const [

    month,

    day,

    year

  ] = date.split("/");



  const birthDate = new Date(

    year,

    month - 1,

    day

  );



  return (

    birthDate.getMonth() === month - 1 &&

    birthDate.getDate() == day

  );

};

const registerUser = async () => {

  if (!acceptedTerms) {

  alert(

    "You must agree to the Terms and Agreement."

  );

  return;

}

  if (loading) return;



  if (

    !firstName.trim() ||

    !middleName.trim() ||

    !lastName.trim() ||

    !email.trim() ||

    !password.trim() ||

    !cellNumber.trim() ||

    !birthDate.trim()

  ) {

    alert(

      "Please fill in all fields."

    );

    return;

  }



  if (

    !isValidEmail(email)

  ) {

    alert(

      "Invalid email address."

    );

    return;

  }



  if (

    password.length < 8

  ) {

    alert(

      "Password must be at least 8 characters."

    );

    return;

  }



  if (

    !isValidPhone(cellNumber)

  ) {

    alert(

      "Phone number must be 11 digits and start with 09."

    );

    return;

  }



  if (

    !isValidBirthDate(

      birthDate

    )

  ) {

    alert(

      "Birth date must be MM/DD/YYYY"

    );

    return;

  }



  setLoading(true);



  try {

    const userCredential =

      await createUserWithEmailAndPassword(

        auth,

        email.trim(),

        password

      );



    const uid =

      userCredential.user.uid;



    await setDoc(

      doc(

        db,

        "users",

        uid

      ),

      {

        firstName:

          firstName.trim(),

        middleName:

          middleName.trim(),

        lastName:

          lastName.trim(),

        email:

          email.trim(),

        cellNumber:

          cellNumber.trim(),

        birthDate:

          birthDate.trim(),

        role: "resident",

        points: 0,

        createdAt:

          serverTimestamp(),

      }

    );



    alert(

      "Registration successful"

    );



    router.replace(

      "/home"

    );

  }

  catch (error) {

    alert(

      error.message

    );

  }

  finally {

    setLoading(false);

  }

};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Branding */}
        <View style={styles.brandContainer}>
          <View style={styles.header}>
            <View style={styles.logo} />
            <View>
              <Text style={styles.appName}>GreenTrace</Text>
              <Text style={styles.tagline}>
                What we do today shapes tomorrow’s green.
              </Text>
            </View>
          </View>

          <Text style={styles.title}>Register to GreenTrace</Text>
          <Text style={styles.subtitle}>
            Act Now for a Greener Tomorrow
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formWrapper}>
          <View style={styles.form}>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First Name" />
            <TextInput style={styles.input} value={middleName} onChangeText={setMiddleName} placeholder="Middle Name" />
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last Name" />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry value={password}
              onChangeText={setPassword}
            />
            <TextInput style={styles.input} value={cellNumber} onChangeText={setCellNumber} placeholder="Cell Number" />
            <TextInput style={styles.input} value={birthDate} onChangeText={setBirthDate} placeholder="MM/DD/YYYY" />

          <TouchableOpacity
  style={styles.termsRow}
  onPress={() => setAcceptedTerms(!acceptedTerms)}
>

  <View
    style={[
      styles.checkbox,

      acceptedTerms &&

      styles.checkboxChecked

    ]}
  />

  <Text style={styles.termsText}>

    Terms and Agreement

  </Text>

</TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={registerUser}>
              <Text style={styles.buttonText}>

  {

    loading

    ?

    "Creating account..."

    :

    "SIGN UP"

  }

</Text>
            </TouchableOpacity>

            <Text style={styles.loginText}>
              Already have an account?{" "}
              <Link href="/signin">
                <Text style={styles.loginLink}>Log In</Text>
              </Link>
            </Text>
          </View>
        </View>

      </View>
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

  brandContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 56,
    height: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginRight: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tagline: {
    fontSize: 12,
    color: "#E6E6E6",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 13,
    color: "#E6E6E6",
    marginTop: 4,
  },

  formWrapper: {
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

  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    marginRight: 8,
  },
  checkboxChecked: {
  backgroundColor: "#FFFFFF",
  },
  termsText: {
    color: "#FFFFFF",
    fontSize: 12,
  },

  button: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#5F9C76",
    fontWeight: "700",
  },

  loginText: {
    textAlign: "center",
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 12,
  },
  loginLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
