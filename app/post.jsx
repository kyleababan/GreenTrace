import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  addDoc,
  arrayUnion,
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
import Navbar from "../components/navbar";
import { auth, db } from "../firebaseConfig";
import { deleteRelatedDocuments } from "./guards/deletePostHelper";

const formatPostedAt = (timestamp) => {
  if (!timestamp) return "Posted just now";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Posted just now";

  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} at ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

export default function Post() {
  const { id } = useLocalSearchParams();

  const [showImage, setShowImage] = useState(false);
  const router = useRouter();

  const [post, setPost] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [authorPoints, setAuthorPoints] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [userReaction, setUserReaction] = useState(null);
  const [reactionScale] = useState(new Animated.Value(1));
  const [showSettings, setShowSettings] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);

  // Pagination state for comments (show 5 at a time)
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(5);

  const currentUser = auth.currentUser;

  const loadCurrentUser = async () => {
    if (!currentUser) return;
    const snapshot = await getDoc(doc(db, "users", currentUser.uid));

    if (snapshot.exists()) {
      setCurrentUserData(snapshot.data());
    }
  };

  const createOrUpdateNotification = async (type) => {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", post.userId),
      where("postId", "==", post.id),
      where("type", "==", type),
    );

    const snapshot = await getDocs(q);
    const actorName = currentUserData
      ? `${currentUserData.firstName} ${currentUserData.lastName}`
      : "Someone";

    if (!snapshot.empty) {
      const notif = snapshot.docs[0];

      await updateDoc(doc(db, "notifications", notif.id), {
        actorNames: arrayUnion(actorName),
        createdAt: serverTimestamp(),
        read: false,
      });
    } else {
      await addDoc(collection(db, "notifications"), {
        userId: post.userId,
        actorId: currentUser.uid,
        actorNames: [actorName],
        type,
        postId: post.id,
        createdAt: serverTimestamp(),
        read: false,
      });
    }
  };

  useEffect(() => {
    loadPost();
    loadComments();
    loadReaction();
    loadCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!post?.userId) return;

    return onSnapshot(doc(db, "users", post.userId), (snapshot) => {
      setAuthorPoints(snapshot.exists() ? (snapshot.data().points ?? 0) : null);
    });
  }, [post?.userId]);

  const loadPost = async () => {
    try {
      const docRef = doc(db, "posts", id);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        setPost({
          id: snapshot.id,
          ...snapshot.data(),
        });
      }
    } catch (error) {
      console.log(error);
      setSendingComment(false);
    }
  };

  const loadReaction = async () => {
    if (!currentUser) return;

    const q = query(
      collection(db, "post_reactions"),
      where("postId", "==", id),
      where("userId", "==", currentUser.uid),
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      setUserReaction(snapshot.docs[0].id);
    }
  };

  // FETCH COMMENTS AND DYNAMICALLY ATTACH CURRENT USER POINTS
  const loadComments = async () => {
    try {
      const q = query(
        collection(db, "comments"),
        where("postId", "==", id),
        orderBy("createdAt", "asc"),
      );

      const snapshot = await getDocs(q);

      const rawComments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Map unique user IDs to fetch their up-to-date points from Firestore
      const uniqueUserIds = [...new Set(rawComments.map((c) => c.userId))];
      const pointsMap = {};

      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          if (!userId) return;
          const userDoc = await getDoc(doc(db, "users", userId));
          if (userDoc.exists()) {
            pointsMap[userId] = userDoc.data().points ?? 0;
          }
        }),
      );

      // Merge current points into comment data
      const enrichedComments = rawComments.map((item) => ({
        ...item,
        currentPoints: pointsMap[item.userId] ?? item.points ?? 0,
      }));

      setComments(enrichedComments);
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;

    if (!currentUser) {
      console.log("No authenticated user.");
      return;
    }

    setSendingComment(true);

    try {
      // Fetch fresh user data right before submitting to guarantee accurate points
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const freshUserData = userDoc.exists() ? userDoc.data() : currentUserData;
      const currentPoints = freshUserData?.points ?? 0;

      await addDoc(collection(db, "comments"), {
        postId: id,
        userId: currentUser.uid,
        firstName: freshUserData?.firstName || "",
        lastName: freshUserData?.lastName || "",
        points: currentPoints,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", id), {
        commentCount: increment(1),
      });

      if (currentUser.uid !== post.userId) {
        await createOrUpdateNotification("comment");
      }

      setComment("");
      await loadComments();
    } catch (error) {
      console.log(error);
    } finally {
      setSendingComment(false);
    }
  };

  const playReactionAnimation = () => {
    Animated.sequence([
      Animated.timing(reactionScale, {
        toValue: 1.35,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(reactionScale, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(reactionScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleReaction = async () => {
    if (reactionLoading || !post) return;

    setReactionLoading(true);
    playReactionAnimation();

    if (!currentUser) {
      setReactionLoading(false);
      return;
    }

    const postRef = doc(db, "posts", post.id);

    try {
      if (userReaction) {
        await deleteDoc(doc(db, "post_reactions", userReaction));

        await updateDoc(postRef, {
          reactionCount: increment(-1),
        });

        setPost((prev) => ({
          ...prev,
          reactionCount: prev.reactionCount - 1,
        }));

        setUserReaction(null);
      } else {
        const reaction = await addDoc(collection(db, "post_reactions"), {
          postId: post.id,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        });

        if (currentUser.uid !== post.userId) {
          await createOrUpdateNotification("reaction");
        }

        await updateDoc(postRef, {
          reactionCount: increment(1),
        });

        setPost((prev) => ({
          ...prev,
          reactionCount: prev.reactionCount + 1,
        }));

        setUserReaction(reaction.id);
      }
    } catch (error) {
      console.error("Unable to update reaction:", error);
    } finally {
      setReactionLoading(false);
    }
  };

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wrapper}>
          <View style={styles.container}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5F9C76" />
            </View>
            <View style={styles.navbarContainer}>
              <Navbar />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Slice visible comments for 5-at-a-time pagination
  const visibleComments = comments.slice(0, visibleCommentsCount);
  const hasMoreComments = visibleCommentsCount < comments.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* TOP HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Image
                  source={require("../assets/images/back.png")}
                  style={styles.backIcon}
                />
              </TouchableOpacity>

              <Text numberOfLines={1} style={styles.headerTitle}>
                {post.firstName} {post.lastName}'s Post
              </Text>

              <View style={{ width: 36 }} />
            </View>
          </View>

          {/* MAIN CONTENT FEED */}
          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
          >
            {/* MAIN POST CARD */}
            <View style={styles.card}>
              {/* USER INFO */}
              <View style={styles.userRow}>
                <Image
                  source={require("../assets/images/profile2.png")}
                  style={styles.avatar}
                />

                <View style={{ flex: 1 }}>
                  <View style={styles.userTopRow}>
                    <Text style={styles.username}>
                      {post.firstName} {post.lastName}
                      <Text style={styles.points}>
                        {" "}
                        • {authorPoints ?? post.points ?? 0} pts
                      </Text>
                    </Text>

                    {/* RIGHT REACTION AND SETTINGS */}
                    <View style={styles.rightButtons}>
                      <TouchableOpacity
                        disabled={reactionLoading}
                        style={{ opacity: reactionLoading ? 0.5 : 1 }}
                        onPress={toggleReaction}
                      >
                        <Animated.Image
                          source={
                            userReaction
                              ? require("../assets/images/priorityreact.png")
                              : require("../assets/images/priorityreact_gray.png")
                          }
                          style={[
                            styles.reactIcon,
                            {
                              transform: [{ scale: reactionScale }],
                            },
                          ]}
                        />
                      </TouchableOpacity>

                      <Text style={styles.reactCount}>
                        {post.reactionCount || 0}
                      </Text>

                      {currentUser?.uid === post.userId && (
                        <TouchableOpacity
                          style={styles.settingsButtonTrigger}
                          onPress={() => setShowSettings(true)}
                        >
                          <Image
                            source={require("../assets/images/setting.png")}
                            style={styles.settingsIcon}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* LOCATION & TIME */}
                  <View style={styles.locationRow}>
                    <Image
                      source={require("../assets/images/location.png")}
                      style={styles.locationIcon}
                    />
                    <Text style={styles.locationText}>
                      {post.locationName || "Unknown location"}
                    </Text>
                  </View>

                  <Text style={styles.postedAt}>
                    {formatPostedAt(post.createdAt)}
                  </Text>
                </View>
              </View>

              {/* CAPTION */}
              {Boolean(post.caption) && (
                <Text style={styles.caption}>{post.caption}</Text>
              )}

              {/* POST IMAGE */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.imageContainer}
                onPress={() => setShowImage(true)}
              >
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.postImage}
                />

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
            </View>

            {/* COMMENTS SECTION */}
            <View style={styles.commentsHeader}>
              <Text style={styles.commentLabel}>
                Comments ({comments.length})
              </Text>
            </View>

            {/* INPUT ROW */}
            <View style={styles.commentRow}>
              <TextInput
                placeholder="Write a comment..."
                placeholderTextColor="#888"
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
              />

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={sendingComment || !comment.trim()}
                style={[
                  styles.sendButton,
                  (!comment.trim() || sendingComment) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={submitComment}
              >
                <Text style={styles.sendText}>
                  {sendingComment ? "..." : "Send"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* PAGINATED COMMENTS LIST */}
            {visibleComments.map((item) => (
              <View key={item.id} style={styles.commentCard}>
                <Image
                  source={require("../assets/images/profile2.png")}
                  style={styles.commentAvatar}
                />

                <View style={styles.commentBody}>
                  <View style={styles.commentUserHeader}>
                    <Text style={styles.commentUsername}>
                      {item.firstName} {item.lastName}
                    </Text>
                    {/* Always displays live/updated user points */}
                    <Text style={styles.commentPoints}>
                      {item.currentPoints ?? item.points ?? 0} pts
                    </Text>
                  </View>

                  <Text style={styles.commentText}>{item.comment}</Text>
                </View>
              </View>
            ))}

            {/* MINIMALISTIC "SEE MORE" BUTTON */}
            {hasMoreComments && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.seeMoreBtn}
                onPress={() => setVisibleCommentsCount((prev) => prev + 5)}
              >
                <Text style={styles.seeMoreText}>See more comments</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* BOTTOM NAVBAR */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>

          {/* FULL IMAGE MODAL */}
          <Modal
            animationType="fade"
            onRequestClose={() => setShowImage(false)}
            transparent={true}
            visible={showImage}
          >
            <View style={styles.modalContainer}>
              <TouchableOpacity
                accessibilityLabel="Close full image"
                style={styles.closeButton}
                onPress={() => setShowImage(false)}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>

              <Image
                resizeMode="contain"
                source={{ uri: post.imageUrl }}
                style={styles.fullImage}
              />
            </View>
          </Modal>

          {/* SETTINGS MODAL */}
          <Modal animationType="fade" transparent={true} visible={showSettings}>
            <View style={styles.settingsOverlay}>
              <View style={styles.settingsBox}>
                <Text style={styles.modalTitle}>Post Options</Text>

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    setShowSettings(false);
                    router.push({
                      pathname: "/edit_post",
                      params: { id: post.id },
                    });
                  }}
                >
                  <Text style={styles.settingsText}>Edit Post</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    setShowSettings(false);
                    setShowDeleteModal(true);
                  }}
                >
                  <Text style={[styles.settingsText, { color: "#FF5B5B" }]}>
                    Delete Post
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelModalButton}
                  onPress={() => setShowSettings(false)}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* DELETE CONFIRMATION MODAL */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={showDeleteModal}
          >
            <View style={styles.settingsOverlay}>
              <View style={styles.settingsBox}>
                <Text style={styles.deleteTitle}>Delete Post</Text>

                <Text style={styles.deleteMessage}>
                  Are you sure you want to delete this post? This action cannot
                  be undone.
                </Text>

                <TouchableOpacity
                  style={styles.confirmDeleteBtn}
                  onPress={async () => {
                    try {
                      await deleteRelatedDocuments(post.id);
                      setShowDeleteModal(false);
                      router.replace("/home");
                    } catch (error) {
                      console.log(error);
                    }
                  }}
                >
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelModalButton}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Top Section Header */
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },

  /* Feed Content */
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

  /* User Meta Row */
  userRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  userTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reactIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
  reactCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginRight: 4,
  },
  settingsButtonTrigger: {
    padding: 2,
    marginLeft: 2,
  },
  settingsIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
    tintColor: "#666",
  },

  /* Location and Time */
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
  postedAt: {
    marginTop: 2,
    fontSize: 11,
    color: "#888",
  },

  /* Post Caption & Image */
  caption: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 10,
  },
  imageContainer: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EBEBEB",
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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

  /* Comments Section */
  commentsHeader: {
    marginBottom: 8,
  },
  commentLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sendButton: {
    backgroundColor: "#5F9C76",
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#A8D0B5",
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  /* Comment Items */
  commentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentUserHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
  },
  commentPoints: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2E7D32",
  },
  commentText: {
    fontSize: 13,
    color: "#444",
    lineHeight: 18,
  },

  /* See More Comments Button */
  seeMoreBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5F9C76",
  },

  /* Bottom Navbar Wrapper */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },

  /* Full Image View Modal */
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "80%",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 2,
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },

  /* Options & Settings Modals */
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsBox: {
    backgroundColor: "#FFFFFF",
    width: 280,
    borderRadius: 16,
    padding: 20,
    alignItems: "stretch",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    color: "#222",
  },
  settingsButton: {
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  settingsText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  cancelModalButton: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelModalText: {
    color: "#888",
    fontSize: 15,
    fontWeight: "600",
  },

  /* Delete Confirmation Modal */
  deleteTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#222",
  },
  deleteMessage: {
    color: "#666",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  confirmDeleteBtn: {
    backgroundColor: "#FF5B5B",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmDeleteText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
