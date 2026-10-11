import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import {
  formatLocationWithPurok,
  normalizePurok,
} from "../../../../constants/locationFormat";
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../../../../constants/wasteCategories";
import { auth, db } from "../../../../firebaseConfig";
import { deleteRelatedDocuments } from "../../../../utils/deletePostHelper";
import { hideBadWords } from "../../../../utils/hideBadWords";
import {
  notifyCommentModerated,
  notifyPostModerated,
  notifyPostStatusUpdated,
  notifyUserEcoPointsAwarded,
  notifyVolunteersOnActivityCancelled,
  notifyVolunteersOnActivityRevertedToOpen,
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
  const isTablet = width >= 700 && width < 1024;
  const isDesktop = width >= 1024;
  const isCompactLayout = width < 1100;
  const { postId, commentId } = useLocalSearchParams();
  const effectiveHighlightedCommentId =
    highlightedCommentId ||
    (Array.isArray(commentId) ? commentId[0] : commentId);

  const [highlightFadeAnim] = useState(() => new Animated.Value(1));
  const [isHighlighted, setIsHighlighted] = useState(
    Boolean(effectiveHighlightedCommentId),
  );

  useEffect(() => {
    if (!effectiveHighlightedCommentId) {
      return undefined;
    }

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
  }, [effectiveHighlightedCommentId, highlightFadeAnim]);

  const [loadedPost, setLoadedPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(!suppliedPost);
  const [postLoadError, setPostLoadError] = useState("");
  const [existingVolunteerId, setExistingVolunteerId] = useState("");
  const [existingVolunteerActivity, setExistingVolunteerActivity] = useState(null);
  const [showCancelCleanupModal, setShowCancelCleanupModal] = useState(false);
  const [cancelCleanupReason, setCancelCleanupReason] = useState("");
  const [cancellingCleanup, setCancellingCleanup] = useState(false);
  const [localLocationOverrides, setLocalLocationOverrides] = useState({});
  const post = {
    ...(suppliedPost || loadedPost),
    ...localLocationOverrides,
  };
  const effectiveCurrentTab = currentTab || post?.status;
  const isCleaned = effectiveCurrentTab === "cleaned";

  const [linkedPostsCount, setLinkedPostsCount] = useState(0);

  useEffect(() => {
    if (!post?.id) return;
    const q = query(
      collection(db, "posts"),
      where("linkedReportId", "==", post.id),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLinkedPostsCount(snapshot.size);
      },
      (err) => console.log("Error loading linked posts count:", err),
    );
    return () => unsubscribe();
  }, [post?.id]);

  const handleSaveLocation = async ({
    locationName,
    street,
    purok,
    barangay,
    municipality,
    coordinates,
  }) => {
    if (!post?.id) return;
    try {
      const updates = {
        locationName,
        street: street || null,
        purok: normalizePurok(purok) || null,
        barangay: barangay || null,
        municipality: municipality || "Pinamungajan",
      };
      if (coordinates) {
        updates.coordinates = coordinates;
      }
      await updateDoc(doc(db, "posts", post.id), updates);
      setLocalLocationOverrides(updates);
      setLocationModalVisible(false);
      Alert.alert("Success", "Report location updated successfully.");
    } catch (err) {
      console.error("Error updating location:", err);
      Alert.alert("Error", "Could not update location. Please try again.");
    }
  };

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
  const [showCommentReasonModal, setShowCommentReasonModal] = useState(false);
  const [showCommentOtherModal, setShowCommentOtherModal] = useState(false);
  const [showCommentConfirmModal, setShowCommentConfirmModal] = useState(false);
  const [selectedCommentReason, setSelectedCommentReason] = useState("");
  const [customCommentReason, setCustomCommentReason] = useState("");
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

  // QoL: Reschedule cleanup drive
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [reschedulingCleanup, setReschedulingCleanup] = useState(false);


  // QoL: Reporter contact details modal
  const [showReporterModal, setShowReporterModal] = useState(false);

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

  const commentDeleteReasons = [
    "Inappropriate or Offensive Language",
    "Spam or Irrelevant Content",
    "Harassment or Disrespectful Behavior",
    "False or Misleading Information",
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
        if (!snapshot.empty) {
          setExistingVolunteerId(snapshot.docs[0].id);
          setExistingVolunteerActivity({
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
          });
        } else {
          setExistingVolunteerId("");
          setExistingVolunteerActivity(null);
        }
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

      const linkedReportsSnapshot = await getDocs(
        query(
          collection(db, "posts"),
          where("linkedReportId", "==", post.id),
        ),
      );

      const settingsSnapshot = await getDoc(doc(db, "settings", "ecopoints"));
      const ecoConfig = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
      const reportCleanedPoints = Number(ecoConfig.reportCleaned) || 5;
      const linkedReportCleanedPoints = Number(ecoConfig.linkedReportCleaned) || 5;
      const volunteerCleanupPoints = Number(ecoConfig.volunteerCleanup) || 10;

      const eligibleLinkedUsers = [];

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
        const postData = postSnapshot.data();
        const ownerId = postData.userId;
        const isPointEligible = postData.isPointEligible !== false; // Duplicate check: if duplicate from same user, no points!

        // Award configured points to the main report owner ONLY if point-eligible (not duplicate)
        if (ownerId && isPointEligible && !postData.isDuplicate) {
          rewardsByUserId.set(ownerId, reportCleanedPoints);
        }

        // Award configured linkedReportCleaned points to each unique linked reporter who reported in the same vicinity and is eligible (NOT duplicate)
        const linkedDocuments = [];
        for (const linkedDoc of linkedReportsSnapshot.docs) {
          const lSnap = await transaction.get(linkedDoc.ref);
          if (lSnap.exists() && lSnap.data().status !== "cleaned") {
            linkedDocuments.push(lSnap);
            const lData = lSnap.data();
            if (lData.userId && lData.isPointEligible !== false && !lData.isDuplicate) {
              if (!rewardsByUserId.has(lData.userId)) {
                rewardsByUserId.set(lData.userId, linkedReportCleanedPoints);
                eligibleLinkedUsers.push({
                  userId: lData.userId,
                  title: lData.title || lData.locationName || post.title || post.locationName,
                  postId: linkedDoc.id,
                });
              }
            }
          }
        }

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
            (rewardsByUserId.get(volunteerId) || 0) + volunteerCleanupPoints,
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
        linkedDocuments.forEach((linkedDoc) => {
          transaction.update(linkedDoc.ref, {
            status: "cleaned",
            ...cleanupFields,
            cleanedBy: auth.currentUser?.uid || null,
            cleanedByName: adminName,
            cleanedAt: serverTimestamp(),
          });
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
            source: userRef.id === ownerId ? "cleanup_reward" : "linked_cleanup_reward",
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

      if (post?.userId && post.isPointEligible !== false && !post.isDuplicate) {
        notifyUserEcoPointsAwarded({
          userId: post.userId,
          amount: reportCleanedPoints,
          source: "cleanup_reward",
          title: post.title || post.locationName,
          postId: post.id,
        });
      }

      eligibleLinkedUsers.forEach((u) => {
        notifyUserEcoPointsAwarded({
          userId: u.userId,
          amount: linkedReportCleanedPoints,
          source: "linked_cleanup_reward",
          title: u.title,
          postId: u.postId,
        });
      });

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

  const handleRevertCleanupToModerate = async () => {
    if (!post?.id || cancellingCleanup) return;
    setCancellingCleanup(true);
    try {
      await updateDoc(doc(db, "posts", post.id), {
        status: "moderate",
        assessmentUpdatedAt: serverTimestamp(),
      });
      await notifyPostStatusUpdated({
        postId: post.id,
        newStatus: "moderate",
      });

      if (existingVolunteerId) {
        await updateDoc(doc(db, "volunteer_posts", existingVolunteerId), {
          status: "open",
          cancellationReason: null,
        });

        if (existingVolunteerActivity) {
          await notifyVolunteersOnActivityRevertedToOpen({
            activityId: existingVolunteerId,
            title: existingVolunteerActivity.title,
            reason: cancelCleanupReason?.trim() || "",
            volunteers: existingVolunteerActivity.volunteers,
            ownerId:
              existingVolunteerActivity.userId ||
              existingVolunteerActivity.ownerId,
            imageUrl: existingVolunteerActivity.imageUrl,
          });
        }
      }

      setLoadedPost((prev) => (prev ? { ...prev, status: "moderate" } : null));
      setExistingVolunteerActivity((prev) =>
        prev ? { ...prev, status: "open", cancellationReason: null } : null,
      );
      setShowCancelCleanupModal(false);
      setCancelCleanupReason("");
      Alert.alert(
        "Operation Reverted",
        "The report status is back to Moderate and volunteer registration is open.",
      );
    } catch (error) {
      console.error("Unable to revert operation:", error);
      Alert.alert("Failed to revert operation. Please try again.");
    } finally {
      setCancellingCleanup(false);
    }
  };

  const handleCancelCleanupPermanently = async () => {
    if (!post?.id || cancellingCleanup) return;
    setCancellingCleanup(true);
    try {
      const reason =
        hideBadWords(cancelCleanupReason.trim()) ||
        "Cancelled by LGU administrator";

      await updateDoc(doc(db, "posts", post.id), {
        status: "moderate",
        assessmentUpdatedAt: serverTimestamp(),
      });
      await notifyPostStatusUpdated({
        postId: post.id,
        newStatus: "moderate",
      });

      if (existingVolunteerId) {
        await updateDoc(doc(db, "volunteer_posts", existingVolunteerId), {
          status: "cancelled",
          cancellationReason: reason,
          cancelledAt: serverTimestamp(),
        });

        if (existingVolunteerActivity) {
          await notifyVolunteersOnActivityCancelled({
            activityId: existingVolunteerId,
            title: existingVolunteerActivity.title,
            reason,
            volunteers: existingVolunteerActivity.volunteers,
            ownerId:
              existingVolunteerActivity.userId ||
              existingVolunteerActivity.ownerId,
            imageUrl: existingVolunteerActivity.imageUrl,
          });
        }
      }

      setLoadedPost((prev) => (prev ? { ...prev, status: "moderate" } : null));
      setExistingVolunteerActivity((prev) =>
        prev
          ? { ...prev, status: "cancelled", cancellationReason: reason }
          : null,
      );
      setShowCancelCleanupModal(false);
      setCancelCleanupReason("");
      Alert.alert(
        "Operation Cancelled",
        "The cleanup operation was cancelled and volunteers have been notified.",
      );
    } catch (error) {
      console.error("Unable to cancel operation:", error);
      Alert.alert("Failed to cancel operation. Please try again.");
    } finally {
      setCancellingCleanup(false);
    }
  };

  const handleRescheduleCleanup = async () => {
    if (!existingVolunteerId || !rescheduleDate.trim() || reschedulingCleanup)
      return;
    setReschedulingCleanup(true);
    try {
      await updateDoc(doc(db, "volunteer_posts", existingVolunteerId), {
        meetingDate: rescheduleDate.trim(),
        meetingTime:
          rescheduleTime.trim() ||
          existingVolunteerActivity?.meetingTime ||
          "",
        rescheduledReason: rescheduleReason.trim() || null,
        updatedAt: serverTimestamp(),
      });

      if (existingVolunteerActivity) {
        await notifyVolunteersOnActivityRevertedToOpen({
          activityId: existingVolunteerId,
          title: existingVolunteerActivity.title,
          reason: `Cleanup operation rescheduled to ${rescheduleDate.trim()} at ${
            rescheduleTime.trim() ||
            existingVolunteerActivity?.meetingTime ||
            "scheduled time"
          }. ${rescheduleReason.trim() ? `Note: ${rescheduleReason.trim()}` : ""}`,
          volunteers: existingVolunteerActivity.volunteers,
          ownerId:
            existingVolunteerActivity.userId ||
            existingVolunteerActivity.ownerId,
          imageUrl: existingVolunteerActivity.imageUrl,
        });
      }

      setExistingVolunteerActivity((prev) =>
        prev
          ? {
              ...prev,
              meetingDate: rescheduleDate.trim(),
              meetingTime:
                rescheduleTime.trim() || prev.meetingTime || "",
            }
          : null,
      );
      setShowRescheduleModal(false);
      setRescheduleReason("");
      Alert.alert(
        "Operation Rescheduled",
        `Cleanup drive rescheduled to ${rescheduleDate.trim()} and registered volunteers have been notified.`,
      );
    } catch (error) {
      console.error("Unable to reschedule operation:", error);
      Alert.alert("Error", "Failed to reschedule cleanup drive. Please try again.");
    } finally {
      setReschedulingCleanup(false);
    }
  };


  const handleCopyReporterEmail = () => {
    const email = residentProfile?.email;
    if (!email) {
      Alert.alert("No Email", "Resident has not provided an email address.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(email);
    }
    Alert.alert("Copied", "Reporter email copied to clipboard.");
  };

  const reporterPhone =
    residentProfile?.cellNumber ||
    residentProfile?.phoneNumber ||
    residentProfile?.phone ||
    post?.cellNumber ||
    post?.phoneNumber ||
    "";

  const handleCopyReporterPhone = () => {
    if (!reporterPhone) {
      Alert.alert("No Phone", "Resident has not provided a phone number.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(reporterPhone);
    }
    Alert.alert("Copied", "Reporter phone number copied to clipboard.");
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

  const chooseCommentReason = (reason) => {
    if (reason === "Other Reason") {
      setShowCommentReasonModal(false);
      setShowCommentOtherModal(true);
      return;
    }

    setSelectedCommentReason(reason);
    setShowCommentReasonModal(false);
    setShowCommentConfirmModal(true);
  };

  const continueCustomCommentReason = () => {
    if (customCommentReason.trim() === "") {
      Alert.alert("Please enter a reason.");
      return;
    }

    setSelectedCommentReason(customCommentReason.trim());
    setShowCommentOtherModal(false);
    setShowCommentConfirmModal(true);
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

      if (commentToDelete.userId) {
        await notifyCommentModerated({
          userId: commentToDelete.userId,
          postTitle: post.title || post.locationName || "Waste Report",
          reason: selectedCommentReason,
          postId: post.id,
        });
      }

      setComments((current) =>
        current.filter((item) => item.id !== commentToDelete.id),
      );
      setCommentToDelete(null);
      setShowCommentConfirmModal(false);
      setSelectedCommentReason("");
      setCustomCommentReason("");
      Alert.alert(
        "Comment Deleted",
        "The comment was removed and the resident was notified.",
      );
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

      if (
        nextStatus === "critical" ||
        nextStatus === "ongoing" ||
        nextStatus === "moderate"
      ) {
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
                  <View
                    style={[
                      styles.authorHeader,
                      isMobile && styles.authorHeaderMobile,
                    ]}
                  >
                    <View
                      style={[
                        styles.authorIdentity,
                        isMobile && styles.authorIdentityMobile,
                      ]}
                    >
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
                    <View style={{ alignItems: isMobile ? "flex-start" : "flex-end", gap: 4 }}>
                      <Text
                        style={[
                          styles.postedDate,
                          isMobile && styles.postedDateMobile,
                        ]}
                      >
                        {formatPostedDate(post.createdAt)}
                      </Text>
                      <TouchableOpacity
                        style={styles.contactReporterButton}
                        onPress={() => setShowReporterModal(true)}
                        activeOpacity={0.8}
                        accessibilityLabel="View reporter contact details"
                      >
                        <Ionicons
                          name="person-circle-outline"
                          size={13}
                          color="#276344"
                        />
                        <Text style={styles.contactReporterButtonText}>
                          Reporter Info
                        </Text>
                      </TouchableOpacity>
                    </View>
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
                      {formatLocationWithPurok(post)}
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

                    {Boolean(post.isDuplicate || post.isPointEligible === false) && (
                      <View style={[styles.statusTag, styles.duplicateTag]}>
                        <Ionicons
                          name="copy-outline"
                          size={10}
                          color="#FFFFFF"
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.statusTagText}>Duplicate Report</Text>
                      </View>
                    )}

                    {Boolean(post.linkedReportId || post.duplicateOf) && (
                      <TouchableOpacity
                        style={[styles.statusTag, styles.linkedTag]}
                        activeOpacity={0.7}
                        onPress={async () => {
                          const targetId = post.linkedReportId || post.duplicateOf;
                          try {
                            const snap = await getDoc(doc(db, "posts", targetId));
                            if (snap.exists()) {
                              setSelectedPost({ id: snap.id, ...snap.data() });
                            } else {
                              Alert.alert("Notice", "The primary linked report is no longer available.");
                            }
                          } catch (err) {
                            console.error("Error loading linked report:", err);
                          }
                        }}
                      >
                        <Ionicons
                          name="link-outline"
                          size={10}
                          color="#FFFFFF"
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.statusTagText}>Linked Report</Text>
                      </TouchableOpacity>
                    )}

                    {linkedPostsCount > 0 && (
                      <View style={[styles.statusTag, styles.linkedTag]}>
                        <Ionicons
                          name="albums-outline"
                          size={10}
                          color="#FFFFFF"
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.statusTagText}>
                          {linkedPostsCount} Linked {linkedPostsCount === 1 ? "Report" : "Reports"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* VICINITY / DUPLICATE NOTICES */}
              {Boolean(post.linkedReportId || post.duplicateOf) && (
                <TouchableOpacity
                  style={styles.linkedNoticeBox}
                  activeOpacity={0.7}
                  onPress={async () => {
                    const targetId = post.linkedReportId || post.duplicateOf;
                    try {
                      const snap = await getDoc(doc(db, "posts", targetId));
                      if (snap.exists()) {
                        setSelectedPost({ id: snap.id, ...snap.data() });
                      } else {
                        Alert.alert("Notice", "The primary linked report is no longer available.");
                      }
                    } catch (err) {
                      console.error("Error opening linked report:", err);
                    }
                  }}
                >
                  <Ionicons name="link" size={16} color="#1D4ED8" />
                  <Text style={styles.linkedNoticeText}>
                    Linked Vicinity Report: Tap to view the primary report for this location.
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color="#1D4ED8" />
                </TouchableOpacity>
              )}

              {Boolean(post.isDuplicate || post.isPointEligible === false) && (
                <View
                  style={[
                    styles.duplicateNoticeBox,
                    Boolean(post.linkedReportId || post.duplicateOf) && {
                      marginTop: 0,
                    },
                  ]}
                >
                  <Ionicons name="copy-outline" size={16} color="#DC2626" />
                  <Text style={styles.duplicateNoticeText}>
                    Duplicate Report: Marked as a duplicate report in the same vicinity (0 EcoPoints awarded).
                  </Text>
                </View>
              )}

              {/* DESCRIPTION */}
              {Boolean(post.caption) && (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.description}>
                    {hideBadWords(post.caption)}
                  </Text>
                </View>
              )}

              {/* REACTIONS */}
              <View
                style={[
                  styles.reactions,
                  isMobile && styles.reactionsMobile,
                ]}
              >
                <View
                  style={[
                    styles.reactBox,
                    isMobile && styles.reactBoxMobile,
                  ]}
                >
                  <Image
                    source={require("../../../../assets/images/priorityreact.png")}
                    style={styles.smallIcon}
                  />
                  <Text style={styles.reactionCount}>
                    {post.reactionCount || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.commentBox,
                    isMobile && styles.commentBoxMobile,
                  ]}
                >
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

          {/* ACTIVE VOLUNTEER CLEANUP CARD */}
          {Boolean(existingVolunteerActivity) && (
            <View style={styles.volunteerActivityCard}>
              <TouchableOpacity
                onPress={openVolunteerActivity}
                activeOpacity={0.8}
                style={styles.volunteerActivityCardMain}
              >
                <View style={styles.volunteerCardHeader}>
                  <View style={styles.volunteerBadgeRow}>
                    <View
                      style={[
                        styles.volunteerStatusDot,
                        existingVolunteerActivity.status === "ongoing"
                          ? styles.volunteerStatusDotOngoing
                          : existingVolunteerActivity.status === "cancelled"
                            ? styles.volunteerStatusDotCancelled
                            : styles.volunteerStatusDotOpen,
                      ]}
                    />
                    <Text style={styles.volunteerStatusText}>
                      {existingVolunteerActivity.status === "ongoing"
                        ? "Operation On-Going"
                        : existingVolunteerActivity.status === "cancelled"
                          ? "Drive Cancelled"
                          : "Volunteer Drive Active"}
                    </Text>
                  </View>
                  <View style={styles.volunteerMemberPill}>
                    <Ionicons name="people" size={13} color="#276344" />
                    <Text style={styles.volunteerMemberPillText}>
                      {(existingVolunteerActivity.volunteers || []).length} /{" "}
                      {existingVolunteerActivity.maxVolunteers || 0}
                    </Text>
                  </View>
                </View>

                <Text style={styles.volunteerActivityTitle} numberOfLines={1}>
                  {existingVolunteerActivity.title || "Community Clean-up Drive"}
                </Text>

                <View style={styles.volunteerCardFooter}>
                  <Text style={styles.volunteerManageHint}>
                    Tap to manage volunteers & attendance
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#276344" />
                </View>
              </TouchableOpacity>

              {effectiveCurrentTab === "ongoing" && (
                <View style={{ borderTopWidth: 1, borderTopColor: "#A7F3D0" }}>
                  <TouchableOpacity
                    style={styles.rescheduleCleanupActionRow}
                    onPress={() => {
                      const d = existingVolunteerActivity?.meetingDate;
                      setRescheduleDate(
                        d
                          ? typeof d?.toDate === "function"
                            ? d.toDate().toISOString().split("T")[0]
                            : String(d)
                          : "",
                      );
                      setRescheduleTime(
                        existingVolunteerActivity?.meetingTime || "",
                      );
                      setShowRescheduleModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#276344"
                    />
                    <Text style={styles.rescheduleCleanupActionText}>
                      Reschedule Cleanup Drive
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelCleanupActionRow}
                    onPress={() => setShowCancelCleanupModal(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={14}
                      color="#DC2626"
                    />
                    <Text style={styles.cancelCleanupActionText}>
                      Cancel / Revert Cleanup Operation
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}


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
            {selectedCommentForMenu?.userId === auth.currentUser?.uid && (
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
            )}
            <TouchableOpacity
              style={styles.commentOptionButton}
              onPress={() => {
                const comment = selectedCommentForMenu;
                setSelectedCommentForMenu(null);
                setCommentToDelete(comment);
                setSelectedCommentReason("");
                setCustomCommentReason("");
                setShowCommentReasonModal(true);
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

      {/* Delete Comment — Select Reason Modal */}
      <Modal visible={showCommentReasonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalEyebrow}>LGU ADMIN</Text>
            <Text style={styles.modalTitle}>Delete comment</Text>
            <Text style={styles.modalSubtitle}>
              Choose a reason so the resident understands why this comment was
              removed.
            </Text>

            {commentDeleteReasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonButton}
                onPress={() => chooseCommentReason(reason)}
              >
                <Text style={styles.reasonButtonText}>{reason}</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowCommentReasonModal(false);
                setCommentToDelete(null);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Comment — Custom Reason Modal */}
      <Modal visible={showCommentOtherModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowCommentOtherModal(false);
                  setShowCommentReasonModal(true);
                }}
              >
                <Image
                  source={require("../../../../assets/images/backG.png")}
                  style={styles.modalBackIcon}
                />
              </TouchableOpacity>

              <View>
                <Text style={styles.modalEyebrow}>DELETE COMMENT</Text>
                <Text style={styles.modalTitle}>Other reason</Text>
              </View>
            </View>

            <TextInput
              placeholder="Write reason for comment removal..."
              multiline
              value={customCommentReason}
              onChangeText={setCustomCommentReason}
              style={styles.reasonInput}
            />

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={continueCustomCommentReason}
            >
              <Text style={styles.confirmButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Comment — Confirm Modal */}
      <Modal visible={showCommentConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={24} color="#B42318" />
            </View>
            <Text style={styles.modalTitle}>Delete this comment?</Text>
            <Text style={styles.modalSubtitle}>
              This action cannot be undone. The resident will be notified with
              the reason: &quot;{selectedCommentReason}&quot;.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={deletingComment}
                onPress={() => {
                  setShowCommentConfirmModal(false);
                  setCommentToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Keep comment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={deletingComment}
                style={[
                  styles.confirmButton,
                  deletingComment && styles.disabledButton,
                ]}
                onPress={handleDeleteComment}
              >
                {deletingComment ? (
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
                  <Text style={styles.confirmButtonText}>Yes, Delete</Text>
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
          <View
            style={[
              styles.modal,
              styles.cleanupModal,
              isTablet && styles.cleanupModalTablet,
              isDesktop && styles.cleanupModalDesktop,
            ]}
          >
            <View style={styles.cleanupModalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.modalEyebrow}>CLEANUP RESULT</Text>
                <Text
                  style={[
                    styles.modalTitle,
                    !isMobile && styles.modalTitleLarge,
                  ]}
                >
                  Before and After images
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCleanupModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.cleanupModalCloseButton}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.modalSubtitle,
                !isMobile && styles.modalSubtitleLarge,
              ]}
            >
              The report photo is used as Before. Add an optional After image
              before marking the report as clean.
            </Text>

            <View
              style={[
                styles.cleanupPreviewRow,
                !isMobile &&
                  (isDesktop
                    ? styles.cleanupPreviewRowDesktop
                    : styles.cleanupPreviewRowTablet),
              ]}
            >
              {/* BEFORE COLUMN */}
              <View style={styles.cleanupPreviewColumn}>
                <View style={styles.cleanupCardHeader}>
                  <View style={styles.cleanupBadgeBefore}>
                    <Text style={styles.cleanupBadgeTextBefore}>BEFORE</Text>
                  </View>
                  <Text style={styles.cleanupSublabel}>Report photo</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullImageUrl(post.imageUrl)}
                  style={[
                    styles.cleanupImageWrapper,
                    !isMobile &&
                      (isDesktop
                        ? styles.cleanupImageWrapperDesktop
                        : styles.cleanupImageWrapperTablet),
                  ]}
                >
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.cleanupPreviewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.cleanupZoomOverlay}>
                    <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                    <Text style={styles.cleanupZoomText}>View</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* AFTER COLUMN */}
              <View style={styles.cleanupPreviewColumn}>
                <View style={styles.cleanupCardHeader}>
                  <View
                    style={[
                      styles.cleanupBadgeAfter,
                      cleanupImageUrl && styles.cleanupBadgeAfterActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cleanupBadgeTextAfter,
                        cleanupImageUrl && styles.cleanupBadgeTextAfterActive,
                      ]}
                    >
                      AFTER
                    </Text>
                  </View>
                  <Text style={styles.cleanupSublabel}>
                    {cleanupImageUrl ? "Cleaned photo" : "Optional"}
                  </Text>
                </View>
                {cleanupImageUrl ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setFullImageUrl(cleanupImageUrl)}
                    style={[
                      styles.cleanupImageWrapper,
                      !isMobile &&
                        (isDesktop
                          ? styles.cleanupImageWrapperDesktop
                          : styles.cleanupImageWrapperTablet),
                    ]}
                  >
                    <Image
                      source={{ uri: cleanupImageUrl }}
                      style={styles.cleanupPreviewImage}
                      resizeMode="cover"
                    />
                    <View style={styles.cleanupZoomOverlay}>
                      <Ionicons
                        name="expand-outline"
                        size={13}
                        color="#FFFFFF"
                      />
                      <Text style={styles.cleanupZoomText}>View</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.cleanupImagePlaceholder,
                      !isMobile &&
                        (isDesktop
                          ? styles.cleanupImagePlaceholderDesktop
                          : styles.cleanupImagePlaceholderTablet),
                    ]}
                    onPress={uploadCleanupImage}
                    disabled={uploadingCleanupImage}
                    activeOpacity={0.8}
                  >
                    {uploadingCleanupImage ? (
                      <View style={styles.cleanupLoadingContainer}>
                        <ActivityIndicator
                          size={isMobile ? "small" : "large"}
                          color="#397A51"
                        />
                        <Text style={styles.cleanupPlaceholderText}>
                          Uploading...
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.cleanupPlaceholderContent}>
                        <View
                          style={[
                            styles.cleanupUploadIconCircle,
                            !isMobile && styles.cleanupUploadIconCircleLarge,
                          ]}
                        >
                          <Ionicons
                            name="cloud-upload-outline"
                            size={isMobile ? 24 : 32}
                            color="#397A51"
                          />
                        </View>
                        <Text
                          style={[
                            styles.cleanupPlaceholderText,
                            !isMobile && styles.cleanupPlaceholderTextLarge,
                          ]}
                        >
                          Add image
                        </Text>
                        {!isMobile && (
                          <Text style={styles.cleanupPlaceholderHint}>
                            Tap to upload cleaned area photo
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {Boolean(cleanupImageUrl) && (
              <View style={styles.cleanupActionsRow}>
                <TouchableOpacity
                  style={styles.replaceCleanupButton}
                  onPress={uploadCleanupImage}
                  disabled={uploadingCleanupImage}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={16}
                    color="#397A51"
                  />
                  <Text style={styles.replaceCleanupText}>
                    {uploadingCleanupImage
                      ? "Uploading..."
                      : "Replace After image"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeCleanupButton}
                  onPress={() => setCleanupImageUrl(null)}
                  disabled={uploadingCleanupImage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.removeCleanupText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.cleanupFooterRow}>
              <TouchableOpacity
                style={styles.cleanupDoneButton}
                onPress={() => setShowCleanupModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.cleanupDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CANCEL / REVERT CLEANUP OPERATION MODAL */}
      <Modal
        visible={showCancelCleanupModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancellingCleanup) setShowCancelCleanupModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View
              style={[
                styles.deleteIconCircle,
                { alignSelf: "center", marginBottom: 12 },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={26} color="#B42318" />
            </View>
            <Text
              style={[
                styles.modalTitle,
                { textAlign: "center", marginBottom: 6 },
              ]}
            >
              Cancel or Revert Cleanup?
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { textAlign: "center", marginBottom: 16 },
              ]}
            >
              You can revert the report back to Moderate (re-opening registration) or cancel the cleanup drive permanently.
            </Text>
            <TextInput
              style={styles.editCommentInput}
              placeholder="Reason for cancellation (e.g., Hazardous weather, Postponed)..."
              placeholderTextColor="#8FA396"
              value={cancelCleanupReason}
              onChangeText={setCancelCleanupReason}
              multiline
              numberOfLines={3}
            />
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.cancelButton, { flex: 1 }]}
                  onPress={() => setShowCancelCleanupModal(false)}
                  disabled={cancellingCleanup}
                >
                  <Text style={styles.cancelButtonText}>Keep Running</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      flex: 1,
                      backgroundColor: "#E8F5EC",
                      borderColor: "#A7F3D0",
                      borderWidth: 1,
                    },
                    cancellingCleanup && styles.disabledButton,
                  ]}
                  onPress={handleRevertCleanupToModerate}
                  disabled={cancellingCleanup}
                >
                  <Text style={[styles.cancelButtonText, { color: "#276344" }]}>
                    Revert to Open
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: "#B42318", minHeight: 44 },
                  cancellingCleanup && styles.disabledButton,
                ]}
                onPress={handleCancelCleanupPermanently}
                disabled={cancellingCleanup}
              >
                {cancellingCleanup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Cancel Drive Permanently
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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

      {/* RESCHEDULE CLEANUP MODAL */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!reschedulingCleanup) setShowRescheduleModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View
              style={[
                styles.deleteIconCircle,
                { alignSelf: "center", marginBottom: 12, backgroundColor: "#EAF4ED" },
              ]}
            >
              <Ionicons name="calendar-outline" size={26} color="#276344" />
            </View>
            <Text
              style={[
                styles.modalTitle,
                { textAlign: "center", marginBottom: 6 },
              ]}
            >
              Reschedule Cleanup Drive
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                { textAlign: "center", marginBottom: 16 },
              ]}
            >
              Update the date and time. Enrolled volunteers will automatically receive an update notification.
            </Text>

            <Text style={styles.rescheduleInputLabel}>Meeting Date</Text>
            <TextInput
              style={styles.rescheduleInput}
              placeholder="e.g. 2026-10-25"
              placeholderTextColor="#8FA396"
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
            />

            <Text style={styles.rescheduleInputLabel}>Meeting Time</Text>
            <TextInput
              style={styles.rescheduleInput}
              placeholder="e.g. 07:00 AM - 10:00 AM"
              placeholderTextColor="#8FA396"
              value={rescheduleTime}
              onChangeText={setRescheduleTime}
            />

            <Text style={styles.rescheduleInputLabel}>Reason / Advisory for Volunteers</Text>
            <TextInput
              style={[styles.rescheduleInput, { height: 65, textAlignVertical: "top" }]}
              placeholder="e.g. Rescheduled due to inclement weather advisory..."
              placeholderTextColor="#8FA396"
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              multiline
            />

            <View style={[styles.modalActions, { marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRescheduleModal(false)}
                disabled={reschedulingCleanup}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { minHeight: 44 },
                  reschedulingCleanup && styles.disabledButton,
                ]}
                onPress={handleRescheduleCleanup}
                disabled={reschedulingCleanup}
              >
                {reschedulingCleanup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Confirm & Notify
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* REPORTER CONTACT DETAILS MODAL */}
      <Modal
        visible={showReporterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReporterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>REPORTER DETAILS</Text>
                <Text style={styles.modalTitle}>Contact Reporter</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReporterModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.reporterInfoCard}>
              <Text style={styles.reporterInfoLabel}>Full Name</Text>
              <Text style={styles.reporterInfoValue}>
                {[residentProfile?.firstName ?? post.firstName, residentProfile?.lastName ?? post.lastName]
                  .filter(Boolean)
                  .join(" ") || "Resident"}
              </Text>
            </View>

            <View style={styles.reporterInfoCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.reporterInfoLabel}>Email Address</Text>
                {Boolean(residentProfile?.email) && (
                  <TouchableOpacity onPress={handleCopyReporterEmail}>
                    <Text style={styles.reporterCopyLink}>Copy</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.reporterInfoValue}>
                {residentProfile?.email || "No email on file"}
              </Text>
            </View>

            <View style={styles.reporterInfoCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.reporterInfoLabel}>Phone Number</Text>
                {Boolean(reporterPhone) && (
                  <TouchableOpacity onPress={handleCopyReporterPhone}>
                    <Text style={styles.reporterCopyLink}>Copy</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.reporterInfoValue} selectable>
                {reporterPhone || "No phone number on file"}
              </Text>
            </View>

            <View style={styles.reporterInfoCard}>
              <Text style={styles.reporterInfoLabel}>Community Reputation</Text>
              <Text style={styles.reporterInfoValue}>
                {residentPoints} EcoPoints · {residentBadges.length} Badges
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 14 }}>
              {Boolean(post.userId) && (
                <TouchableOpacity
                  style={[styles.confirmButton, { minHeight: 44 }]}
                  onPress={() => {
                    setShowReporterModal(false);
                    router.push({
                      pathname: "/admin/assessments/post_view/UserPostDetail",
                      params: { userId: post.userId },
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmButtonText}>View Resident Profile</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowReporterModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POST LOCATION MINI MAP MODAL */}
      <PostLocationModal
        key={
          locationModalVisible
            ? `post-detail-loc-${post?.id}-open`
            : "post-detail-loc-closed"
        }
        post={post}
        initialLocation={post?.locationName}
        initialCoords={post?.coordinates}
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onSelectLocation={handleSaveLocation}
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
  authorHeaderMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
  },
  authorIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  authorIdentityMobile: {
    flex: 0,
    width: "100%",
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
  postedDateMobile: { alignSelf: "flex-start" },
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
  duplicateTag: {
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
  },
  linkedTag: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
  },
  linkedNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
    marginBottom: 10,
    gap: 8,
  },
  linkedNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    fontWeight: "600",
    lineHeight: 16,
  },
  duplicateNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
    marginBottom: 10,
    gap: 8,
  },
  duplicateNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "600",
    lineHeight: 16,
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
  reactionsMobile: {
    width: "100%",
    backgroundColor: "#E4E4E4",
    borderRadius: 5,
    overflow: "hidden",
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
  reactBoxMobile: {
    flex: 1,
    width: "50%",
    borderRightWidth: 1,
    borderRightColor: "#FFFFFF",
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
  commentBoxMobile: {
    flex: 1,
    width: "50%",
    backgroundColor: "transparent",
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
  cleanupModal: {
    width: "100%",
    maxWidth: 440,
  },
  cleanupModalTablet: {
    maxWidth: 680,
    padding: 28,
    borderRadius: 20,
  },
  cleanupModalDesktop: {
    maxWidth: 820,
    padding: 32,
    borderRadius: 22,
  },
  cleanupModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cleanupModalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitleLarge: {
    fontSize: 24,
    marginBottom: 4,
  },
  modalSubtitleLarge: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  cleanupPreviewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  cleanupPreviewRowTablet: {
    gap: 18,
    marginBottom: 16,
  },
  cleanupPreviewRowDesktop: {
    gap: 22,
    marginBottom: 18,
  },
  cleanupPreviewColumn: {
    flex: 1,
    minWidth: 0,
  },
  cleanupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cleanupBadgeBefore: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "#EEF2F6",
  },
  cleanupBadgeTextBefore: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  cleanupBadgeAfter: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "#F1F5F9",
  },
  cleanupBadgeTextAfter: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  cleanupBadgeAfterActive: {
    backgroundColor: "#DCFCE7",
  },
  cleanupBadgeTextAfterActive: {
    color: "#166534",
  },
  cleanupSublabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },
  cleanupImageWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#EEF4F0",
  },
  cleanupImageWrapperTablet: {
    borderRadius: 14,
  },
  cleanupImageWrapperDesktop: {
    borderRadius: 16,
  },
  cleanupPreviewImage: {
    width: "100%",
    height: "100%",
  },
  cleanupZoomOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  cleanupZoomText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  cleanupImagePlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#9BC5A7",
    backgroundColor: "#F4FAF6",
  },
  cleanupImagePlaceholderTablet: {
    borderRadius: 14,
  },
  cleanupImagePlaceholderDesktop: {
    borderRadius: 16,
  },
  cleanupPlaceholderContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  cleanupUploadIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E8F5EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  cleanupUploadIconCircleLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 4,
  },
  cleanupPlaceholderText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "700",
  },
  cleanupPlaceholderTextLarge: {
    fontSize: 14,
    fontWeight: "800",
  },
  cleanupPlaceholderHint: {
    fontSize: 11,
    color: "#68746C",
    textAlign: "center",
    marginTop: 2,
  },
  cleanupLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cleanupActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
    gap: 10,
  },
  replaceCleanupButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#E8F5EC",
  },
  replaceCleanupText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
  },
  removeCleanupButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  removeCleanupText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "800",
  },
  cleanupFooterRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cleanupDoneButton: {
    backgroundColor: "#397A51",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  cleanupDoneButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
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
  volunteerActivityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  volunteerActivityCardMain: {
    padding: 14,
  },
  volunteerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  volunteerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  volunteerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  volunteerStatusDotOngoing: {
    backgroundColor: "#D97706",
  },
  volunteerStatusDotCancelled: {
    backgroundColor: "#DC2626",
  },
  volunteerStatusDotOpen: {
    backgroundColor: "#10B981",
  },
  volunteerStatusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#276344",
  },
  volunteerMemberPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#E8F5EC",
  },
  volunteerMemberPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#276344",
  },
  volunteerActivityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
  },
  volunteerCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  volunteerManageHint: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  cancelCleanupActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    backgroundColor: "#FEF2F2",
    borderTopWidth: 1,
    borderTopColor: "#FECACA",
  },
  cancelCleanupActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  rescheduleCleanupActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    backgroundColor: "#F0FDF4",
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
  },
  rescheduleCleanupActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#276344",
  },
  contactReporterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EAF4ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginTop: 2,
  },
  contactReporterButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#276344",
  },
  rescheduleInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4,
    marginTop: 6,
  },
  rescheduleInput: {
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1E293B",
    marginBottom: 6,
  },
  reporterInfoCard: {
    backgroundColor: "#F8FAF9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reporterInfoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 2,
  },
  reporterInfoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  reporterCopyLink: {
    fontSize: 11,
    fontWeight: "700",
    color: "#276344",
  },
});
