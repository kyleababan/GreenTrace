import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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
import Navbar from "../components/navbar";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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

export default function Home() {
  const router = useRouter();

  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [userReactions, setUserReactions] = useState({});
  const [animations, setAnimations] = useState({});
  const [currentUserData, setCurrentUserData] = useState(null);

  // Live lookup for points across feed
  const [authorPoints, setAuthorPoints] = useState({});
  const [reactionLoadingByPost, setReactionLoadingByPost] = useState({});
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    const unsubscribe = loadPosts();
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const pointsByUserId = {};
      snapshot.forEach((userDocument) => {
        pointsByUserId[userDocument.id] = userDocument.data().points ?? 0;
      });
      setAuthorPoints(pointsByUserId);
    });

    loadUserReactions();
    loadCurrentUser();

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

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

  const toggleReaction = async (postId) => {
    if (reactionLoadingByPost[postId]) return;

    setReactionLoadingByPost((current) => ({ ...current, [postId]: true }));
    playReactionAnimation(postId);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const postRef = doc(db, "posts", postId);

      if (userReactions[postId]) {
        await deleteDoc(doc(db, "post_reactions", userReactions[postId]));

        await updateDoc(postRef, {
          reactionCount: increment(-1),
        });

        const updated = { ...userReactions };
        delete updated[postId];
        setUserReactions(updated);
      } else {
        const reaction = await addDoc(collection(db, "post_reactions"), {
          postId,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        });

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

          if (!currentUserData) return;

          const actorName = `${currentUserData.firstName} ${currentUserData.lastName}`;

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

        await updateDoc(postRef, {
          reactionCount: increment(1),
        });

        setUserReactions((prev) => ({
          ...prev,
          [postId]: reaction.id,
        }));
      }
    } catch (error) {
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

  const loadPosts = () => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPosts(data);
      setFilteredPosts(data);

      const anims = {};

      data.forEach((post) => {
        anims[post.id] = animations[post.id] || new Animated.Value(1);
      });

      setAnimations(anims);
    });
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
          >
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
                        {post.locationName || "Unknown location"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Caption */}
                {Boolean(post.caption) && (
                  <Text style={styles.caption}>{post.caption}</Text>
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

                  {/* Priority Status Badge */}
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          post.status === "critical"
                            ? "#FF5B5B"
                            : post.status === "moderate"
                              ? "#FFC940"
                              : post.status === "cleaned"
                                ? "#34C759"
                                : "#A5A5A5",
                      },
                    ]}
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
    maxWidth: 480,
  },

  /* Top Section */
  topSection: {
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
  },
  points: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2E7D32",
  },
  relativeTime: {
    fontSize: 11,
    color: "#888",
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
  imageContainer: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EBEBEB",
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  statusDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#FFFFFF",
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
