import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
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
  useWindowDimensions,
} from "react-native";

import PostLocationModal from "../../../../components/PostLocationModal";
import { formatLocationWithPurok } from "../../../../constants/locationFormat";
import { auth, db } from "../../../../firebaseConfig";
import { hideBadWords } from "../../../../utils/hideBadWords";
import {
  notifyPostStatusUpdated,
  notifyUserEcoPointsAwarded,
  notifyVolunteersOnActivityCancelled,
  notifyVolunteersOnActivityRevertedToOpen,
  notifyVolunteersOnActivityStarted,
} from "../../../../utils/notificationHelpers";

const getMemberId = (member) =>
  typeof member === "string"
    ? member
    : member?.userId || member?.uid || member?.id || "";

const getMemberName = (member) => {
  if (typeof member === "string") return "Volunteer";

  return (
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
    member?.name ||
    "Volunteer"
  );
};

const initialsFor = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "V";

const DEFAULT_EVENT_REWARD = 8;

export default function VolunteerPostDetail({
  setSelectedVolunteerPost,
  post: suppliedPost,
  setSelectedPost,
}) {
  const { volunteerId } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isCompactMobile = width < 480;
  const mobileImageHeight = Math.min(Math.max(width - 24, 0) * 0.75, 360);

  const [post, setPost] = useState(suppliedPost || null);
  const [imageAspectRatio, setImageAspectRatio] = useState(4 / 3);
  const [loading, setLoading] = useState(!suppliedPost);
  const [loadError, setLoadError] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [actionMember, setActionMember] = useState(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertTargetMember, setRevertTargetMember] = useState(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertingAttendance, setRevertingAttendance] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [kickReason, setKickReason] = useState("");
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState("");
  const [memberProfiles, setMemberProfiles] = useState({});
  const [kickDialog, setKickDialog] = useState(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionSummary, setCompletionSummary] = useState("");
  const [completingActivity, setCompletingActivity] = useState(false);
  const [updatingLock, setUpdatingLock] = useState(false);
  const [startingCleanup, setStartingCleanup] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelProgressModal, setShowCancelProgressModal] = useState(false);
  const [cancelProgressReason, setCancelProgressReason] = useState("");
  const [cancellingProgress, setCancellingProgress] = useState(false);
  const [wasteSacks, setWasteSacks] = useState("");
  const [wasteWeightKg, setWasteWeightKg] = useState("");

  useEffect(() => {
    if (suppliedPost || !volunteerId) return;

    const loadVolunteerPost = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const snapshot = await getDoc(doc(db, "volunteer_posts", volunteerId));

        if (!snapshot.exists()) {
          setLoadError("This volunteer activity is no longer available.");
          return;
        }

        setPost({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        console.error("Unable to load volunteer post:", error);
        setLoadError("Unable to load this volunteer activity.");
      } finally {
        setLoading(false);
      }
    };

    loadVolunteerPost();
  }, [suppliedPost, volunteerId]);

  const members = useMemo(
    () => (Array.isArray(post?.volunteers) ? post.volunteers : []),
    [post],
  );
  const joinedCount = Number.isFinite(Number(post?.joinedCount))
    ? Number(post.joinedCount)
    : members.length;
  const maxVolunteers = post?.maxVolunteers ?? post?.maxParticipants ?? 0;
  const isStandaloneEvent = !post?.postId;
  const isOperationActive = post?.status === "ongoing";
  const standaloneOperationStarted =
    isStandaloneEvent && post?.status === "ongoing";
  const standaloneOperationCompleted =
    isStandaloneEvent && ["completed", "cleaned"].includes(post?.status);
  const eventAttendanceAvailable =
    isOperationActive ||
    standaloneOperationStarted ||
    standaloneOperationCompleted ||
    ["completed", "cleaned"].includes(post?.status);
  const attendedVolunteerIds = Array.isArray(post?.attendedVolunteerIds)
    ? post.attendedVolunteerIds
    : [];
  useEffect(() => {
    const memberIds = members.map(getMemberId).filter(Boolean);
    if (!memberIds.length) {
      return undefined;
    }

    let isCurrent = true;

    Promise.all(
      memberIds.map(async (memberId) => {
        const snapshot = await getDoc(doc(db, "users", memberId));
        return [memberId, snapshot.exists() ? snapshot.data() : null];
      }),
    )
      .then((profiles) => {
        if (!isCurrent) return;
        setMemberProfiles(
          Object.fromEntries(profiles.filter(([, profile]) => profile)),
        );
      })
      .catch((error) =>
        console.error("Unable to load volunteer profiles:", error),
      );

    return () => {
      isCurrent = false;
    };
  }, [members]);

  const goBack = () => {
    if (setSelectedVolunteerPost) {
      setSelectedVolunteerPost(null);
      if (setSelectedPost && post?.postId) setSelectedPost({ id: post.postId });
      return;
    }

    router.back();
  };

  const editVolunteerActivity = () => {
    router.push({
      pathname: "/admin/assessments/post_view/VolunteerPostCreate",
      params: { volunteerId: post.id },
    });
  };

  const deleteVolunteerActivity = () => {
    if (!post?.id || deletingActivity) return;

    setShowDeleteDialog(true);
  };

  const confirmDeleteVolunteerActivity = async () => {
    if (!post?.id || deletingActivity) return;

    setDeletingActivity(true);
    try {
      await runTransaction(db, async (transaction) => {
        const activityRef = doc(db, "volunteer_posts", post.id);
        const activitySnapshot = await transaction.get(activityRef);

        if (!activitySnapshot.exists()) {
          throw new Error("This event no longer exists.");
        }

        const activity = activitySnapshot.data();
        const activityMembers = Array.isArray(activity.volunteers)
          ? activity.volunteers
          : [];
        const activityJoinedCount = Number(activity.joinedCount) || 0;
        const isCompletedStandaloneEvent =
          !activity.postId &&
          ["completed", "cleaned"].includes(
            String(activity.status || "").toLowerCase(),
          );

        if (activity.status !== "open" && !isCompletedStandaloneEvent) {
          throw new Error(
            "Only open or completed standalone events can be deleted.",
          );
        }

        if (
          !isCompletedStandaloneEvent &&
          (activityMembers.length > 0 || activityJoinedCount > 0)
        ) {
          throw new Error("Events with joined volunteers cannot be deleted.");
        }

        transaction.delete(activityRef);
      });
      if (
        isStandaloneEvent &&
        ["completed", "cleaned"].includes(String(post.status || "").toLowerCase())
      ) {
        router.back();
      } else {
        router.replace("/admin/VolunteerList");
      }
    } catch (error) {
      console.error("Unable to delete volunteer activity:", error);
      setShowDeleteDialog(false);
      setKickDialog({
        title: "Unable to delete event",
        message: error.message || "Please try again.",
      });
    } finally {
      setDeletingActivity(false);
    }
  };

  const toggleActivityLock = async () => {
    if (!post?.id || updatingLock) return;

    const nextLocked = !post.isLocked;
    setUpdatingLock(true);
    try {
      await updateDoc(doc(db, "volunteer_posts", post.id), {
        isLocked: nextLocked,
      });
      setPost((currentPost) => ({ ...currentPost, isLocked: nextLocked }));
    } catch (error) {
      console.error("Unable to update activity lock:", error);
      setKickDialog({
        title: "Unable to update activity",
        message: "Please try again.",
      });
    } finally {
      setUpdatingLock(false);
    }
  };

  const startCleanupOperation = async () => {
    if (
      !post?.id ||
      startingCleanup ||
      standaloneOperationStarted ||
      standaloneOperationCompleted
    )
      return;

    setStartingCleanup(true);
    try {
      if (post.postId) {
        await updateDoc(doc(db, "posts", post.postId), { status: "ongoing" });
        await updateDoc(doc(db, "volunteer_posts", post.id), {
          status: "ongoing",
        });
        await notifyPostStatusUpdated({
          postId: post.postId,
          newStatus: "ongoing",
        });
        await notifyVolunteersOnActivityStarted({
          activityId: post.id,
          title: post.title,
          volunteers: post.volunteers,
          ownerId: post.userId || post.ownerId,
          imageUrl: post.imageUrl,
        });
        router.replace({
          pathname: "/admin/assessments/post_view/PostDetail",
          params: { postId: post.postId },
        });
        return;
      }

      await updateDoc(doc(db, "volunteer_posts", post.id), {
        status: "ongoing",
      });
      await notifyVolunteersOnActivityStarted({
        activityId: post.id,
        title: post.title,
        volunteers: post.volunteers,
        ownerId: post.userId || post.ownerId,
        imageUrl: post.imageUrl,
      });
      setPost((currentPost) => ({ ...currentPost, status: "ongoing" }));
      setKickDialog({
        title: "Event started",
        message: "This event is now marked as ongoing and volunteers have been notified.",
      });
    } catch (error) {
      console.error("Unable to start cleanup operation:", error);
      setKickDialog({
        title: "Unable to start cleanup",
        message: "Please try again.",
      });
    } finally {
      setStartingCleanup(false);
    }
  };

  const cancelInProgressEvent = async () => {
    if (!post?.id || !isOperationActive || cancellingProgress) return;

    setCancellingProgress(true);
    try {
      const reason = hideBadWords(cancelProgressReason.trim());

      await updateDoc(doc(db, "volunteer_posts", post.id), {
        status: "cancelled",
        cancellationReason: reason || "Cancelled by LGU administrator",
        cancelledAt: serverTimestamp(),
      });

      if (post.postId) {
        await updateDoc(doc(db, "posts", post.postId), {
          status: "moderate",
        });
        await notifyPostStatusUpdated({
          postId: post.postId,
          newStatus: "moderate",
        });
      }

      await notifyVolunteersOnActivityCancelled({
        activityId: post.id,
        title: post.title,
        reason: reason || "Event was cancelled by LGU administrator.",
        volunteers: post.volunteers,
        ownerId: post.userId || post.ownerId,
        imageUrl: post.imageUrl,
      });

      setPost((currentPost) => ({
        ...currentPost,
        status: "cancelled",
        cancellationReason: reason || "Cancelled by LGU administrator",
      }));
      setShowCancelProgressModal(false);
      setCancelProgressReason("");
      setKickDialog({
        title: "Event cancelled",
        message: "The in-progress event was cancelled and registered volunteers have been notified.",
      });
    } catch (error) {
      console.error("Unable to cancel event in progress:", error);
      setKickDialog({
        title: "Unable to cancel event",
        message: error.message || "Please try again.",
      });
    } finally {
      setCancellingProgress(false);
    }
  };

  const revertInProgressEventToOpen = async () => {
    if (!post?.id || !isOperationActive || cancellingProgress) return;

    setCancellingProgress(true);
    try {
      await updateDoc(doc(db, "volunteer_posts", post.id), {
        status: "open",
        cancellationReason: null,
      });

      if (post.postId) {
        await updateDoc(doc(db, "posts", post.postId), {
          status: "moderate",
        });
        await notifyPostStatusUpdated({
          postId: post.postId,
          newStatus: "moderate",
        });
      }

      await notifyVolunteersOnActivityRevertedToOpen({
        activityId: post.id,
        title: post.title,
        reason: cancelProgressReason?.trim() || "",
        volunteers: post.volunteers,
        ownerId: post.userId || post.ownerId,
        imageUrl: post.imageUrl,
      });

      setPost((currentPost) => ({
        ...currentPost,
        status: "open",
        cancellationReason: null,
      }));
      setShowCancelProgressModal(false);
      setCancelProgressReason("");
      setKickDialog({
        title: "Reverted to Open Registration",
        message:
          "The activity status has been reset to Open. Volunteers can continue joining.",
      });
    } catch (error) {
      console.error("Unable to revert event to open:", error);
      setKickDialog({
        title: "Unable to revert event",
        message: error.message || "Please try again.",
      });
    } finally {
      setCancellingProgress(false);
    }
  };

  const completeStandaloneEvent = async () => {
    if (!post?.id || !standaloneOperationStarted || completingActivity) return;

    setCompletingActivity(true);
    try {
      const summary = hideBadWords(completionSummary.trim());
      const result = await runTransaction(db, async (transaction) => {
        const activityRef = doc(db, "volunteer_posts", post.id);
        const settingsRef = doc(db, "settings", "ecopoints");
        const activitySnapshot = await transaction.get(activityRef);

        if (!activitySnapshot.exists()) {
          throw new Error("This event no longer exists.");
        }

        const activity = activitySnapshot.data();
        if (activity.status === "completed" || activity.status === "cleaned") {
          return {
            alreadyCompleted: true,
            completionSummary: activity.completionSummary || "",
            reward: Number(activity.eventRewardPoints) || 0,
            volunteerCount: 0,
          };
        }
        if (activity.status !== "ongoing") {
          throw new Error("Start the event before marking it as completed.");
        }

        const settingsSnapshot = await transaction.get(settingsRef);
        const configuredReward = settingsSnapshot.exists()
          ? (settingsSnapshot.data().volunteerEvent ?? DEFAULT_EVENT_REWARD)
          : DEFAULT_EVENT_REWARD;
        const reward = Number(configuredReward);
        if (!Number.isInteger(reward) || reward < 1) {
          throw new Error(
            "The Volunteer Event EcoPoints setting must be a positive whole number.",
          );
        }

        const volunteerIds = [
          ...new Set(
            (Array.isArray(activity.volunteers) ? activity.volunteers : [])
              .map(getMemberId)
              .filter(
                (userId) => typeof userId === "string" && userId.length > 0,
              ),
          ),
        ];
        const userDocuments = await Promise.all(
          volunteerIds.map(async (userId) => {
            const userRef = doc(db, "users", userId);
            const userSnapshot = await transaction.get(userRef);
            if (!userSnapshot.exists()) {
              throw new Error(
                "A joined volunteer account could not be found. No points were awarded and the event was not completed.",
              );
            }
            return { userId, userRef, userSnapshot };
          }),
        );

        const attendedIds =
          Array.isArray(activity.attendedVolunteerIds) &&
          activity.attendedVolunteerIds.length > 0
            ? activity.attendedVolunteerIds
            : volunteerIds;

        transaction.update(activityRef, {
          status: "completed",
          completionSummary: summary,
          wasteCollected: {
            sacks: Number(wasteSacks) || 0,
            weightKg: Number(wasteWeightKg) || 0,
          },
          completedAt: serverTimestamp(),
          eventRewardPoints: reward,
          rewardedVolunteerIds: attendedIds,
        });

        const rewardedUserDocs = userDocuments.filter((u) =>
          attendedIds.includes(u.userId),
        );

        rewardedUserDocs.forEach(({ userId, userRef, userSnapshot }) => {
          transaction.update(userRef, {
            points: (Number(userSnapshot.data().points) || 0) + reward,
          });
          transaction.set(
            doc(
              db,
              "point_transactions",
              `${post.id}_${userId}_volunteer_event`,
            ),
            {
              userId,
              amount: reward,
              source: "volunteer_event_reward",
              volunteerPostId: post.id,
              createdAt: serverTimestamp(),
            },
          );
        });

        return {
          alreadyCompleted: false,
          reward,
          volunteerCount: rewardedUserDocs.length,
          rewardedIds: attendedIds,
        };
      });

      setPost((currentPost) => ({
        ...currentPost,
        status: "completed",
        completionSummary: result.alreadyCompleted
          ? result.completionSummary
          : summary,
        eventRewardPoints: result.reward || currentPost.eventRewardPoints,
      }));
      setShowCompletionModal(false);
      setCompletionSummary("");

      if (!result.alreadyCompleted && result.reward) {
        const volunteerIds = Array.isArray(post.volunteers)
          ? post.volunteers.map(getMemberId).filter(Boolean)
          : [];
        volunteerIds.forEach((vId) => {
          notifyUserEcoPointsAwarded({
            userId: vId,
            amount: result.reward,
            source: "volunteer_event_reward",
            title: post.title,
            volunteerPostId: post.id,
          });
        });
      }
      setKickDialog(
        result.alreadyCompleted
          ? {
              title: "Event already completed",
              message: "This event has already been completed.",
            }
          : {
              title: "Event completed",
              message: `${result.volunteerCount} joined ${
                result.volunteerCount === 1
                  ? "volunteer received"
                  : "volunteers received"
              } ${result.reward} EcoPoints each.`,
            },
      );
    } catch (error) {
      console.error("Unable to complete standalone event:", error);
      setKickDialog({
        title: "Unable to complete event",
        message: error.message || "Please try again.",
      });
    } finally {
      setCompletingActivity(false);
    }
  };

  const markVolunteerPresent = async (memberId) => {
    if (!post?.id || !memberId || updatingAttendanceId) return;

    setUpdatingAttendanceId(memberId);
    try {
      let updatedAttendeeIds = [];
      const notificationRef = doc(collection(db, "notifications"));

      await runTransaction(db, async (transaction) => {
        const activityRef = doc(db, "volunteer_posts", post.id);
        const activitySnapshot = await transaction.get(activityRef);
        if (!activitySnapshot.exists()) {
          throw new Error("This event no longer exists.");
        }

        const currentAttendees = Array.isArray(
          activitySnapshot.data().attendedVolunteerIds,
        )
          ? activitySnapshot.data().attendedVolunteerIds
          : [];

        if (currentAttendees.includes(memberId)) {
          updatedAttendeeIds = currentAttendees;
          return;
        }

        updatedAttendeeIds = [...currentAttendees, memberId];

        transaction.update(activityRef, {
          attendedVolunteerIds: updatedAttendeeIds,
        });

        transaction.set(notificationRef, {
          userId: memberId,
          ...(auth.currentUser?.uid ? { actorId: auth.currentUser.uid } : {}),
          actorNames: ["GreenTrace Admin"],
          type: "attendance_marked",
          title: "Attendance Confirmed",
          message: `You were marked Present for "${post.title || "volunteer activity"}".`,
          volunteerPostId: post.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      setPost((currentPost) => ({
        ...currentPost,
        attendedVolunteerIds: updatedAttendeeIds,
      }));
    } catch (error) {
      console.error("Unable to mark volunteer present:", error);
      Alert.alert("Error", "Could not mark volunteer as present.");
    } finally {
      setUpdatingAttendanceId("");
    }
  };

  const confirmRevertAttendance = async () => {
    const memberId = getMemberId(revertTargetMember);
    const reason = revertReason.trim();
    if (!post?.id || !memberId || !reason || revertingAttendance) return;

    setRevertingAttendance(true);
    try {
      let updatedAttendeeIds = [];
      const notificationRef = doc(collection(db, "notifications"));

      await runTransaction(db, async (transaction) => {
        const activityRef = doc(db, "volunteer_posts", post.id);
        const activitySnapshot = await transaction.get(activityRef);
        if (!activitySnapshot.exists()) {
          throw new Error("This event no longer exists.");
        }

        const currentAttendees = Array.isArray(
          activitySnapshot.data().attendedVolunteerIds,
        )
          ? activitySnapshot.data().attendedVolunteerIds
          : [];

        updatedAttendeeIds = currentAttendees.filter((id) => id !== memberId);

        transaction.update(activityRef, {
          attendedVolunteerIds: updatedAttendeeIds,
        });

        transaction.set(notificationRef, {
          userId: memberId,
          ...(auth.currentUser?.uid ? { actorId: auth.currentUser.uid } : {}),
          actorNames: ["GreenTrace Admin"],
          type: "attendance_reverted",
          title: "Attendance Reverted",
          message: `Your attendance status for "${post.title || "volunteer activity"}" was reverted. Reason: ${reason}`,
          volunteerPostId: post.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      setPost((currentPost) => ({
        ...currentPost,
        attendedVolunteerIds: updatedAttendeeIds,
      }));

      setShowRevertModal(false);
      setRevertReason("");
      setRevertTargetMember(null);
    } catch (error) {
      console.error("Unable to revert volunteer attendance:", error);
      Alert.alert("Error", "Could not revert attendance.");
    } finally {
      setRevertingAttendance(false);
    }
  };

  const viewMemberProfile = (member) => {
    const memberId = getMemberId(member);

    if (!memberId) {
      setKickDialog({
        title: "Unable to view profile",
        message: "This volunteer does not have a user ID.",
      });
      return;
    }

    setShowMembers(false);
    setActionMember(null);
    router.push({
      pathname: "/admin/assessments/post_view/UserPostDetail",
      params: { userId: memberId },
    });
  };

  const confirmKick = (member) => {
    const memberId = getMemberId(member);
    const memberName = getMemberName(member);

    if (!memberId) {
      setKickDialog({
        title: "Unable to remove",
        message: "This volunteer does not have a user ID.",
      });
      return;
    }

    setActionMember(null);
    setKickDialog({
      title: "Kick volunteer?",
      message: `Remove ${memberName} from this activity? Please provide a reason. They will be notified.`,
      memberId,
    });
    setKickReason("");
  };

  const confirmKickMember = () => {
    const memberId = kickDialog?.memberId;
    const reason = kickReason.trim();
    if (!memberId || !reason || removingMemberId) return;

    setKickDialog(null);
    setKickReason("");
    kickMember(memberId, reason);
  };

  const kickMember = async (memberId, reason) => {
    if (!post?.id || removingMemberId) return;

    setRemovingMemberId(memberId);
    try {
      const notificationRef = doc(collection(db, "notifications"));
      const removed = await runTransaction(db, async (transaction) => {
        const postRef = doc(db, "volunteer_posts", post.id);
        const snapshot = await transaction.get(postRef);

        if (!snapshot.exists())
          throw new Error("Volunteer post no longer exists.");

        const data = snapshot.data();
        const currentMembers = Array.isArray(data.volunteers)
          ? data.volunteers
          : [];
        const updatedMembers = currentMembers.filter(
          (member) => getMemberId(member) !== memberId,
        );
        const attendedVolunteerIds = Array.isArray(data.attendedVolunteerIds)
          ? data.attendedVolunteerIds
          : [];

        if (updatedMembers.length === currentMembers.length) {
          throw new Error("This volunteer is no longer in the activity.");
        }

        transaction.update(postRef, {
          volunteers: updatedMembers,
          joinedCount: updatedMembers.length,
          attendedVolunteerIds: attendedVolunteerIds.filter(
            (attendedId) => attendedId !== memberId,
          ),
        });
        transaction.set(notificationRef, {
          userId: memberId,
          ...(auth.currentUser?.uid ? { actorId: auth.currentUser.uid } : {}),
          actorNames: ["GreenTrace Admin"],
          type: "volunteer_kicked",
          title: "Removed from volunteer activity",
          message: `You were removed from "${data.title || post.title || "a volunteer activity"}". Reason: ${reason}`,
          volunteerPostId: post.id,
          read: false,
          createdAt: serverTimestamp(),
        });

        return true;
      });

      if (!removed) return;

      setPost((currentPost) => {
        const updatedMembers = (currentPost?.volunteers || []).filter(
          (member) => getMemberId(member) !== memberId,
        );

        return {
          ...currentPost,
          volunteers: updatedMembers,
          joinedCount: updatedMembers.length,
          attendedVolunteerIds: Array.isArray(
            currentPost?.attendedVolunteerIds,
          )
            ? currentPost.attendedVolunteerIds.filter(
                (attendedId) => attendedId !== memberId,
              )
            : [],
        };
      });
      setActionMember(null);
    } catch (error) {
      console.error("Unable to kick volunteer:", error);
      setKickDialog({
        title: "Unable to remove",
        message: error.message || "Please try again.",
      });
    } finally {
      setRemovingMemberId("");
    }
  };

  const formattedDate = post?.meetingDate
    ? (() => {
        if (typeof post.meetingDate?.toDate === "function") {
          return post.meetingDate.toDate().toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
        const parts = String(post.meetingDate).split("-").map(Number);
        if (parts.length === 3 && !parts.some(Number.isNaN)) {
          return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(
            undefined,
            { month: "short", day: "numeric", year: "numeric" },
          );
        }
        return String(post.meetingDate);
      })()
    : "";

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color="#5F9C76" size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>
          {loadError || "Volunteer activity not found."}
        </Text>
        <TouchableOpacity style={styles.backToListButton} onPress={goBack}>
          <Text style={styles.backToListText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isMobile && styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP BAR / ACTIONS */}
        <View
          style={[
            styles.topBar,
            isMobile && styles.topBarMobile,
            isCompactMobile && styles.topBarCompactMobile,
          ]}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBack}
            accessibilityLabel="Go back"
            activeOpacity={0.8}
          >
            <Image
              source={require("../../../../assets/images/backG.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <View
            style={[
              styles.adminActions,
              isMobile && styles.adminActionsMobile,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.lockButton,
                isMobile && styles.lockButtonMobile,
                post.isLocked && styles.lockedButton,
                updatingLock && styles.disabledAction,
              ]}
              onPress={toggleActivityLock}
              disabled={updatingLock}
              accessibilityRole="button"
              accessibilityLabel={
                post.isLocked
                  ? "Unlock volunteer activity"
                  : "Lock volunteer activity"
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name={post.isLocked ? "lock-closed" : "lock-open-outline"}
                size={20}
                color={post.isLocked ? "#fff" : "#276344"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.editButton,
                isMobile && styles.actionButtonMobile,
              ]}
              onPress={editVolunteerActivity}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={19} color="#fff" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                isMobile && styles.actionButtonMobile,
                deletingActivity && styles.disabledAction,
              ]}
              onPress={deleteVolunteerActivity}
              disabled={deletingActivity}
              accessibilityRole="button"
              accessibilityLabel="Delete volunteer event"
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={19} color="#B42318" />
              <Text style={styles.deleteButtonText}>
                {deletingActivity ? "Deleting..." : "Delete"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.row,
            { flexDirection: isMobile ? "column" : "row" },
            isMobile && styles.rowMobile,
          ]}
        >
          {/* LEFT COLUMN: IMAGE, TITLE & DESCRIPTION */}
          <View
            style={[
              styles.leftColumn,
              !isMobile && styles.desktopColumn,
            ]}
          >
            {post.imageUrl ? (
              isMobile ? (
                <View
                  style={[
                    styles.mobileImageFrame,
                    { height: mobileImageHeight },
                  ]}
                >
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <Image
                  source={{ uri: post.imageUrl }}
                  style={[styles.cardImage, { aspectRatio: imageAspectRatio }]}
                  resizeMode="contain"
                  onLoad={({ nativeEvent }) => {
                    const imageWidth =
                      nativeEvent?.source?.width ?? nativeEvent?.width;
                    const imageHeight =
                      nativeEvent?.source?.height ?? nativeEvent?.height;
                    if (imageWidth > 0 && imageHeight > 0) {
                      setImageAspectRatio(imageWidth / imageHeight);
                    }
                  }}
                />
              )
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  isMobile && styles.mobileImageFrame,
                  isMobile
                    ? { height: mobileImageHeight }
                    : { aspectRatio: 4 / 3 },
                ]}
              >
                <Ionicons name="image-outline" size={42} color="#71907d" />
                <Text style={styles.placeholderText}>No image available</Text>
              </View>
            )}

            <View style={styles.eventTitleRow}>
              <Text style={styles.titleText}>
                {hideBadWords(post.title) || "Volunteer activity"}
              </Text>
              {isStandaloneEvent && (
                <View
                  style={[
                    styles.eventStatusBadge,
                    standaloneOperationCompleted
                      ? styles.completedStatusBadge
                      : standaloneOperationStarted
                        ? styles.ongoingStatusBadge
                        : styles.openStatusBadge,
                  ]}
                >
                  <Text style={styles.eventStatusText}>
                    {standaloneOperationCompleted
                      ? "Completed"
                      : standaloneOperationStarted
                        ? "Ongoing"
                        : "Open"}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.descriptionText}>
              {hideBadWords(post.description) || "No description provided."}
            </Text>
            {standaloneOperationCompleted && post.completionSummary ? (
              <View style={styles.completionSummaryBox}>
                <Text style={styles.sectionLabel}>Event summary</Text>
                <Text style={styles.descriptionText}>
                  {hideBadWords(post.completionSummary)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* RIGHT COLUMN: MEMBERS, SCHEDULE, REQUIREMENTS, LOCATION & ACTION */}
          <View
            style={[
              styles.detailsColumn,
              isMobile && styles.detailsColumnMobile,
              !isMobile && styles.desktopColumn,
            ]}
          >
            {/* MEMBERS SUMMARY */}
            <TouchableOpacity
              style={styles.membersSummary}
              onPress={() => setShowMembers(true)}
              accessibilityRole="button"
              accessibilityLabel="View joined volunteers"
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.sectionLabel}>Members</Text>
                <Text style={styles.membersHint}>
                  {eventAttendanceAvailable
                    ? `${attendedVolunteerIds.length} attended · Tap to view`
                    : "Tap to view joined volunteers"}
                </Text>
              </View>
              <View style={styles.countBadge}>
                <Ionicons name="people-outline" size={20} color="#276344" />
                <Text style={styles.countText}>
                  {joinedCount} / {maxVolunteers}
                </Text>
              </View>
            </TouchableOpacity>

            {/* SCHEDULE (DATE & TIME) */}
            {Boolean(formattedDate || post.meetingTime) && (
              <View style={styles.scheduleBox}>
                {Boolean(formattedDate) && (
                  <View style={styles.scheduleRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#276344"
                    />
                    <Text style={styles.scheduleText}>{formattedDate}</Text>
                  </View>
                )}
                {Boolean(post.meetingTime) && (
                  <View style={styles.scheduleRow}>
                    <Ionicons name="time-outline" size={18} color="#276344" />
                    <Text style={styles.scheduleText}>{post.meetingTime}</Text>
                  </View>
                )}
              </View>
            )}

            {/* REQUIREMENTS */}
            <View
              style={[
                styles.requirementBox,
                isMobile && styles.requirementBoxMobile,
              ]}
            >
              <Text style={styles.sectionLabel}>Requirements</Text>
              {isMobile ? (
                <View style={styles.requirementListMobile}>
                  {post.requirements?.length ? (
                    post.requirements.map((item, index) => (
                      <Text
                        key={`${item}-${index}`}
                        style={styles.requirementText}
                      >
                        • {hideBadWords(item)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.mutedText}>
                      No requirements listed.
                    </Text>
                  )}
                </View>
              ) : (
                <ScrollView
                  style={styles.requirementList}
                  contentContainerStyle={styles.requirementListContent}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={Boolean(
                    post.requirements?.length,
                  )}
                >
                  {post.requirements?.length ? (
                    post.requirements.map((item, index) => (
                      <Text
                        key={`${item}-${index}`}
                        style={styles.requirementText}
                      >
                        • {hideBadWords(item)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.mutedText}>
                      No requirements listed.
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>

            {/* LOCATION */}
            <TouchableOpacity
              style={styles.locationBox}
              onPress={() => setShowLocationModal(true)}
              accessibilityRole="button"
              accessibilityLabel="View meetup GPS coordinates"
              activeOpacity={0.8}
            >
              <Ionicons name="location" size={20} color="#276344" />
              <Text style={styles.locationText}>
                {formatLocationWithPurok(post.meetingLocation || post) ||
                  "Location not specified"}
              </Text>
              <Ionicons name="navigate-outline" size={18} color="#276344" />
            </TouchableOpacity>

            {/* START EVENT OR CLEANUP OPERATION */}
            <TouchableOpacity
              style={[
                styles.startCleanupButton,
                (startingCleanup ||
                  isOperationActive ||
                  standaloneOperationCompleted) &&
                  styles.disabledAction,
              ]}
              onPress={startCleanupOperation}
              disabled={
                startingCleanup ||
                isOperationActive ||
                standaloneOperationCompleted
              }
              accessibilityRole="button"
              activeOpacity={0.85}
            >
              {startingCleanup ? (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.startCleanupText}>Starting...</Text>
                </View>
              ) : (
                <>
                  <Ionicons
                    name={
                      isOperationActive || standaloneOperationCompleted
                        ? "checkmark-circle-outline"
                        : "play-circle-outline"
                    }
                    size={21}
                    color="#fff"
                  />
                  <Text style={styles.startCleanupText}>
                    {standaloneOperationCompleted
                      ? "Event completed"
                      : isOperationActive
                        ? isStandaloneEvent
                          ? "Event in progress"
                          : "Operation in progress"
                        : isStandaloneEvent
                          ? "Start Event"
                          : "Start Clean-up Operation"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {isOperationActive && (
              <>
                {isStandaloneEvent ? (
                  <TouchableOpacity
                    style={[
                      styles.completeEventButton,
                      completingActivity && styles.disabledAction,
                    ]}
                    onPress={() => setShowCompletionModal(true)}
                    disabled={completingActivity || cancellingProgress}
                    accessibilityRole="button"
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={20}
                      color="#276344"
                    />
                    <Text style={styles.completeEventText}>Mark event completed</Text>
                  </TouchableOpacity>
                ) : post?.postId ? (
                  <TouchableOpacity
                    style={styles.completeEventButton}
                    onPress={() =>
                      router.replace({
                        pathname: "/admin/assessments/post_view/PostDetail",
                        params: { postId: post.postId },
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#276344"
                    />
                    <Text style={styles.completeEventText}>
                      Go to Report to Mark as Clean
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.cancelProgressButton,
                    cancellingProgress && styles.disabledAction,
                  ]}
                  onPress={() => setShowCancelProgressModal(true)}
                  disabled={completingActivity || cancellingProgress}
                  accessibilityRole="button"
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#B42318"
                  />
                  <Text style={styles.cancelProgressText}>
                    {isStandaloneEvent
                      ? "Cancel event in progress"
                      : "Cancel / Revert cleanup operation"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <PostLocationModal
        post={{
          ...post,
          locationName: post.meetingLocation || post.locationName,
          coordinates: post.meetingCoordinates || post.coordinates,
        }}
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
      />

      {/* MEMBERS MODAL */}
      <Modal
        visible={showMembers}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMembers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.membersModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Joined volunteers</Text>
                <Text style={styles.modalSubtitle}>
                  {joinedCount} of {maxVolunteers} participants · {attendedVolunteerIds.length} present
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMembers(false)}
                accessibilityLabel="Close members"
              >
                <Ionicons name="close" size={26} color="#222" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.membersList}
            >
              {members.length ? (
                members.map((member, index) => {
                  const memberId = getMemberId(member) || `member-${index}`;
                  const attendanceMemberId = getMemberId(member);
                  const isAttended = attendedVolunteerIds.includes(
                    attendanceMemberId,
                  );
                  const displayMember = {
                    ...(memberProfiles[getMemberId(member)] || {}),
                    ...(typeof member === "object"
                      ? member
                      : { userId: member }),
                  };
                  const name = getMemberName(displayMember);
                  const avatarUrl =
                    displayMember.imageUrl ||
                    displayMember.photoURL ||
                    displayMember.profileImage;

                  return (
                    <TouchableOpacity
                      key={memberId}
                      style={styles.memberCard}
                      onPress={() => setActionMember(displayMember)}
                      accessibilityRole="button"
                      accessibilityLabel={`Manage ${name}`}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberRow}>
                        {avatarUrl ? (
                          <Image
                            source={{ uri: avatarUrl }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitials}>
                              {initialsFor(name)}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={styles.memberEmail} numberOfLines={1}>
                            {displayMember.email || "Volunteer"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.attendanceStatusBadge,
                            isAttended
                              ? styles.attendanceStatusBadgePresent
                              : styles.attendanceStatusBadgeRegistered,
                          ]}
                        >
                          <Ionicons
                            name={
                              isAttended
                                ? "checkmark-circle"
                                : "time-outline"
                            }
                            size={13}
                            color={isAttended ? "#15803D" : "#64748B"}
                          />
                          <Text
                            style={[
                              styles.attendanceStatusBadgeText,
                              isAttended
                                ? styles.attendanceStatusBadgeTextPresent
                                : styles.attendanceStatusBadgeTextRegistered,
                            ]}
                          >
                            {isAttended ? "Present" : "Registered"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#94A3B8"
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>
                  No volunteers have joined yet.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MEMBER ACTION MODAL */}
      <Modal
        visible={Boolean(actionMember)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.memberActionModalCard}>
            {/* Header with avatar, name & close */}
            <View style={styles.memberActionHeader}>
              <View style={styles.memberActionUserInfo}>
                {actionMember?.imageUrl ||
                actionMember?.photoURL ||
                actionMember?.profileImage ? (
                  <Image
                    source={{
                      uri:
                        actionMember.imageUrl ||
                        actionMember.photoURL ||
                        actionMember.profileImage,
                    }}
                    style={styles.actionAvatar}
                  />
                ) : (
                  <View style={styles.actionAvatarFallback}>
                    <Text style={styles.actionAvatarInitials}>
                      {initialsFor(getMemberName(actionMember))}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionMemberName} numberOfLines={1}>
                    {getMemberName(actionMember)}
                  </Text>
                  <Text style={styles.actionMemberSubtitle} numberOfLines={1}>
                    {actionMember?.email || "GreenTrace Volunteer"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setActionMember(null)}
                style={styles.actionCloseBtn}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Attendance state banner in the card */}
            <View
              style={[
                styles.attendanceStateBanner,
                attendedVolunteerIds.includes(getMemberId(actionMember))
                  ? styles.attendanceStateBannerPresent
                  : styles.attendanceStateBannerRegistered,
              ]}
            >
              <Ionicons
                name={
                  attendedVolunteerIds.includes(getMemberId(actionMember))
                    ? "checkmark-circle"
                    : "information-circle-outline"
                }
                size={18}
                color={
                  attendedVolunteerIds.includes(getMemberId(actionMember))
                    ? "#15803D"
                    : "#64748B"
                }
              />
              <Text
                style={[
                  styles.attendanceStateBannerText,
                  attendedVolunteerIds.includes(getMemberId(actionMember))
                    ? styles.attendanceStateBannerTextPresent
                    : styles.attendanceStateBannerTextRegistered,
                ]}
              >
                {attendedVolunteerIds.includes(getMemberId(actionMember))
                  ? "Status: Present"
                  : "Status: Not Marked (Registered)"}
              </Text>
            </View>

            {/* User action options: View Profile & Kick */}
            <View style={styles.memberTopActionsRow}>
              <TouchableOpacity
                style={styles.actionProfileBtn}
                onPress={() => viewMemberProfile(actionMember)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={17} color="#276344" />
                <Text style={styles.actionProfileBtnText}>View Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionKickBtn}
                onPress={() => confirmKick(actionMember)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="person-remove-outline"
                  size={17}
                  color="#DC2626"
                />
                <Text style={styles.actionKickBtnText}>Kick</Text>
              </TouchableOpacity>
            </View>

            {/* Attendance Action: Below to that put an attendance button */}
            <View style={styles.attendanceActionSection}>
              <Text style={styles.attendanceSectionLabel}>
                Attendance
              </Text>

              {attendedVolunteerIds.includes(getMemberId(actionMember)) ? (
                <TouchableOpacity
                  style={[
                    styles.presentAttendanceBtn,
                    updatingAttendanceId === getMemberId(actionMember) &&
                      styles.disabledAction,
                  ]}
                  onPress={() => {
                    setRevertTargetMember(actionMember);
                    setRevertReason("");
                    setShowRevertModal(true);
                  }}
                  disabled={updatingAttendanceId === getMemberId(actionMember)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presentAttendanceBtnText}>Present</Text>
                    <Text style={styles.presentAttendanceBtnSubtext}>
                      Tap to revert attendance with a reason
                    </Text>
                  </View>
                  <Ionicons
                    name="arrow-undo-outline"
                    size={18}
                    color="#D1FAE5"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.markPresentBtn,
                    updatingAttendanceId === getMemberId(actionMember) &&
                      styles.disabledAction,
                  ]}
                  onPress={() =>
                    markVolunteerPresent(getMemberId(actionMember))
                  }
                  disabled={updatingAttendanceId === getMemberId(actionMember)}
                  activeOpacity={0.85}
                >
                  {updatingAttendanceId === getMemberId(actionMember) ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.markPresentBtnText}>
                        Mark as Present
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* REVERT ATTENDANCE REASON MODAL */}
      <Modal
        visible={showRevertModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!revertingAttendance) setShowRevertModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal} accessibilityRole="alert">
            <View style={[styles.confirmIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="arrow-undo-outline" size={26} color="#D97706" />
            </View>
            <Text style={styles.confirmTitle}>Revert Attendance?</Text>
            <Text style={styles.confirmMessage}>
              Revert present status for{" "}
              {getMemberName(revertTargetMember) || "this volunteer"}? Please
              state the reason. They will be notified.
            </Text>
            <TextInput
              value={revertReason}
              onChangeText={setRevertReason}
              placeholder="Reason for reverting (e.g. Left early, Marked by mistake)..."
              placeholderTextColor="#8C9E93"
              multiline
              maxLength={500}
              editable={!revertingAttendance}
              style={styles.kickReasonInput}
              textAlignVertical="top"
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={revertingAttendance}
                onPress={() => {
                  setShowRevertModal(false);
                  setRevertReason("");
                  setRevertTargetMember(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmKickButton,
                  { backgroundColor: "#D97706" },
                  (!revertReason.trim() || revertingAttendance) &&
                    styles.disabledAction,
                ]}
                disabled={!revertReason.trim() || revertingAttendance}
                onPress={confirmRevertAttendance}
              >
                {revertingAttendance ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.confirmKickText}>Reverting...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmKickText}>Confirm Revert</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* COMPLETE EVENT MODAL */}
      <Modal
        visible={showCompletionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!completingActivity) setShowCompletionModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.completionIcon}>
              <Ionicons
                name="checkmark-done-outline"
                size={27}
                color="#276344"
              />
            </View>
            <Text style={styles.confirmTitle}>Complete this event?</Text>
            <Text style={styles.confirmMessage}>
              You can add an optional summary of the event outcome.
            </Text>
            <TextInput
              value={completionSummary}
              onChangeText={setCompletionSummary}
              placeholder="Event summary (optional)"
              placeholderTextColor="#8C9E93"
              multiline
              maxLength={500}
              editable={!completingActivity}
              style={styles.completionSummaryInput}
              textAlignVertical="top"
            />
            <View style={styles.wasteMetricsInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wasteMetricsInputLabel}>Sacks Collected</Text>
                <TextInput
                  value={wasteSacks}
                  onChangeText={setWasteSacks}
                  placeholder="e.g. 10"
                  placeholderTextColor="#8C9E93"
                  keyboardType="numeric"
                  editable={!completingActivity}
                  style={styles.wasteMetricInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wasteMetricsInputLabel}>Est. Weight (kg)</Text>
                <TextInput
                  value={wasteWeightKg}
                  onChangeText={setWasteWeightKg}
                  placeholder="e.g. 50"
                  placeholderTextColor="#8C9E93"
                  keyboardType="numeric"
                  editable={!completingActivity}
                  style={styles.wasteMetricInput}
                />
              </View>
            </View>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCompletionModal(false)}
                disabled={completingActivity}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.completeEventConfirmButton,
                  completingActivity && styles.disabledButton,
                ]}
                onPress={completeStandaloneEvent}
                disabled={completingActivity}
              >
                {completingActivity ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.completeEventConfirmText}>
                    Complete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE DIALOG */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingActivity) setShowDeleteDialog(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal} accessibilityRole="alert">
            <View style={styles.confirmIcon}>
              <Ionicons name="warning-outline" size={28} color="#B42318" />
            </View>
            <Text style={styles.confirmTitle}>Delete this event?</Text>
            <Text style={styles.confirmMessage}>
              {post.postId
                ? "This cannot be undone. The original waste report will remain, but this volunteer event will be removed."
                : standaloneOperationCompleted
                  ? "This cannot be undone. The completed event will be removed. EcoPoints already earned by volunteers will remain."
                  : "This cannot be undone. This volunteer event will be permanently removed."}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteDialog(false)}
                disabled={deletingActivity}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmKickButton,
                  deletingActivity && styles.disabledButton,
                ]}
                onPress={confirmDeleteVolunteerActivity}
                disabled={deletingActivity}
              >
                {deletingActivity ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmKickText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmKickText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CANCEL IN-PROGRESS EVENT MODAL */}
      <Modal
        visible={showCancelProgressModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancellingProgress) setShowCancelProgressModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal} accessibilityRole="alert">
            <View style={[styles.confirmIcon, { backgroundColor: "#FDE8E8" }]}>
              <Ionicons name="close-circle-outline" size={28} color="#B42318" />
            </View>
            <Text style={styles.confirmTitle}>
              {isStandaloneEvent
                ? "Cancel or Revert Event?"
                : "Cancel or Revert Cleanup Drive?"}
            </Text>
            <Text style={styles.confirmMessage}>
              You can revert the activity back to Open Registration (so volunteers can still join) or cancel it permanently.
            </Text>
            <TextInput
              style={styles.completionSummaryInput}
              placeholder="Reason for cancellation or update (e.g. Hazardous weather, Rescheduled)..."
              placeholderTextColor="#8FA396"
              value={cancelProgressReason}
              onChangeText={setCancelProgressReason}
              multiline
              numberOfLines={3}
            />
            <View style={[styles.confirmActions, { flexDirection: "column", gap: 8 }]}>
              <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
                <TouchableOpacity
                  style={[styles.cancelButton, { flex: 1 }]}
                  onPress={() => setShowCancelProgressModal(false)}
                  disabled={cancellingProgress}
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
                    cancellingProgress && styles.disabledButton,
                  ]}
                  onPress={revertInProgressEventToOpen}
                  disabled={cancellingProgress}
                >
                  <Text style={[styles.cancelButtonText, { color: "#276344" }]}>
                    Revert to Open
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.confirmKickButton,
                  { backgroundColor: "#B42318", width: "100%" },
                  cancellingProgress && styles.disabledButton,
                ]}
                onPress={cancelInProgressEvent}
                disabled={cancellingProgress}
              >
                {cancellingProgress ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmKickText}>Updating...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmKickText}>Cancel Permanently</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KICK DIALOG */}
      <Modal
        visible={Boolean(kickDialog)}
        transparent
        animationType="fade"
        onRequestClose={() => setKickDialog(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal} accessibilityRole="alert">
            <View style={styles.confirmIcon}>
              <Ionicons
                name={
                  kickDialog?.memberId
                    ? "person-remove-outline"
                    : kickDialog?.title === "Event started"
                      ? "checkmark-circle-outline"
                      : "alert-circle-outline"
                }
                size={28}
                color={
                  kickDialog?.title === "Event started"
                    ? "#276344"
                    : "#bf3030"
                }
              />
            </View>
            <Text style={styles.confirmTitle}>{kickDialog?.title}</Text>
            <Text style={styles.confirmMessage}>{kickDialog?.message}</Text>
            {kickDialog?.memberId && (
              <TextInput
                value={kickReason}
                onChangeText={setKickReason}
                placeholder="Reason for removing this volunteer"
                placeholderTextColor="#8C9E93"
                multiline
                maxLength={500}
                editable={!removingMemberId}
                style={styles.kickReasonInput}
                textAlignVertical="top"
              />
            )}
            <View style={styles.confirmActions}>
              {kickDialog?.memberId ? (
                <>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    disabled={Boolean(removingMemberId)}
                    onPress={() => {
                      setKickDialog(null);
                      setKickReason("");
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmKickButton,
                      (!kickReason.trim() || removingMemberId) &&
                        styles.disabledAction,
                    ]}
                    disabled={!kickReason.trim() || Boolean(removingMemberId)}
                    onPress={confirmKickMember}
                  >
                    <Text style={styles.confirmKickText}>
                      {removingMemberId ? "Removing..." : "Kick"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.okButton}
                  onPress={() => setKickDialog(null)}
                >
                  <Text style={styles.okButtonText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5" },
  content: { padding: 20, gap: 20 },
  contentMobile: { padding: 12, gap: 12 },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  stateText: { fontSize: 16, textAlign: "center", color: "#4d5e53" },
  backToListButton: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backToListText: { color: "#fff", fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarMobile: {
    justifyContent: "flex-start",
    gap: 10,
  },
  topBarCompactMobile: { alignItems: "center", flexWrap: "wrap" },
  backBtn: { alignSelf: "flex-start" },
  backIcon: { width: 45, height: 45 },
  adminActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  adminActionsMobile: { gap: 6 },
  lockButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5F9C76",
    backgroundColor: "#e6f0e9",
    alignItems: "center",
    justifyContent: "center",
  },
  lockButtonMobile: { width: 38, height: 38 },
  lockedButton: { backgroundColor: "#bf3030", borderColor: "#bf3030" },
  disabledAction: { opacity: 0.6 },
  disabledButton: { opacity: 0.7 },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#5F9C76",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
  },
  actionButtonMobile: { gap: 4, paddingHorizontal: 10, paddingVertical: 9 },
  editButtonText: { color: "#fff", fontWeight: "700" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F2B8B5",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
  },
  deleteButtonText: { color: "#B42318", fontWeight: "700" },
  row: { gap: 24 },
  rowMobile: { gap: 12 },
  leftColumn: { gap: 12 },
  detailsColumn: { gap: 14 },
  desktopColumn: { flex: 1 },
  detailsColumnMobile: { gap: 10 },
  cardImage: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#dfe8e2",
  },
  mobileImageFrame: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#dfe8e2",
    overflow: "hidden",
  },
  imagePlaceholder: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#dfe8e2",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderText: { color: "#577061" },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: "700",
    color: "#172119",
  },
  eventStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  openStatusBadge: { backgroundColor: "#EAF4ED" },
  ongoingStatusBadge: { backgroundColor: "#FFF4D6" },
  completedStatusBadge: { backgroundColor: "#E5ECE7" },
  eventStatusText: { color: "#276344", fontSize: 12, fontWeight: "700" },
  completionSummaryBox: {
    padding: 12,
    gap: 6,
    borderRadius: 10,
    backgroundColor: "#F4F8F5",
    borderWidth: 1,
    borderColor: "#DCE8DF",
  },
  descriptionText: { color: "#3f4c43", lineHeight: 20 },
  membersSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e5ece7",
    padding: 14,
    borderRadius: 10,
    gap: 12,
  },
  requirementBoxMobile: { padding: 12 },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: "#1d2b21" },
  membersHint: { marginTop: 3, color: "#63756a", fontSize: 12 },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
  },
  countText: { fontWeight: "700", color: "#276344" },
  scheduleBox: {
    backgroundColor: "#e0e3e1",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scheduleText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    color: "#243129",
    fontWeight: "600",
  },
  requirementBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
  },
  requirementList: {
    height: 180,
    flexGrow: 0,
    marginTop: 8,
  },
  requirementListContent: {
    gap: 5,
    paddingBottom: 2,
  },
  requirementListMobile: {
    marginTop: 8,
    gap: 3,
  },
  requirementText: { color: "#304036" },
  mutedText: { color: "#728078" },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e0e3e1",
    padding: 13,
    borderRadius: 8,
  },
  locationText: { color: "#243129", flex: 1, fontSize: 14 },
  startCleanupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#276344",
    padding: 14,
    borderRadius: 8,
  },
  startCleanupText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  completeEventButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: "#B9D2C1",
    borderRadius: 8,
    backgroundColor: "#F1F7F3",
  },
  completeEventText: { color: "#276344", fontWeight: "700", fontSize: 14 },
  cancelProgressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: "#F2B8B5",
    borderRadius: 8,
    backgroundColor: "#FDECEC",
  },
  cancelProgressText: { color: "#B42318", fontWeight: "700", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  membersModal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 21, fontWeight: "700", color: "#172119" },
  modalSubtitle: { marginTop: 3, color: "#63756a" },
  membersList: { gap: 10 },
  memberCard: {
    borderWidth: 1,
    borderColor: "#e2e8e3",
    borderRadius: 10,
    overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#fff", fontWeight: "700" },
  memberName: { fontWeight: "700", color: "#1d2b21", fontSize: 14 },
  memberEmail: { color: "#64748B", fontSize: 12, marginTop: 2 },
  attendanceStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  attendanceStatusBadgePresent: {
    backgroundColor: "#DCFCE7",
  },
  attendanceStatusBadgeRegistered: {
    backgroundColor: "#F1F5F9",
  },
  attendanceStatusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  attendanceStatusBadgeTextPresent: {
    color: "#15803D",
  },
  attendanceStatusBadgeTextRegistered: {
    color: "#64748B",
  },
  emptyText: { color: "#728078", textAlign: "center", paddingVertical: 24 },
  confirmModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  completionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EAF4ED",
    alignItems: "center",
    justifyContent: "center",
  },
  completionSummaryInput: {
    width: "100%",
    minHeight: 100,
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
    color: "#24352A",
    backgroundColor: "#FBFDFC",
  },
  confirmTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
    color: "#172119",
    textAlign: "center",
  },
  confirmMessage: {
    marginTop: 8,
    color: "#63756a",
    lineHeight: 20,
    textAlign: "center",
  },
  kickReasonInput: {
    width: "100%",
    minHeight: 90,
    maxHeight: 150,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 10,
    backgroundColor: "#F8FAF9",
    color: "#1F2937",
    fontSize: 13,
  },
  confirmActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#edf1ee",
  },
  cancelButtonText: { color: "#304036", fontWeight: "700" },
  confirmKickButton: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#bf3030",
  },
  confirmKickText: { color: "#fff", fontWeight: "700" },
  completeEventConfirmButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#276344",
  },
  completeEventConfirmText: { color: "#fff", fontWeight: "700" },
  okButton: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
  },
  okButtonText: { color: "#fff", fontWeight: "700" },

  /* MEMBER ACTION & ATTENDANCE MODAL STYLES */
  memberActionModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  memberActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberActionUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  actionAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  actionAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#276344",
    alignItems: "center",
    justifyContent: "center",
  },
  actionAvatarInitials: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  actionMemberName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  actionMemberSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  actionCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  attendanceStateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  attendanceStateBannerPresent: {
    backgroundColor: "#DCFCE7",
  },
  attendanceStateBannerRegistered: {
    backgroundColor: "#F1F5F9",
  },
  attendanceStateBannerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  attendanceStateBannerTextPresent: {
    color: "#15803D",
  },
  attendanceStateBannerTextRegistered: {
    color: "#475569",
  },
  memberTopActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionProfileBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E8F5EC",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  actionProfileBtnText: {
    color: "#276344",
    fontWeight: "700",
    fontSize: 13,
  },
  actionKickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  actionKickBtnText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
  attendanceActionSection: {
    marginTop: 4,
    gap: 8,
  },
  attendanceSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  markPresentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#276344",
    paddingVertical: 13,
    borderRadius: 10,
    shadowColor: "#276344",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  markPresentBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  presentAttendanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#15803D",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#166534",
  },
  presentAttendanceBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  presentAttendanceBtnSubtext: {
    color: "#DCFCE7",
    fontSize: 11,
    marginTop: 1,
  },

  /* WASTE METRICS INPUTS IN COMPLETE MODAL */
  wasteMetricsInputsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    width: "100%",
  },
  wasteMetricsInputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  wasteMetricInput: {
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FAFCFB",
    fontSize: 13,
    color: "#1F2937",
  },
});
