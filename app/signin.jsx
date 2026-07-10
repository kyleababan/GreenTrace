import { useState } from "react";

import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";


import { Link, useRouter } from "expo-router";

import { signInWithEmailAndPassword } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebaseConfig";


export default function Login() {
  const router = useRouter(); 
  const [email,setEmail] = useState("");

const [password,setPassword] = useState("");

const loginUser = async () => {

  if (!email.trim()) {

    alert("Please enter your email");

    return;

  }

  if (!password.trim()) {

    alert("Please enter your password");

    return;

  }

  try {

    const userCredential =

      await signInWithEmailAndPassword(

        auth,

        email,

        password

      );

    const uid =

      userCredential.user.uid;

    const userRef =

      doc(db, "users", uid);

    const userSnap =

      await getDoc(userRef);

    if (!userSnap.exists()) {

      alert("User data not found");

      return;

    }

    const userData =

      userSnap.data();

    if (

      userData.role === "admin"

    ) {

      router.replace(

        "/admin/dashboard"

      );

    }

    else {

      router.replace(

        "/home"

      );

    }

  }

  catch (error) {

    alert(

      "Invalid email or password"

    );

  }

};
  return (
    
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

       

        {/* Welcome Text */}
        <View style={styles.welcome}>
           {/* Logo + App Name (Row) */}
        <View style={styles.header}>
          <Image
                      source={require("../assets/images/minicon.png")}
                      style={styles.logo}
                  />
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
  style={styles.button}
  onPress={loginUser}
>
  <Text style={styles.buttonText}>LOG IN</Text>
</TouchableOpacity>

            <Text style={styles.signupText}>
  Don’t have an account?{" "}
  <Link href="/signup" asChild>
    <Text style={styles.signupLink}>Sign Up</Text>
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

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  logo:{
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
});
