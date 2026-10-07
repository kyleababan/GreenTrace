import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { Ionicons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
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
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    updateDoc,
    where,
} from "firebase/firestore";
import FormError from "../components/form-error";
import Navbar from "../components/navbar";
import PostLocationModal from "../components/PostLocationModal";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../constants/wasteCategories";
import { auth, db } from "../firebaseConfig";
import { deleteRelatedDocuments } from "../utils/deletePostHelper";
import { getNameInitials } from "../utils/getNameInitials";
import { hideBadWords } from "../utils/hideBadWords";
import {
    COMMENTS_PER_PAGE,
    getUserPointsMap,
    mergeUniqueById,
} from "../utils/pagination";

const formatDateTime = (timestamp) => {
  if (!timestamp) return null;
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} at ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

const formatPostedAt = (timestamp) =>
  `Posted ${formatDateTime(timestamp) || "just now"}`;

const isPostEditLocked = (status) =>
  ["ongoing", "on-going", "cleaned"].includes(
    String(status || "")
      .trim()
      .toLowerCase(),
  );

export default function Post() {
  const { id } = useLocalSearchParams();

  const [fullImageUrl, setFullImageUrl] = useState(null);
  const router = useRouter();

  const [post, setPost] = useState(null);
  const [authorProfile, setAuthorProfile] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [authorPoints, setAuthorPoints] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentProfiles, setCommentProfiles] = useState({});
  const [commentSortOrder, setCommentSortOrder] = useState("asc");
  const [comment, setComment] = useState("");
  const [userReaction, setUserReaction] = useState(null);
  const [reactionScale] = useState(new Animated.Value(1));
  const [showSettings, setShowSettings] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [captionHasMore, setCaptionHasMore] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedCommentForMenu, setSelectedCommentForMenu] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingEditComment, setSavingEditComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const lastCommentDocRef = useRef(null);
  const loadingCommentsRef = useRef(false);
  const commentsLoadIdRef = useRef(0);
  const commentUserIdsKey = JSON.stringify(
    [...new Set(comments.map((item) => item.userId).filter(Boolean))].sort(),
  );

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
    if (!post?.userId) return;

    return onSnapshot(
      doc(db, "users", post.userId),
      (snapshot) => {
        const profile = snapshot.exists() ? snapshot.data() : null;
        setAuthorProfile(profile);
        setAuthorPoints(profile ? (profile.points ?? 0) : null);
      },
      (error) => {
        console.error("Unable to subscribe to post author profile:", error);
      },
    );
  }, [post?.userId]);

  useEffect(() => {
    const userIds = JSON.parse(commentUserIdsKey);
    const unsubscribeUsers = userIds.map((userId) =>
      onSnapshot(
        doc(db, "users", userId),
        (snapshot) => {
          setCommentProfiles((current) => ({
            ...current,
            [userId]: snapshot.exists() ? snapshot.data() : null,
          }));
        },
        (error) => {
          console.error(`Unable to subscribe to comment author ${userId}:`, error);
        },
      ),
    );

    return () => unsubscribeUsers.forEach((unsubscribe) => unsubscribe());
  }, [commentUserIdsKey]);

  const loadPost = async () => {
    try {
      const docRef = doc(db, "posts", id);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        setPost({
          id: snapshot.id,
          ...snapshot.data(),
        });
      } else {
        router.replace("/post-unavailable");
      }
    } catch (error) {
      console.log(error);
      router.replace("/post-unavailable");
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
  const loadComments = async (reset = false, sortOrder = commentSortOrder) => {
    if (
      (loadingCommentsRef.current && !reset) ||
      (!reset && !hasMoreComments)
    ) {
      return;
    }

    const requestId = ++commentsLoadIdRef.current;
    loadingCommentsRef.current = true;
    setLoadingMoreComments(true);
    try {
      const constraints = [
        where("postId", "==", id),
        orderBy("createdAt", sortOrder),
        limit(COMMENTS_PER_PAGE),
      ];
      if (reset) {
        lastCommentDocRef.current = null;
      } else if (lastCommentDocRef.current) {
        constraints.push(startAfter(lastCommentDocRef.current));
      }

      const q = query(collection(db, "comments"), ...constraints);

      const snapshot = await getDocs(q);

      const rawComments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const pointsMap = await getUserPointsMap(
        db,
        rawComments.map((item) => item.userId),
      );

      if (requestId !== commentsLoadIdRef.current) return;

      const enrichedComments = rawComments.map((item) => ({
        ...item,
        comment: hideBadWords(item.comment),
        currentPoints: pointsMap[item.userId] ?? item.points ?? 0,
      }));

      setComments((currentComments) => {
        if (reset) return enrichedComments;
        return mergeUniqueById(currentComments, enrichedComments);
      });
      lastCommentDocRef.current =
        snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMoreComments(snapshot.docs.length === COMMENTS_PER_PAGE);
    } catch (error) {
      if (requestId === commentsLoadIdRef.current) {
        console.error("Error loading comments:", error);
      }
    } finally {
      if (requestId === commentsLoadIdRef.current) {
        loadingCommentsRef.current = false;
        setLoadingMoreComments(false);
      }
    }
  };

  useEffect(() => {
    loadPost();
    loadComments(true);
    loadReaction();
    loadCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitComment = async () => {
    if (!comment.trim()) {
      setCommentError("Write a comment before sending.");
      return;
    }

    if (!currentUser) {
      setCommentError("You must be signed in to comment.");
      return;
    }

    setSendingComment(true);
    setCommentError("");

    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const freshUserData = userDoc.exists() ? userDoc.data() : currentUserData;
      const currentPoints = freshUserData?.points ?? 0;

      await addDoc(collection(db, "comments"), {
        postId: id,
        userId: currentUser.uid,
        firstName: freshUserData?.firstName || "",
        lastName: freshUserData?.lastName || "",
        points: currentPoints,
        comment: hideBadWords(comment.trim()),
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", id), {
        commentCount: increment(1),
      });

      setPost((prev) =>
        prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev,
      );

      if (currentUser.uid !== post.userId) {
        await createOrUpdateNotification("comment");
      }

      setComment("");
      await loadComments(true);
    } catch (error) {
      console.log(error);
      setCommentError("Could not send your comment. Please try again.");
    } finally {
      setSendingComment(false);
    }
  };

  const handleSaveEditComment = async () => {
    if (!editingComment) return;
    const trimmed = editCommentText.trim();
    if (!trimmed) {
      Alert.alert("Empty Comment", "Comment cannot be empty.");
      return;
    }

    try {
      setSavingEditComment(true);
      const cleaned = hideBadWords(trimmed);
      const commentDocRef = doc(db, "comments", editingComment.id);
      await updateDoc(commentDocRef, {
        comment: cleaned,
        updatedAt: serverTimestamp(),
      });

      setComments((prevComments) =>
        prevComments.map((c) =>
          c.id === editingComment.id ? { ...c, comment: cleaned } : c,
        ),
      );

      setEditingComment(null);
      setEditCommentText("");
    } catch (error) {
      console.error("Error updating comment:", error);
      Alert.alert("Error", "Could not update comment. Please try again.");
    } finally {
      setSavingEditComment(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete || deletingComment) return;

    try {
      setDeletingComment(true);
      await deleteDoc(doc(db, "comments", commentToDelete.id));

      if (post?.id) {
        await updateDoc(doc(db, "posts", post.id), {
          commentCount: increment(-1),
        });
      }

      setPost((prev) =>
        prev
          ? {
              ...prev,
              commentCount: Math.max(0, (prev.commentCount ?? 1) - 1),
            }
          : prev,
      );

      setComments((prevComments) =>
        prevComments.filter((c) => c.id !== commentToDelete.id),
      );

      setCommentToDelete(null);
    } catch (error) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", "Could not delete comment. Please try again.");
    } finally {
      setDeletingComment(false);
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

  const captionText = hideBadWords(post.caption || "");
  const showCaptionToggle =
    captionHasMore || captionText.split(/\r?\n/).length >= 3;

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
                {`${authorProfile?.firstName ?? post.firstName ?? ""} ${
                  authorProfile?.lastName ?? post.lastName ?? ""
                }'s Post`}
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getNameInitials(
                      `${authorProfile?.firstName ?? post.firstName ?? ""} ${authorProfile?.lastName ?? post.lastName ?? ""}`,
                    )}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.userTopRow}>
                    <Text style={styles.username}>
                      {authorProfile?.firstName ?? post.firstName}{" "}
                      {authorProfile?.lastName ?? post.lastName}
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

                      {currentUser?.uid === post.userId &&
                        !isPostEditLocked(post.status) && (
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
                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => setLocationModalVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Image
                      source={require("../assets/images/location.png")}
                      style={styles.locationIcon}
                    />
                    <Text style={styles.locationText}>
                      {post.locationName || "Unknown location"}
                    </Text>
                  </TouchableOpacity>

                  {/* Report Status & Waste Category Tags */}
                  <View style={styles.tagsRow}>
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

                    {Boolean(formatWasteLabel(post.wasteClassification)) && (
                      <View
                        style={[
                          styles.wasteTag,
                          {
                            backgroundColor: getWasteCategoryColor(
                              post.wasteClassification?.category,
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.wasteTagText}>
                          {formatWasteLabel(post.wasteClassification)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.postedAt}>
                    {formatPostedAt(post.createdAt)}
                  </Text>
                </View>
              </View>

              {/* CAPTION */}
              {Boolean(post.title) && (
                <Text style={styles.reportTitle}>
                  {hideBadWords(post.title)}
                </Text>
              )}
              {Boolean(post.caption) && (
                <View style={styles.captionContainer}>
                  <View
                    style={[
                      styles.captionTextWrapper,
                      !expandedCaption && styles.captionTextWrapperCollapsed,
                    ]}
                  >
                    <Text
                      style={styles.caption}
                      onTextLayout={({ nativeEvent }) =>
                        setCaptionHasMore(nativeEvent.lines.length > 3)
                      }
                    >
                      {captionText}
                    </Text>
                  </View>
                  {showCaptionToggle && (
                    <TouchableOpacity
                      onPress={() => setExpandedCaption((current) => !current)}
                    >
                      <Text style={styles.captionToggle}>
                        {expandedCaption ? "See less" : "See more"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* POST IMAGE */}
              {!(post.status === "cleaned" && post.afterImageUrl) && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.imageContainer}
                  onPress={() => setFullImageUrl(post.imageUrl)}
                >
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.postImage}
                  />
                </TouchableOpacity>
              )}

              {post.status === "cleaned" && post.afterImageUrl && (
                <View style={styles.beforeAfterSection}>
                  <View style={styles.cleanupResultHeader}>
                    <Text style={styles.beforeAfterTitle}>Cleanup Result</Text>
                    <Text style={styles.cleanupAdmin} numberOfLines={1}>
                      By {post.cleanedByName || "Admin"}
                    </Text>
                  </View>
                  <View style={styles.beforeAfterRow}>
                    <View style={styles.beforeAfterColumn}>
                      <Text style={styles.beforeAfterLabel}>Before</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="View before cleanup image full screen"
                        activeOpacity={0.9}
                        onPress={() => setFullImageUrl(post.imageUrl)}
                      >
                        <Image
                          source={{ uri: post.imageUrl }}
                          style={styles.beforeAfterImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.beforeAfterColumn}>
                      <Text style={styles.beforeAfterLabel}>After</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="View after cleanup image full screen"
                        activeOpacity={0.9}
                        onPress={() => setFullImageUrl(post.afterImageUrl)}
                      >
                        <Image
                          source={{ uri: post.afterImageUrl }}
                          style={styles.beforeAfterImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* COMMENTS SECTION */}
            <View style={styles.commentsHeader}>
              <Text style={styles.commentLabel}>
                Comments ({post.commentCount ?? comments.length})
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.commentSortButton,
                  loadingMoreComments && styles.commentSortButtonDisabled,
                ]}
                disabled={loadingMoreComments}
                accessibilityRole="button"
                accessibilityLabel={`Sort comments ${
                  commentSortOrder === "asc" ? "newest" : "oldest"
                } first`}
                onPress={() => {
                  const nextOrder =
                    commentSortOrder === "asc" ? "desc" : "asc";
                  setCommentSortOrder(nextOrder);
                  setComments([]);
                  setHasMoreComments(true);
                  loadComments(true, nextOrder);
                }}
              >
                <Ionicons name="swap-vertical" size={15} color="#397A51" />
                <Text style={styles.commentSortText}>
                  {commentSortOrder === "asc" ? "Oldest first" : "Newest first"}
                </Text>
              </TouchableOpacity>
            </View>

            <FormError message={commentError} />

            {/* INPUT ROW */}
            <View style={styles.commentRow}>
              <TextInput
                placeholder="Write a comment..."
                placeholderTextColor="#888"
                style={styles.commentInput}
                value={comment}
                onChangeText={(value) => {
                  setComment(value);
                  setCommentError("");
                }}
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
            {comments.map((item) => (
              <View key={item.id} style={styles.commentCard}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>
                    {getNameInitials(
                      `${commentProfiles[item.userId]?.firstName ?? item.firstName ?? ""} ${commentProfiles[item.userId]?.lastName ?? item.lastName ?? ""}`,
                    )}
                  </Text>
                </View>

                <View style={styles.commentBody}>
                  <View style={styles.commentUserHeader}>
                    <Text style={styles.commentUsername}>
                      {commentProfiles[item.userId]?.firstName ??
                        item.firstName}{" "}
                      {commentProfiles[item.userId]?.lastName ?? item.lastName}
                    </Text>
                    <View style={styles.commentHeaderRight}>
                      {/* Always displays live/updated user points */}
                      <Text style={styles.commentPoints}>
                        {item.currentPoints ?? item.points ?? 0} pts
                      </Text>

                      {/* 3 small box dot options menu, only shown if you are the owner of that comment */}
                      {currentUser?.uid === item.userId && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          style={styles.commentMenuButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => setSelectedCommentForMenu(item)}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={14}
                            color="#52675A"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <Text style={styles.commentText}>
                    {hideBadWords(item.comment)}
                  </Text>
                  <Text style={styles.commentTimestamp}>
                    {formatDateTime(item.createdAt) || "Just now"}
                  </Text>
                </View>
              </View>
            ))}

            {/* MINIMALISTIC "SEE MORE" BUTTON */}
            {hasMoreComments && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.seeMoreBtn}
                disabled={loadingMoreComments}
                onPress={() => loadComments()}
              >
                <Text style={styles.seeMoreText}>
                  {loadingMoreComments
                    ? "Loading comments..."
                    : `Load ${COMMENTS_PER_PAGE} more comments`}
                </Text>
              </TouchableOpacity>
            )}
            {loadingMoreComments && <ActivityIndicator color="#5F9C76" />}
          </ScrollView>

          {/* BOTTOM NAVBAR */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>

          {/* FULL IMAGE MODAL */}
          <Modal
            animationType="fade"
            onRequestClose={() => setFullImageUrl(null)}
            transparent={true}
            visible={Boolean(fullImageUrl)}
          >
            <View style={styles.modalContainer}>
              <TouchableOpacity
                accessibilityLabel="Close full image"
                style={styles.closeButton}
                onPress={() => setFullImageUrl(null)}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>

              <Image
                resizeMode="contain"
                source={{ uri: fullImageUrl || post.imageUrl }}
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
            onRequestClose={() => !deletingPost && setShowDeleteModal(false)}
          >
            <View style={styles.settingsOverlay}>
              <View style={styles.settingsBox}>
                <Text style={styles.deleteTitle}>Delete Post</Text>

                <Text style={styles.deleteMessage}>
                  Are you sure you want to delete this post? This action cannot
                  be undone.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.confirmDeleteBtn,
                    deletingPost && { opacity: 0.6 },
                  ]}
                  disabled={deletingPost}
                  onPress={async () => {
                    if (deletingPost) return;
                    try {
                      setDeletingPost(true);
                      const latestPost = await getDoc(
                        doc(db, "posts", post.id),
                      );
                      if (
                        latestPost.exists() &&
                        isPostEditLocked(latestPost.data().status)
                      ) {
                        Alert.alert(
                          "Post cannot be changed",
                          "Reports marked On-going or Cleaned cannot be edited or deleted.",
                        );
                        setShowDeleteModal(false);
                        setDeletingPost(false);
                        return;
                      }
                      await deleteRelatedDocuments(post.id);
                      setShowDeleteModal(false);
                      router.replace("/home");
                    } catch (error) {
                      console.error("Unable to delete report:", error);
                      setDeletingPost(false);
                    }
                  }}
                >
                  {deletingPost ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.confirmDeleteText}>Deleting...</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelModalButton,
                    deletingPost && { opacity: 0.5 },
                  ]}
                  disabled={deletingPost}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* COMMENT OPTIONS MODAL */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={Boolean(selectedCommentForMenu)}
            onRequestClose={() => setSelectedCommentForMenu(null)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.settingsOverlay}
              onPress={() => setSelectedCommentForMenu(null)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={styles.settingsBox}
                onPress={(e) => e.stopPropagation?.()}
              >
                <Text style={styles.modalTitle}>Comment Options</Text>

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    const c = selectedCommentForMenu;
                    setSelectedCommentForMenu(null);
                    setEditingComment(c);
                    setEditCommentText(c?.comment || "");
                  }}
                >
                  <View style={styles.commentModalBtnContent}>
                    <Ionicons name="pencil-outline" size={17} color="#2D5A3E" />
                    <Text style={styles.settingsText}>Edit Comment</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    const c = selectedCommentForMenu;
                    setSelectedCommentForMenu(null);
                    setCommentToDelete(c);
                  }}
                >
                  <View style={styles.commentModalBtnContent}>
                    <Ionicons name="trash-outline" size={17} color="#FF5B5B" />
                    <Text style={[styles.settingsText, { color: "#FF5B5B" }]}>
                      Delete Comment
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelModalButton}
                  onPress={() => setSelectedCommentForMenu(null)}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* EDIT COMMENT MODAL */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={Boolean(editingComment)}
            onRequestClose={() => {
              if (!savingEditComment) {
                setEditingComment(null);
                setEditCommentText("");
              }
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.settingsOverlay}
            >
              <View style={styles.editCommentBox}>
                <Text style={styles.modalTitle}>Edit Comment</Text>

                <TextInput
                  style={styles.editCommentInput}
                  multiline
                  placeholder="Edit your comment..."
                  placeholderTextColor="#888"
                  value={editCommentText}
                  onChangeText={setEditCommentText}
                  maxLength={500}
                />

                <View style={styles.editModalActionRow}>
                  <TouchableOpacity
                    style={styles.editCancelBtn}
                    disabled={savingEditComment}
                    onPress={() => {
                      setEditingComment(null);
                      setEditCommentText("");
                    }}
                  >
                    <Text style={styles.editCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.editSaveBtn,
                      (!editCommentText.trim() || savingEditComment) && {
                        opacity: 0.6,
                      },
                    ]}
                    disabled={!editCommentText.trim() || savingEditComment}
                    onPress={handleSaveEditComment}
                  >
                    {savingEditComment ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.editSaveBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* DELETE COMMENT CONFIRMATION MODAL */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={Boolean(commentToDelete)}
            onRequestClose={() => {
              if (!deletingComment) setCommentToDelete(null);
            }}
          >
            <View style={styles.settingsOverlay}>
              <View style={styles.settingsBox}>
                <Text style={styles.deleteTitle}>Delete Comment</Text>

                <Text style={styles.deleteMessage}>
                  Are you sure you want to delete this comment? This action
                  cannot be undone.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.confirmDeleteBtn,
                    deletingComment && { opacity: 0.6 },
                  ]}
                  disabled={deletingComment}
                  onPress={handleDeleteComment}
                >
                  {deletingComment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelModalButton, { marginTop: 10 }]}
                  disabled={deletingComment}
                  onPress={() => setCommentToDelete(null)}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </View>

      {/* POST LOCATION MINI MAP MODAL */}
      <PostLocationModal
        post={post}
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
      />
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
    width: 32,
    height: 32,
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
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
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
    color: "#405047",
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
    alignSelf: "flex-start",
    cursor: "pointer",
  },
  locationIcon: {
    width: 12,
    height: 12,
    marginRight: 4,
    resizeMode: "contain",
  },
  locationText: {
    fontSize: 12,
    color: "#4B6B58",
    fontWeight: "500",
  },
  postedAt: {
    marginTop: 2,
    fontSize: 11,
    color: "#888",
  },

  /* Post Caption & Image */
  captionContainer: {
    position: "relative",
  },
  captionTextWrapper: {
    overflow: "hidden",
  },
  captionTextWrapperCollapsed: {
    height: 60,
  },
  caption: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 10,
  },
  reportTitle: {
    color: "#234B33",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  statusTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wasteTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wasteTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  beforeAfterSection: {
    marginTop: 2,
    marginBottom: 2,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F4FAF6",
    borderWidth: 1,
    borderColor: "#D8E6DC",
  },
  cleanupResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 7,
  },
  beforeAfterTitle: {
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
  beforeAfterRow: {
    flexDirection: "row",
    gap: 8,
  },
  beforeAfterColumn: {
    flex: 1,
  },
  beforeAfterLabel: {
    fontWeight: "700",
    color: "#68746C",
    fontSize: 10,
    marginBottom: 3,
  },
  beforeAfterImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 7,
    backgroundColor: "#EBEBEB",
  },

  /* Comments Section */
  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  commentLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#24352A",
  },
  commentSortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#E8F2EB",
  },
  commentSortButtonDisabled: {
    opacity: 0.55,
  },
  commentSortText: {
    color: "#397A51",
    fontSize: 11,
    fontWeight: "600",
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
    color: "#24352A",
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
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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
    color: "#24352A",
  },
  commentPoints: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2E7D32",
  },
  commentHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentMenuButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#F2F6F3",
    borderWidth: 1,
    borderColor: "#DCE5DF",
    alignItems: "center",
    justifyContent: "center",
  },
  commentText: {
    fontSize: 13,
    color: "#405047",
    lineHeight: 18,
  },
  commentTimestamp: {
    fontSize: 11,
    color: "#7A8980",
    marginTop: 4,
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

  /* Comment Modals */
  commentModalBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  editCommentBox: {
    backgroundColor: "#FFFFFF",
    width: "88%",
    maxWidth: 380,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  editCommentInput: {
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#D2E2D7",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#24352A",
    minHeight: 85,
    maxHeight: 160,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  editModalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  editCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#ECEFEF",
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelBtnText: {
    color: "#526259",
    fontWeight: "600",
    fontSize: 14,
  },
  editSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  editSaveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
