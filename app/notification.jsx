import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  RefreshControl,
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
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";
import { subscribeToUnreadNotifications } from "../utils/notificationHelpers";

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
    if (type === "volunteer_kicked") return "person-remove";
    if (type === "activity_created") return "calendar-outline";
    if (type === "status_update") return "alert-circle";
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

  const NOTIFICATIONS_PER_PAGE = 10;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const lastDocRef = useRef(null);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);

  const loadNotifications = useCallback(
    async (reset = false) => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (isLoadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;

      isLoadingRef.current = true;
      if (reset) {
        setLoading(true);
        lastDocRef.current = null;
        hasMoreRef.current = true;
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const constraints = [
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(NOTIFICATIONS_PER_PAGE),
        ];

        if (!reset && lastDocRef.current) {
          constraints.push(startAfter(lastDocRef.current));
        }

        const q = query(collection(db, "notifications"), ...constraints);
        const snapshot = await getDocs(q);

        const newItems = await Promise.all(
          snapshot.docs.map(async (notificationDoc) => {
            const item = {
              id: notificationDoc.id,
              ...notificationDoc.data(),
            };

            if (item.postId) {
              try {
                const postSnap = await getDoc(doc(db, "posts", item.postId));

                if (postSnap.exists()) {
                  item.postImage = postSnap.data().imageUrl || item.postImage;
                  item.postAvailable = true;
                } else {
                  item.postAvailable = false;
                }
              } catch (_error) {
                item.postAvailable = false;
              }
            } else if (item.volunteerPostId) {
              item.postAvailable = true;
              if (!item.postImage) {
                try {
                  const volSnap = await getDoc(
                    doc(db, "volunteer_posts", item.volunteerPostId),
                  );
                  if (volSnap.exists()) {
                    item.postImage = volSnap.data().imageUrl;
                  }
                } catch (_error) {
                  // ignore
                }
              }
            } else {
              item.postAvailable = false;
            }

            return item;
          }),
        );

        const isBatchFull = snapshot.docs.length === NOTIFICATIONS_PER_PAGE;
        hasMoreRef.current = isBatchFull;
        setHasMore(isBatchFull);

        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        setNotifications((current) => {
          if (reset) return newItems;
          const existingIds = new Set(current.map((item) => item.id));
          const filteredNew = newItems.filter(
            (item) => !existingIds.has(item.id),
          );
          return [...current, ...filteredNew];
        });
      } catch (error) {
        console.log("Error loading notifications:", error);
      } finally {
        isLoadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [currentUser],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  useEffect(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    return subscribeToUnreadNotifications(db, currentUser.uid, setUnreadCount);
  }, [currentUser]);

  const markAllAsRead = async () => {
    if (!currentUser || markingAllRead || unreadCount === 0) return;

    setMarkingAllRead(true);
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", currentUser.uid),
        ),
      );
      const unreadNotifications = snapshot.docs.filter(
        (notification) => notification.data().read !== true,
      );

      for (let index = 0; index < unreadNotifications.length; index += 450) {
        const batch = writeBatch(db);
        unreadNotifications
          .slice(index, index + 450)
          .forEach((notification) => {
            batch.update(notification.ref, { read: true });
          });
        await batch.commit();
      }

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
      Alert.alert(
        "Unable to mark notifications as read",
        "Please try again.",
      );
    } finally {
      setMarkingAllRead(false);
    }
  };

  const openNotification = async (item) => {
    if (item.read !== true) {
      try {
        await updateDoc(doc(db, "notifications", item.id), { read: true });
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, read: true }
              : notification,
          ),
        );
      } catch (error) {
        console.error("Unable to mark notification as read:", error);
        Alert.alert(
          "Unable to update notification",
          "The notification will still open. Please try again later.",
        );
      }
    }

    if (
      (item.type === "volunteer_kicked" || item.type === "activity_created") &&
      item.volunteerPostId
    ) {
      router.push({
        pathname: "/volunteering",
        params: { volunteerId: item.volunteerPostId },
      });
    } else if (item.postAvailable) {
      router.push({
        pathname: "/post",
        params: { id: item.postId },
      });
    } else {
      router.push("/post-unavailable");
    }
  };

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
              contentContainerStyle={styles.feedContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={["#5F9C76"]}
                  tintColor="#5F9C76"
                />
              }
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                <Text style={styles.notificationCount}>
                  {notifications.length}
                </Text>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllReadButton}
                    activeOpacity={0.8}
                    disabled={markingAllRead}
                    onPress={markAllAsRead}
                    accessibilityRole="button"
                  >
                    {markingAllRead ? (
                      <ActivityIndicator size="small" color="#397A51" />
                    ) : (
                      <Text style={styles.markAllReadText}>
                        Mark all as read
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {notifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    item.read !== true && styles.unreadNotificationCard,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => openNotification(item)}
                  accessibilityLabel={`${item.read === true ? "Read" : "Unread"} notification from ${item.type === "deleted_post" || item.type === "activity_created" || item.type === "status_update" ? item.title || "GreenTrace LGU" : getActorText(item)}`}
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
                      {item.type === "deleted_post" ||
                      item.type === "activity_created" ||
                      item.type === "status_update"
                        ? item.title || "GreenTrace LGU"
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
                    <View style={styles.readStatus}>
                      <View
                        style={[
                          styles.readStatusDot,
                          item.read === true && styles.readStatusDotRead,
                        ]}
                      />
                      <Text
                        style={[
                          styles.readStatusText,
                          item.read === true && styles.readStatusTextRead,
                        ]}
                      >
                        {item.read === true ? "Read" : "Unread"}
                      </Text>
                    </View>
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

              {/* Load More Button */}
              {notifications.length > 0 && hasMore && (
                <View style={styles.loadMoreContainer}>
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    activeOpacity={0.8}
                    disabled={loadingMore}
                    onPress={() => loadNotifications(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Load more notifications"
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#2E6944" />
                    ) : (
                      <>
                        <Ionicons
                          name="chevron-down-circle-outline"
                          size={18}
                          color="#2E6944"
                        />
                        <Text style={styles.loadMoreText}>Load more</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* All caught up indicator */}
              {notifications.length > 0 && !hasMore && (
                <View style={styles.endOfListContainer}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#8FA396"
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={styles.endOfListText}>
                    You{"'"}re all caught up
                  </Text>
                </View>
              )}

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
  feedContent: {
    paddingBottom: 24,
  },
  loadMoreContainer: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8F3EC",
    borderWidth: 1,
    borderColor: "#C2DEC9",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 22,
    minWidth: 140,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  loadMoreText: {
    color: "#2E6944",
    fontSize: 13,
    fontWeight: "700",
  },
  endOfListContainer: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  endOfListText: {
    color: "#8FA396",
    fontSize: 12,
    fontWeight: "600",
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
  unreadNotificationCard: {
    borderWidth: 1,
    borderColor: "#B8DCC2",
    backgroundColor: "#F7FCF8",
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
  readStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  readStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E53935",
  },
  readStatusDotRead: {
    backgroundColor: "#93A39A",
  },
  readStatusText: {
    color: "#C62828",
    fontSize: 10,
    fontWeight: "700",
  },
  readStatusTextRead: {
    color: "#839189",
    fontWeight: "500",
  },
  markAllReadButton: {
    minHeight: 30,
    justifyContent: "center",
    marginLeft: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#E4F1E8",
  },
  markAllReadText: {
    color: "#397A51",
    fontSize: 11,
    fontWeight: "700",
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
