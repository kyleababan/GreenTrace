import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BadgeWithDetails from "../components/BadgeWithDetails";
import Navbar from "../components/navbar";
import {
  BADGES,
  getUserContributionStats,
  getVolunteerId,
  isBadgeEarned,
} from "../constants/badges";
import { formatLocationWithPurok } from "../constants/locationFormat";
import { hideBadWords } from "../utils/hideBadWords";

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
const HOME_CAROUSEL_INTERVAL = 5000;

export default function Home() {
  const router = useRouter();

  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [userReactions, setUserReactions] = useState({});
  const [animations, setAnimations] = useState({});
  const [currentUserData, setCurrentUserData] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementSlides, setAnnouncementSlides] = useState([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [announcementCardWidth, setAnnouncementCardWidth] = useState(0);
  const [userRankSummary, setUserRankSummary] = useState(null);
  const [openVolunteerActivity, setOpenVolunteerActivity] = useState(null);
  const announcementTranslate = useRef(new Animated.Value(0)).current;

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
      const [postsSnapshot, volunteerPostsSnapshot, usersSnapshot] =
        await Promise.all([
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
    loadUserRankSummary();
    loadOpenVolunteerActivity();
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

  const formatDateKey = (date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

  const loadAnnouncement = async () => {
    try {
      const snapshot = await getDocs(collection(db, "announcements"));
      const announcements = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      const todayKey = formatDateKey(new Date());
      const todaysAnnouncement = announcements.find((item) =>
        Array.isArray(item.scheduledDateKeys)
          ? item.scheduledDateKeys.includes(todayKey)
          : false,
      );

      if (todaysAnnouncement) {
        setAnnouncement(todaysAnnouncement);
        return;
      }

      const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: "long",
      });

      setAnnouncement({
        id: "no_schedule",
        title: "No schedule for today",
        schedule: `${todayLabel} — no LGU pickup schedule assigned.`,
        area: "",
        message: "Check back tomorrow for the next cleanup schedule.",
        isFallback: true,
      });
    } catch (error) {
      console.log("Error loading announcement:", error);
    }
  };

  const loadUserRankSummary = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setUserRankSummary(null);
        return;
      }

      const usersSnapshot = await getDocs(collection(db, "users"));
      const pointTransactionsSnapshot = await getDocs(
        collection(db, "point_transactions"),
      );
      const currentMonthKey = `${new Date().getFullYear()}-${String(
        new Date().getMonth() + 1,
      ).padStart(2, "0")}`;
      const monthlyPointsByUser = {};

      pointTransactionsSnapshot.forEach((transactionDocument) => {
        const transaction = transactionDocument.data();
        const createdAt =
          typeof transaction.createdAt?.toDate === "function"
            ? transaction.createdAt.toDate()
            : new Date(transaction.createdAt);
        if (Number.isNaN(createdAt.getTime())) return;

        const transactionMonthKey = `${createdAt.getFullYear()}-${String(
          createdAt.getMonth() + 1,
        ).padStart(2, "0")}`;
        if (transactionMonthKey !== currentMonthKey) return;

        monthlyPointsByUser[transaction.userId] =
          (monthlyPointsByUser[transaction.userId] || 0) +
          (Number(transaction.amount) || 0);
      });

      const leaderboard = usersSnapshot.docs
        .map((userDocument) => ({
          id: userDocument.id,
          ...userDocument.data(),
          monthlyPoints: monthlyPointsByUser[userDocument.id] || 0,
        }))
        .filter((user) => Number(user.monthlyPoints) > 0)
        .sort((first, second) => second.monthlyPoints - first.monthlyPoints);

      const userIndex = leaderboard.findIndex(
        (user) => user.id === currentUser.uid,
      );
      const userEntry = leaderboard[userIndex];

      if (!userEntry) {
        setUserRankSummary(null);
        return;
      }

      setUserRankSummary({
        rank: userIndex + 1,
        points: userEntry.monthlyPoints,
        name:
          [userEntry.firstName, userEntry.lastName].filter(Boolean).join(" ") ||
          "You",
      });
    } catch (error) {
      console.log("Error loading monthly leaderboard summary:", error);
      setUserRankSummary(null);
    }
  };

  const loadOpenVolunteerActivity = async () => {
    try {
      const snapshot = await getDocs(collection(db, "volunteer_posts"));
      const openActivities = snapshot.docs
        .map((activityDocument) => ({
          id: activityDocument.id,
          ...activityDocument.data(),
        }))
        .filter((activity) => activity.status === "open");

      setOpenVolunteerActivity(openActivities[0] || null);
    } catch (error) {
      console.log("Error loading volunteer activity:", error);
      setOpenVolunteerActivity(null);
    }
  };

  const handleAnnouncementPress = (slide) => {
    if (!slide) return;

    if (slide.type === "rank") {
      router.push("/rank");
      return;
    }

    if (slide.type === "volunteer" && slide.activityId) {
      router.push({
        pathname: "/volunteering",
        params: { volunteerId: slide.activityId },
      });
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

  useEffect(() => {
    const slides = [];

    if (announcement) {
      slides.push({
        type: "schedule",
        title: announcement.title,
        details: announcement.isFallback
          ? announcement.schedule
          : `${announcement.schedule}${announcement.area ? ` • ${announcement.area}` : ""}`,
        message: announcement.message,
      });
    }

    if (userRankSummary) {
      slides.push({
        type: "rank",
        title: `${userRankSummary.name || "You"} is currently at top`,
        details: `#${userRankSummary.rank} in the monthly leaderboard`,
        message: `has contributed ${userRankSummary.points} points this month!`,
        actionText: "Click here to see more",
      });
    }

    if (openVolunteerActivity) {
      slides.push({
        type: "volunteer",
        title: openVolunteerActivity.title || "Volunteer opportunity",
        details:
          openVolunteerActivity.locationName || "Open volunteer activity",
        message: `${openVolunteerActivity.joinedCount || 0}/${openVolunteerActivity.maxVolunteers || 0} volunteers joined`,
        actionText: "Join now",
        activityId: openVolunteerActivity.id,
      });
    }

    if (slides.length === 0) {
      setAnnouncementSlides([]);
      return;
    }

    setAnnouncementSlides(slides);
    setAnnouncementIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(slides.length - 1, 0)),
    );
  }, [announcement, userRankSummary, openVolunteerActivity]);

  useEffect(() => {
    if (announcementSlides.length < 2 || !announcementCardWidth)
      return undefined;

    const timer = setInterval(() => {
      setAnnouncementIndex(
        (currentIndex) => (currentIndex + 1) % announcementSlides.length,
      );
    }, HOME_CAROUSEL_INTERVAL);

    return () => clearInterval(timer);
  }, [announcementCardWidth, announcementSlides.length]);

  useEffect(() => {
    if (!announcementCardWidth) return;

    Animated.timing(announcementTranslate, {
      toValue: -announcementIndex * announcementCardWidth,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [announcementCardWidth, announcementIndex, announcementTranslate]);

  const loadPosts = async (reset = false) => {
    if (loadingPostsRef.current || (!reset && !hasMorePostsRef.current)) return;

    loadingPostsRef.current = true;
    setLoadingMorePosts(true);

    try {
      const constraints = [orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE)];
      if (!reset && lastPostDocRef.current) {
        constraints.splice(1, 0, startAfter(lastPostDocRef.current));
      }

      const snapshot = await getDocs(
        query(collection(db, "posts"), ...constraints),
      );
      const data = snapshot.docs.map((postDocument) => ({
        id: postDocument.id,
        ...postDocument.data(),
      }));

      setPosts((currentPosts) => {
        if (reset) return data;
        const currentIds = new Set(currentPosts.map((post) => post.id));
        return [
          ...currentPosts,
          ...data.filter((post) => !currentIds.has(post.id)),
        ];
      });

      setAnimations((currentAnimations) => {
        const nextAnimations = { ...currentAnimations };
        data.forEach((post) => {
          if (!nextAnimations[post.id])
            nextAnimations[post.id] = new Animated.Value(1);
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
              const { contentOffset, contentSize, layoutMeasurement } =
                nativeEvent;
              if (
                layoutMeasurement.height + contentOffset.y >=
                contentSize.height - 160
              ) {
                loadPosts();
              }
            }}
          >
            {announcementSlides.length > 0 && (
              <View
                style={styles.announcementCard}
                onLayout={(event) =>
                  setAnnouncementCardWidth(event.nativeEvent.layout.width)
                }
              >
                <View style={styles.announcementCarousel}>
                  <Animated.View
                    style={[
                      styles.announcementTrack,
                      {
                        transform: [{ translateX: announcementTranslate }],
                      },
                    ]}
                  >
                    {announcementSlides.map((slide, index) => {
                      const label =
                        slide.type === "rank"
                          ? "TOP CONTRIBUTER"
                          : slide.type === "volunteer"
                            ? "VOLUNTEER"
                            : "SCHEDULED DATE";

                      return (
                        <View
                          key={`${slide.type}-${index}`}
                          style={[
                            styles.announcementSlide,
                            { width: announcementCardWidth || "100%" },
                          ]}
                        >
                          <View style={styles.announcementHeader}>
                            <Text style={styles.announcementLabel}>
                              {label}
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => handleAnnouncementPress(slide)}
                              style={styles.announcementActionButton}
                            ></TouchableOpacity>
                          </View>

                          <Text style={styles.announcementTitle}>
                            {slide.title}
                          </Text>
                          <Text style={styles.announcementDetails}>
                            {slide.details}
                          </Text>
                          {Boolean(slide.message) && (
                            <Text style={styles.announcementMessage}>
                              {slide.message}
                            </Text>
                          )}
                          {Boolean(slide.actionText) && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => handleAnnouncementPress(slide)}
                            >
                              <Text style={styles.announcementActionText}>
                                {slide.actionText}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </Animated.View>
                </View>

                {announcementSlides.length > 1 && (
                  <View style={styles.dotRow}>
                    {announcementSlides.map((slide, index) => (
                      <TouchableOpacity
                        key={`dot-${slide.type}-${index}`}
                        activeOpacity={0.8}
                        onPress={() => setAnnouncementIndex(index)}
                        style={[
                          styles.dot,
                          announcementIndex === index && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
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
                    <Text style={styles.reportedByLabel}>Reported by</Text>
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
                        {formatLocationWithPurok(post.locationName, post.purok)}
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
                                ? "#ff8c40"
                                : post.status === "cleaned"
                                  ? "#34C759"
                                  : post.status === "ongoing"
                                    ? "#FFC940"
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
                {Boolean(post.title) && (
                  <Text style={styles.reportTitle}>
                    {hideBadWords(post.title)}
                  </Text>
                )}
                {Boolean(post.caption) && (
                  <View>
                    <Text
                      style={styles.caption}
                      numberOfLines={expandedPosts[post.id] ? undefined : 3}
                    >
                      {hideBadWords(post.caption)}
                    </Text>
                    {post.caption.length > 140 && (
                      <TouchableOpacity
                        onPress={() => togglePostCaption(post.id)}
                      >
                        <Text style={styles.captionToggle}>
                          {expandedPosts[post.id] ? "See less" : "See more"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {post.status === "cleaned" && post.afterImageUrl && (
                  <TouchableOpacity
                    style={styles.cleanupResult}
                    activeOpacity={0.9}
                    onPress={() =>
                      router.push({
                        pathname: "/post",
                        params: { id: post.id },
                      })
                    }
                  >
                    <View style={styles.cleanupResultHeader}>
                      <Text style={styles.cleanupResultTitle}>
                        Cleanup Result
                      </Text>
                      <Text style={styles.cleanupAdmin} numberOfLines={1}>
                        By {post.cleanedByName || "Admin"}
                      </Text>
                    </View>
                    <View style={styles.cleanupImages}>
                      <View style={styles.cleanupImageColumn}>
                        <Text style={styles.cleanupImageLabel}>Before</Text>
                        <Image
                          source={{ uri: post.imageUrl }}
                          style={styles.cleanupImage}
                          resizeMode="cover"
                        />
                      </View>
                      <View style={styles.cleanupImageColumn}>
                        <Text style={styles.cleanupImageLabel}>After</Text>
                        <Image
                          source={{ uri: post.afterImageUrl }}
                          style={styles.cleanupImage}
                          resizeMode="cover"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Image Container */}
                {!(post.status === "cleaned" && post.afterImageUrl) && (
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
                )}

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
    overflow: "hidden",
  },
  announcementCarousel: {
    overflow: "hidden",
    borderRadius: 8,
  },
  announcementTrack: {
    flexDirection: "row",
    width: "100%",
  },
  announcementSlide: {
    paddingRight: 8,
  },
  announcementHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  announcementLabel: {
    color: "#397A51",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    flexShrink: 1,
  },

  announcementActionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 16,
  },
  announcementTitle: {
    color: "#234B33",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 3,
  },
  announcementDetails: {
    color: "#397A51",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  announcementMessage: {
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  announcementActionText: {
    color: "#1F6B46",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
    textDecorationLine: "underline",
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#B9D3C5",
  },
  dotActive: {
    width: 20,
    backgroundColor: "#397A51",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#234B33",
    marginBottom: 6,
  },

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
  reportedByLabel: {
    color: "#7A8A80",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 1,
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
  cleanupResult: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F4FAF6",
    borderWidth: 1,
    borderColor: "#D8E6DC",
    width: "100%",
  },
  cleanupResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 7,
  },
  cleanupResultTitle: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
  },
  cleanupAdmin: {
    flex: 1,
    color: "#68746C",
    fontSize: 10,
    textAlign: "right",
  },
  cleanupImages: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  cleanupImageColumn: {
    flex: 1,
    minWidth: 0,
  },
  cleanupImageLabel: {
    color: "#68746C",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 3,
  },
  cleanupImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 7,
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
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

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
    fontFamily: "sans-serif-medium",
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
