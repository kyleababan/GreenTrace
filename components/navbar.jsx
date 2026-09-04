import { usePathname, useRouter } from "expo-router";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      route: "/home",
      icon: require("../assets/images/home.png"),
    },
    {
      route: "/volunteer",
      icon: require("../assets/images/vlist.png"),
    },
    {
      route: "/notification",
      icon: require("../assets/images/notif.png"),
    },
    {
      route: "/rank",
      icon: require("../assets/images/rank.png"),
    },
    {
      route: "/profile",
      icon: require("../assets/images/acc.png"),
    },
  ];

  return (
    <View style={styles.navbar}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.route;

        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.navItem}
            disabled={isActive}
            onPress={() => router.replace(tab.route)}
          >
            <Image source={tab.icon} style={styles.icon} />

            <View
              style={[styles.activeLine, !isActive && styles.inactiveLine]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderColor: "#ccc",
    alignItems: "center",
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  icon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },

  activeLine: {
    width: 20,
    height: 3,
    backgroundColor: "#5F9C76",
    marginTop: 4,
    borderRadius: 2,
  },

  inactiveLine: {
    opacity: 0,
  },
});
