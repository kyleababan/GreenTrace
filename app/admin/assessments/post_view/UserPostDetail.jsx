import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
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

import { formatLocationWithPurok } from "../../../../constants/locationFormat";
import { db } from "../../../../firebaseConfig";
import { deleteUserRelatedDocuments } from "../../../../utils/deletePostHelper";
import { hideBadWords } from "../../../../utils/hideBadWords";

const getFullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unnamed user";

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

const getMemberId = (member) =>
  typeof member === "string"
    ? member
    : member?.userId || member?.uid || member?.id || "";

const formatPointSource = (entry) => {
  if (entry.title) return entry.title;
  switch (entry.source) {
    case "admin_award":
      return "Awarded by Administrator";
    case "volunteer_event_reward":
      return "Volunteer Event Reward";
    case "linked_cleanup_reward":
      return "Linked Report Cleaned EcoPoints";
    case "cleanup_reward":
    case "post_cleaned":
      return "Report Cleaned EcoPoints";
    default:
      return "EcoPoints Transaction";
  }
};

const getLogTimestamp = (entry) => {
  const ts = entry.changedAt || entry.createdAt;
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (typeof ts === "string" || typeof ts === "number") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
};

const getChangeLabel = (field) =>
  ({
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
  })[field] || field;

const formatChangeTime = (timestamp) => {
  if (!timestamp) return "Time unavailable";
  let date;
  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  if (Number.isNaN(date.getTime())) return "Time unavailable";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getLogIcon = (entry) => {
  if (entry.type === "points") return "gift-outline";
  if (entry.subType === "attendance_marked")
    return "checkmark-done-circle-outline";
  if (entry.subType === "attendance_reverted")
    return "alert-circle-outline";
  if (entry.subType === "activity_rescheduled") return "time-outline";
  if (entry.subType === "activity_cancelled") return "close-circle-outline";
  if (
    entry.type === "volunteering_kicked" ||
    entry.subType === "volunteer_kicked"
  )
    return "person-remove-outline";
  if (entry.type === "volunteering")
    return entry.isAttended ? "checkmark-circle-outline" : "people-outline";
  if (entry.subType === "deleted_post" || entry.field === "report_moderated")
    return "trash-outline";
  if (entry.subType === "account_warning") return "warning-outline";
  if (entry.field === "account_unban" || entry.violationType === "admin_unban")
    return "shield-checkmark-outline";
  if (entry.field === "account_ban" || entry.violationType === "admin_ban")
    return "ban-outline";
  if (entry.type === "violation") return "alert-circle-outline";
  if (entry.type === "comment") return "chatbubble-ellipses-outline";
  if (entry.subType === "status_update") return "alert-circle-outline";
  return "document-text-outline";
};

const getLogIconBg = (entry) => {
  if (entry.type === "points") return "#E68A00";
  if (entry.subType === "attendance_marked") return "#2E7D32";
  if (entry.subType === "attendance_reverted") return "#D97706";
  if (entry.subType === "activity_rescheduled") return "#2563EB";
  if (entry.subType === "activity_cancelled") return "#D92D20";
  if (
    entry.type === "volunteering_kicked" ||
    entry.subType === "volunteer_kicked"
  )
    return "#B42318";
  if (entry.type === "volunteering")
    return entry.isAttended ? "#2E7D32" : "#2563EB";
  if (entry.subType === "deleted_post" || entry.subType === "account_warning")
    return "#B42318";
  if (entry.field === "account_unban" || entry.violationType === "admin_unban")
    return "#2E7D32";
  if (entry.field === "account_ban" || entry.violationType === "admin_ban")
    return "#B42318";
  if (entry.type === "violation") return "#B42318";
  if (entry.type === "comment") return "#5F9C76";
  if (entry.subType === "status_update") return "#F59E0B";
  return "#64748B";
};

export default function UserPostDetail() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 700;
  const ContentWrapper = isMobile ? ScrollView : View;
  const mobileActivityHeight = Math.max(height, 600);
  const contentWrapperProps = isMobile
    ? {
        contentContainerStyle: styles.mobileContent,
        showsVerticalScrollIndicator: false,
      }
    : {};
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [visibleReportCount, setVisibleReportCount] = useState(6);
  const [changeLogs, setChangeLogs] = useState([]);
  const [visibleLogCount, setVisibleLogCount] = useState(6);
  const [activeLogSubTab, setActiveLogSubTab] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState("");
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [activeActivityTab, setActiveActivityTab] = useState("reports");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showUnbanModal, setShowUnbanModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [banningUser, setBanningUser] = useState(false);
  const [unbanningUser, setUnbanningUser] = useState(false);
  const visiblePosts = posts.slice(0, visibleReportCount);

  const filteredChangeLogs = useMemo(() => {
    let result = changeLogs;

    // Filter by subtab category
    if (activeLogSubTab === "points") {
      result = result.filter((log) => log.type === "points");
    } else if (activeLogSubTab === "violations") {
      result = result.filter(
        (log) =>
          log.type === "violation" ||
          log.type === "moderation" ||
          log.subType === "deleted_post" ||
          log.subType === "account_warning" ||
          log.type === "volunteering_kicked" ||
          log.subType === "volunteer_kicked",
      );
    } else if (activeLogSubTab === "volunteering") {
      result = result.filter(
        (log) =>
          log.type === "volunteering" ||
          log.type === "volunteering_kicked" ||
          log.subType === "volunteer_kicked" ||
          log.subType === "attendance_marked" ||
          log.subType === "attendance_reverted" ||
          log.subType === "activity_rescheduled" ||
          log.subType === "activity_cancelled",
      );
    } else if (activeLogSubTab === "comments") {
      result = result.filter(
        (log) =>
          log.type === "comment" ||
          log.type === "profile" ||
          log.subType === "status_update",
      );
    }

    // Filter by keyword search
    const queryTerm = logSearch.trim().toLowerCase();
    if (queryTerm) {
      result = result.filter((log) => {
        const text = [
          log.title,
          log.message,
          log.reason,
          log.actionTaken,
          log.postCaption,
          log.comment,
          log.locationName,
          log.field,
          log.oldValue,
          log.newValue,
          log.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(queryTerm);
      });
    }

    return result;
  }, [changeLogs, activeLogSubTab, logSearch]);

  const logCounts = useMemo(() => {
    let points = 0;
    let violations = 0;
    let volunteering = 0;
    let comments = 0;

    for (const log of changeLogs) {
      if (log.type === "points") points++;
      if (
        log.type === "violation" ||
        log.type === "moderation" ||
        log.subType === "deleted_post" ||
        log.subType === "account_warning" ||
        log.type === "volunteering_kicked" ||
        log.subType === "volunteer_kicked"
      ) {
        violations++;
      }
      if (
        log.type === "volunteering" ||
        log.type === "volunteering_kicked" ||
        log.subType === "volunteer_kicked" ||
        log.subType === "attendance_marked" ||
        log.subType === "attendance_reverted" ||
        log.subType === "activity_rescheduled" ||
        log.subType === "activity_cancelled"
      ) {
        volunteering++;
      }
      if (
        log.type === "comment" ||
        log.type === "profile" ||
        log.subType === "status_update"
      ) {
        comments++;
      }
    }

    return {
      all: changeLogs.length,
      points,
      violations,
      volunteering,
      comments,
    };
  }, [changeLogs]);

  const visibleChangeLogs = filteredChangeLogs.slice(0, visibleLogCount);

  const handleSubTabChange = (subTab) => {
    setActiveLogSubTab(subTab);
    setVisibleLogCount(6);
  };

  const openCommentLog = (entry) => {
    router.push({
      pathname: "/admin/situtation_assessment",
      params: {
        status: ["critical", "moderate", "ongoing", "cleaned"].includes(
          String(entry.postStatus || "").toLowerCase(),
        )
          ? String(entry.postStatus).toLowerCase()
          : "critical",
        postId: entry.postId,
        commentId: entry.id,
        from: "user_logs",
      },
    });
  };

  const openVolunteerLog = (entry) => {
    const volId = entry.volunteerPostId || entry.id;
    if (!volId) return;
    router.push({
      pathname: "/admin/assessments/post_view/VolunteerPostDetail",
      params: { volunteerId: volId },
    });
  };

  const openPostLog = (postId) => {
    if (!postId) return;
    router.push({
      pathname: "/admin/assessments/post_view/PostDetail",
      params: { postId },
    });
  };

  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const userSnapshot = await getDoc(doc(db, "users", userId));
        if (!userSnapshot.exists()) {
          setLoadError("This user is no longer available.");
          return;
        }

        const postsSnapshot = await getDocs(
          query(collection(db, "posts"), where("userId", "==", userId)),
        );

        const userPosts = postsSnapshot.docs.map((post) => ({
          id: post.id,
          ...post.data(),
        }));
        userPosts.sort(
          (firstPost, secondPost) =>
            (secondPost.createdAt?.seconds || 0) -
            (firstPost.createdAt?.seconds || 0),
        );

        setUser({ id: userSnapshot.id, ...userSnapshot.data() });
        setPosts(userPosts);
      } catch (error) {
        console.error("Unable to load user details:", error);
        setLoadError("Unable to load this user.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) loadUserData();
  }, [userId]);

  useEffect(() => {
    let isActive = true;

    const loadChangeLogs = async () => {
      if (!userId) return;

      setLogsLoading(true);
      setLogsError("");
      try {
        const [
          subcollectionLogsSnapshot,
          commentsSnapshot,
          userDocSnapshot,
          pointTransactionsSnapshot,
          notificationsSnapshot,
          volunteerPostsSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "users", userId, "changeLogs")),
          getDocs(
            query(collection(db, "comments"), where("userId", "==", userId)),
          ),
          getDoc(doc(db, "users", userId)),
          getDocs(
            query(
              collection(db, "point_transactions"),
              where("userId", "==", userId),
            ),
          ),
          getDocs(
            query(
              collection(db, "notifications"),
              where("userId", "==", userId),
            ),
          ),
          getDocs(collection(db, "volunteer_posts")),
        ]);

        const comments = commentsSnapshot.docs.map((comment) => ({
          id: comment.id,
          ...comment.data(),
        }));
        const relatedPostIds = [
          ...new Set(comments.map((comment) => comment.postId).filter(Boolean)),
        ];
        const postSnapshots = await Promise.all(
          relatedPostIds.map((postId) => getDoc(doc(db, "posts", postId))),
        );
        const relatedPosts = new Map(
          postSnapshots
            .filter((postSnapshot) => postSnapshot.exists())
            .map((postSnapshot) => [
              postSnapshot.id,
              { id: postSnapshot.id, ...postSnapshot.data() },
            ]),
        );
        const commentLogs = comments.map((comment) => {
          const post = relatedPosts.get(comment.postId);
          return {
            ...comment,
            type: "comment",
            createdAt: comment.createdAt,
            postCaption: post?.caption || "Waste report",
            postStatus: post?.status || "pending",
            postExists: Boolean(post),
          };
        });

        const subcollectionLogs = subcollectionLogsSnapshot.docs.map((entry) => {
          const data = entry.data();
          const logType =
            data.type ||
            (data.violationType ||
            String(data.field || "").includes("violation") ||
            String(data.field || "").includes("ban")
              ? "violation"
              : "profile");
          return {
            id: entry.id,
            ...data,
            type: logType,
          };
        });

        // 1. EcoPoints transaction logs
        const pointLogs = pointTransactionsSnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            type: "points",
            amount: Number(data.amount) || 0,
            source: data.source || "admin_award",
            title: data.title || "",
            reason: data.reason || "",
            volunteerPostId: data.volunteerPostId || "",
            postId: data.postId || "",
            createdAt: data.createdAt || null,
            changedAt: data.createdAt || null,
          };
        });

        // 2. Volunteering history & attendance logs
        const volunteeringLogs = volunteerPostsSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((vPost) => {
            const members = Array.isArray(vPost.volunteers)
              ? vPost.volunteers
              : [];
            return members.some((m) => getMemberId(m) === userId);
          })
          .map((vPost) => {
            const isAttended =
              Array.isArray(vPost.attendedVolunteerIds) &&
              vPost.attendedVolunteerIds.includes(userId);
            return {
              id: vPost.id,
              type: "volunteering",
              title: vPost.title || "Volunteer Activity",
              locationName: vPost.locationName || vPost.address || "",
              status: vPost.status || "open",
              meetingDate: vPost.meetingDate || "",
              rewardPoints: Number(vPost.eventRewardPoints) || 0,
              isAttended,
              isStandalone: !vPost.postId,
              createdAt: vPost.createdAt || vPost.updatedAt || null,
              changedAt: vPost.createdAt || vPost.updatedAt || null,
            };
          });

        // 3. Official notification timeline events (moderated reports, kicks, attendance, updates)
        const notificationEvents = notificationsSnapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const nType = data.type;
            const rawMsg = data.message || "";
            const extractedReason = data.reason
              ? data.reason
              : rawMsg.includes("Reason: ")
              ? rawMsg.split("Reason: ")[1]
              : "";

            if (nType === "deleted_post") {
              return {
                id: docSnap.id,
                type: "violation",
                subType: "deleted_post",
                field: "report_moderated",
                title: data.title || "Waste Report Removed",
                message: rawMsg || "Report removed by LGU moderation.",
                reason: extractedReason || "Guideline violation",
                actionTaken: "Report Deleted by LGU Administrator",
                source: "content_moderation",
                postId: data.postId || "",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "volunteer_kicked") {
              return {
                id: docSnap.id,
                type: "volunteering_kicked",
                subType: "volunteer_kicked",
                field: "volunteer_kicked",
                title: data.title || "Removed from Volunteer Activity",
                message: rawMsg,
                reason: extractedReason || "Removed by administrator",
                actionTaken: "Removed from Volunteer Activity",
                source: "admin_action",
                volunteerPostId: data.volunteerPostId || "",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "attendance_marked") {
              return {
                id: docSnap.id,
                type: "volunteering",
                subType: "attendance_marked",
                title: data.title || "Attendance Confirmed",
                message: rawMsg || "Marked Present for volunteer activity.",
                actionTaken: "Marked Present",
                source: "lgu_attendance",
                volunteerPostId: data.volunteerPostId || "",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "attendance_reverted") {
              return {
                id: docSnap.id,
                type: "volunteering",
                subType: "attendance_reverted",
                title: data.title || "Attendance Reverted",
                message: rawMsg,
                reason: extractedReason || "Attendance status reverted",
                actionTaken: "Attendance Reverted",
                source: "lgu_attendance",
                volunteerPostId: data.volunteerPostId || "",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "activity_rescheduled") {
              return {
                id: docSnap.id,
                type: "volunteering",
                subType: "activity_rescheduled",
                title: data.title || "Activity Rescheduled",
                message: rawMsg,
                source: "activity_update",
                volunteerPostId: data.volunteerPostId || "",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "activity_cancelled") {
              return {
                id: docSnap.id,
                type: "volunteering",
                subType: "activity_cancelled",
                title: data.title || "Activity Cancelled",
                message: rawMsg,
                reason: extractedReason,
                source: "activity_update",
                volunteerPostId: data.volunteerPostId || "",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "account_warning") {
              return {
                id: docSnap.id,
                type: "violation",
                subType: "account_warning",
                title: data.title || "Official Account Warning",
                message: rawMsg || "Warning issued by LGU.",
                reason: extractedReason || rawMsg,
                actionTaken: "Official Warning Issued",
                source: "admin_action",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            if (nType === "status_update") {
              return {
                id: docSnap.id,
                type: "comment",
                subType: "status_update",
                title: data.title || "Report Status Updated",
                message: rawMsg,
                postId: data.postId || "",
                source: "report_update",
                changedAt: data.createdAt || null,
                createdAt: data.createdAt || null,
              };
            }

            return null;
          })
          .filter(Boolean);

        // Check if there are user-level warnings/bans without changeLogs records (legacy or pre-existing)
        const targetUserData = userDocSnapshot.exists()
          ? userDocSnapshot.data()
          : {};
        const fallbackLogs = [];
        const existingWarnings = targetUserData.nsfwWarnings || 0;
        const hasNsfwLog = subcollectionLogs.some(
          (l) => l.violationType === "nsfw" || l.field === "nsfw_violation",
        );

        if (!hasNsfwLog && existingWarnings > 0) {
          for (let i = 1; i <= existingWarnings; i++) {
            fallbackLogs.push({
              id: `legacy-warning-${i}`,
              type: "violation",
              field: "nsfw_violation",
              violationType: "nsfw",
              warningNumber: i,
              maxWarnings: 3,
              reason:
                targetUserData.banReason ||
                "Uploaded inappropriate/NSFW content detected by AI moderation.",
              actionTaken:
                i >= 3
                  ? "Account Banned (Reached 3 Warnings)"
                  : `Warning ${i} of 3 issued`,
              source: "content_moderation",
              changedAt:
                targetUserData.bannedAt ||
                targetUserData.updatedAt ||
                targetUserData.createdAt ||
                null,
              isLegacy: true,
            });
          }
        }

        const hasBanLog = subcollectionLogs.some(
          (l) =>
            l.field === "account_ban" ||
            (l.violationType === "nsfw" && l.warningNumber >= 3),
        );
        if (!hasBanLog && targetUserData.isBanned && existingWarnings === 0) {
          fallbackLogs.push({
            id: `legacy-ban`,
            type: "violation",
            field: "account_ban",
            violationType: "admin_ban",
            reason:
              targetUserData.banReason ||
              "Account suspended by Administrator.",
            actionTaken: "Account Banned by Admin",
            source: "admin_action",
            changedAt:
              targetUserData.bannedAt ||
              targetUserData.updatedAt ||
              targetUserData.createdAt ||
              null,
            isLegacy: true,
          });
        }

        const allLogs = [
          ...subcollectionLogs,
          ...fallbackLogs,
          ...commentLogs,
          ...pointLogs,
          ...volunteeringLogs,
          ...notificationEvents,
        ];
        const sortedLogs = allLogs.sort(
          (first, second) => getLogTimestamp(second) - getLogTimestamp(first),
        );
        if (isActive) {
          setChangeLogs(sortedLogs);
        }
      } catch (error) {
        console.error("Unable to load reporter change logs:", error);
        if (isActive) {
          setLogsError("Unable to load this user's profile change logs.");
        }
      } finally {
        if (isActive) setLogsLoading(false);
      }
    };

    loadChangeLogs();
    return () => {
      isActive = false;
    };
  }, [userId, logsRefreshKey]);

  const addPoints = async () => {
    const amount = Number(pointsToAdd);
    if (!Number.isInteger(amount) || amount < 1) {
      Alert.alert("Invalid points", "Enter a whole number greater than zero.");
      return;
    }

    setAddingPoints(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.id), { points: increment(amount) });
      batch.set(doc(collection(db, "point_transactions")), {
        userId: user.id,
        amount,
        source: "admin_award",
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      setUser((currentUser) => ({
        ...currentUser,
        points: (Number(currentUser.points) || 0) + amount,
      }));
      setPointsToAdd("");
      setShowPointsModal(false);
      setLogsRefreshKey((k) => k + 1);
    } catch (error) {
      console.error("Unable to add points:", error);
      Alert.alert("Unable to add points", "Please try again.");
    } finally {
      setAddingPoints(false);
    }
  };

  const openBanModal = () => {
    setBanReason(user?.banReason || "");
    setShowBanModal(true);
  };

  const banUser = async () => {
    const reason = banReason.trim();
    if (!reason || banningUser) return;

    setBanningUser(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        isBanned: true,
        banReason: reason,
        bannedAt: serverTimestamp(),
      });
      try {
        await addDoc(collection(db, "users", user.id, "changeLogs"), {
          type: "violation",
          field: "account_ban",
          violationType: "admin_ban",
          reason: reason,
          actionTaken: "Account Banned by Admin",
          source: "admin_action",
          changedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (logErr) {
        console.warn("Could not write ban log:", logErr);
      }
      setUser((currentUser) => ({
        ...currentUser,
        isBanned: true,
        banReason: reason,
      }));
      setShowBanModal(false);
      setLogsRefreshKey((k) => k + 1);
    } catch (error) {
      console.error("Unable to ban user:", error);
    } finally {
      setBanningUser(false);
    }
  };

  const unbanUser = async () => {
    if (unbanningUser) return;

    setUnbanningUser(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        isBanned: false,
        banReason: "",
        nsfwWarnings: 0,
        unbannedAt: serverTimestamp(),
      });
      try {
        await addDoc(collection(db, "users", user.id, "changeLogs"), {
          type: "violation",
          field: "account_unban",
          violationType: "admin_unban",
          reason: "Account unbanned and warning counter reset.",
          actionTaken: "Account Unbanned by Admin",
          source: "admin_action",
          changedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (logErr) {
        console.warn("Could not write unban log:", logErr);
      }
      setUser((currentUser) => ({
        ...currentUser,
        isBanned: false,
        banReason: "",
        nsfwWarnings: 0,
      }));
      setShowUnbanModal(false);
      setLogsRefreshKey((k) => k + 1);
    } catch (error) {
      console.error("Unable to unban user:", error);
      Alert.alert("Error", "Unable to unban user. Please try again.");
    } finally {
      setUnbanningUser(false);
    }
  };

  const deleteUserAccount = async () => {
    if (deletingUser) return;

    setDeletingUser(true);
    try {
      await deleteUserRelatedDocuments(user.id);
      setShowDeleteModal(false);
      router.replace("/admin/UserList");
    } catch (error) {
      console.error("Unable to delete user account data:", error);
      setDeletingUser(false);
    }
  };

  if (loading)
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color="#5F9C76" />
      </View>
    );

  if (!user) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>{loadError || "User not found."}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = getFullName(user);

  return (
    <View style={[styles.page, isMobile && styles.pageMobile]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>User information</Text>
      </View>

      <ContentWrapper
        style={[
          styles.content,
          { flexDirection: isMobile ? "column" : "row" },
          isMobile && styles.mobileContentWrapper,
        ]}
        {...contentWrapperProps}
      >
        <View style={[styles.userPanel, isMobile && styles.mobileUserPanel]}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>{getInitials(name)}</Text>
          </View>
          <View style={styles.pointsRow}>
            <Text style={styles.pointsValue}>
              {Number(user.points) || 0} pts
            </Text>
            <TouchableOpacity
              style={styles.addPointsButton}
              onPress={() => setShowPointsModal(true)}
              accessibilityLabel="Add eco points"
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userDetail}>
            {user.email || "No email address"}
          </Text>
          <Text style={styles.userDetail}>
            {user.cellNumber || "No phone number"}
          </Text>
          {user.birthDate ? (
            <Text style={styles.userDetail}>Birth date: {user.birthDate}</Text>
          ) : null}
          {user.isBanned ? (
            <View style={styles.bannedContainer}>
              <Text style={styles.bannedBadge}>Banned</Text>
              {Boolean(user.banReason) && (
                <Text style={styles.banReasonText}>
                  Reason: {user.banReason}
                </Text>
              )}
            </View>
          ) : user.nsfwWarnings ? (
            <Text style={styles.warningBadge}>
              Warnings: {user.nsfwWarnings} / 3
            </Text>
          ) : null}

          <View style={styles.accountActions}>
            {user.isBanned ? (
              <TouchableOpacity
                style={styles.unbanButton}
                onPress={() => setShowUnbanModal(true)}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color="#2e7d32"
                />
                <Text style={styles.unbanButtonText}>Unban</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.banButton} onPress={openBanModal}>
                <Ionicons name="ban-outline" size={17} color="#9a5b00" />
                <Text style={styles.banButtonText}>Ban</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setShowDeleteModal(true)}
            >
              <Ionicons name="trash-outline" size={17} color="#bf3030" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.postsPanel,
            isMobile && {
              flex: 0,
              flexShrink: 0,
              height: mobileActivityHeight,
              minHeight: mobileActivityHeight,
              width: "100%",
            },
          ]}
        >
          <View style={styles.activityTabs}>
            <TouchableOpacity
              style={[
                styles.activityTab,
                activeActivityTab === "reports" && styles.activityTabActive,
              ]}
              onPress={() => setActiveActivityTab("reports")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeActivityTab === "reports" }}
            >
              <Text
                style={[
                  styles.activityTabText,
                  activeActivityTab === "reports" &&
                    styles.activityTabTextActive,
                ]}
              >
                Reports ({posts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.activityTab,
                activeActivityTab === "logs" && styles.activityTabActive,
              ]}
              onPress={() => setActiveActivityTab("logs")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeActivityTab === "logs" }}
            >
              <Text
                style={[
                  styles.activityTabText,
                  activeActivityTab === "logs" && styles.activityTabTextActive,
                ]}
              >
                Logs ({changeLogs.length})
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>
            {activeActivityTab === "reports"
              ? `${name}'s reports`
              : `${name}'s activity & violation logs`}
          </Text>
          {activeActivityTab === "logs" && (
            <View style={styles.logControlsWrapper}>
              {/* Search Bar for Filtering Logs */}
              <View style={styles.logSearchBox}>
                <Ionicons name="search" size={15} color="#5F9C76" />
                <TextInput
                  placeholder="Filter logs by keyword, reason, activity..."
                  placeholderTextColor="#8FA396"
                  style={styles.logSearchInput}
                  value={logSearch}
                  onChangeText={(text) => {
                    setLogSearch(text);
                    setVisibleLogCount(6);
                  }}
                />
                {logSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setLogSearch("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#8FA396" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Subtabs Horizontal Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.logSubTabsScroll}
                contentContainerStyle={styles.logSubTabs}
              >
                <TouchableOpacity
                  style={[
                    styles.logSubTab,
                    activeLogSubTab === "all" && styles.logSubTabActive,
                  ]}
                  onPress={() => handleSubTabChange("all")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="layers-outline"
                    size={13}
                    color={activeLogSubTab === "all" ? "#FFFFFF" : "#526E5F"}
                  />
                  <Text
                    style={[
                      styles.logSubTabText,
                      activeLogSubTab === "all" && styles.logSubTabTextActive,
                    ]}
                  >
                    All ({logCounts.all})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.logSubTab,
                    activeLogSubTab === "volunteering" &&
                      styles.logSubTabActive,
                  ]}
                  onPress={() => handleSubTabChange("volunteering")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="people-outline"
                    size={13}
                    color={
                      activeLogSubTab === "volunteering"
                        ? "#FFFFFF"
                        : "#526E5F"
                    }
                  />
                  <Text
                    style={[
                      styles.logSubTabText,
                      activeLogSubTab === "volunteering" &&
                        styles.logSubTabTextActive,
                    ]}
                  >
                    Volunteering ({logCounts.volunteering})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.logSubTab,
                    activeLogSubTab === "points" && styles.logSubTabActive,
                  ]}
                  onPress={() => handleSubTabChange("points")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="gift-outline"
                    size={13}
                    color={activeLogSubTab === "points" ? "#FFFFFF" : "#526E5F"}
                  />
                  <Text
                    style={[
                      styles.logSubTabText,
                      activeLogSubTab === "points" && styles.logSubTabTextActive,
                    ]}
                  >
                    EcoPoints ({logCounts.points})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.logSubTab,
                    activeLogSubTab === "violations" &&
                      styles.logSubTabActive,
                  ]}
                  onPress={() => handleSubTabChange("violations")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="shield-outline"
                    size={13}
                    color={
                      activeLogSubTab === "violations" ? "#FFFFFF" : "#526E5F"
                    }
                  />
                  <Text
                    style={[
                      styles.logSubTabText,
                      activeLogSubTab === "violations" &&
                        styles.logSubTabTextActive,
                    ]}
                  >
                    Violations ({logCounts.violations})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.logSubTab,
                    activeLogSubTab === "comments" && styles.logSubTabActive,
                  ]}
                  onPress={() => handleSubTabChange("comments")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={13}
                    color={
                      activeLogSubTab === "comments" ? "#FFFFFF" : "#526E5F"
                    }
                  />
                  <Text
                    style={[
                      styles.logSubTabText,
                      activeLogSubTab === "comments" &&
                        styles.logSubTabTextActive,
                    ]}
                  >
                    Comments & Updates ({logCounts.comments})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
          {activeActivityTab === "reports" ? (
            <ScrollView
              style={styles.reportsScroll}
              contentContainerStyle={styles.postList}
              showsVerticalScrollIndicator
            >
              {posts.length ? (
                visiblePosts.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={[styles.postCard, isMobile && styles.mobilePostCard]}
                    onPress={() =>
                      router.push({
                        pathname: "/admin/assessments/post_view/PostDetail",
                        params: { postId: post.id },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View report: ${hideBadWords(post.caption) || "Waste report"}`}
                  >
                    <View style={styles.postCopy}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {hideBadWords(post.caption) || "Waste report"}
                      </Text>
                      <Text style={styles.postLocation} numberOfLines={2}>
                        {formatLocationWithPurok(post) || "Location not specified"}
                      </Text>
                      <Text style={styles.postStatus}>
                        {post.status || "pending"}
                      </Text>
                    </View>
                    {post.imageUrl ? (
                      <Image
                        source={{ uri: post.imageUrl }}
                        style={styles.postImage}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={25}
                          color="#71907d"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  This user has not submitted any reports.
                </Text>
              )}
              {visibleReportCount < posts.length ? (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() =>
                    setVisibleReportCount((count) =>
                      Math.min(count + 6, posts.length),
                    )
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.loadMoreButtonText}>
                    Load 6 more reports
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.reportsScroll}
              contentContainerStyle={styles.changeLogList}
              showsVerticalScrollIndicator
            >
              {logsLoading ? (
                <ActivityIndicator size="small" color="#5F9C76" />
              ) : logsError ? (
                <Text style={styles.logError}>{logsError}</Text>
              ) : filteredChangeLogs.length ? (
                visibleChangeLogs.map((entry, index) => {
                  const isClickable =
                    (entry.type === "comment" && entry.postExists) ||
                    Boolean(entry.volunteerPostId) ||
                    (entry.type === "volunteering" && Boolean(entry.id)) ||
                    (entry.subType === "status_update" && Boolean(entry.postId));

                  const iconName = getLogIcon(entry);
                  const iconBg = getLogIconBg(entry);

                  let displayTitle = entry.title || "Activity Log";
                  let displayMessage = entry.message || "";
                  let badgeText = "";
                  let badgeStyle = styles.logPillDefault;
                  let badgeTextStyle = styles.logPillTextDefault;

                  if (entry.type === "points") {
                    displayTitle =
                      entry.amount >= 0
                        ? "EcoPoints Awarded"
                        : "EcoPoints Deducted";
                    badgeText =
                      entry.amount >= 0
                        ? `+${entry.amount} pts`
                        : `${entry.amount} pts`;
                    badgeStyle = styles.logPillPoints;
                    badgeTextStyle = styles.logPillTextPoints;
                    displayMessage =
                      formatPointSource(entry) +
                      (entry.reason ? ` · Note: ${entry.reason}` : "");
                  } else if (entry.subType === "attendance_marked") {
                    badgeText = "Present";
                    badgeStyle = styles.logPillPresent;
                    badgeTextStyle = styles.logPillTextPresent;
                  } else if (entry.subType === "attendance_reverted") {
                    badgeText = "Reverted";
                    badgeStyle = styles.logPillReverted;
                    badgeTextStyle = styles.logPillTextReverted;
                  } else if (entry.subType === "activity_rescheduled") {
                    badgeText = "Rescheduled";
                    badgeStyle = styles.logPillInfo;
                    badgeTextStyle = styles.logPillTextInfo;
                  } else if (entry.subType === "activity_cancelled") {
                    badgeText = "Cancelled";
                    badgeStyle = styles.logPillDanger;
                    badgeTextStyle = styles.logPillTextDanger;
                  } else if (
                    entry.type === "volunteering_kicked" ||
                    entry.subType === "volunteer_kicked"
                  ) {
                    badgeText = "Removed";
                    badgeStyle = styles.logPillDanger;
                    badgeTextStyle = styles.logPillTextDanger;
                  } else if (entry.type === "volunteering") {
                    badgeText = entry.isAttended ? "Attended" : "Registered";
                    badgeStyle = entry.isAttended
                      ? styles.logPillPresent
                      : styles.logPillInfo;
                    badgeTextStyle = entry.isAttended
                      ? styles.logPillTextPresent
                      : styles.logPillTextInfo;
                    displayMessage =
                      [
                        entry.meetingDate && `Schedule: ${entry.meetingDate}`,
                        entry.locationName &&
                          `Location: ${
                            formatLocationWithPurok(entry) || entry.locationName
                          }`,
                        entry.rewardPoints > 0 &&
                          `Reward: +${entry.rewardPoints} EcoPoints`,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                      entry.status ||
                      "Joined volunteer activity";
                  } else if (entry.subType === "deleted_post") {
                    badgeText = "Moderated";
                    badgeStyle = styles.logPillDanger;
                    badgeTextStyle = styles.logPillTextDanger;
                  } else if (entry.subType === "account_warning") {
                    badgeText = "Warning";
                    badgeStyle = styles.logPillWarning;
                    badgeTextStyle = styles.logPillTextWarning;
                  } else if (
                    entry.field === "account_unban" ||
                    entry.violationType === "admin_unban"
                  ) {
                    badgeText = "Restored";
                    badgeStyle = styles.logPillPresent;
                    badgeTextStyle = styles.logPillTextPresent;
                  } else if (
                    entry.field === "account_ban" ||
                    entry.violationType === "admin_ban"
                  ) {
                    badgeText = "Banned";
                    badgeStyle = styles.logPillDanger;
                    badgeTextStyle = styles.logPillTextDanger;
                  } else if (entry.violationType === "nsfw") {
                    badgeText = entry.warningNumber
                      ? `Warning ${entry.warningNumber}/3`
                      : "Violation";
                    badgeStyle = styles.logPillWarning;
                    badgeTextStyle = styles.logPillTextWarning;
                  } else if (entry.type === "comment") {
                    displayTitle = "Comment on Report";
                    badgeText = "Comment";
                    badgeStyle = styles.logPillComment;
                    badgeTextStyle = styles.logPillTextComment;
                    displayMessage = `"${entry.comment || ""}" on "${
                      entry.postCaption || "Waste report"
                    }"`;
                  } else if (entry.subType === "status_update") {
                    badgeText = "Status";
                    badgeStyle = styles.logPillWarning;
                    badgeTextStyle = styles.logPillTextWarning;
                  } else if (entry.field) {
                    displayTitle = `${getChangeLabel(entry.field)} Updated`;
                    badgeText = "Profile";
                    badgeStyle = styles.logPillDefault;
                    badgeTextStyle = styles.logPillTextDefault;
                    displayMessage = `From: ${
                      entry.oldValue || "Not set"
                    } → To: ${entry.newValue || "Not set"}`;
                  }

                  return (
                    <TouchableOpacity
                      key={`${entry.type}-${entry.id}-${index}`}
                      style={[
                        styles.logCard,
                        isClickable && styles.logCardClickable,
                      ]}
                      onPress={() => {
                        if (
                          entry.volunteerPostId ||
                          (entry.type === "volunteering" && entry.id)
                        ) {
                          openVolunteerLog(entry);
                        } else if (entry.type === "comment" && entry.postExists) {
                          openCommentLog(entry);
                        } else if (entry.postId) {
                          openPostLog(entry.postId);
                        }
                      }}
                      disabled={!isClickable}
                      activeOpacity={0.75}
                      accessibilityRole={isClickable ? "button" : undefined}
                      accessibilityLabel={`${displayTitle}: ${displayMessage}`}
                    >
                      <View
                        style={[
                          styles.logIconWrapper,
                          { backgroundColor: iconBg },
                        ]}
                      >
                        <Ionicons name={iconName} size={19} color="#FFFFFF" />
                      </View>

                      <View style={styles.logTextContainer}>
                        <View style={styles.logTitleRow}>
                          <Text style={styles.logItemTitle} numberOfLines={1}>
                            {displayTitle}
                          </Text>
                          {Boolean(badgeText) && (
                            <View style={[styles.logPill, badgeStyle]}>
                              <Text
                                style={[styles.logPillText, badgeTextStyle]}
                              >
                                {badgeText}
                              </Text>
                            </View>
                          )}
                        </View>

                        {Boolean(displayMessage) && (
                          <Text style={styles.logItemMessage} numberOfLines={2}>
                            {hideBadWords(displayMessage)}
                          </Text>
                        )}

                        <View style={styles.logFooterRow}>
                          <Text style={styles.logTimeText}>
                            {formatChangeTime(
                              entry.changedAt || entry.createdAt,
                            )}
                          </Text>
                          {isClickable && (
                            <View style={styles.logViewLink}>
                              <Text style={styles.logViewLinkText}>View</Text>
                              <Ionicons
                                name="chevron-forward"
                                size={12}
                                color="#276344"
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyLogsContainer}>
                  <Ionicons
                    name="file-tray-outline"
                    size={38}
                    color="#9CA3AF"
                  />
                  <Text style={styles.emptyText}>
                    {logSearch.trim()
                      ? `No logs match "${logSearch.trim()}".`
                      : activeLogSubTab === "points"
                      ? "No EcoPoints transactions recorded for this user."
                      : activeLogSubTab === "violations"
                      ? "No violations or disciplinary actions on record."
                      : activeLogSubTab === "volunteering"
                      ? "No volunteering activities recorded for this user."
                      : activeLogSubTab === "comments"
                      ? "No comments or report updates on record."
                      : "No activity, violations, or profile changes have been logged yet."}
                  </Text>
                </View>
              )}
              {!logsLoading &&
              !logsError &&
              visibleLogCount < filteredChangeLogs.length ? (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() =>
                    setVisibleLogCount((count) =>
                      Math.min(count + 6, filteredChangeLogs.length),
                    )
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.loadMoreButtonText}>Load 6 more logs</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </View>
      </ContentWrapper>

      <Modal
        visible={showPointsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPointsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add eco points</Text>
            <Text style={styles.modalText}>
              Enter the number of points to add for {name}.
            </Text>
            <TextInput
              placeholder="Points"
              keyboardType="numeric"
              value={pointsToAdd}
              onChangeText={(value) =>
                setPointsToAdd(value.replace(/[^0-9]/g, ""))
              }
              style={styles.pointsInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPointsModal(false)}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  addingPoints && styles.disabledButton,
                ]}
                disabled={addingPoints}
                onPress={addPoints}
              >
                {addingPoints ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmButtonText}>Adding...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Add points</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal} accessibilityRole="alert">
            <View style={styles.dangerIcon}>
              <Ionicons name="warning-outline" size={28} color="#bf3030" />
            </View>
            <Text style={[styles.modalTitle, styles.centerText]}>
              Delete user account?
            </Text>
            <Text style={[styles.modalText, styles.centerText]}>
              Caution: Deleting this account will permanently remove its data.
              Are you sure?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
                disabled={deletingUser}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dangerConfirmButton,
                  deletingUser && styles.disabledButton,
                ]}
                onPress={deleteUserAccount}
                disabled={deletingUser}
              >
                {deletingUser ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmButtonText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Ban {name}</Text>
            <Text style={styles.modalText}>
              Enter the reason this user is being banned.
            </Text>
            <TextInput
              value={banReason}
              onChangeText={setBanReason}
              placeholder="Ban reason"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={styles.reasonInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowBanModal(false)}
                disabled={banningUser}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.banConfirmButton,
                  (!banReason.trim() || banningUser) && styles.disabledButton,
                ]}
                onPress={banUser}
                disabled={!banReason.trim() || banningUser}
              >
                {banningUser ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmButtonText}>Banning...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Ban user</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUnbanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnbanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal} accessibilityRole="alert">
            <View style={styles.unbanIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={28}
                color="#2e7d32"
              />
            </View>
            <Text style={[styles.modalTitle, styles.centerText]}>
              Unban {name}?
            </Text>
            <Text style={[styles.modalText, styles.centerText]}>
              This will unban the account and reset their warning count to 0.
              The user will regain full access to sign in and post reports.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowUnbanModal(false)}
                disabled={unbanningUser}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unbanConfirmButton,
                  unbanningUser && styles.disabledButton,
                ]}
                onPress={unbanUser}
                disabled={unbanningUser}
              >
                {unbanningUser ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmButtonText}>Unbanning...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmButtonText}>Unban user</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5", padding: 20 },
  pageMobile: { padding: 12 },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  stateText: { color: "#5d6b61", textAlign: "center" },
  backButton: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: { color: "#fff", fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  backIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { fontSize: 22, fontWeight: "700", color: "#1d2b21" },
  content: { flex: 1, minHeight: 0, gap: 20 },
  mobileContentWrapper: { minHeight: 0 },
  mobileContent: {
    flexGrow: 0,
    gap: 12,
    paddingBottom: 12,
  },
  userPanel: {
    width: 250,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  mobileUserPanel: { width: "100%" },
  profileAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitials: { color: "#fff", fontSize: 30, fontWeight: "700" },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  pointsValue: { color: "#287650", fontSize: 17, fontWeight: "700" },
  addPointsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 21,
    fontWeight: "700",
    color: "#1d2b21",
    marginTop: 8,
    textAlign: "center",
  },
  userDetail: {
    color: "#4d5d52",
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },
  bannedContainer: {
    marginTop: 10,
    alignItems: "center",
    width: "100%",
  },
  banReasonText: {
    marginTop: 4,
    fontSize: 11,
    color: "#9c2525",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  warningBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    color: "#d97706",
    backgroundColor: "#fffbeb",
    fontWeight: "700",
    fontSize: 12,
  },
  bannedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    color: "#9c2525",
    backgroundColor: "#fff0f0",
    fontWeight: "700",
    fontSize: 12,
  },
  accountActions: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  banButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "#fff5df",
  },
  banButtonText: { color: "#9a5b00", fontWeight: "700" },
  unbanButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "#e8f5e9",
  },
  unbanButtonText: { color: "#2e7d32", fontWeight: "700" },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: "#fff0f0",
  },
  deleteButtonText: { color: "#bf3030", fontWeight: "700" },
  postsPanel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    overflow: "hidden",
  },
  activityTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8e3",
  },
  activityTab: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activityTabActive: {
    borderBottomColor: "#5F9C76",
  },
  activityTabText: {
    color: "#63756a",
    fontSize: 13,
    fontWeight: "600",
  },
  activityTabTextActive: {
    color: "#276344",
    fontWeight: "700",
  },
  reportsScroll: { flex: 1, minHeight: 0 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1d2b21",
    marginBottom: 12,
  },
  logControlsWrapper: {
    marginBottom: 12,
    gap: 10,
  },
  logSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f7f5",
    borderWidth: 1,
    borderColor: "#d7e0d9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  logSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#1d2b21",
    padding: 0,
  },
  logSubTabsWrapper: {
    height: 34,
    flexShrink: 0,
    marginBottom: 4,
  },
  logSubTabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 34,
  },
  logSubTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 2,
    paddingRight: 16,
  },
  logSubTab: {
    height: 30,
    alignSelf: "center",
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#edf2ee",
    borderWidth: 1,
    borderColor: "#d7dfd9",
  },
  logSubTabActive: {
    backgroundColor: "#276344",
    borderColor: "#276344",
  },
  logSubTabText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#4b5d50",
    textAlign: "center",
  },
  logSubTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  postList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 4,
  },
  changeLogList: {
    gap: 10,
    paddingBottom: 4,
  },
  logCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3eae5",
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  logCardClickable: {
    backgroundColor: "#fafcfb",
    borderColor: "#d5e2d8",
  },
  logIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  logTextContainer: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  logTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 4,
  },
  logItemTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1d2b21",
    flexShrink: 1,
  },
  logItemMessage: {
    fontSize: 12.5,
    color: "#4d5d52",
    lineHeight: 18,
    marginBottom: 6,
  },
  logFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  logTimeText: {
    fontSize: 11,
    color: "#849188",
  },
  logViewLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  logViewLinkText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#276344",
  },
  logPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  logPillText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  logPillDefault: {
    backgroundColor: "#edf2ee",
    borderColor: "#d7dfd9",
  },
  logPillTextDefault: {
    color: "#4b5d50",
  },
  logPillPoints: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  logPillTextPoints: {
    color: "#b45309",
  },
  logPillPresent: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  logPillTextPresent: {
    color: "#15803d",
  },
  logPillReverted: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  logPillTextReverted: {
    color: "#b91c1c",
  },
  logPillInfo: {
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
  },
  logPillTextInfo: {
    color: "#0369a1",
  },
  logPillDanger: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  logPillTextDanger: {
    color: "#b91c1c",
  },
  logPillWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fef08a",
  },
  logPillTextWarning: {
    color: "#b45309",
  },
  logPillComment: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  logPillTextComment: {
    color: "#1d4ed8",
  },
  emptyLogsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  logError: {
    color: "#b42318",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  postCard: {
    width: "48%",
    flexDirection: "row",
    minHeight: 116,
    backgroundColor: "#f7f9f7",
    borderWidth: 1,
    borderColor: "#e2e8e3",
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  mobilePostCard: { width: "100%" },
  postCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  postTitle: { color: "#1d2b21", fontWeight: "700", fontSize: 15 },
  postLocation: { color: "#63756a", fontSize: 12, marginTop: 5 },
  postStatus: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#e6f0e9",
    color: "#276344",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  postImage: { width: 112, height: 84, borderRadius: 7, alignSelf: "center" },
  imagePlaceholder: {
    width: 112,
    height: 84,
    borderRadius: 7,
    backgroundColor: "#dfe8e2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  loadMoreButton: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#e6f0e9",
  },
  loadMoreButtonText: {
    color: "#276344",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: { color: "#63756a", textAlign: "center", marginTop: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1d2b21" },
  modalText: { color: "#5d6b61", marginTop: 8, lineHeight: 20 },
  pointsInput: {
    borderWidth: 1,
    borderColor: "#d7dfd9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    marginTop: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: "#edf0ee",
  },
  confirmButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: "#5F9C76",
  },
  disabledButton: { opacity: 0.6 },
  confirmButtonText: { color: "#fff", fontWeight: "700" },
  reasonInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#d7dfd9",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  dangerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff0f0",
    marginBottom: 12,
  },
  centerText: { textAlign: "center" },
  dangerConfirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: "#bf3030",
  },
  banConfirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: "#b97912",
  },
  unbanIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f5e9",
    marginBottom: 12,
  },
  unbanConfirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: "#2e7d32",
  },
});
