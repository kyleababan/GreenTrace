import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

export default function Notification() {
  const router = useRouter();

  const currentUser = auth.currentUser;
  const listEntrance = useRef(new Animated.Value(0)).current;

  const getActorText = (item) => {
    const names = item.actorNames || [];

    if (names.length === 0) return "Someone";

    if (names.length === 1) return names[0];

    if (names.length === 2) return `${names[0]} & ${names[1]}`;

    return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  };

  const getNotificationIcon = (type) => {
    if (type === "comment") return "chatbubble-ellipses";
    if (type === "reaction" || type === "priority") return "heart";
    if (type === "deleted_post") return "shield-checkmark";
    return "notifications";
  };

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return "Just now";

    const date =
      typeof timestamp.toDate === "function"
        ? timestamp.toDate()
        : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Just now";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  // This creates 5 placeholder notifications
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(q);

      const data = await Promise.all(
        snapshot.docs.map(async (notification) => {
          const item = {
            id: notification.id,
            ...notification.data(),
          };

          try {
            const postSnap = await getDoc(doc(db, "posts", item.postId));

            if (postSnap.exists()) {
              item.postImage = postSnap.data().imageUrl;
            }
          } catch (_error) {}

          return item;
        }),
      );

      setNotifications(data);
    } catch (error) {
      console.log("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (loading) return;

    listEntrance.setValue(0);
    Animated.timing(listEntrance, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [listEntrance, loading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Notifications</Text>
                <Text style={styles.headerSubtitle}>
                  Your latest GreenTrace activity
                </Text>
              </View>
            </View>
          </View>

          {/* CONTENT */}
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#5F9C76" />
            </View>
          ) : (
            <Animated.ScrollView
              style={[
                styles.feed,
                {
                  opacity: listEntrance,
                  transform: [
                    {
                      translateY: listEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [28, 0],
                      }),
                    },
                  ],
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                <Text style={styles.notificationCount}>
                  {notifications.length}
                </Text>
              </View>
              {notifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.notificationCard}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({
                      pathname: "/post",
                      params: {
                        id: item.postId,
                      },
                    })
                  }
                >
                  <View style={styles.iconWrapper}>
                    <Ionicons
                      name={getNotificationIcon(item.type)}
                      size={19}
                      color="#FFFFFF"
                    />
                  </View>

                  {/* CENTER: Text Content */}
                  <View style={styles.textContainer}>
                    <Text style={styles.userName}>
                      {item.type === "deleted_post"
                        ? "GreenTrace LGU"
                        : getActorText(item)}
                    </Text>

                    <Text style={styles.userAction} numberOfLines={2}>
                      {item.type === "comment"
                        ? "commented on your post."
                        : item.type === "reaction" || item.type === "priority"
                          ? "Increased your priority."
                          : item.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(item.createdAt)}
                    </Text>
                  </View>

                  {/* RIGHT: Small Thumbnail of the post */}
                  {item.postImage ? (
                    <Image
                      source={{ uri: item.postImage }}
                      style={styles.postThumbnail}
                    />
                  ) : (
                    <View style={styles.postThumbnail} />
                  )}
                </TouchableOpacity>
              ))}

              {notifications.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No notifications yet.</Text>
                </View>
              )}
            </Animated.ScrollView>
          )}

          {/* NAVBAR */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#5F9C76",
  },
  postThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#DDD",
  },

  wrapper: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F5F5F5", // Light grey background makes white cards pop
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F5F5F5",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topSection: {
    height: 82,
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingVertical: 25,
    backgroundColor: "#5F9C76",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    color: "#E8F3EC",
    fontSize: 12,
    marginTop: 2,
  },
  feed: {
    flex: 1,
    paddingHorizontal: 16,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    // Adds a subtle shadow
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    color: "#234B33",
    fontSize: 16,
    fontWeight: "800",
  },
  notificationCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: "#E4F1E8",
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    resizeMode: "cover",
  },

  textContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  userName: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#1F3326",
  },
  userAction: {
    fontSize: 12,
    color: "#59685F",
    lineHeight: 17,
    marginTop: 2,
  },
  notificationTime: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 5,
  },
  emptyState: {
    marginTop: 60,
    alignItems: "center",
  },
  emptyText: {
    color: "#777",
    fontSize: 16,
    textAlign: "center",
  },

  navbarContainer: {
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
});
