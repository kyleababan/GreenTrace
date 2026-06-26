import React, { useEffect, useState } from "react";

import { Slot, Redirect } from "expo-router";

import { View, StyleSheet, ActivityIndicator } from "react-native";

import { onAuthStateChanged } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../../firebaseConfig";

import Sidebar from "../../components/Sidebar";

export default function AdminLayout() {

  const [loading, setLoading] = useState(true);

  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(

      auth,

      async (user) => {

        if (!user) {

          setAuthorized(false);

          setLoading(false);

          return;

        }

        try {

          const userRef = doc(

            db,

            "users",

            user.uid

          );

          const userSnap = await getDoc(

            userRef

          );

          if (

            userSnap.exists() &&

            userSnap.data().role === "admin"

          ) {

            setAuthorized(true);

          }

          else {

            setAuthorized(false);

          }

        }

        catch (error) {

          console.log(error);

          setAuthorized(false);

        }

        setLoading(false);

      }

    );

    return unsubscribe;

  }, []);

  if (loading) {

    return (

      <View style={styles.loadingContainer}>

        <ActivityIndicator size="large" />

      </View>

    );

  }

  if (!authorized) {

    return <Redirect href="/signin" />;

  }

  return (

    <View style={styles.container}>

      <Sidebar />

      <View style={styles.content}>

        <Slot />

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

  container: {

    flex: 1,

    flexDirection: "row",

  },

  content: {

    flex: 1,

    backgroundColor: "#f5f6fa",

    padding: 20,

  },

  loadingContainer: {

    flex: 1,

    justifyContent: "center",

    alignItems: "center",

  },

});