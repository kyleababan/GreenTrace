// components/Sidebar.jsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "A";

export default function Sidebar({ onClose, isDrawer = false }) {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);

  const { width } = useWindowDimensions();

  const sidebarWidth = isDrawer
    ? "100%"
    : width >= 1024
      ? 300
      : Math.max(200, width * 0.25);

  const handleNavigate = (path) => {
    if (onClose) onClose();
    router.push(path);
  };

  useEffect(() => {
    const loadAdmin = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));
        if (snapshot.exists()) setAdmin(snapshot.data());
      } catch (error) {
        console.error("Unable to load admin profile:", error);
      }
    };

    loadAdmin();
  }, []);

  const adminName = admin
    ? [admin.firstName, admin.lastName].filter(Boolean).join(" ")
    : "Admin";
  const adminRole = admin?.role || "admin";
  const adminInitials = getInitials(adminName);

  return (
    <View
      style={[
        styles.sidebar,
        { width: sidebarWidth },
        isDrawer && { height: "100%", flex: 1 },
      ]}
    >
      {/* ADMIN TOOL LABEL & CLOSE BUTTON */}
      <View style={styles.topLogoRow}>
        <Image
          source={require("../assets/images/GT-admintool-label.png")}
          style={[styles.logo, Boolean(onClose) && { maxWidth: "78%" }]}
          resizeMode="contain"
        />
        {Boolean(onClose) && (
          <TouchableOpacity
            style={styles.closeDrawerBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ADMIN PROFILE */}

      <TouchableOpacity
        style={styles.divider}
        onPress={() => handleNavigate("/admin/profile")}
      >
        <View style={styles.Aprofile}>
          <Text style={styles.avatarText}>{adminInitials}</Text>
        </View>

        <View>
          <Text style={styles.adminName}>{adminName}</Text>

          <Text style={styles.adminRole}>{adminRole}</Text>
        </View>
      </TouchableOpacity>

      {/* MENU */}

      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.item}
          onPress={() => handleNavigate("/admin/dashboard")}
        >
          <Image
            source={require("../assets/images/Dashboard Logo.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => handleNavigate("/admin/situtation_assessment")}
        >
          <Image
            source={require("../assets/images/Situation Assessment Logo.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Situation Assessment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => handleNavigate("/admin/VolunteerList")}
        >
          <Image
            source={require("../assets/images/vlist.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Volunteer List</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => handleNavigate("/admin/UserList")}
        >
          <Image
            source={require("../assets/images/acc.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => handleNavigate("/admin/pickup_schedule")}
        >
          <Image
            source={require("../assets/images/Notification.png")}
            style={styles.icon}
          />
          <Text style={styles.itemText}>Scheduled Date</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => handleNavigate("/admin/map")}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="location" size={22} color="#599A74" />
          </View>
          <Text style={styles.itemText}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM */}

      <View style={styles.bottom}>
        <TouchableOpacity onPress={() => handleNavigate("/admin/settings")}>
          <Image
            source={require("../assets/images/settings.png")}
            style={styles.settings}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutContainer}
          onPress={() => {
            if (onClose) onClose();
            router.replace("/signin");
          }}
        >
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: "#599A74",
    padding: 14,
    flexShrink: 0,
  },

  topLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  closeDrawerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },

  logo: {
    width: "85%",
    height: 56,
    alignSelf: "flex-start",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    minWidth: 0,
  },

  adminName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    flexShrink: 1,
  },

  adminRole: {
    color: "#fff",
    fontSize: 12,
  },

  Aprofile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: { color: "#599A74", fontSize: 18, fontWeight: "700" },

  menu: {
    marginTop: 2,
  },

  item: {
    width: "100%",

    minHeight: 58,

    backgroundColor: "#f1f1f1",

    borderRadius: 10,

    marginVertical: 5,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 14,

    gap: 12,
  },

  icon: {
    width: 24,
    height: 24,
  },

  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  itemText: {
    flex: 1,
    color: "#599A74",

    fontSize: 14,

    fontWeight: "bold",
  },

  bottom: {
    marginTop: "auto",

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  settings: {
    width: 48,

    height: 48,
  },

  logoutContainer: {
    flex: 1,

    minHeight: 48,

    backgroundColor: "#f1f1f1",

    justifyContent: "center",

    alignItems: "center",

    borderRadius: 10,
  },

  logout: {
    color: "#FF6666",

    fontSize: 15,

    fontWeight: "bold",
  },
});
