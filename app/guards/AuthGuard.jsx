import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useSegments, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { auth, db } from "../../firebaseConfig";

const PUBLIC_ROUTES = new Set(["signin", "signup"]);

export default function AuthGuard({ children, adminOnly = false }) {
  const router = useRouter();
  const segments = useSegments();
  const currentRoute = segments[0] || "";
  const isPublicRoute = PUBLIC_ROUTES.has(currentRoute);
  const [loading, setLoading] = useState(!isPublicRoute);
  const [authorized, setAuthorized] = useState(isPublicRoute);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isPublicRoute) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      if (!user) {
        setAuthorized(false);
        setLoading(false);
        router.replace("/signin");
        return;
      }

      if (adminOnly) {
        try {
          const userSnapshot = await getDoc(doc(db, "users", user.uid));
          if (!userSnapshot.exists() || userSnapshot.data().role !== "admin") {
            setAuthorized(false);
            router.replace("/home");
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Unable to verify administrator access:", error);
          setAuthorized(false);
          router.replace("/signin");
          setLoading(false);
          return;
        }
      }

      setAuthorized(true);
      setLoading(false);
    });

    return unsubscribe;
  }, [adminOnly, isPublicRoute, router]);

  if ((loading || !authorized) && !isPublicRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5F9C76" />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F6F8",
  },
});
