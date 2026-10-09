import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";

import { uploadToCloudinary } from "../../../../cloudinary";
import PostLocationModal from "../../../../components/PostLocationModal";
import {
    BADGES,
    getUserContributionStats,
    isBadgeEarned,
} from "../../../../constants/badges";
import { formatLocationWithPurok } from "../../../../constants/locationFormat";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../../../../constants/wasteCategories";
import { auth, db } from "../../../../firebaseConfig";
import { deleteRelatedDocuments } from "../../../../utils/deletePostHelper";
import { hideBadWords } from "../../../../utils/hideBadWords";
import {
  notifyPostModerated,
  notifyPostStatusUpdated,
} from "../../../../utils/notificationHelpers";

const STATUS_DETAILS = {
  pending: { label: "Pending", color: "#A5A5A5" },
  moderate: { label: "Moderate", color: "#ff8c40" },
  critical: { label: "Critical", color: "#FF5B5B" },
  ongoing: { label: "On-going", color: "#FFC940" },
  cleaned: { label: "Cleaned", color: "#34C759" },
};

const formatPostedDate = (timestamp) => {
  if (!timestamp) return "Posted recently";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Posted recently";

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  let elapsed;
  if (elapsedSeconds < 60) elapsed = `${elapsedSeconds}s`;
  else if (elapsedSeconds < 3600)
    elapsed = `${Math.floor(elapsedSeconds / 60)}m`;
  else if (elapsedSeconds < 86400)
    elapsed = `${Math.floor(elapsedSeconds / 3600)}h`;
  else elapsed = `${Math.floor(elapsedSeconds / 86400)}d`;

  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} \u2022 ${elapsed}`;
};

const getTimestampMillis = (timestamp) => {
  if (!timestamp) return null;
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const formatCommentDate = (timestamp) => {
  const millis = getTimestampMillis(timestamp);
  if (millis === null) return "Just now";

  const date = new Date(millis);
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} at ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

export default function PostDetail({
  post: suppliedPost,
  currentTab,
  setSelectedPost,
  setSelectedVolunteerPost,
  highlightedCommentId,
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isCompactLayout = width < 1100;
  const { postId, commentId } = useLocalSearchParams();
  const effectiveHighlightedCommentId =
    highlightedCommentId ||
    (Array.isArray(commentId) ? commentId[0] : commentId);

  const highlightFadeAnim = useRef(new Animated.Value(1)).current;
  const [isHighlighted, setIsHighlighted] = useState(
    Boolean(effectiveHighlightedCommentId),
  );

  useEffect(() => {
    if (effectiveHighlightedCommentId) {
      setIsHighlighted(true);
      highlightFadeAnim.setValue(1);
      const timer = setTimeout(() => {
        Animated.timing(highlightFadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }).start(() => {
          setIsHighlighted(false);
        });
      }, 2300);

      return () => clearTimeout(timer);
    } else {
      setIsHighlighted(false);
      highlightFadeAnim.setValue(0);
    }
  }, [effectiveHighlightedCommentId]);

  const [loadedPost, setLoadedPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(!suppliedPost);
  const [postLoadError, setPostLoadError] = useState("");
  const [existingVolunteerId, setExistingVolunteerId] = useState("");
  const post = suppliedPost || loadedPost;
  const effectiveCurrentTab = currentTab || post?.status;
  const isCleaned = effectiveCurrentTab === "cleaned";

  const [comments, setComments] = useState([]);
  const [commentSortOrder, setCommentSortOrder] = useState("desc");
  const [visibleCommentsByPost, setVisibleCommentsByPost] = useState({});
  const [commentText, setCommentText] = useState("");
  const [selectedCommentForMenu, setSelectedCommentForMenu] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingEditComment, setSavingEditComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [residentPoints, setResidentPoints] = useState(
    suppliedPost?.points ?? 0,
  );
  const [residentProfile, setResidentProfile] = useState(null);
  const [residentBadges, setResidentBadges] = useState([]);
  const [commentProfiles, setCommentProfiles] = useState({});
  const [updating, setUpdating] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState(null);

  const [showOtherModal, setShowOtherModal] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [selectedReason, setSelectedReason] = useState("");

  const [customReason, setCustomReason] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [openingVolunteerActivity, setOpeningVolunteerActivity] =
    useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupImageUrl, setCleanupImageUrl] = useState(
    suppliedPost?.afterImageUrl || "",
  );
  const [uploadingCleanupImage, setUploadingCleanupImage] = useState(false);
  const [pendingAssessmentStatus, setPendingAssessmentStatus] = useState(null);
  const commentUserIdsKey = JSON.stringify(
    [...new Set(comments.map((comment) => comment.userId).filter(Boolean))].sort(),
  );

  useEffect(() => {
    if (suppliedPost || !postId) return;

    const loadPost = async () => {
      try {
        const snapshot = await getDoc(doc(db, "posts", postId));
        if (!snapshot.exists()) {
          setPostLoadError("This report is no longer available.");
          return;
        }
        setLoadedPost({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        console.error("Unable to load report:", error);
        setPostLoadError("Unable to load this report.");
      } finally {
        setLoadingPost(false);
      }
    };

    loadPost();
  }, [postId, suppliedPost]);

  const deleteReasons = [
    "Inappropriate Content",

    "Issue Already Resolved",

    "Duplicate Report",

    "Other Reason",
  ];

  useEffect(() => {
    if (!post?.id) return;

    const loadComments = async () => {
      const q = query(
        collection(db, "comments"),
        where("postId", "==", post.id),
      );

      const snapshot = await getDocs(q);

      setComments(
        snapshot.docs.map((comment) => ({
          id: comment.id,
          ...comment.data(),
        })),
      );
    };

    loadComments();
  }, [post?.id]);

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

  useEffect(() => {
    if (!post?.userId) return;

    return onSnapshot(
      doc(db, "users", post.userId),
      (snapshot) => {
        const profile = snapshot.exists() ? snapshot.data() : null;
        setResidentProfile(profile);
        if (profile) setResidentPoints(profile.points ?? post.points ?? 0);
      },
      (error) => {
        console.error("Unable to subscribe to report author profile:", error);
      },
    );
  }, [post?.points, post?.userId]);

  useEffect(() => {
    if (!post?.userId) return;

    const loadResidentDetails = async () => {
      try {
        const [userSnapshot, postsSnapshot, volunteerPostsSnapshot] =
          await Promise.all([
            getDoc(doc(db, "users", post.userId)),
            getDocs(collection(db, "posts")),
            getDocs(collection(db, "volunteer_posts")),
          ]);
        if (userSnapshot.exists()) {
          setResidentPoints(userSnapshot.data().points ?? post.points ?? 0);
        }

        const allPosts = postsSnapshot.docs.map((document) => document.data());
        const allVolunteerPosts = volunteerPostsSnapshot.docs.map((document) =>
          document.data(),
        );
        const stats = getUserContributionStats(
          post.userId,
          allPosts,
          allVolunteerPosts,
        );
        setResidentBadges(
          BADGES.filter((badge) => isBadgeEarned(badge, stats)),
        );
      } catch (error) {
        console.error("Unable to load resident details:", error);
      }
    };

    loadResidentDetails();
  }, [post?.points, post?.userId]);

  useEffect(() => {
    if (!post?.id) return;

    const checkVolunteerActivity = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "volunteer_posts"),
            where("postId", "==", post.id),
          ),
        );
        setExistingVolunteerId(snapshot.empty ? "" : snapshot.docs[0].id);
      } catch (error) {
        console.error("Unable to check volunteer activity:", error);
      }
    };

    checkVolunteerActivity();
  }, [post?.id]);

  const closePostDetail = () => {
    if (setSelectedPost) setSelectedPost(null);
    else router.back();
  };

  const markAsClean = async () => {
    if (updating) return;

    setUpdating(true);

    try {
      const adminSnapshot = auth.currentUser
        ? await getDoc(doc(db, "users", auth.currentUser.uid))
        : null;
      const adminData = adminSnapshot?.exists() ? adminSnapshot.data() : {};
      const adminName =
        [adminData.firstName, adminData.lastName].filter(Boolean).join(" ") ||
        auth.currentUser?.email ||
        "Admin";

      const volunteerSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", post.id),
        ),
      );

      const rewardsApplied = await runTransaction(db, async (transaction) => {
        const postRef = doc(db, "posts", post.id);
        const postSnapshot = await transaction.get(postRef);

        if (!postSnapshot.exists())
          throw new Error("This report no longer exists.");
        if (postSnapshot.data().status === "cleaned") return false;

        const volunteerDocuments = [];
        for (const volunteerDocument of volunteerSnapshot.docs) {
          const snapshot = await transaction.get(volunteerDocument.ref);
          if (snapshot.exists()) volunteerDocuments.push(snapshot);
        }

        const rewardsByUserId = new Map();
        const volunteerIds = new Set();
        const ownerId = postSnapshot.data().userId;
        if (ownerId) rewardsByUserId.set(ownerId, 5);

        volunteerDocuments.forEach((volunteerDocument) => {
          const volunteers = Array.isArray(volunteerDocument.data().volunteers)
            ? volunteerDocument.data().volunteers
            : [];

          volunteers.forEach((volunteer) => {
            const volunteerId =
              typeof volunteer === "string"
                ? volunteer
                : volunteer?.userId || volunteer?.uid || volunteer?.id;

            if (!volunteerId) return;
            volunteerIds.add(volunteerId);
          });
        });

        volunteerIds.forEach((volunteerId) => {
          rewardsByUserId.set(
            volunteerId,
            (rewardsByUserId.get(volunteerId) || 0) + 10,
          );
        });

        const userDocuments = [];
        for (const [userId, reward] of rewardsByUserId) {
          const userRef = doc(db, "users", userId);
          const userSnapshot = await transaction.get(userRef);
          if (userSnapshot.exists())
            userDocuments.push({ userRef, userSnapshot, reward });
        }

        const cleanupFields = cleanupImageUrl
          ? { afterImageUrl: cleanupImageUrl }
          : {};

        transaction.update(postRef, {
          status: "cleaned",
          ...cleanupFields,
          cleanedBy: auth.currentUser?.uid || null,
          cleanedByName: adminName,
          cleanedAt: serverTimestamp(),
        });
        volunteerDocuments.forEach((volunteerDocument) => {
          transaction.update(volunteerDocument.ref, { status: "cleaned" });
        });
        userDocuments.forEach(({ userRef, userSnapshot, reward }) => {
          transaction.update(userRef, {
            points: (Number(userSnapshot.data().points) || 0) + reward,
          });
          transaction.set(doc(collection(db, "point_transactions")), {
            userId: userRef.id,
            amount: reward,
            source: "cleanup_reward",
            postId: post.id,
            createdAt: serverTimestamp(),
          });
        });

        return true;
      });

      if (!rewardsApplied) {
        Alert.alert("This post has already been marked as cleaned.");
        closePostDetail();
        return;
      }

      Alert.alert("Post marked as cleaned.");

      closePostDetail();
    } catch (error) {
      console.log(error);

      Alert.alert("Failed to update.");

      setUpdating(false);
    }
  };

  const uploadCleanupImage = async () => {
    if (uploadingCleanupImage || isCleaned) return;

    setUploadingCleanupImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) return;

      const imageUrl = await uploadToCloudinary(result.assets[0], {
        skipModeration: true,
        skipAi: true,
      });
      setCleanupImageUrl(imageUrl);
      Alert.alert(
        "Cleanup image added",
        "It will be saved when you mark the report as clean.",
      );
    } catch (error) {
      console.error("Unable to upload cleanup image:", error);
      Alert.alert("Unable to upload image", "Please try again.");
    } finally {
      setUploadingCleanupImage(false);
    }
  };

  const openVolunteerActivity = async () => {
    if (openingVolunteerActivity || isCleaned) return;

    setOpeningVolunteerActivity(true);

    try {
      if (existingVolunteerId) {
        router.push({
          pathname: "/admin/assessments/post_view/VolunteerPostDetail",
          params: { volunteerId: existingVolunteerId },
        });
        return;
      }

      const volunteerSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", post.id),
        ),
      );

      if (!volunteerSnapshot.empty) {
        setExistingVolunteerId(volunteerSnapshot.docs[0].id);
        router.push({
          pathname: "/admin/assessments/post_view/VolunteerPostDetail",
          params: { volunteerId: volunteerSnapshot.docs[0].id },
        });
        return;
      }

      if (setSelectedVolunteerPost) setSelectedVolunteerPost(post);
    } catch (error) {
      console.error("Unable to open volunteer activity:", error);
      Alert.alert("Unable to check volunteer activities. Please try again.");
    } finally {
      setOpeningVolunteerActivity(false);
    }
  };

  const chooseReason = (reason) => {
    if (reason === "Other Reason") {
      setShowReasonModal(false);

      setShowOtherModal(true);

      return;
    }

    setSelectedReason(reason);

    setShowReasonModal(false);

    setShowConfirmModal(true);
  };

  const continueCustomReason = () => {
    if (customReason.trim() === "") {
      Alert.alert("Please enter a reason.");

      return;
    }

    setSelectedReason(customReason);

    setShowOtherModal(false);

    setShowConfirmModal(true);
  };

  const submitAdminComment = async () => {
    const trimmedComment = commentText.trim();
    if (
      !trimmedComment ||
      submittingComment ||
      !post?.id ||
      !auth.currentUser
    ) {
      return;
    }

    setSubmittingComment(true);
    try {
      const userSnapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userSnapshot.exists() ? userSnapshot.data() : {};
      const newComment = {
        postId: post.id,
        userId: auth.currentUser.uid,
        firstName: userData.firstName || "LGU",
        lastName: userData.lastName || "Admin",
        points: Number(userData.points) || 0,
        comment: hideBadWords(trimmedComment),
        createdAt: serverTimestamp(),
      };

      const commentSnapshot = await addDoc(
        collection(db, "comments"),
        newComment,
      );
      await updateDoc(doc(db, "posts", post.id), {
        commentCount: increment(1),
      });

      setComments((current) => [
        ...current,
        { id: commentSnapshot.id, ...newComment, createdAt: new Date() },
      ]);
      setVisibleCommentsByPost((current) => ({
        ...current,
        [post.id]: Math.max(current[post.id] ?? 5, comments.length + 1),
      }));
      setCommentText("");
    } catch (error) {
      console.error("Unable to add admin comment:", error);
      Alert.alert("Unable to add comment", "Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSaveEditComment = async () => {
    if (!editingComment || savingEditComment) return;

    const trimmedComment = editCommentText.trim();
    if (!trimmedComment) {
      Alert.alert("Empty Comment", "Comment cannot be empty.");
      return;
    }

    try {
      setSavingEditComment(true);
      const cleanedComment = hideBadWords(trimmedComment);
      await updateDoc(doc(db, "comments", editingComment.id), {
        comment: cleanedComment,
        updatedAt: serverTimestamp(),
      });

      setComments((current) =>
        current.map((item) =>
          item.id === editingComment.id
            ? { ...item, comment: cleanedComment }
            : item,
        ),
      );
      setEditingComment(null);
      setEditCommentText("");
    } catch (error) {
      console.error("Unable to update comment:", error);
      Alert.alert("Unable to update comment", "Please try again.");
    } finally {
      setSavingEditComment(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete || deletingComment || !post?.id) return;

    try {
      setDeletingComment(true);
      const batch = writeBatch(db);
      batch.delete(doc(db, "comments", commentToDelete.id));
      batch.update(doc(db, "posts", post.id), {
        commentCount: increment(-1),
      });
      await batch.commit();

      setComments((current) =>
        current.filter((item) => item.id !== commentToDelete.id),
      );
      setCommentToDelete(null);
    } catch (error) {
      console.error("Unable to delete comment:", error);
      Alert.alert("Unable to delete comment", "Please try again.");
    } finally {
      setDeletingComment(false);
    }
  };

  const sendDeleteNotification = async () => {
    await notifyPostModerated({
      post,
      reason: selectedReason,
    });
  };

  const deletePost = async () => {
    if (deleting) return;

    setDeleting(true);

    try {
      // Notify the user first
      await sendDeleteNotification();

      // Delete the post and all related documents
      await deleteRelatedDocuments(post.id);

      Alert.alert("Report deleted successfully.");

      setShowConfirmModal(false);

      closePostDetail();
    } catch (error) {
      console.log(error);

      Alert.alert("Something went wrong.");

      setDeleting(false);
    }
  };

  const setToOngoing = async () => {
    if (updating) return;

    setUpdating(true);

    try {
      await updateDoc(doc(db, "posts", post.id), {
        status: "ongoing",
      });

      await notifyPostStatusUpdated({
        post,
        newStatus: "ongoing",
      });

      Alert.alert("Post has been set to On-going.");

      closePostDetail();
    } catch (error) {
      console.log(error);

      Alert.alert("Failed to update the post.");

      setUpdating(false);
    }
  };

  const updateAssessment = async (nextStatus) => {
    const currentStatus = String(post.status || "pending").toLowerCase();
    if (updating || currentStatus === nextStatus) return;
    if (currentStatus === "cleaned") {
      Alert.alert("Cleaned reports cannot be reassessed.");
      return;
    }

    setUpdating(true);
    setPendingAssessmentStatus(nextStatus);

    try {
      await updateDoc(doc(db, "posts", post.id), {
        status: nextStatus,
        assessedBy: auth.currentUser?.uid || null,
        assessmentUpdatedAt: serverTimestamp(),
      });

      if (nextStatus === "critical" || nextStatus === "ongoing") {
        await notifyPostStatusUpdated({
          post,
          newStatus: nextStatus,
        });
      }

      setShowAssessmentModal(false);
      Alert.alert(
        nextStatus === "critical"
          ? "Report assessed as Critical."
          : "Report assessed as Moderate.",
      );
      closePostDetail();
    } catch (error) {
      console.error("Unable to update assessment:", error);
      Alert.alert("Failed to update the situation assessment.");
      setUpdating(false);
      setPendingAssessmentStatus(null);
    }
  };

  if (loadingPost) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color="#5F9C76" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.stateContainer}>
        <Text>{postLoadError || "Report not found."}</Text>
        <TouchableOpacity style={styles.helpBTN} onPress={() => router.back()}>
          <Text style={styles.helpText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bottomActions = (
    <View
      style={[
        styles.bottomActions,
        isCompactLayout && styles.bottomActionsCompact,
      ]}
    >
      <TouchableOpacity
        disabled={openingVolunteerActivity || updating}
        style={[
          styles.helpBTN,
          { flex: 1, backgroundColor: "#599A74" },
          (openingVolunteerActivity || updating) && styles.disabledButton,
        ]}
        onPress={openVolunteerActivity}
      >
        {openingVolunteerActivity ? (
          <View style={styles.actionLoading}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.helpText}>Opening...</Text>
          </View>
        ) : (
          <Text style={styles.helpText}>
            {existingVolunteerId ? "Manage Volunteers" : "Help"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        disabled={updating || openingVolunteerActivity}
        style={[
          styles.helpBTN,
          {
            backgroundColor:
              effectiveCurrentTab === "ongoing" ? "#34C759" : "#A5A5A5",
            flex: 1,
          },
          (updating || openingVolunteerActivity) && styles.disabledButton,
        ]}
        onPress={
          effectiveCurrentTab === "ongoing" ? markAsClean : setToOngoing
        }
      >
        {updating ? (
          <View style={styles.actionLoading}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.helpText}>
              {effectiveCurrentTab === "ongoing"
                ? "Marking as Clean..."
                : "Setting to On-Going..."}
            </Text>
          </View>
        ) : (
          <Text style={styles.helpText}>
            {effectiveCurrentTab === "ongoing"
              ? "Mark as Clean"
              : "Set to On-Going"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const sortedComments = [...comments].sort((first, second) => {
    if (first.id === effectiveHighlightedCommentId) return -1;
    if (second.id === effectiveHighlightedCommentId) return 1;
    const firstTime = getTimestampMillis(first.createdAt);
    const secondTime = getTimestampMillis(second.createdAt);
    if (firstTime === null) return secondTime === null ? 0 : 1;
    if (secondTime === null) return -1;
    return commentSortOrder === "asc"
      ? firstTime - secondTime
      : secondTime - firstTime;
  });

  const renderComments = () =>
    sortedComments.length > 0 ? (
      sortedComments
        .slice(
          0,
          isCompactLayout
            ? (visibleCommentsByPost[post?.id] ?? 5)
            : comments.length,
        )
        .map((comment) => {
          const isThisCommentHighlighted =
            comment.id === effectiveHighlightedCommentId && isHighlighted;

          return (
            <Animated.View
              key={comment.id}
              style={[
                styles.commentCard,
                isThisCommentHighlighted && {
                  backgroundColor: highlightFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#F4F4F4", "#EAF3FF"],
                  }),
                  borderColor: highlightFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["transparent", "#3B82F6"],
                  }),
                  borderWidth: 2,
                },
              ]}
            >
              <Image
                source={require("../../../../assets/images/ProfileIG.png")}
                style={styles.commentAvatar}
              />

              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <Text style={styles.userName} numberOfLines={2}>
                    {commentProfiles[comment.userId]?.firstName ??
                      comment.firstName}{" "}
                    {commentProfiles[comment.userId]?.lastName ??
                      comment.lastName}
                  </Text>

                  <View style={styles.commentHeaderActions}>
                    <Text style={styles.commentPoints}>
                      {comment.points} pts
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${commentProfiles[comment.userId]?.firstName ?? comment.firstName ?? "user"}'s comment`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.commentMenuButton}
                      onPress={() => setSelectedCommentForMenu(comment)}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={16}
                        color="#52675A"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.commentText} selectable>
                  {hideBadWords(comment.comment)}
                </Text>
                <Text style={styles.commentTimestamp}>
                  {formatCommentDate(comment.createdAt)}
                </Text>
              </View>
            </Animated.View>
          );
        })
    ) : (
      <Text style={styles.emptyComments}>No comments yet.</Text>
    );

  const visibleCommentCount = visibleCommentsByPost[post?.id] ?? 5;
  const hasMoreComments =
    isCompactLayout && visibleCommentCount < comments.length;

  const commentsSection = (
    <View
      style={[
        styles.commentSection,
        isCompactLayout && styles.commentSectionCompact,
      ]}
    >
      <View style={styles.commentsSectionHeader}>
        <Text style={[styles.sectionTitle, styles.commentsSectionTitle]}>
          Comments
        </Text>
        <TouchableOpacity
          style={styles.commentSortButton}
          onPress={() =>
            setCommentSortOrder((current) =>
              current === "asc" ? "desc" : "asc",
            )
          }
          accessibilityRole="button"
          accessibilityLabel={`Sort comments ${
            commentSortOrder === "asc" ? "newest" : "oldest"
          } first`}
        >
          <Ionicons name="swap-vertical" size={15} color="#397A51" />
          <Text style={styles.commentSortText}>
            {commentSortOrder === "asc" ? "Oldest first" : "Newest first"}
          </Text>
        </TouchableOpacity>
      </View>
      {isCompactLayout ? (
        <ScrollView
          style={styles.commentsListCompact}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {renderComments()}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
        >
          {renderComments()}
        </ScrollView>
      )}
      {hasMoreComments && (
        <TouchableOpacity
          style={styles.loadMoreCommentsButton}
          onPress={() =>
            setVisibleCommentsByPost((current) => ({
              ...current,
              [post.id]: visibleCommentCount + 5,
            }))
          }
          accessibilityRole="button"
        >
          <Text style={styles.loadMoreCommentsText}>
            Load more comments (
            {Math.min(5, comments.length - visibleCommentCount)} more)
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.adminCommentRow}>
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Write an admin comment..."
          placeholderTextColor="#94A3B8"
          style={styles.adminCommentInput}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.adminCommentButton,
            (!commentText.trim() || submittingComment) &&
              styles.disabledButton,
          ]}
          onPress={submitAdminComment}
          disabled={!commentText.trim() || submittingComment}
        >
          {submittingComment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={17} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={closePostDetail}>
          <Image
            source={require("../../../../assets/images/backG.png")}
            style={styles.profileImage}
          />
        </TouchableOpacity>

        <View style={styles.detailHeaderContent}>
          <Text style={styles.title} numberOfLines={1}>
            Post Details
          </Text>
          <TouchableOpacity
            style={styles.deletePostAction}
            onPress={() => {
              setShowReasonModal(true);
            }}
          >
            <Text style={styles.deletePostActionText}>
              {isMobile ? "Delete" : "Delete Post"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={[
          styles.detailScrollContent,
          isCompactLayout && styles.detailScrollContentCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* MAIN LAYOUT */}
      <View
        style={[
          styles.mainContainer,
          isCompactLayout && styles.mainContainerCompact,
        ]}
      >
        {/* LEFT - POST */}
        <View style={[styles.left, isCompactLayout && styles.leftCompact]}>
          <Animated.View
            style={[
              styles.card,
              effectiveHighlightedCommentId &&
                isHighlighted && {
                  borderColor: highlightFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["transparent", "#3B82F6"],
                  }),
                  borderWidth: 3,
                },
            ]}
          >
            {!Boolean(isCleaned && post.afterImageUrl) && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="View report image full screen"
                activeOpacity={0.9}
                onPress={() => setFullImageUrl(post.imageUrl)}
              >
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.postImage}
                />
              </TouchableOpacity>
            )}

            {Boolean(isCleaned && post.afterImageUrl) && (
              <View style={styles.beforeAfterSection}>
                <Text style={styles.beforeAfterTitle}>Cleanup Result</Text>
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
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.cleanedByText} numberOfLines={1}>
                  Cleaned by {post.cleanedByName || "Admin"}
                </Text>
              </View>
            )}

            <View style={styles.postInfo}>
              {/* PROFILE AND POST DETAILS */}
              <View style={styles.authorRow}>
                <Image
                  source={require("../../../../assets/images/profile2.png")}
                  style={styles.authorImage}
                />
                <View style={styles.authorDetails}>
                  <View style={styles.authorHeader}>
                    <View style={styles.authorIdentity}>
                      <Text style={styles.profileName}>
                        {residentProfile?.firstName ?? post.firstName}{" "}
                        {residentProfile?.lastName ?? post.lastName}
                        <Text style={styles.pointsText}>
                          {" "}
                          {"\u2022"} {residentPoints} pts
                        </Text>
                      </Text>

                      <View style={styles.badgeRow}>
                        {residentBadges.slice(0, 3).map((badge) => (
                          <View key={badge.id} style={styles.badge}>
                            <Text style={styles.badgeIcon}>{badge.icon}</Text>
                          </View>
                        ))}
                        {residentBadges.length > 3 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeMore}>
                              +{residentBadges.length - 3}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.postedDate}>
                      {formatPostedDate(post.createdAt)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => setLocationModalVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Image
                      source={require("../../../../assets/images/location.png")}
                      style={styles.locationIcon}
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {formatLocationWithPurok(post.locationName, post.purok)}
                    </Text>
                  </TouchableOpacity>

                  {/* Report Status & Waste Category Tags */}
                  <View style={styles.tagsRow}>
                    <View
                      style={[
                        styles.statusTag,
                        {
                          backgroundColor: (
                            STATUS_DETAILS[post.status] ||
                            STATUS_DETAILS.pending
                          ).color,
                        },
                      ]}
                    >
                      <Text style={styles.statusTagText}>
                        {
                          (
                            STATUS_DETAILS[post.status] ||
                            STATUS_DETAILS.pending
                          ).label
                        }
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
                </View>
              </View>

              {/* DESCRIPTION */}
              {Boolean(post.caption) && (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.description}>
                    {hideBadWords(post.caption)}
                  </Text>
                </View>
              )}

              {/* REACTIONS */}
              <View style={styles.reactions}>
                <View style={styles.reactBox}>
                  <Image
                    source={require("../../../../assets/images/priorityreact.png")}
                    style={styles.smallIcon}
                  />
                  <Text style={styles.reactionCount}>
                    {post.reactionCount || 0}
                  </Text>
                </View>
                <View style={styles.commentBox}>
                  <Image
                    source={require("../../../../assets/images/comment.png")}
                    style={styles.smallIcon}
                  />
                  <Text style={styles.count}>{comments.length}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* RIGHT - COMMENTS + LOCATION */}
        <View style={[styles.right, isCompactLayout && styles.rightCompact]}>
          {!isCompactLayout && commentsSection}

          {!isCleaned && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => setShowCleanupModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.actionCardIcon}>
                <Ionicons name="images-outline" size={22} color="#397A51" />
              </View>
              <View style={styles.actionCardCopy}>
                <Text style={styles.actionCardTitle}>Cleanup result image</Text>
                <Text style={styles.actionCardHint}>
                  {cleanupImageUrl
                    ? "After image added"
                    : "Optional Before and After images"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#7A8A80" />
            </TouchableOpacity>
          )}

          {/* SITUATION ASSESSMENT */}
          <TouchableOpacity
            style={[
              styles.assessmentSection,
              {
                borderColor: (
                  STATUS_DETAILS[
                    String(
                      post.status || effectiveCurrentTab || "pending",
                    ).toLowerCase()
                  ] || STATUS_DETAILS.pending
                ).color,
              },
            ]}
            onPress={() => setShowAssessmentModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.assessmentHeader}>
              <View>
                <Text style={styles.sectionTitle}>Situation Assessment</Text>
                <Text style={styles.assessmentCardStatus}>
                  {
                    (
                      STATUS_DETAILS[
                        String(
                          post.status || effectiveCurrentTab || "pending",
                        ).toLowerCase()
                      ] || STATUS_DETAILS.pending
                    ).label
                  }
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#397A51" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {isCompactLayout && !isCleaned && bottomActions}
      {isCompactLayout && commentsSection}
      </ScrollView>

      {/* BUTTON */}
      {!isCompactLayout && !isCleaned && bottomActions}

      <Modal
        visible={Boolean(fullImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageUrl(null)}
      >
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close full image"
            style={styles.fullImageCloseButton}
            onPress={() => setFullImageUrl(null)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {Boolean(fullImageUrl) && (
            <Image
              source={{ uri: fullImageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Modal visible={showReasonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalEyebrow}>LGU ADMIN</Text>
            <Text style={styles.modalTitle}>Delete report</Text>
            <Text style={styles.modalSubtitle}>
              Choose a reason so the resident understands why this report was
              removed.
            </Text>

            {deleteReasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonButton}
                onPress={() => chooseReason(reason)}
              >
                <Text style={styles.reasonButtonText}>{reason}</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowReasonModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showOtherModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowOtherModal(false);
                  setShowReasonModal(true);
                }}
              >
                <Image
                  source={require("../../../../assets/images/backG.png")}
                  style={styles.modalBackIcon}
                />
              </TouchableOpacity>

              <View>
                <Text style={styles.modalEyebrow}>DELETE REPORT</Text>
                <Text style={styles.modalTitle}>Other reason</Text>
              </View>
            </View>

            <TextInput
              placeholder="Write reason..."
              multiline
              value={customReason}
              onChangeText={setCustomReason}
              style={styles.reasonInput}
            />

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={continueCustomReason}
            >
              <Text style={styles.confirmButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={24} color="#B42318" />
            </View>
            <Text style={styles.modalTitle}>Delete this report?</Text>
            <Text style={styles.modalSubtitle}>
              This action cannot be undone. The resident will be notified with
              the reason you selected.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText}>Keep report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={deleting}
                style={[
                  styles.confirmButton,
                  deleting && styles.disabledButton,
                ]}
                onPress={deletePost}
              >
                {deleting ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Yes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedCommentForMenu)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCommentForMenu(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setSelectedCommentForMenu(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modal}
            onPress={(event) => event.stopPropagation?.()}
          >
            <Text style={styles.modalTitle}>Comment Options</Text>
            <TouchableOpacity
              style={styles.commentOptionButton}
              onPress={() => {
                const selectedComment = selectedCommentForMenu;
                setSelectedCommentForMenu(null);
                setEditingComment(selectedComment);
                setEditCommentText(selectedComment?.comment || "");
              }}
            >
              <Ionicons name="pencil-outline" size={18} color="#397A51" />
              <Text style={styles.commentOptionText}>Edit Comment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentOptionButton}
              onPress={() => {
                setCommentToDelete(selectedCommentForMenu);
                setSelectedCommentForMenu(null);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#B42318" />
              <Text style={styles.commentDeleteOptionText}>Delete Comment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setSelectedCommentForMenu(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={Boolean(editingComment)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingEditComment) {
            setEditingComment(null);
            setEditCommentText("");
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modal}>
            <Text style={styles.modalEyebrow}>COMMENT</Text>
            <Text style={styles.modalTitle}>Edit Comment</Text>
            <TextInput
              value={editCommentText}
              onChangeText={setEditCommentText}
              placeholder="Edit comment..."
              placeholderTextColor="#94A3B8"
              style={styles.editCommentInput}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={savingEditComment}
                onPress={() => {
                  setEditingComment(null);
                  setEditCommentText("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.commentSaveButton,
                  (!editCommentText.trim() || savingEditComment) &&
                    styles.disabledButton,
                ]}
                disabled={!editCommentText.trim() || savingEditComment}
                onPress={handleSaveEditComment}
              >
                {savingEditComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.commentSaveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(commentToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingComment) setCommentToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={24} color="#B42318" />
            </View>
            <Text style={styles.modalTitle}>Delete this comment?</Text>
            <Text style={styles.modalSubtitle}>
              This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={deletingComment}
                onPress={() => setCommentToDelete(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  deletingComment && styles.disabledButton,
                ]}
                disabled={deletingComment}
                onPress={handleDeleteComment}
              >
                {deletingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCleanupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCleanupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>CLEANUP RESULT</Text>
                <Text style={styles.modalTitle}>Before and After images</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCleanupModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              The report photo is used as Before. Add an optional After image
              before marking the report as clean.
            </Text>
            <View style={styles.cleanupPreviewRow}>
              <View style={styles.cleanupPreviewColumn}>
                <Text style={styles.cleanupPreviewLabel}>Before</Text>
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.cleanupPreviewImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.cleanupPreviewColumn}>
                <Text style={styles.cleanupPreviewLabel}>After</Text>
                {cleanupImageUrl ? (
                  <Image
                    source={{ uri: cleanupImageUrl }}
                    style={styles.cleanupPreviewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.cleanupImagePlaceholder}
                    onPress={uploadCleanupImage}
                    disabled={uploadingCleanupImage}
                  >
                    {uploadingCleanupImage ? (
                      <ActivityIndicator color="#397A51" />
                    ) : (
                      <>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={24}
                          color="#397A51"
                        />
                        <Text style={styles.cleanupPlaceholderText}>
                          Add image
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {Boolean(cleanupImageUrl) && (
              <TouchableOpacity
                style={styles.replaceCleanupButton}
                onPress={uploadCleanupImage}
                disabled={uploadingCleanupImage}
              >
                <Text style={styles.replaceCleanupText}>
                  {uploadingCleanupImage
                    ? "Uploading..."
                    : "Replace After image"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowCleanupModal(false)}
            >
              <Text style={styles.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAssessmentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssessmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>REPORT STATUS</Text>
                <Text style={styles.modalTitle}>Situation Assessment</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAssessmentModal(false)}
              ></TouchableOpacity>
            </View>
            <Text style={styles.assessmentHint}>
              {isCleaned
                ? "This report has been resolved and the reported area is now clean."
                : "Residents submit reports as Moderate. MENRO may reassess the situation when necessary."}
            </Text>
            {isCleaned ? (
              <View style={styles.cleanAssessment}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.cleanAssessmentText}>Area is Clean</Text>
              </View>
            ) : (
              <View style={styles.assessmentButtons}>
                {[
                  { id: "moderate", label: "Moderate", color: "#ff8c40" },
                  { id: "critical", label: "Critical", color: "#FF5B5B" },
                ].map((option) => {
                  const postStatus = String(
                    post.status || "pending",
                  ).toLowerCase();
                  const isSelected = postStatus === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      disabled={updating || isSelected}
                      onPress={() => updateAssessment(option.id)}
                      style={[
                        styles.assessmentButton,
                        { borderColor: option.color },
                        isSelected && { backgroundColor: option.color },
                        (updating || isSelected) && styles.disabledButton,
                      ]}
                    >
                      {updating && pendingAssessmentStatus === option.id ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <ActivityIndicator
                            size="small"
                            color={isSelected ? "#FFFFFF" : option.color}
                          />
                          <Text
                            style={[
                              styles.assessmentButtonText,
                              isSelected && styles.assessmentButtonTextSelected,
                            ]}
                          >
                            Updating...
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.assessmentButtonText,
                            isSelected && styles.assessmentButtonTextSelected,
                          ]}
                        >
                          {isSelected
                            ? `${option.label} (Current)`
                            : option.label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAssessmentModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* POST LOCATION MINI MAP MODAL */}
      <PostLocationModal
        post={post}
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
      />
    </View>
  );
}

// Keep your existing styles as-is
const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  modalBackIcon: {
    width: 38,
    height: 38,
    marginRight: 10,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },

  modal: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  modalEyebrow: {
    color: "#5F9C76",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  modalTitle: {
    color: "#1F2937",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },

  modalSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },

  reasonButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  reasonButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  modalCancelButton: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  modalCancelText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
  commentOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  commentOptionText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  commentDeleteOptionText: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "700",
  },
  editCommentInput: {
    minHeight: 90,
    maxHeight: 160,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 10,
    backgroundColor: "#F8FAF9",
    color: "#1F2937",
    fontSize: 14,
    textAlignVertical: "top",
  },
  commentSaveButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#599A74",
  },
  commentSaveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  reasonInput: {
    height: 120,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    textAlignVertical: "top",
  },

  confirmButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#B42318",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#F1F5F3",
  },
  cancelButtonText: {
    color: "#52675A",
    fontSize: 14,
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  deleteIconCircle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    marginBottom: 14,
    backgroundColor: "#FDECEC",
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: 0,
    backgroundColor: "#F4F4F4",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  highlightedCommentCard: {
    backgroundColor: "#EAF3FF",
    borderColor: "#3B82F6",
    borderWidth: 2,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 20,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
  },
  commentHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentMenuButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
  },
  screen: {
    flex: 1,
    minHeight: 0,
  },
  detailHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  detailHeaderContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  deletePostAction: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  deletePostActionText: {
    color: "#FF6666",
    fontSize: 13,
    fontWeight: "700",
  },
  detailScroll: {
    flex: 1,
    minHeight: 0,
  },
  detailScrollContent: {
    flexGrow: 1,
  },
  detailScrollContentCompact: {
    width: "100%",
    alignItems: "stretch",
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#599A74",
    flexShrink: 1,
    marginBottom: 0,
  },
  mainContainer: {
    flexDirection: "row",
    flex: 1, // take full remaining vertical space
    minHeight: 0,
    minWidth: 0,
    gap: 20,
    marginBottom: 0,
  },
  mainContainerCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    flexDirection: "column",
    alignItems: "stretch",
    alignSelf: "stretch",
    gap: 14,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  leftCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    width: "100%",
    alignSelf: "stretch",
  },

  right: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: 15,
  },
  rightCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    width: "100%",
    alignSelf: "stretch",
    gap: 12,
  },

  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
  },
  highlightedPostCard: {
    borderColor: "#3B82F6",
    borderWidth: 3,
  },

  postImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    resizeMode: "cover",
  },
  fullImageOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.92)",
  },
  fullImage: {
    width: "100%",
    height: "85%",
  },
  fullImageCloseButton: {
    position: "absolute",
    top: 40,
    right: 16,
    zIndex: 1,
    padding: 10,
  },

  beforeAfterSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E3EAE5",
  },
  beforeAfterTitle: {
    color: "#397A51",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  beforeAfterRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  beforeAfterColumn: {
    flex: 1,
    minWidth: 0,
  },
  beforeAfterLabel: {
    color: "#68746C",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  beforeAfterImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 8,
    resizeMode: "cover",
  },
  cleanedByText: {
    color: "#68746C",
    fontSize: 11,
    marginTop: 6,
  },

  postInfo: {
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  profileName: {
    fontWeight: "bold",
  },
  authorRow: { flexDirection: "row", alignItems: "flex-start" },
  authorImage: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  authorDetails: { flex: 1 },
  authorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
  },
  authorIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  pointsText: { color: "#2E7D32", fontSize: 12, fontWeight: "700" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  badge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    backgroundColor: "#F4FAF6",
  },
  badgeIcon: { fontSize: 14 },
  badgeMore: { color: "#5F9C76", fontSize: 10, fontWeight: "800" },
  postedDate: { color: "#7B8580", fontSize: 11 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    marginTop: 5,
    alignSelf: "flex-start",
    cursor: "pointer",
  },
  locationIcon: { width: 14, height: 14, marginRight: 5, flexShrink: 0 },
  locationText: { flex: 1, minWidth: 0 },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },
  statusTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTagText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  wasteTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wasteTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  description: {
    lineHeight: 19,
  },
  descriptionContainer: {
    marginVertical: 10,
  },
  descriptionTextWrapper: {
    overflow: "hidden",
  },
  descriptionTextWrapperCollapsed: {
    maxHeight: 57,
  },
  descriptionToggle: {
    marginTop: 3,
    color: "#397A51",
    fontSize: 13,
    fontWeight: "700",
  },
  commentsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  commentsSectionTitle: {
    marginBottom: 0,
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
  commentSortText: {
    color: "#397A51",
    fontSize: 11,
    fontWeight: "600",
  },
  commentTimestamp: {
    marginTop: 4,
    color: "#7A8980",
    fontSize: 11,
  },
  reactions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  count: {
    fontWeight: "bold",
  },
  reactBox: {
    flexDirection: "row",
    alignItems: "center",
    width: "10%",
    justifyContent: "center",
    padding: 10,
  },
  commentBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E4E4E4",
    borderRadius: 5,
    width: "90%",
    justifyContent: "center",
    padding: 10,
  },
  smallIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  commentSection: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxHeight: 480,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
  },
  commentSectionCompact: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    height: 400,
    maxHeight: 400,
    padding: 12,
    overflow: "hidden",
  },
  commentsListCompact: {
    width: "100%",
    height: 240,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
  },
  commentsList: {
    flex: 1,
    minHeight: 0,
  },
  emptyComments: {
    paddingVertical: 12,
    color: "#68746C",
    fontSize: 13,
  },
  loadMoreCommentsButton: {
    alignSelf: "center",
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#E8F2EB",
  },
  loadMoreCommentsText: {
    color: "#397A51",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    gap: 8,
    backgroundColor: "#F5F6F5",
  },
  bottomActionsCompact: {
    width: "100%",
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  actionLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adminCommentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  adminCommentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8E2DC",
    backgroundColor: "#F8FAF9",
    color: "#1F2937",
    fontSize: 13,
  },
  adminCommentButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#599A74",
  },
  disabledButton: {
    opacity: 0.5,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    flex: 1,
    minWidth: 0,
    fontWeight: "bold",
    fontSize: 14,
    color: "#25332A",
  },
  commentPoints: {
    flexShrink: 0,
    color: "#2C5FA5",
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "right",
  },
  locationSection: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  assessmentSection: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#A5A5A5",
  },
  assessmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    backgroundColor: "#FFFFFF",
  },
  actionCardIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: "#E6F3E9",
  },
  actionCardCopy: {
    flex: 1,
  },
  actionCardTitle: {
    color: "#234B33",
    fontSize: 14,
    fontWeight: "800",
  },
  actionCardHint: {
    color: "#68746C",
    fontSize: 11,
    marginTop: 3,
  },
  assessmentCardStatus: {
    color: "#68746C",
    fontSize: 12,
    marginTop: 3,
  },
  assessmentHint: {
    color: "#68746C",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  assessmentButtons: {
    flexDirection: "row",
    gap: 10,
  },
  assessmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
  },
  assessmentButtonDisabled: { opacity: 0.45 },
  assessmentButtonText: {
    color: "#34443A",
    fontSize: 13,
    fontWeight: "700",
  },
  assessmentButtonTextSelected: { color: "#FFFFFF" },
  cleanupUploadSection: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    marginBottom: 12,
  },
  cleanupUploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cleanupUploadHint: {
    color: "#68746C",
    fontSize: 11,
    marginTop: 3,
  },
  cleanupPreviewRow: {
    flexDirection: "row",
    gap: 10,
  },
  cleanupPreviewColumn: {
    flex: 1,
    minWidth: 0,
  },
  cleanupPreviewLabel: {
    color: "#68746C",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  cleanupPreviewImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: "#EEF4F0",
  },
  cleanupImagePlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9BC5A7",
    backgroundColor: "#F4FAF6",
  },
  cleanupPlaceholderText: {
    color: "#397A51",
    fontSize: 11,
    fontWeight: "700",
  },
  replaceCleanupButton: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingVertical: 4,
  },
  replaceCleanupText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
  },
  cleanAssessment: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 8,
    backgroundColor: "#34A865",
  },
  cleanAssessmentText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  helpBTN: {
    backgroundColor: "#599A74",
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  helpText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
  commentText: {
    flexShrink: 1,
    minWidth: 0,
    color: "#666",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
