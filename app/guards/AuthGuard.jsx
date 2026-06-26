import { useEffect, useState } from "react";

import { useRouter } from "expo-router";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../firebaseConfig";

import { View, ActivityIndicator } from "react-native";

export default function AuthGuard({

  children,

  adminOnly = false,

}) {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(

      auth,

      async (user) => {

        if (!user) {

          router.replace("/signin");

          return;

        }

        setLoading(false);

      }

    );

    return unsubscribe;

  }, []);

  if (loading) {

    return (

      <View

        style={{

          flex: 1,

          justifyContent: "center",

          alignItems: "center",

        }}

      >

        <ActivityIndicator size="large" />

      </View>

    );

  }

  return children;

}