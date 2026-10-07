import { usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../firebaseConfig";
import { subscribeToUnreadNotifications } from "../utils/notificationHelpers";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      return undefined;
    }

    return subscribeToUnreadNotifications(db, userId, setUnreadNotificationCount);
  }, []);

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
            <View style={styles.iconWrapper}>
              <Image source={tab.icon} style={styles.icon} />
              {tab.route === "/notification" &&
                unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 99
                        ? "99+"
                        : unreadNotificationCount}
                    </Text>
                  </View>
                )}
            </View>

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

  iconWrapper: {
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -8,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "#E53935",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
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
