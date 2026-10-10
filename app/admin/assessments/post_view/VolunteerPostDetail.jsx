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
import { auth, db } from "../../../../firebaseConfig";
import { hideBadWords } from "../../../../utils/hideBadWords";
import { notifyPostStatusUpdated } from "../../../../utils/notificationHelpers";

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
  const [selectedMember, setSelectedMember] = useState(null);
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
    [post?.volunteers],
  );
  const joinedCount = Number.isFinite(Number(post?.joinedCount))
    ? Number(post.joinedCount)
    : members.length;
  const maxVolunteers = post?.maxVolunteers ?? post?.maxParticipants ?? 0;
  const isStandaloneEvent = !post?.postId;
  const standaloneOperationStarted =
    isStandaloneEvent && post?.status === "ongoing";
  const standaloneOperationCompleted =
    isStandaloneEvent && ["completed", "cleaned"].includes(post?.status);
  const eventAttendanceAvailable =
    standaloneOperationStarted || standaloneOperationCompleted;
  const attendedVolunteerIds = Array.isArray(post?.attendedVolunteerIds)
    ? post.attendedVolunteerIds
    : [];
  useEffect(() => {
    const memberIds = members.map(getMemberId).filter(Boolean);
    if (!memberIds.length) {
      setMemberProfiles({});
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
        await notifyPostStatusUpdated({
          postId: post.postId,
          newStatus: "ongoing",
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
      setPost((currentPost) => ({ ...currentPost, status: "ongoing" }));
      setKickDialog({
        title: "Event started",
        message: "This event is now marked as ongoing.",
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

        transaction.update(activityRef, {
          status: "completed",
          completionSummary: summary,
          completedAt: serverTimestamp(),
          eventRewardPoints: reward,
          rewardedVolunteerIds: volunteerIds,
        });

        userDocuments.forEach(({ userId, userRef, userSnapshot }) => {
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
          volunteerCount: userDocuments.length,
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

  const toggleVolunteerAttendance = async (memberId) => {
    if (!post?.id || !isStandaloneEvent || !memberId || updatingAttendanceId)
      return;

    setUpdatingAttendanceId(memberId);
    try {
      let updatedAttendeeIds = [];
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
        const nextAttendees = currentAttendees.includes(memberId)
          ? currentAttendees.filter((id) => id !== memberId)
          : [...currentAttendees, memberId];
        updatedAttendeeIds = nextAttendees;

        transaction.update(activityRef, {
          attendedVolunteerIds: nextAttendees,
        });
      });

      setPost((currentPost) => {
        return {
          ...currentPost,
          attendedVolunteerIds: updatedAttendeeIds,
        };
      });
    } catch (error) {
      console.error("Unable to update event attendance:", error);
      setKickDialog({
        title: "Unable to update attendance",
        message: "Please try again.",
      });
    } finally {
      setUpdatingAttendanceId("");
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
      setSelectedMember(null);
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
                {post.meetingLocation ||
                  post.locationName ||
                  "Location not specified"}
              </Text>
              <Ionicons name="navigate-outline" size={18} color="#276344" />
            </TouchableOpacity>

            {/* START EVENT OR CLEANUP OPERATION */}
            <TouchableOpacity
              style={[
                styles.startCleanupButton,
                (startingCleanup ||
                  standaloneOperationStarted ||
                  standaloneOperationCompleted) &&
                  styles.disabledAction,
              ]}
              onPress={startCleanupOperation}
              disabled={
                startingCleanup ||
                standaloneOperationStarted ||
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
                      standaloneOperationStarted ||
                      standaloneOperationCompleted
                        ? "checkmark-circle-outline"
                        : "play-circle-outline"
                    }
                    size={21}
                    color="#fff"
                  />
                  <Text style={styles.startCleanupText}>
                    {standaloneOperationCompleted
                      ? "Event completed"
                      : standaloneOperationStarted
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
            {standaloneOperationStarted && (
              <TouchableOpacity
                style={[
                  styles.completeEventButton,
                  completingActivity && styles.disabledAction,
                ]}
                onPress={() => setShowCompletionModal(true)}
                disabled={completingActivity}
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
                  {joinedCount} of {maxVolunteers} participants
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
                  const isSelected = selectedMember === memberId;
                  const avatarUrl =
                    displayMember.imageUrl ||
                    displayMember.photoURL ||
                    displayMember.profileImage;

                  return (
                    <View key={memberId} style={styles.memberCard}>
                      <TouchableOpacity
                        style={styles.memberRow}
                        onPress={() =>
                          setSelectedMember(isSelected ? null : memberId)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Show actions for ${name}`}
                        activeOpacity={0.7}
                      >
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
                        <Text style={styles.memberName}>{name}</Text>
                        <Ionicons
                          name={isSelected ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#5f6f65"
                        />
                      </TouchableOpacity>

                      {isSelected && (
                        <View style={styles.memberActions}>
                          <TouchableOpacity
                            style={styles.viewProfileButton}
                            onPress={() => viewMemberProfile(displayMember)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="person-outline"
                              size={18}
                              color="#276344"
                            />
                            <Text style={styles.viewProfileText}>
                              View profile
                            </Text>
                          </TouchableOpacity>
                          {eventAttendanceAvailable && (
                            <TouchableOpacity
                              style={[
                                styles.attendanceButton,
                                isAttended && styles.attendedButton,
                                updatingAttendanceId === attendanceMemberId &&
                                  styles.disabledAction,
                              ]}
                              onPress={() =>
                                toggleVolunteerAttendance(attendanceMemberId)
                              }
                              disabled={
                                !attendanceMemberId ||
                                Boolean(updatingAttendanceId)
                              }
                              accessibilityRole="button"
                              accessibilityLabel={
                                isAttended
                                  ? `Mark ${name} as not attended`
                                  : `Mark ${name} as attended`
                              }
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={
                                  isAttended
                                    ? "checkmark-circle"
                                    : "checkmark-circle-outline"
                                }
                                size={18}
                                color={isAttended ? "#FFFFFF" : "#276344"}
                              />
                              <Text
                                style={[
                                  styles.attendanceText,
                                  isAttended && styles.attendedText,
                                ]}
                              >
                                {updatingAttendanceId === attendanceMemberId
                                  ? "Saving..."
                                  : isAttended
                                    ? "Attended"
                                    : "Mark attended"}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.kickButton}
                            disabled={removingMemberId === getMemberId(member)}
                            onPress={() => confirmKick(displayMember)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="person-remove-outline"
                              size={18}
                              color="#bf3030"
                            />
                            <Text style={styles.kickText}>
                              {removingMemberId === getMemberId(member)
                                ? "Removing..."
                                : "Kick"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
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
  memberName: { flex: 1, fontWeight: "600", color: "#1d2b21" },
  memberActions: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8e3",
    padding: 10,
    backgroundColor: "#f8faf8",
  },
  viewProfileButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#e6f0e9",
  },
  viewProfileText: { color: "#276344", fontWeight: "600" },
  kickButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#fff0f0",
  },
  kickText: { color: "#bf3030", fontWeight: "600" },
  attendanceButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    padding: 10,
    borderRadius: 7,
    backgroundColor: "#e6f0e9",
  },
  attendedButton: { backgroundColor: "#5F9C76" },
  attendanceText: {
    color: "#276344",
    fontWeight: "600",
    textAlign: "center",
  },
  attendedText: { color: "#FFFFFF" },
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
});
