import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useSegments, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { auth, db } from "../../firebaseConfig";

const PUBLIC_ROUTES = new Set(["signin", "signup"]);

let cachedUserId = null;
let cachedUserRole = null;
let cachedIsBanned = false;

export default function AuthGuard({ children, adminOnly = false }) {
  const router = useRouter();
  const segments = useSegments();
  const currentRoute = segments[0] || "";
  const isPublicRoute = PUBLIC_ROUTES.has(currentRoute);
  const isAdminRoute = currentRoute === "admin";

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const isRoutingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        cachedUserId = null;
        cachedUserRole = null;
        cachedIsBanned = false;

        if (isPublicRoute) {
          setAuthorized(true);
          setLoading(false);
        } else {
          setAuthorized(false);
          setLoading(false);
          router.replace("/signin");
        }
        return;
      }

      // User is authenticated — get role & status (from cache or Firestore)
      let role = cachedUserRole;
      let isBanned = cachedIsBanned;

      if (cachedUserId !== user.uid || !role) {
        try {
          const userSnapshot = await getDoc(doc(db, "users", user.uid));
          if (!userSnapshot.exists()) {
            await signOut(auth);
            cachedUserId = null;
            cachedUserRole = null;
            cachedIsBanned = false;
            setAuthorized(false);
            setLoading(false);
            router.replace("/signin");
            return;
          }
          const data = userSnapshot.data();
          role = data.role || "user";
          isBanned = Boolean(data.isBanned);
          cachedUserId = user.uid;
          cachedUserRole = role;
          cachedIsBanned = isBanned;
        } catch (error) {
          console.error("AuthGuard: unable to verify user permissions:", error);
          await signOut(auth);
          cachedUserId = null;
          cachedUserRole = null;
          cachedIsBanned = false;
          setAuthorized(false);
          setLoading(false);
          router.replace("/signin");
          return;
        }
      }

      if (!isMounted) return;

      // Check if user is banned
      if (isBanned) {
        await signOut(auth);
        cachedUserId = null;
        cachedUserRole = null;
        cachedIsBanned = false;
        setAuthorized(false);
        setLoading(false);
        router.replace("/signin");
        return;
      }

      // Root route redirect
      if (!currentRoute) {
        setAuthorized(false);
        setLoading(false);
        if (role === "admin") {
          router.replace("/admin/dashboard");
        } else {
          router.replace("/home");
        }
        return;
      }

      // 1. ADMIN USER ATTEMPTING TO ACCESS USER-SIDE OR PUBLIC ROUTES
      if (role === "admin") {
        if (!isAdminRoute) {
          // Block admin from accessing user side (home, create_post, volunteer, etc.) or signin/signup
          setAuthorized(false);
          setLoading(false);
          router.replace("/admin/dashboard");
          return;
        }
        // Admin on admin route
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // 2. REGULAR USER (RESIDENT) ATTEMPTING TO ACCESS ADMIN-SIDE
      if (isAdminRoute || adminOnly) {
        // Block resident from accessing admin portal
        setAuthorized(false);
        setLoading(false);
        router.replace("/home");
        return;
      }

      // 3. LOGGED-IN REGULAR USER ON PUBLIC AUTH ROUTES (signin / signup)
      if (isPublicRoute) {
        setAuthorized(false);
        setLoading(false);
        router.replace("/home");
        return;
      }

      // 4. REGULAR USER ON VALID USER-SIDE ROUTE
      setAuthorized(true);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentRoute, isPublicRoute, isAdminRoute, adminOnly, router]);

  if (loading || !authorized) {
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
