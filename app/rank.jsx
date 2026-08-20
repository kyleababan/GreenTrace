import { Ionicons } from "@expo/vector-icons";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";
import { db } from "../firebaseConfig";

const displayName = (user) => {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  return name || "GreenTrace member";
};

const getVolunteerId = (volunteer) => {
  if (typeof volunteer === "string") return volunteer;
  return volunteer?.userId || volunteer?.uid || volunteer?.id || null;
};

const toDate = (value) => {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

const getMonthCountdown = (nowValue) => {
  const now = new Date(nowValue);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const remainingSeconds = Math.max(0, Math.floor((nextMonth.getTime() - now.getTime()) / 1000));
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
};

const appendAward = (awardsByUser, userId, badge) => {
  const badges = awardsByUser.get(userId) || [];
  if (!badges.some((existingBadge) => existingBadge.id === badge.id)) {
    badges.push(badge);
    awardsByUser.set(userId, badges);
  }
};

const calculateContributorAwards = (users, transactions) => {
  const awardsByUser = new Map();
  const currentMonthKey = getMonthKey(new Date());
  const earnedAt = new Date().toISOString();

  users
    .filter((user) => (Number(user.points) || 0) > 0)
    .sort((first, second) => (Number(second.points) || 0) - (Number(first.points) || 0))
    .slice(0, 50)
    .forEach((user) => {
      appendAward(awardsByUser, user.id, {
        id: "all-time-top-contributor",
        icon: "\u{1F3C6}",
        title: "All Time Top Contributor",
        description: "Awarded for reaching the All Time Top 50 contributors.",
        earnedAt,
      });
    });

  const completedMonths = new Map();
  transactions.forEach((transaction) => {
    const date = toDate(transaction.createdAt);
    if (!date) return;
    const monthKey = getMonthKey(date);
    if (monthKey >= currentMonthKey) return;

    const pointsByUser = completedMonths.get(monthKey) || new Map();
    pointsByUser.set(
      transaction.userId,
      (pointsByUser.get(transaction.userId) || 0) + (Number(transaction.amount) || 0),
    );
    completedMonths.set(monthKey, pointsByUser);
  });

  completedMonths.forEach((pointsByUser, monthKey) => {
    [...pointsByUser.entries()]
      .filter(([, points]) => points > 0)
      .sort((first, second) => second[1] - first[1])
      .slice(0, 10)
      .forEach(([userId]) => {
        const periodLabel = getMonthLabel(monthKey);
        appendAward(awardsByUser, userId, {
          id: `monthly-top-contributor-${monthKey}`,
          icon: "\u{1F3C5}",
          title: "Monthly Top Contributor",
          periodLabel,
          description: `Finished among the Top 10 contributors for ${periodLabel}.`,
          earnedAt,
        });
      });
  });

  return awardsByUser;
};

export default function RankScreen() {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [volunteerPosts, setVolunteerPosts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [hoveredBadge, setHoveredBadge] = useState("");
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  useEffect(() => {
    const countdownInterval = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(countdownInterval);
  }, []);

  useEffect(() => {
    const refreshRankings = async () => {
      try {
        const [usersSnapshot, postsSnapshot, volunteerPostsSnapshot, transactionsSnapshot] =
          await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "posts")),
            getDocs(collection(db, "volunteer_posts")),
            getDocs(collection(db, "point_transactions")),
          ]);

        const loadedUsers = usersSnapshot.docs.map((user) => ({ id: user.id, ...user.data() }));
        const loadedTransactions = transactionsSnapshot.docs.map((transaction) => ({
          id: transaction.id,
          ...transaction.data(),
        }));
        const awardsByUser = calculateContributorAwards(loadedUsers, loadedTransactions);

        const usersWithAwards = loadedUsers.map((user) => {
          const existingBadges = Array.isArray(user.contributorBadges) ? user.contributorBadges : [];
          const missingBadges = (awardsByUser.get(user.id) || []).filter(
            (badge) => !existingBadges.some((existingBadge) => existingBadge.id === badge.id),
          );

          if (missingBadges.length) {
            updateDoc(doc(db, "users", user.id), {
              contributorBadges: arrayUnion(...missingBadges),
            }).catch((error) => console.error("Unable to award contributor badge:", error));
          }

          return { ...user, contributorBadges: [...existingBadges, ...missingBadges] };
        });

        setUsers(usersWithAwards);
        setPosts(postsSnapshot.docs.map((post) => post.data()));
        setVolunteerPosts(volunteerPostsSnapshot.docs.map((post) => post.data()));
        setTransactions(loadedTransactions);
      } catch (error) {
        console.log("Unable to refresh rankings:", error);
      } finally {
        setLoading(false);
      }
    };

    refreshRankings();
    const refreshInterval = setInterval(refreshRankings, 10 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  const currentMonthKey = getMonthKey(new Date());
  const currentMonthLabel = getMonthLabel(currentMonthKey);

  const rankings = useMemo(() => {
    const cleanedReportsByUser = posts.reduce((counts, post) => {
      if (post.status === "cleaned" && post.userId) {
        counts[post.userId] = (counts[post.userId] || 0) + 1;
      }
      return counts;
    }, {});

    const volunteerActivitiesByUser = volunteerPosts.reduce((counts, activity) => {
      if (activity.status !== "cleaned") return counts;
      const volunteerIds = new Set(
        (Array.isArray(activity.volunteers) ? activity.volunteers : [])
          .map(getVolunteerId)
          .filter(Boolean),
      );
      volunteerIds.forEach((userId) => {
        counts[userId] = (counts[userId] || 0) + 1;
      });
      return counts;
    }, {});

    const monthlyPointsByUser = transactions.reduce((points, transaction) => {
      const date = toDate(transaction.createdAt);
      if (!date || getMonthKey(date) !== currentMonthKey) return points;
      points[transaction.userId] =
        (points[transaction.userId] || 0) + (Number(transaction.amount) || 0);
      return points;
    }, {});

    return users
      .map((user) => ({
        ...user,
        cleanedReports: cleanedReportsByUser[user.id] || 0,
        volunteeredCount: volunteerActivitiesByUser[user.id] || 0,
        totalPoints: Number(user.points) || 0,
        monthlyPoints: monthlyPointsByUser[user.id] || 0,
      }))
      .filter((user) =>
        activeFilter === "monthly"
          ? user.monthlyPoints > 0
          : user.totalPoints > 0 || user.cleanedReports > 0 || user.volunteeredCount > 0,
      )
      .sort((first, second) =>
        activeFilter === "monthly"
          ? second.monthlyPoints - first.monthlyPoints || second.totalPoints - first.totalPoints
          : second.totalPoints - first.totalPoints || second.cleanedReports - first.cleanedReports,
      )
      .slice(0, 100);
  }, [activeFilter, currentMonthKey, posts, transactions, users, volunteerPosts]);

  const title = activeFilter === "monthly" ? "Top Contributor of the Month" : "All Time Top Contributor";

  const renderContributorBadges = (user) => {
    const badges = Array.isArray(user.contributorBadges) ? user.contributorBadges : [];
    return badges.slice(-3).map((badge) => {
      const hoverKey = `${user.id}-${badge.id}`;
      return (
        <View key={badge.id} style={styles.badgeWrapper}>
          <Pressable
            style={styles.contributorBadge}
            onHoverIn={() => setHoveredBadge(hoverKey)}
            onHoverOut={() => setHoveredBadge("")}
            onLongPress={() => setSelectedBadge(badge)}
            delayLongPress={350}
          >
            <Text style={styles.contributorBadgeIcon}>{badge.icon}</Text>
          </Pressable>
          {hoveredBadge === hoverKey && (
            <View style={styles.badgeTooltip}>
              <Text style={styles.badgeTooltipTitle}>{badge.title}</Text>
              {badge.periodLabel && <Text style={styles.badgeTooltipPeriod}>{badge.periodLabel}</Text>}
              <Text style={styles.badgeTooltipText}>{badge.description}</Text>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Image source={require("../assets/images/rank.png")} style={styles.headerIcon} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>
              {activeFilter === "monthly"
                ? `Eco Points earned during ${currentMonthLabel}`
                : "Top members by total Eco Points"}
            </Text>
          </View>
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === "monthly" && styles.activeFilterButton]}
            onPress={() => setActiveFilter("monthly")}
          >
            <Ionicons name="calendar-outline" size={17} color={activeFilter === "monthly" ? "#FFFFFF" : "#397A51"} />
            <Text style={[styles.filterText, activeFilter === "monthly" && styles.activeFilterText]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === "allTime" && styles.activeFilterButton]}
            onPress={() => setActiveFilter("allTime")}
          >
            <Ionicons name="trophy-outline" size={17} color={activeFilter === "allTime" ? "#FFFFFF" : "#397A51"} />
            <Text style={[styles.filterText, activeFilter === "allTime" && styles.activeFilterText]}>All Time</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>{title}</Text>
              {activeFilter === "monthly" && (
                <View style={styles.countdownPill}>
                  <Ionicons name="time-outline" size={14} color="#397A51" />
                  <Text style={styles.countdownText}>{getMonthCountdown(countdownNow)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.summaryText}>
              {activeFilter === "monthly"
                ? `Ranks Eco Points earned this month. After ${currentMonthLabel}, the Top 10 receive a dated Monthly Top Contributor badge.`
                : "Ranks total Eco Points. Members permanently earn an All Time Top Contributor badge after reaching the Top 50."}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.stateContainer}><ActivityIndicator color="#5F9C76" /></View>
          ) : rankings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image source={require("../assets/images/rank.png")} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No rankings yet</Text>
              <Text style={styles.emptyText}>
                {activeFilter === "monthly"
                  ? `No Eco Points have been recorded for ${currentMonthLabel} yet.`
                  : "Members will appear here after earning Eco Points."}
              </Text>
            </View>
          ) : rankings.map((user, index) => (
            <View key={user.id} style={styles.rankCard}>
              <View style={[styles.rankBadge, index < 3 && styles.topRankBadge]}>
                <Text style={[styles.rankNumber, index < 3 && styles.topRankNumber]}>{index + 1}</Text>
              </View>
              <Image source={require("../assets/images/profile2.png")} style={styles.avatar} />
              <View style={styles.userDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{displayName(user)}</Text>
                  <View style={styles.contributorBadges}>{renderContributorBadges(user)}</View>
                </View>
                <Text style={styles.reportCount}>
                  {user.cleanedReports} cleaned {user.cleanedReports === 1 ? "report" : "reports"}
                  {"  \u2022  "}{user.volunteeredCount} volunteered
                </Text>
              </View>
              <View style={styles.pointsPill}>
                <Image source={require("../assets/images/ecopts.png")} style={styles.pointsIcon} />
                <Text style={styles.pointsText}>
                  {activeFilter === "monthly" ? user.monthlyPoints : user.totalPoints}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.navbarContainer}><Navbar /></View>

        <Modal visible={Boolean(selectedBadge)} transparent animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedBadge(null)}>
            <Pressable style={styles.badgeModal}>
              <Text style={styles.badgeModalIcon}>{selectedBadge?.icon}</Text>
              <Text style={styles.badgeModalTitle}>{selectedBadge?.title}</Text>
              {selectedBadge?.periodLabel && <Text style={styles.badgeModalPeriod}>{selectedBadge.periodLabel}</Text>}
              <Text style={styles.badgeModalText}>{selectedBadge?.description}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedBadge(null)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F4F6F8", alignItems: "center" },
  container: { flex: 1, width: "100%", maxWidth: 500, backgroundColor: "#F4F6F8" },
  header: { height: 86, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#5F9C76", paddingHorizontal: 20, justifyContent: "center" },
  headerIcon: { width: 38, height: 38, resizeMode: "contain", tintColor: "#FFFFFF" },
  headerText: { flexShrink: 1 },
  headerTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "700" },
  headerSubtitle: { color: "#E8F3EC", fontSize: 12, marginTop: 2 },
  filterContainer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  filterButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: "#BFD9C7", backgroundColor: "#FFFFFF" },
  activeFilterButton: { backgroundColor: "#5F9C76", borderColor: "#5F9C76" },
  filterText: { color: "#397A51", fontSize: 13, fontWeight: "700" },
  activeFilterText: { color: "#FFFFFF" },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  summaryContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  summaryCard: { backgroundColor: "#EAF4ED", borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#D6E9DA" },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  summaryTitle: { flexShrink: 1, color: "#2F6F46", fontSize: 16, fontWeight: "700" },
  countdownPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: "#DDF0E2" },
  countdownText: { color: "#397A51", fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
  summaryText: { color: "#5F6F65", fontSize: 13, lineHeight: 19 },
  rankCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, marginBottom: 12, elevation: 2, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, overflow: "visible" },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EDF1EE", alignItems: "center", justifyContent: "center", marginRight: 10 },
  topRankBadge: { backgroundColor: "#DFF0E4" },
  rankNumber: { color: "#66756B", fontWeight: "700", fontSize: 13 },
  topRankNumber: { color: "#2F7D4A" },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 11 },
  userDetails: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  userName: { color: "#1F2937", fontSize: 15, fontWeight: "700" },
  reportCount: { color: "#6B7280", fontSize: 12, marginTop: 3 },
  contributorBadges: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeWrapper: { position: "relative" },
  contributorBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#C7DFC9", backgroundColor: "#F1FAF3" },
  contributorBadgeIcon: { fontSize: 13 },
  badgeTooltip: { position: "absolute", zIndex: 20, left: -85, bottom: 30, width: 200, padding: 10, borderRadius: 8, backgroundColor: "#25372C", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5 },
  badgeTooltipTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  badgeTooltipPeriod: { color: "#BDE3C8", fontSize: 11, marginTop: 2 },
  badgeTooltipText: { color: "#E8EEE9", fontSize: 10, lineHeight: 14, marginTop: 4 },
  pointsPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6 },
  pointsIcon: { width: 14, height: 14, marginRight: 4, tintColor: "#5F9C76" },
  pointsText: { color: "#2F7D4A", fontSize: 13, fontWeight: "700" },
  stateContainer: { paddingVertical: 44, alignItems: "center" },
  emptyCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 28 },
  emptyIcon: { width: 42, height: 42, resizeMode: "contain", tintColor: "#5F9C76", marginBottom: 12 },
  emptyTitle: { color: "#374151", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyText: { color: "#6B7280", fontSize: 13, lineHeight: 19, textAlign: "center" },
  navbarContainer: { borderTopWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
  modalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15, 25, 19, 0.55)" },
  badgeModal: { width: "100%", maxWidth: 330, alignItems: "center", padding: 24, borderRadius: 18, backgroundColor: "#FFFFFF" },
  badgeModalIcon: { fontSize: 38 },
  badgeModalTitle: { color: "#2F6F46", fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 8 },
  badgeModalPeriod: { color: "#5F9C76", fontSize: 13, fontWeight: "700", marginTop: 4 },
  badgeModalText: { color: "#66756B", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 10 },
  closeButton: { marginTop: 18, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 9, backgroundColor: "#5F9C76" },
  closeButtonText: { color: "#FFFFFF", fontWeight: "700" },
});
