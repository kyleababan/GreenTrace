import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const OFFICIAL_TYPES = [
  "deleted_post",
  "deleted_comment",
  "status_update",
  "activity_started",
  "activity_cancelled",
  "activity_reverted",
  "activity_created",
  "activity_rescheduled",
  "attendance_marked",
  "attendance_reverted",
  "volunteer_kicked",
  "points_reward",
  "account_warning",
  "announcement",
];

export default function Notification() {
  const router = useRouter();

  const currentUser = auth.currentUser;
  const [listEntrance] = useState(() => new Animated.Value(0));

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
    if (type === "deleted_post" || type === "deleted_comment") return "trash-outline";
    if (type === "volunteer_kicked") return "person-remove";
    if (type === "activity_created") return "calendar-outline";
    if (type === "activity_rescheduled") return "time-outline";
    if (type === "activity_started") return "play-circle-outline";
    if (type === "activity_cancelled") return "close-circle-outline";
    if (type === "activity_reverted") return "refresh-circle-outline";
    if (type === "attendance_marked") return "checkmark-done-circle-outline";
    if (type === "attendance_reverted") return "alert-circle-outline";
    if (type === "status_update") return "alert-circle";
    if (type === "points_reward") return "gift-outline";
    if (type === "account_warning") return "warning-outline";
    if (type === "announcement") return "megaphone-outline";
    return "notifications";
  };

  const getNotificationIconBg = (type) => {
    if (
      type === "deleted_post" ||
      type === "deleted_comment" ||
      type === "account_warning"
    )
      return "#B42318";
    if (type === "activity_cancelled") return "#D92D20";
    if (type === "activity_reverted" || type === "attendance_reverted")
      return "#D97706";
    if (type === "activity_rescheduled") return "#2563EB";
    if (type === "points_reward") return "#E68A00";
    if (type === "status_update") return "#F59E0B";
    if (type === "announcement") return "#1D70B8";
    if (
      type === "activity_started" ||
      type === "activity_created" ||
      type === "attendance_marked"
    )
      return "#2E7D32";
    if (type === "reaction" || type === "priority") return "#E11D48";
    return "#5F9C76";
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
  const [activeTab, setActiveTab] = useState("all");
  const [selectedNotice, setSelectedNotice] = useState(null);
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
    const timer = setTimeout(() => {
      loadNotifications(true);
    }, 0);
    return () => clearTimeout(timer);
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

  const officialCount = useMemo(
    () =>
      notifications.filter((item) => OFFICIAL_TYPES.includes(item.type)).length,
    [notifications],
  );
  const communityCount = useMemo(
    () =>
      notifications.filter((item) => !OFFICIAL_TYPES.includes(item.type)).length,
    [notifications],
  );
  const displayedNotifications = useMemo(() => {
    if (activeTab === "official") {
      return notifications.filter((item) => OFFICIAL_TYPES.includes(item.type));
    }
    if (activeTab === "community") {
      return notifications.filter((item) => !OFFICIAL_TYPES.includes(item.type));
    }
    return notifications;
  }, [notifications, activeTab]);

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
      }
    }

    if (
      item.type === "deleted_post" ||
      item.type === "deleted_comment" ||
      item.type === "account_warning" ||
      item.type === "announcement" ||
      item.type === "points_reward"
    ) {
      setSelectedNotice(item);
      return;
    }

    if (
      (item.type === "volunteer_kicked" ||
        item.type === "activity_created" ||
        item.type === "activity_started" ||
        item.type === "activity_cancelled" ||
        item.type === "activity_reverted" ||
        item.type === "activity_rescheduled" ||
        item.type === "attendance_marked" ||
        item.type === "attendance_reverted") &&
      item.volunteerPostId
    ) {
      router.push({
        pathname: "/volunteering",
        params: { volunteerId: item.volunteerPostId },
      });
    } else if (item.type === "status_update") {
      if (item.postId && item.postAvailable) {
        router.push({
          pathname: "/post",
          params: { id: item.postId },
        });
      } else {
        setSelectedNotice(item);
      }
    } else if (item.postAvailable) {
      router.push({
        pathname: "/post",
        params: { id: item.postId },
      });
    } else if (OFFICIAL_TYPES.includes(item.type)) {
      setSelectedNotice(item);
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
                  {displayedNotifications.length}
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

              {/* FILTER TABS ROW: ALL | OFFICIAL (LGU) | COMMUNITY */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsRow}
              >
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "all" && styles.tabBtnActive,
                  ]}
                  onPress={() => setActiveTab("all")}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "all" && styles.tabBtnTextActive,
                    ]}
                  >
                    All ({notifications.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "official" && styles.tabBtnActive,
                  ]}
                  onPress={() => setActiveTab("official")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={12}
                    color={activeTab === "official" ? "#FFFFFF" : "#2E7D32"}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "official" && styles.tabBtnTextActive,
                    ]}
                  >
                    Official ({officialCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "community" && styles.tabBtnActive,
                  ]}
                  onPress={() => setActiveTab("community")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="people"
                    size={12}
                    color={activeTab === "community" ? "#FFFFFF" : "#556E60"}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "community" && styles.tabBtnTextActive,
                    ]}
                  >
                    Community ({communityCount})
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {displayedNotifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    item.read !== true && styles.unreadNotificationCard,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => openNotification(item)}
                  accessibilityLabel={`${item.read === true ? "Read" : "Unread"} notification`}
                >
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: getNotificationIconBg(item.type) },
                    ]}
                  >
                    <Ionicons
                      name={getNotificationIcon(item.type)}
                      size={19}
                      color="#FFFFFF"
                    />
                  </View>

                  {/* CENTER: Text Content */}
                  <View style={styles.textContainer}>
                    <Text style={styles.userName}>
                      {OFFICIAL_TYPES.includes(item.type)
                        ? item.title || "GreenTrace LGU"
                        : getActorText(item)}
                    </Text>

                    <Text
                      style={styles.userAction}
                      numberOfLines={
                        item.type === "deleted_post" ||
                        item.type === "deleted_comment" ||
                        item.type === "account_warning"
                          ? 3
                          : 2
                      }
                    >
                      {item.type === "comment"
                        ? "commented on your post."
                        : item.type === "reaction" || item.type === "priority"
                          ? "Increased your priority."
                          : (item.message || "").replace(/\n+/g, " ")}
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
              {displayedNotifications.length > 0 && hasMore && (
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
              {displayedNotifications.length > 0 && !hasMore && (
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

              {displayedNotifications.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={38}
                    color="#94A3B8"
                  />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptySubtext}>
                    {activeTab === "official"
                      ? "You have no official LGU notices at this time."
                      : activeTab === "community"
                        ? "You have no community comments or priority votes yet."
                        : "You're all caught up! No recent notifications."}
                  </Text>
                </View>
              )}
            </Animated.ScrollView>
          )}

          {/* DETAILED OFFICIAL NOTICE MODAL */}
          <Modal
            visible={Boolean(selectedNotice)}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedNotice(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.noticeModalCard} accessibilityRole="dialog">
                <View
                  style={[
                    styles.noticeIconCircle,
                    {
                      backgroundColor: getNotificationIconBg(
                        selectedNotice?.type,
                      ),
                    },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(selectedNotice?.type)}
                    size={28}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.noticeHeaderBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#276344" />
                  <Text style={styles.noticeHeaderBadgeText}>
                    Official LGU Advisory
                  </Text>
                </View>

                <Text style={styles.noticeTitle}>
                  {selectedNotice?.title || "Notice from GreenTrace LGU"}
                </Text>

                <Text style={styles.noticeDate}>
                  {formatNotificationTime(selectedNotice?.createdAt)}
                </Text>

                {/* Special points highlight if points_reward */}
                {Boolean(selectedNotice?.pointsAmount) && (
                  <View style={styles.pointsBadgeWrap}>
                    <Ionicons name="gift" size={18} color="#B45309" />
                    <Text style={styles.pointsBadgeText}>
                      +{selectedNotice.pointsAmount} EcoPoints Awarded
                    </Text>
                  </View>
                )}

                {/* Special strike chips if account_warning */}
                {selectedNotice?.type === "account_warning" && (
                  <View style={styles.warningStripWrap}>
                    <Ionicons name="alert-circle" size={15} color="#B42318" />
                    <Text style={styles.warningStripText}>
                      Strike {selectedNotice.warningNumber || 1} of{" "}
                      {selectedNotice.maxWarnings || 3}
                    </Text>
                  </View>
                )}

                <View style={styles.noticeMessageBox}>
                  <Text style={styles.noticeMessageText}>
                    {selectedNotice?.message || "No additional message."}
                  </Text>
                </View>

                <View style={styles.noticeActions}>
                  {Boolean(
                    selectedNotice?.postId && selectedNotice?.postAvailable,
                  ) && (
                    <TouchableOpacity
                      style={styles.noticeSecondaryBtn}
                      onPress={() => {
                        const pId = selectedNotice.postId;
                        setSelectedNotice(null);
                        router.push({ pathname: "/post", params: { id: pId } });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.noticeSecondaryBtnText}>
                        View Post
                      </Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(selectedNotice?.volunteerPostId) && (
                    <TouchableOpacity
                      style={styles.noticeSecondaryBtn}
                      onPress={() => {
                        const vId = selectedNotice.volunteerPostId;
                        setSelectedNotice(null);
                        router.push({
                          pathname: "/volunteering",
                          params: { volunteerId: vId },
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.noticeSecondaryBtnText}>
                        View Activity
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.noticePrimaryBtn}
                    onPress={() => setSelectedNotice(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noticePrimaryBtnText}>Understood</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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

  /* TABS ROW */
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 14,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 16,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EAF2EC",
    borderWidth: 1,
    borderColor: "#D1E2D7",
  },
  tabBtnActive: {
    backgroundColor: "#2E6944",
    borderColor: "#2E6944",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B6154",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },

  /* DETAILED NOTICE MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noticeModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  noticeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  noticeHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EAF4ED",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  noticeHeaderBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#276344",
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 4,
  },
  noticeDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 14,
  },
  pointsBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 14,
  },
  pointsBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  warningStripWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 14,
  },
  warningStripText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B42318",
  },
  noticeMessageBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  noticeMessageText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
    textAlign: "center",
  },
  noticeActions: {
    width: "100%",
    gap: 8,
  },
  noticePrimaryBtn: {
    width: "100%",
    backgroundColor: "#2E6944",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  noticePrimaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  noticeSecondaryBtn: {
    width: "100%",
    backgroundColor: "#F1F5F3",
    borderWidth: 1,
    borderColor: "#D3E4D8",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#276344",
  },

  navbarContainer: {
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
});
