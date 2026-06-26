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

export default function Sidebar() {
  const router = useRouter();

  const { width } = useWindowDimensions();

  const sidebarWidth =
    width >= 1024
      ? 300
      : Math.max(200, width * 0.25);

  return (
    <View style={[styles.sidebar, { width: sidebarWidth }]}>

      {/* LOGO */}

      {/* <Image
        source={require("../assets/minicon.png")}
        style={styles.logo}
      /> */}

      {/* ADMIN PROFILE */}

      <TouchableOpacity
        style={styles.divider}
        onPress={() => router.push("/admin/profile")}
      >

        {/* <Image
          source={require("../assets/profile.png")}
          style={styles.Aprofile}
        /> */}

        <View>
          <Text style={styles.adminName}>
            Magistrate GB
          </Text>

          <Text style={styles.adminRole}>
            Admin
          </Text>
        </View>

      </TouchableOpacity>

      {/* MENU */}

      <View style={styles.menu}>

        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/admin/dashboard")
          }
        >

          {/* <Image
            source={require("../assets/Dashboard Logo.png")}
            style={styles.icon}
          /> */}

          <Text style={styles.itemText}>
            Dashboard
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/admin/situtation_assessment")
          }
        >

          {/* <Image
            source={require("../assets/Situation Assessment Logo.png")}
            style={styles.icon}
          /> */}

          <Text style={styles.itemText}>
            Situation Assessment
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/admin/VolunteerList")
          }
        >

          {/* <Image
            source={require("../assets/vlist.png")}
            style={styles.icon}
          /> */}

          <Text style={styles.itemText}>
            Volunteer List
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            router.push("/admin/UserList")
          }
        >

          {/* <Image
            source={require("../assets/acc.png")}
            style={styles.icon}
          /> */}

          <Text style={styles.itemText}>
            Users
          </Text>

        </TouchableOpacity>

      </View>

      {/* BOTTOM */}

      <View style={styles.bottom}>

        <TouchableOpacity
          onPress={() =>
            router.push("/admin/settings")
          }
        >

          {/* <Image
            source={require("../assets/Settings BTN.png")}
            style={styles.settings}
          /> */}

        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutContainer}
          onPress={() =>
            router.replace("/signin")
          }
        >

          <Text style={styles.logout}>
            Logout
          </Text>

        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  sidebar: {
    backgroundColor: "#599A74",
    padding: 20,
  },

  logo: {
    width: 200,
    height: 100,
    marginBottom: 30,
    resizeMode: "contain",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  adminName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },

  adminRole: {
    color: "#fff",
    fontSize: 14,
  },

  Aprofile: {
    width: 100,
    height: 100,
    borderRadius: 25,
    marginRight: 10,
  },

  menu: {
    marginTop: 10,
  },

  item: {
    width: "100%",

    height: 70,

    backgroundColor: "#f1f1f1",

    borderRadius: 10,

    marginVertical: 10,

    flexDirection: "row",

    alignItems: "center",

    paddingLeft: 25,

    gap: 15,
  },

  icon: {
    width: 25,
    height: 25,
  },

  itemText: {
    color: "#599A74",

    fontSize: 15,

    fontWeight: "bold",
  },

  bottom: {
    marginTop: "auto",

    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  settings: {
    width: 60,

    height: 60,
  },

  logoutContainer: {
    flex: 1,

    height: 60,

    backgroundColor: "#f1f1f1",

    justifyContent: "center",

    alignItems: "center",

    borderRadius: 10,
  },

  logout: {
    color: "#FF6666",

    fontSize: 20,

    fontWeight: "bold",
  },
});