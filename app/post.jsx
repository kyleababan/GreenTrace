import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
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

  return `      ${date.toLocaleDateString(undefined, {
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
  console.log(id);
  console.log(typeof id);

  const [showImage, setShowImage] = useState(false);

  const router = useRouter();

  const [post, setPost] = useState(null);

  const [currentUserData, setCurrentUserData] = useState(null);

  const [authorPoints, setAuthorPoints] = useState(null);

  const loadCurrentUser = async () => {
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

    const actorName = `${currentUserData.firstName} ${currentUserData.lastName}`;

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

  const [comments, setComments] = useState([]);

  const [comment, setComment] = useState("");

  const currentUser = auth.currentUser;

  const [userReaction, setUserReaction] = useState(null);

  const [reactionScale] = useState(new Animated.Value(1));

  const [showSettings, setShowSettings] = useState(false);

  const [sendingComment, setSendingComment] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [reactionLoading, setReactionLoading] = useState(false);

  useEffect(() => {
    loadPost();
    loadComments();
    loadReaction();
    loadCurrentUser();
    // The screen only reloads these records when its route post ID changes.
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
    const currentUser = auth.currentUser;

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

  const loadComments = async () => {
    const q = query(
      collection(db, "comments"),
      where("postId", "==", id),
      orderBy("createdAt", "asc"),
    );

    const snapshot = await getDocs(q);

    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setComments(data);
  };

  const submitComment = async () => {
    console.log("submitComment called");
    console.log("currentUserData:", currentUserData);
    console.log("currentUser:", currentUser);
    console.log("post:", post);

    if (!comment.trim()) return;

    if (!currentUserData) {
      console.log("User data not loaded yet.");
      return;
    }

    setSendingComment(true);

    try {
      await addDoc(collection(db, "comments"), {
        postId: id,

        userId: currentUser.uid,

        firstName: currentUserData.firstName,

        lastName: currentUserData.lastName,

        points: currentUserData.points,

        comment,

        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", id), {
        commentCount: increment(1),
      });

      if (currentUser.uid !== post.userId) {
        await createOrUpdateNotification("comment");
      }

      setComment("");

      loadComments();
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

    playReactionAnimation(post.id);

    const currentUser = auth.currentUser;

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
        console.log("Creating reaction notification...");

        const reaction = await addDoc(collection(db, "post_reactions"), {
          postId: post.id,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        console.log("Reaction notification created.");

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
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* TOP SECTION */}
        <View style={styles.topSection}>
          <View style={styles.headerRow}>
            {/* BACK BUTTON */}
            <TouchableOpacity onPress={() => router.back()}>
              <Image
                source={require("../assets/images/back.png")} // 👈 add your icon
                style={styles.backIcon}
              />
            </TouchableOpacity>

            {/* TITLE */}
            <Text style={styles.headerTitle}>
              {post.firstName} {post.lastName}
              {"'s Post"}
            </Text>
          </View>
        </View>

        {/* POSTS */}
        <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
          {/* POST CARD */}
          <View style={styles.card}>
            {/* USER INFO */}
            <View style={styles.userRow}>
              <Image
                source={require("../assets/images/profile2.png")}
                style={styles.avatar}
              />

              <View style={{ flex: 1 }}>
                {/* TOP ROW */}

                <View style={styles.userTopRow}>
                  <View>
                    <Text style={styles.username}>
                      {post.firstName} {post.lastName}
                      <Text style={styles.points}>
                        {" "}
                        {authorPoints ?? post.points ?? 0} pts
                      </Text>
                    </Text>
                  </View>

                  {/* RIGHT SIDE */}

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
                            transform: [
                              {
                                scale: reactionScale,
                              },
                            ],
                          },
                        ]}
                      />
                    </TouchableOpacity>

                    <Text style={styles.reactCount}>{post.reactionCount}</Text>

                    {currentUser?.uid === post.userId && (
                      <TouchableOpacity onPress={() => setShowSettings(true)}>
                        <Image
                          source={require("../assets/images/setting.png")}
                          style={styles.settingsIcon}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* LOCATION */}

                <View style={styles.locationRow}>
                  <Image
                    source={require("../assets/images/location.png")}
                    style={styles.locationIcon}
                  />

                  <Text style={styles.locationText}>{post.locationName}</Text>
                </View>

                <Text style={styles.postedAt}>
                  {formatPostedAt(post.createdAt)}
                </Text>
              </View>
            </View>

            <Text style={styles.caption}>{post.caption}</Text>

            {/* IMAGE */}

            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => setShowImage(true)}
            >
              <Image source={{ uri: post.imageUrl }} style={styles.postImage} />

              {/* ✅ MOVE HERE */}
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

          {/* COMMENT INPUT */}
          <Text style={styles.commentLabel}>Comments</Text>
          <View style={styles.commentRow}>
            <TextInput
              placeholder="Write a comment..."
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
            />

            <TouchableOpacity
              style={styles.sendButton}
              onPress={submitComment}
              disabled={sendingComment}
            >
              <Text style={styles.sendText}>
                {sendingComment ? "Sending..." : "Send"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* COMMENTS LIST */}

          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <Image
                source={require("../assets/images/profile2.png")}
                style={styles.avatar}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.username}>
                  {comment.firstName} {comment.lastName}
                  <Text style={styles.points}> {comment.points} pts</Text>
                </Text>

                <Text style={styles.commentText}>{comment.comment}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* BOTTOM NAVBAR */}
        <View style={styles.navbarContainer}>
          <Navbar />
        </View>

        <Modal
          visible={showImage}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImage(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowImage(false)}
              accessibilityLabel="Close full image"
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>

            <Image
              source={{ uri: post.imageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </View>
        </Modal>

        <Modal visible={showSettings} transparent animationType="fade">
          <View style={styles.settingsOverlay}>
            <View style={styles.settingsBox}>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  setShowSettings(false);

                  router.push({
                    pathname: "/edit_post",
                    params: {
                      id: post.id,
                    },
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
                {/* <Image
    source={require("../assets/images/delete.png")}
    style={styles.modalIcon}
/> */}

                <Text style={[styles.settingsText, { color: "red" }]}>
                  Delete Post
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text
                  style={{
                    marginTop: 20,
                    color: "#666",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showDeleteModal} transparent animationType="fade">
          <View style={styles.settingsOverlay}>
            <View style={styles.settingsBox}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  marginBottom: 10,
                  textAlign: "center",
                }}
              >
                Delete Post
              </Text>

              <Text
                style={{
                  color: "#666",
                  textAlign: "center",
                  marginBottom: 25,
                }}
              >
                Are you sure you want to delete this post?
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: "#E74C3C",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
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
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: 17,
                  }}
                >
                  Delete
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Text
                  style={{
                    marginTop: 18,
                    color: "#666",
                    textAlign: "center",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    // backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 500, // 👈 THIS PREVENTS STRETCHING
  },

  topSection: {
    padding: 25,
    backgroundColor: "#5F9C76",
  },

  searchRow: {
    top: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  iconPlaceholder: {
    width: 28,
    height: 28,
    right: 10,
    borderRadius: 20,
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 23,
    height: 40,
  },

  addButton: {
    marginLeft: 10,
    backgroundColor: "#fff",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    right: -10,
  },

  addText: {
    fontSize: 20,
    fontWeight: "bold",
  },

  feed: {
    flex: 1,
    paddingHorizontal: 16,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    alignSelf: "flex-start",
  },

  username: {
    fontWeight: "600",
  },

  points: {
    color: "blue",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  locationIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
    resizeMode: "contain",
  },

  locationText: {
    fontSize: 12,
    color: "gray",
  },

  postedAt: {
    marginTop: 3,
    fontSize: 11,
    color: "#7A7A7A",
  },

  caption: {
    marginBottom: 8,
  },

  imageContainer: {
    width: "100%",
    height: 320,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ddd",
    position: "relative",
  },

  postImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover", // 👈 fills the container nicely
  },

  statusDot: {
    width: 25,
    height: 25,
    borderRadius: 30,
    position: "absolute",
    right: 10,
    top: 10,
  },

  actionsContainer: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center",
  },

  commentBox: {
    flex: 1,
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 30,
    flexDirection: "row",
    justifyContent: "center",
  },

  commentContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // 👈 THIS FIXES YOUR ISSUE
    gap: 6,
  },

  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },

  navItem: {
    alignItems: "center",
  },

  navIcon: {
    width: 24,
    height: 24,
    backgroundColor: "#ccc",
    borderRadius: 6,
  },

  activeLine: {
    width: 20,
    height: 3,
    backgroundColor: "#5F9C76",
    marginTop: 4,
    borderRadius: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  backIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
    resizeMode: "contain",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
  },

  commentLabel: {
    fontWeight: "600",
    marginBottom: 6,
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#E5E5E5",
    borderRadius: 20,
    height: 45,
    paddingHorizontal: 16,
  },

  commentCard: {
    backgroundColor: "#F4F4F4",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
  },

  commentUserRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  commentText: {
    marginTop: 2,
    fontSize: 13,
    color: "#666",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
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
    right: 25,
    zIndex: 1,
  },

  closeText: {
    color: "#fff",
    fontSize: 35,
    fontWeight: "bold",
  },

  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  sendButton: {
    marginLeft: 10,
    backgroundColor: "#5F9C76",
    borderRadius: 20,
    height: 45,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },

  sendText: {
    color: "#fff",
    fontWeight: "bold",
  },

  userTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reactIcon: {
    width: 26,
    height: 26,
    resizeMode: "contain",
  },

  reactCount: {
    fontWeight: "600",
    color: "#666",
  },

  settingsIcon: {
    width: 27,
    height: 27,
    resizeMode: "contain",
  },

  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  settingsBox: {
    backgroundColor: "#fff",
    width: 260,
    borderRadius: 15,
    padding: 20,
  },

  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },

  modalIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },

  settingsText: {
    fontSize: 17,
    fontWeight: "600",
  },
});
