// components/Sidebar.jsx

import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "A";

export default function Sidebar() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);

  const { width } = useWindowDimensions();

  const sidebarWidth = width >= 1024 ? 300 : Math.max(200, width * 0.25);

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
    <View style={[styles.sidebar, { width: sidebarWidth }]}>
      {/* ADMIN TOOL LABEL */}
      <Image
        source={require("../assets/images/GT-admintool-label.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* ADMIN PROFILE */}

      <TouchableOpacity
        style={styles.divider}
        onPress={() => router.push("/admin/profile")}
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
          onPress={() => router.push("/admin/dashboard")}
        >
          <Image
            source={require("../assets/images/Dashboard Logo.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/situtation_assessment")}
        >
          <Image
            source={require("../assets/images/Situation Assessment Logo.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Situation Assessment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/VolunteerList")}
        >
          <Image
            source={require("../assets/images/vlist.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Volunteer List</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/UserList")}
        >
          <Image
            source={require("../assets/images/acc.png")}
            style={styles.icon}
          />

          <Text style={styles.itemText}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push("/admin/pickup_schedule")}
        >
          <Image
            source={require("../assets/images/Notification.png")}
            style={styles.icon}
          />
          <Text style={styles.itemText}>Scheduled Date</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM */}

      <View style={styles.bottom}>
        <TouchableOpacity onPress={() => router.push("/admin/settings")}>
          <Image
            source={require("../assets/images/settings.png")}
            style={styles.settings}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutContainer}
          onPress={() => router.replace("/signin")}
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

  logo: {
    width: "85%",
    height: 56,
    marginBottom: 14,
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
