import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";
import BadgeWithDetails from "../components/BadgeWithDetails";
import {
  BADGES,
  getUserContributionStats,
  getVolunteerId,
  isBadgeEarned,
} from "../constants/badges";
import { formatLocationWithPurok } from "../constants/locationFormat";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

const formatRelativeTime = (timestamp, now) => {
  if (!timestamp) return "Just now";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  let relativeTime;

  if (seconds < 60) relativeTime = `${seconds}s`;
  else if (seconds < 60 * 60) relativeTime = `${Math.floor(seconds / 60)}m`;
  else if (seconds < 24 * 60 * 60)
    relativeTime = `${Math.floor(seconds / (60 * 60))}h`;
  else relativeTime = `${Math.floor(seconds / (24 * 60 * 60))}d`;

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${dateLabel} • ${relativeTime}`;
};

const POSTS_PER_PAGE = 10;

export default function Home() {
  const router = useRouter();

  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [userReactions, setUserReactions] = useState({});
  const [animations, setAnimations] = useState({});
  const [currentUserData, setCurrentUserData] = useState(null);
  const [announcement, setAnnouncement] = useState(null);

  // Live lookup for points across feed
  const [authorPoints, setAuthorPoints] = useState({});
  const [authorBadges, setAuthorBadges] = useState({});
  const [reactionLoadingByPost, setReactionLoadingByPost] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [expandedPosts, setExpandedPosts] = useState({});
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const lastPostDocRef = useRef(null);
  const hasMorePostsRef = useRef(true);
  const loadingPostsRef = useRef(false);

  const loadCurrentUser = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const snapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (snapshot.exists()) {
        setCurrentUserData(snapshot.data());
      }
    } catch (error) {
      console.log(error);
    }
  };

  const loadAuthorBadges = async () => {
    try {
      const [postsSnapshot, volunteerPostsSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, "posts")),
        getDocs(collection(db, "volunteer_posts")),
        getDocs(collection(db, "users")),
      ]);
      const allPosts = postsSnapshot.docs.map((post) => post.data());
      const volunteerPosts = volunteerPostsSnapshot.docs.map((post) =>
        post.data(),
      );
      const userIds = new Set(
        allPosts.map((post) => post.userId).filter(Boolean),
      );

      volunteerPosts.forEach((activity) => {
        (Array.isArray(activity.volunteers) ? activity.volunteers : []).forEach(
          (volunteer) => {
            const userId = getVolunteerId(volunteer);
            if (userId) userIds.add(userId);
          },
        );
      });

      const badgesByUserId = {};
      const contributorBadgesByUserId = {};
      usersSnapshot.forEach((userDocument) => {
        const savedBadges = userDocument.data().contributorBadges;
        contributorBadgesByUserId[userDocument.id] = Array.isArray(savedBadges)
          ? savedBadges
          : [];
      });
      userIds.forEach((userId) => {
        const stats = getUserContributionStats(
          userId,
          allPosts,
          volunteerPosts,
        );
        badgesByUserId[userId] = [
          ...(contributorBadgesByUserId[userId] || []),
          ...BADGES.filter((badge) => isBadgeEarned(badge, stats)),
        ];
      });
      setAuthorBadges(badgesByUserId);
    } catch (error) {
      console.log("Unable to load author badges:", error);
    }
  };

  useEffect(() => {
    loadPosts(true);
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const pointsByUserId = {};
      snapshot.forEach((userDocument) => {
        pointsByUserId[userDocument.id] = userDocument.data().points ?? 0;
      });
      setAuthorPoints(pointsByUserId);
    });

    loadUserReactions();
    loadCurrentUser();
    loadAnnouncement();
    loadAuthorBadges();

    return () => {
      unsubscribeUsers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const visiblePostIds = posts.map((post) => post.id).join("|");

  useEffect(() => {
    if (!visiblePostIds) return undefined;

    const unsubscribePosts = visiblePostIds.split("|").map((postId) =>
      onSnapshot(doc(db, "posts", postId), (snapshot) => {
        if (!snapshot.exists()) return;

        const reactionCount = snapshot.data().reactionCount ?? 0;

        setPosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId && post.reactionCount !== reactionCount
              ? { ...post, reactionCount }
              : post,
          ),
        );
      }),
    );

    return () => {
      unsubscribePosts.forEach((unsubscribe) => unsubscribe());
    };
  }, [visiblePostIds]);

  const loadUserReactions = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const q = query(
      collection(db, "post_reactions"),
      where("userId", "==", currentUser.uid),
    );

    const snapshot = await getDocs(q);
    const reacted = {};

    snapshot.forEach((doc) => {
      reacted[doc.data().postId] = doc.id;
    });

    setUserReactions(reacted);
  };

  const loadAnnouncement = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(1)));
      if (!snapshot.empty) setAnnouncement({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } catch (error) {
      console.log("Error loading announcement:", error);
    }
  };

  const playReactionAnimation = (postId) => {
    const scale = animations[postId];
    if (!scale) return;

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.35,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const adjustLocalReactionCount = (postId, amount) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              reactionCount: Math.max(0, (post.reactionCount ?? 0) + amount),
            }
          : post,
      ),
    );
  };

  const toggleReaction = async (postId) => {
    if (reactionLoadingByPost[postId]) return;

    setReactionLoadingByPost((current) => ({ ...current, [postId]: true }));
    playReactionAnimation(postId);

    let optimisticDelta = 0;
    let countCommitted = false;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const postRef = doc(db, "posts", postId);

      if (userReactions[postId]) {
        optimisticDelta = -1;
        adjustLocalReactionCount(postId, -1);

        await deleteDoc(doc(db, "post_reactions", userReactions[postId]));

        await updateDoc(postRef, {
          reactionCount: increment(-1),
        });
        countCommitted = true;

        const updated = { ...userReactions };
        delete updated[postId];
        setUserReactions(updated);
      } else {
        optimisticDelta = 1;
        adjustLocalReactionCount(postId, 1);

        const reaction = await addDoc(collection(db, "post_reactions"), {
          postId,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        });

        await updateDoc(postRef, {
          reactionCount: increment(1),
        });
        countCommitted = true;

        setUserReactions((prev) => ({
          ...prev,
          [postId]: reaction.id,
        }));

        const postSnapshot = await getDoc(postRef);
        const postData = postSnapshot.data();

        if (postData.userId !== currentUser.uid) {
          const notificationQuery = query(
            collection(db, "notifications"),
            where("userId", "==", postData.userId),
            where("postId", "==", postId),
            where("type", "==", "reaction"),
          );

          const notificationSnapshot = await getDocs(notificationQuery);

          const actorName = currentUserData
            ? `${currentUserData.firstName} ${currentUserData.lastName}`
            : "Someone";

          if (notificationSnapshot.empty) {
            await addDoc(collection(db, "notifications"), {
              userId: postData.userId,
              actorId: currentUser.uid,
              actorNames: [actorName],
              type: "reaction",
              postId,
              createdAt: serverTimestamp(),
              read: false,
            });
          } else {
            const notificationDoc = notificationSnapshot.docs[0];
            const data = notificationDoc.data();
            let actorNames = data.actorNames || [];

            if (!actorNames.includes(actorName)) {
              actorNames.push(actorName);
            }

            await updateDoc(notificationDoc.ref, {
              actorNames,
              createdAt: serverTimestamp(),
            });
          }
        }
      }
    } catch (error) {
      if (optimisticDelta && !countCommitted) {
        adjustLocalReactionCount(postId, -optimisticDelta);
      }
      console.log(error);
    } finally {
      setReactionLoadingByPost((current) => ({ ...current, [postId]: false }));
    }
  };

  useEffect(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      setFilteredPosts(posts);
      return;
    }

    const filtered = posts.filter(
      (post) =>
        post.caption?.toLowerCase().includes(keyword) ||
        post.locationName?.toLowerCase().includes(keyword) ||
        post.firstName?.toLowerCase().includes(keyword) ||
        post.lastName?.toLowerCase().includes(keyword),
    );

    setFilteredPosts(filtered);
  }, [search, posts]);

  const loadPosts = async (reset = false) => {
    if (loadingPostsRef.current || (!reset && !hasMorePostsRef.current)) return;

    loadingPostsRef.current = true;
    setLoadingMorePosts(true);

    try {
      const constraints = [orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE)];
      if (!reset && lastPostDocRef.current) {
        constraints.splice(1, 0, startAfter(lastPostDocRef.current));
      }

      const snapshot = await getDocs(query(collection(db, "posts"), ...constraints));
      const data = snapshot.docs.map((postDocument) => ({
        id: postDocument.id,
        ...postDocument.data(),
      }));

      setPosts((currentPosts) => {
        if (reset) return data;
        const currentIds = new Set(currentPosts.map((post) => post.id));
        return [...currentPosts, ...data.filter((post) => !currentIds.has(post.id))];
      });

      setAnimations((currentAnimations) => {
        const nextAnimations = { ...currentAnimations };
        data.forEach((post) => {
          if (!nextAnimations[post.id]) nextAnimations[post.id] = new Animated.Value(1);
        });
        return nextAnimations;
      });

      lastPostDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      hasMorePostsRef.current = snapshot.docs.length === POSTS_PER_PAGE;
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      loadingPostsRef.current = false;
      setLoadingMorePosts(false);
    }
  };

  const togglePostCaption = (postId) => {
    setExpandedPosts((current) => ({ ...current, [postId]: !current[postId] }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* TOP HEADER / SEARCH SECTION */}
          <View style={styles.topSection}>
            <View style={styles.searchRow}>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logoHeader}
              />

              <TextInput
                placeholder="Search..."
                placeholderTextColor="#888"
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
              />

              <TouchableOpacity
                style={styles.addButton}
                activeOpacity={0.8}
                onPress={() => router.push("/create_post")}
              >
                <Image
                  source={require("../assets/images/plus.png")}
                  style={styles.addIcon}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* POSTS FEED */}
          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={200}
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 160) {
                loadPosts();
              }
            }}
          >
            {announcement && (
              <View style={styles.announcementCard}>
                <Text style={styles.announcementLabel}>SCHEDULED DATE</Text>
                <Text style={styles.announcementTitle}>{announcement.title}</Text>
                <Text style={styles.announcementDetails}>{announcement.schedule}{announcement.area ? ` • ${announcement.area}` : ""}</Text>
                {Boolean(announcement.message) && <Text style={styles.announcementMessage}>{announcement.message}</Text>}
              </View>
            )}
            {filteredPosts.map((post) => (
              <View key={post.id} style={styles.card}>
                {/* Author Info & Location */}
                <View style={styles.userRow}>
                  <Image
                    source={require("../assets/images/profile2.png")}
                    style={styles.avatar}
                  />

                  <View style={styles.userDetails}>
                    <View style={styles.userHeader}>
                      <Text style={styles.username}>
                        {post.firstName} {post.lastName}
                        <Text style={styles.points}>
                          {" "}
                          • {authorPoints[post.userId] ?? post.points ?? 0} pts
                        </Text>
                      </Text>

                      <View style={styles.authorBadgeRow}>
                        {(authorBadges[post.userId] || [])
                          .slice(0, 3)
                          .map((badge) => (
                            <BadgeWithDetails
                              key={badge.id}
                              badge={badge}
                              size={20}
                              tooltipPlacement="above"
                            />
                          ))}
                        {(authorBadges[post.userId]?.length || 0) > 3 && (
                          <View style={styles.authorBadge}>
                            <Text style={styles.authorBadgeMore}>
                              +{authorBadges[post.userId].length - 3}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.relativeTime}>
                        {formatRelativeTime(post.createdAt, now)}
                      </Text>
                    </View>

                    <View style={styles.locationRow}>
                      <Image
                        source={require("../assets/images/location.png")}
                        style={styles.locationIcon}
                      />
                      <Text style={styles.locationText}>
                        {formatLocationWithPurok(
                          post.locationName,
                          post.purok,
                        )}
                      </Text>
                    </View>

                    {/* Report Status Tag */}
                    <View
                      style={[
                        styles.statusTag,
                        {
                          backgroundColor:
                            post.status === "critical"
                              ? "#FF5B5B"
                              : post.status === "moderate"
                                ? "#FFC940"
                                : post.status === "cleaned"
                                  ? "#34C759"
                                  : post.status === "ongoing"
                                    ? "#7DD3FC"
                                    : "#A5A5A5",
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {post.status === "critical"
                          ? "Critical"
                          : post.status === "moderate"
                            ? "Moderate"
                            : post.status === "ongoing"
                              ? "On-going"
                              : post.status === "cleaned"
                                ? "Cleaned"
                                : "Pending"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Caption */}
                {Boolean(post.title) && <Text style={styles.reportTitle}>{post.title}</Text>}
                {Boolean(post.caption) && (
                  <View>
                    <Text
                      style={styles.caption}
                      numberOfLines={expandedPosts[post.id] ? undefined : 3}
                    >
                      {post.caption}
                    </Text>
                    {post.caption.length > 140 && (
                      <TouchableOpacity onPress={() => togglePostCaption(post.id)}>
                        <Text style={styles.captionToggle}>
                          {expandedPosts[post.id] ? "See less" : "See more"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Image Container */}
                <TouchableOpacity
                  style={styles.imageContainer}
                  activeOpacity={0.9}
                  onPress={() =>
                    router.push({
                      pathname: "/post",
                      params: { id: post.id },
                    })
                  }
                >
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>

                {/* Action Row */}
                <View style={styles.actionsContainer}>
                  {/* Reaction Button */}
                  <TouchableOpacity
                    disabled={reactionLoadingByPost[post.id]}
                    style={[
                      styles.reactionButton,
                      { opacity: reactionLoadingByPost[post.id] ? 0.5 : 1 },
                    ]}
                    onPress={() => toggleReaction(post.id)}
                  >
                    <Animated.Image
                      source={
                        userReactions[post.id]
                          ? require("../assets/images/priorityreact.png")
                          : require("../assets/images/priorityreact_gray.png")
                      }
                      style={[
                        styles.actionIcon,
                        {
                          transform: [
                            {
                              scale: animations[post.id] || 1,
                            },
                          ],
                        },
                      ]}
                    />

                    <Text style={styles.actionText}>
                      {post.reactionCount || 0}
                    </Text>
                  </TouchableOpacity>

                  {/* Comment Box Route */}
                  <TouchableOpacity
                    style={styles.commentBox}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/post",
                        params: { id: post.id },
                      })
                    }
                  >
                    <View style={styles.commentContent}>
                      <Image
                        source={require("../assets/images/comment.png")}
                        style={styles.actionIcon}
                      />
                      <Text style={styles.actionText}>
                        {post.commentCount ?? 0} Comments
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {loadingMorePosts && <ActivityIndicator color="#5F9C76" />}
          </ScrollView>

          {/* BOTTOM NAVBAR */}
          <View style={styles.navbar}>
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
  wrapper: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F4F6F8",
  },
  container: {
    flex: 1,
    backgroundColor: "#F4F6F8",
    width: "100%",
    maxWidth: 500,
  },

  /* Top Section */
  topSection: {
    height: 82,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#5F9C76",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoHeader: {
    width: 38,
    height: 38,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    fontSize: 14,
    color: "#333",
  },
  addButton: {
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addIcon: {
    width: 50,
    height: 50,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
  },

  /* Feed / Cards */
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  announcementCard: {
    backgroundColor: "#E7F1EA",
    borderLeftWidth: 5,
    borderLeftColor: "#5F9C76",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  announcementLabel: { color: "#397A51", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  announcementTitle: { color: "#234B33", fontSize: 17, fontWeight: "800", marginTop: 3 },
  announcementDetails: { color: "#397A51", fontSize: 13, fontWeight: "700", marginTop: 5 },
  announcementMessage: { color: "#4B5563", fontSize: 13, lineHeight: 18, marginTop: 6 },
  reportTitle: { fontSize: 16, fontWeight: "800", color: "#234B33", marginBottom: 6 },

  /* User Info */
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    resizeMode: "cover",
  },
  userDetails: {
    flex: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  username: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    flexShrink: 1,
  },
  points: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2E7D32",
  },
  authorBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 5,
    marginRight: "auto",
  },
  authorBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#B7DEC4",
  },
  authorBadgeIcon: {
    fontSize: 11,
  },
  authorBadgeMore: {
    color: "#397A51",
    fontSize: 8,
    fontWeight: "800",
  },
  relativeTime: {
    fontSize: 11,
    color: "#888",
    marginLeft: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationIcon: {
    width: 12,
    height: 12,
    marginRight: 4,
    resizeMode: "contain",
    tintColor: "#666",
  },
  locationText: {
    fontSize: 12,
    color: "#666",
  },

  /* Post Content */
  caption: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 10,
  },
  captionToggle: {
    color: "#397A51",
    fontSize: 13,
    fontWeight: "700",
    marginTop: -6,
    marginBottom: 10,
  },
  imageContainer: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C9DCCF",
    overflow: "hidden",
    backgroundColor: "#EBEBEB",
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  statusTag: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },

  /* Actions */
  actionsContainer: {
    flexDirection: "row",
    marginTop: 12,
    alignItems: "center",
    gap: 10,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
    gap: 6,
  },
  actionIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  commentBox: {
    flex: 1,
    backgroundColor: "#F0F2F5",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  commentContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  /* Bottom Navbar Wrapper */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
