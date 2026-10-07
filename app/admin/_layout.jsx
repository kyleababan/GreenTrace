import { Redirect, Slot, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import Sidebar from "../../components/Sidebar";
import { auth, db } from "../../firebaseConfig";

export const AdminSidebarContext = createContext({
  sidebarOpen: false,
  setSidebarOpen: () => {},
  toggleSidebar: () => {},
  isMobile: false,
});

export const useAdminSidebar = () => useContext(AdminSidebarContext);

export default function AdminLayout() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isTablet = width >= 700 && width < 1024;
  const isMapPage = pathname === "/admin/map";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().role === "admin") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      } catch (error) {
        console.log(error);
        setAuthorized(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#599A74" />
      </View>
    );
  }

  if (!authorized) {
    return <Redirect href="/signin" />;
  }

  return (
    <AdminSidebarContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        isMobile,
      }}
    >
      <View style={styles.container}>
        {!isMobile && <Sidebar />}

        {isMobile && (
          <Modal
            visible={sidebarOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSidebarOpen(false)}
          >
            <View style={styles.drawerOverlay}>
              <TouchableOpacity
                style={styles.drawerBackdrop}
                activeOpacity={1}
                onPress={() => setSidebarOpen(false)}
              />
              <View
                style={[
                  styles.drawerContent,
                  { width: Math.min(300, width * 0.82) },
                ]}
              >
                <Sidebar onClose={() => setSidebarOpen(false)} isDrawer />
              </View>
            </View>
          </Modal>
        )}

        <View
          style={[
            styles.content,
            isMobile && !isMapPage && styles.contentMobile,
            isTablet && styles.contentTablet,
            isMapPage && isMobile && styles.contentMobileMap,
          ]}
        >
          {isMobile && !isMapPage && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Open admin navigation"
                style={styles.mobileMenuButton}
                onPress={toggleSidebar}
              >
                <Ionicons name="menu" size={24} color="#315F43" />
              </TouchableOpacity>
              <Text style={styles.mobileHeaderTitle}>Admin</Text>
            </View>
          )}
          <Slot />
        </View>
      </View>
    </AdminSidebarContext.Provider>
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

  contentMobile: {
    padding: 0,
  },

  contentTablet: {
    padding: 12,
  },

  contentMobileMap: {
    padding: 10,
    backgroundColor: "#F4F7F5",
  },

  mobileHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F5F6FA",
  },

  mobileMenuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#E8F1EB",
  },

  mobileHeaderTitle: {
    color: "#315F43",
    fontSize: 16,
    fontWeight: "700",
  },

  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  drawerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  drawerContent: {
    height: "100%",
    backgroundColor: "#599A74",
    boxShadow: "4px 0 16px rgba(0, 0, 0, 0.3)",
    zIndex: 1000,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
