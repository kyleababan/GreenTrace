import { usePathname, useRouter } from "expo-router";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      name: "home",
      route: "/home",
      icon: require("../assets/images/home.png"), // TODO: replace with your icon
    },
    {
      name: "volunteer",
      route: "/volunteer",
      icon: require("../assets/images/vlist.png"), // TODO
    },
    {
      name: "notification",
      route: "/notification",
      icon: require("../assets/images/notif.png"), // TODO
    },
    {
      name: "profile",
      route: "/profile",
      icon: require("../assets/images/acc.png"), // TODO
    },
  ];

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
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

              {/* Keep the indicator mounted so tab changes do not shift or flash. */}
              <View
                style={[styles.activeLine, !isActive && styles.inactiveLine]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
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
    alignItems: "center",
    paddingHorizontal: 35,
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
