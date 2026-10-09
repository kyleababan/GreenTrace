import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
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
    useWindowDimensions,
} from "react-native";

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

const getChangeLabel = (field) =>
  ({
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
  })[field] || field;

const formatChangeTime = (timestamp) => {
  if (!timestamp) return "Time unavailable";
  if (timestamp.toDate) return timestamp.toDate().toLocaleString();
  if (timestamp.seconds)
    return new Date(timestamp.seconds * 1000).toLocaleString();
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  return "Time unavailable";
};

export default function UserPostDetail() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [visibleReportCount, setVisibleReportCount] = useState(6);
  const [changeLogs, setChangeLogs] = useState([]);
  const [visibleLogCount, setVisibleLogCount] = useState(6);
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
  const visibleChangeLogs = changeLogs.slice(0, visibleLogCount);

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
        const [subcollectionLogsSnapshot, commentsSnapshot, userDocSnapshot] =
          await Promise.all([
            getDocs(collection(db, "users", userId, "changeLogs")),
            getDocs(
              query(collection(db, "comments"), where("userId", "==", userId)),
            ),
            getDoc(doc(db, "users", userId)),
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
        ];
        const sortedLogs = allLogs.sort(
          (first, second) =>
            (second.changedAt?.toMillis?.() ??
              second.createdAt?.toMillis?.() ??
              (second.changedAt?.seconds ? second.changedAt.seconds * 1000 : 0) ??
              0) -
            (first.changedAt?.toMillis?.() ??
              first.createdAt?.toMillis?.() ??
              (first.changedAt?.seconds ? first.changedAt.seconds * 1000 : 0) ??
              0),
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
    <View style={styles.page}>
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

      <View
        style={[styles.content, { flexDirection: isMobile ? "column" : "row" }]}
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

        <View style={styles.postsPanel}>
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
                        {post.locationName || "Location not specified"}
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
              ) : changeLogs.length ? (
                visibleChangeLogs.map((entry) => {
                  const isComment = entry.type === "comment";
                  const isViolation = entry.type === "violation";
                  const isUnban =
                    isViolation &&
                    (entry.violationType === "admin_unban" ||
                      entry.field === "account_unban");
                  const isNsfw =
                    isViolation &&
                    (entry.violationType === "nsfw" ||
                      entry.field === "nsfw_violation");
                  const isAdminBan =
                    isViolation &&
                    (entry.violationType === "admin_ban" ||
                      entry.field === "account_ban");

                  return (
                    <TouchableOpacity
                      key={`${entry.type}-${entry.id}`}
                      style={[
                        styles.changeLogCard,
                        isComment && styles.commentLogCard,
                        isViolation &&
                          (isUnban
                            ? styles.unbanLogCard
                            : styles.violationLogCard),
                      ]}
                      onPress={
                        isComment && entry.postExists
                          ? () => openCommentLog(entry)
                          : undefined
                      }
                      disabled={!isComment || !entry.postExists}
                      activeOpacity={0.75}
                      accessibilityRole={
                        isComment && entry.postExists ? "button" : undefined
                      }
                      accessibilityLabel={
                        isComment && entry.postExists
                          ? `Open comment on ${entry.postCaption}`
                          : undefined
                      }
                    >
                      <View
                        style={[
                          styles.changeLogIcon,
                          isViolation &&
                            (isUnban
                              ? styles.unbanIconWrapper
                              : isAdminBan
                              ? styles.banIconWrapper
                              : styles.violationIconWrapper),
                        ]}
                      >
                        <Ionicons
                          name={
                            isComment
                              ? "chatbubble-outline"
                              : isUnban
                              ? "shield-checkmark-outline"
                              : isNsfw
                              ? "alert-circle-outline"
                              : isAdminBan
                              ? "ban-outline"
                              : "create-outline"
                          }
                          size={18}
                          color={
                            isComment
                              ? "#4B7F5F"
                              : isUnban
                              ? "#166534"
                              : isNsfw
                              ? "#b42318"
                              : isAdminBan
                              ? "#b45309"
                              : "#4B7F5F"
                          }
                        />
                      </View>
                      <View style={styles.changeLogCopy}>
                        {isComment ? (
                          <>
                            <Text style={styles.changeLogTitle}>
                              Commented on a report
                            </Text>
                            <Text style={styles.changeLogValues}>
                              Report: {hideBadWords(entry.postCaption)}
                            </Text>
                            <Text style={styles.changeLogValues}>
                              Comment: {hideBadWords(entry.comment || "")}
                            </Text>
                            {entry.postExists ? (
                              <Text style={styles.commentLogHint}>
                                Tap to view the highlighted comment
                              </Text>
                            ) : (
                              <Text style={styles.changeLogTime}>
                                The report is no longer available.
                              </Text>
                            )}
                          </>
                        ) : isViolation ? (
                          <>
                            <View style={styles.violationHeaderRow}>
                              <Text
                                style={
                                  isUnban
                                    ? styles.unbanLogTitle
                                    : isAdminBan
                                    ? styles.banLogTitle
                                    : styles.violationLogTitle
                                }
                              >
                                {isUnban
                                  ? "Account Unbanned"
                                  : isNsfw
                                  ? "Policy Violation: Inappropriate Content"
                                  : "Account Suspension"}
                              </Text>
                              <View style={styles.violationBadgeRow}>
                                {isUnban && (
                                  <View style={styles.unbanBadge}>
                                    <Text style={styles.unbanBadgeText}>
                                      Restored
                                    </Text>
                                  </View>
                                )}
                                {Boolean(entry.warningNumber) && (
                                  <View
                                    style={
                                      entry.warningNumber >= 3
                                        ? styles.violationBannedBadge
                                        : styles.violationWarningBadge
                                    }
                                  >
                                    <Text
                                      style={
                                        entry.warningNumber >= 3
                                          ? styles.violationBannedBadgeText
                                          : styles.violationWarningBadgeText
                                      }
                                    >
                                      Warning {entry.warningNumber} /{" "}
                                      {entry.maxWarnings || 3}
                                    </Text>
                                  </View>
                                )}
                                {(isAdminBan ||
                                  (isNsfw && entry.warningNumber >= 3) ||
                                  entry.actionTaken?.includes("Banned")) && (
                                  <View style={styles.violationBannedBadge}>
                                    <Text
                                      style={styles.violationBannedBadgeText}
                                    >
                                      Banned
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Text style={styles.violationReason}>
                              <Text style={styles.violationLabel}>
                                Reason:{" "}
                              </Text>
                              {hideBadWords(entry.reason || "Terms violation")}
                            </Text>
                            {Boolean(entry.actionTaken) && (
                              <Text style={styles.violationAction}>
                                <Text style={styles.violationLabel}>
                                  Action:{" "}
                                </Text>
                                {entry.actionTaken}
                              </Text>
                            )}
                            {Boolean(entry.source) && (
                              <Text style={styles.violationSource}>
                                Source:{" "}
                                {entry.source === "create_post"
                                  ? "Create Post Upload"
                                  : entry.source === "edit_post"
                                  ? "Edit Post Upload"
                                  : entry.source === "admin_action"
                                  ? "Admin Management"
                                  : "Content Moderation"}
                              </Text>
                            )}
                          </>
                        ) : (
                          <>
                            <Text style={styles.changeLogTitle}>
                              {getChangeLabel(entry.field)} changed
                            </Text>
                            <Text style={styles.changeLogValues}>
                              From: {entry.oldValue || "Not set"}
                            </Text>
                            <Text style={styles.changeLogValues}>
                              To: {entry.newValue || "Not set"}
                            </Text>
                          </>
                        )}
                        <Text style={styles.changeLogTime}>
                          {formatChangeTime(
                            isComment ? entry.createdAt : entry.changedAt,
                          )}
                        </Text>
                      </View>
                      {isComment && entry.postExists ? (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#4B7F5F"
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>
                  No activity, violations, or profile changes have been logged yet.
                </Text>
              )}
              {!logsLoading &&
              !logsError &&
              visibleLogCount < changeLogs.length ? (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() =>
                    setVisibleLogCount((count) =>
                      Math.min(count + 6, changeLogs.length),
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
      </View>

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
  changeLogCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f7f9f7",
    borderWidth: 1,
    borderColor: "#e2e8e3",
    borderRadius: 10,
    padding: 12,
  },
  commentLogCard: {
    borderColor: "#b8d2ff",
    backgroundColor: "#f2f7ff",
  },
  changeLogIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6f0e9",
  },
  changeLogCopy: {
    flex: 1,
    minWidth: 0,
  },
  changeLogTitle: {
    color: "#1d2b21",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  changeLogValues: {
    color: "#4d5d52",
    fontSize: 12,
    lineHeight: 18,
    overflowWrap: "anywhere",
  },
  changeLogTime: {
    color: "#849188",
    fontSize: 11,
    marginTop: 6,
  },
  commentLogHint: {
    color: "#3973c6",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  violationLogCard: {
    borderColor: "#fecdd3",
    backgroundColor: "#fff5f5",
  },
  unbanLogCard: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  violationIconWrapper: {
    backgroundColor: "#fee2e2",
  },
  unbanIconWrapper: {
    backgroundColor: "#dcfce7",
  },
  banIconWrapper: {
    backgroundColor: "#fef3c7",
  },
  violationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  violationLogTitle: {
    color: "#b42318",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  unbanLogTitle: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  banLogTitle: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  violationBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  violationWarningBadge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  violationWarningBadgeText: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: "700",
  },
  violationBannedBadge: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  violationBannedBadgeText: {
    color: "#991b1b",
    fontSize: 11,
    fontWeight: "700",
  },
  unbanBadge: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  unbanBadgeText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "700",
  },
  violationLabel: {
    fontWeight: "700",
    color: "#374151",
  },
  violationReason: {
    color: "#4b5563",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  violationAction: {
    color: "#4b5563",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  violationSource: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 3,
    fontStyle: "italic",
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
