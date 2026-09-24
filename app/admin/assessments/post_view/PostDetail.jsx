import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";

import { uploadToCloudinary } from "../../../../cloudinary";
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

export default function PostDetail({
  post: suppliedPost,
  currentTab,
  setSelectedPost,
  setSelectedVolunteerPost,
}) {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const [loadedPost, setLoadedPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(!suppliedPost);
  const [postLoadError, setPostLoadError] = useState("");
  const [existingVolunteerId, setExistingVolunteerId] = useState("");
  const post = suppliedPost || loadedPost;
  const effectiveCurrentTab = currentTab || post?.status;
  const isCleaned = effectiveCurrentTab === "cleaned";

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [residentPoints, setResidentPoints] = useState(
    suppliedPost?.points ?? 0,
  );
  const [residentBadges, setResidentBadges] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);

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
      setCommentText("");
    } catch (error) {
      console.error("Unable to add admin comment:", error);
      Alert.alert("Unable to add comment", "Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const sendDeleteNotification = async () => {
    await addDoc(
      collection(db, "notifications"),

      {
        userId: post.userId,

        title: "Report Removed",

        message: `Your waste report was removed by the LGU.\n\nReason: ${selectedReason}`,

        type: "deleted_post",

        read: false,

        createdAt: serverTimestamp(),
      },
    );
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

  return (
    <View style={styles.screen}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={closePostDetail}>
          <Image
            source={require("../../../../assets/images/backG.png")}
            style={styles.profileImage}
          />
        </TouchableOpacity>

        <View
          style={{
            alignItems: "center",
            width: "96%",
            justifyContent: "space-between",
            flexDirection: "row",
          }}
        >
          <Text style={styles.title}>Post Details</Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#fff",
              padding: 12,
              borderRadius: 5,
            }}
            onPress={() => {
              setShowReasonModal(true);
            }}
          >
            <Text style={{ color: "#FF6666" }}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN LAYOUT */}
      <View style={styles.mainContainer}>
        {/* LEFT - POST */}
        <View style={styles.left}>
          <View style={styles.card}>
            {!Boolean(isCleaned && post.afterImageUrl) && (
              <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
            )}

            {Boolean(isCleaned && post.afterImageUrl) && (
              <View style={styles.beforeAfterSection}>
                <Text style={styles.beforeAfterTitle}>Cleanup Result</Text>
                <View style={styles.beforeAfterRow}>
                  <View style={styles.beforeAfterColumn}>
                    <Text style={styles.beforeAfterLabel}>Before</Text>
                    <Image
                      source={{ uri: post.imageUrl }}
                      style={styles.beforeAfterImage}
                    />
                  </View>
                  <View style={styles.beforeAfterColumn}>
                    <Text style={styles.beforeAfterLabel}>After</Text>
                    <Image
                      source={{ uri: post.afterImageUrl }}
                      style={styles.beforeAfterImage}
                    />
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
                        {post.firstName} {post.lastName}
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

                  <View style={styles.locationRow}>
                    <Image
                      source={require("../../../../assets/images/location.png")}
                      style={styles.locationIcon}
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {formatLocationWithPurok(post.locationName, post.purok)}
                    </Text>
                  </View>

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
              <Text style={styles.description}>
                {hideBadWords(post.caption)}
              </Text>

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
          </View>
        </View>

        {/* RIGHT - COMMENTS + LOCATION */}
        <View style={styles.right}>
          {/* COMMENTS */}
          <View style={styles.commentSection}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <Image
                      source={require("../../../../assets/images/ProfileIG.png")}
                      style={styles.profileImage}
                    />

                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={styles.userName}>
                          {comment.firstName} {comment.lastName}
                        </Text>

                        <Text
                          style={{
                            color: "#2C5FA5",
                            fontWeight: "bold",
                          }}
                        >
                          {comment.points} pts
                        </Text>
                      </View>

                      <Text style={styles.commentText}>
                        {hideBadWords(comment.comment)}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text>No comments yet.</Text>
              )}
            </ScrollView>
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

      {/* BUTTON */}
      {!isCleaned && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 20,
            gap: 5,
          }}
        >
          <TouchableOpacity
            disabled={openingVolunteerActivity || updating}
            style={[
              styles.helpBTN,
              {
                flex: 1,
                backgroundColor: "#599A74",
              },
              (openingVolunteerActivity || updating) && styles.disabledButton,
            ]}
            onPress={openVolunteerActivity}
          >
            {openingVolunteerActivity ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.helpText}>Opening...</Text>
              </View>
            ) : (
              <Text style={styles.helpText}>
                {existingVolunteerId ? "Manage Volunteers" : "Help"}
              </Text>
            )}
          </TouchableOpacity>

          {!isCleaned && (
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
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
          )}
        </View>
      )}

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
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  screen: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#599A74",
    marginBottom: 10,
    alignContent: "center",
    justifyContent: "center",
  },
  mainContainer: {
    flexDirection: "row",
    flex: 1, // take full remaining vertical space
    gap: 20,
    marginBottom: 0,
  },
  left: {
    flex: 1,
  },

  right: {
    flex: 1,
    gap: 15,
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
  },

  postImage: {
    width: "auto",
    height: "auto",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    resizeMode: "cover",
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
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  locationIcon: { width: 14, height: 14, marginRight: 5, tintColor: "#666666" },
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
    marginVertical: 10,
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
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
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
    fontWeight: "bold",
    fontSize: 16,
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
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  helpText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  commentText: {
    color: "#666",
    marginTop: 2,
  },
});
