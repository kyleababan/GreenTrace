import { useEffect, useState } from "react";

import { ActivityIndicator, View } from "react-native";

import { Redirect } from "expo-router";

import { onAuthStateChanged } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

export default function Index() {

  const [loading, setLoading] = useState(true);

  const [route, setRoute] = useState("/signin");

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(

      auth,

      async (user) => {

        if (!user) {

          setRoute("/signin");

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

          if (!userSnap.exists()) {

            setRoute("/signin");

          }

          else {

            const userData =

              userSnap.data();

            if (

              userData.role === "admin"

            ) {

              setRoute(

                "/admin/dashboard"

              );

            }

            else {

              setRoute("/home");

            }

          }

        }

        catch (error) {

          console.log(error);

          setRoute("/signin");

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

        <ActivityIndicator

          size="large"

        />

      </View>

    );

  }

  return <Redirect href={route} />;

}