import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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

export default function RankScreen() {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [volunteerPosts, setVolunteerPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshRankings = async () => {
      try {
        const [usersSnapshot, postsSnapshot, volunteerPostsSnapshot] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "posts")),
          getDocs(collection(db, "volunteer_posts")),
        ]);

        setUsers(
          usersSnapshot.docs.map((user) => ({ id: user.id, ...user.data() })),
        );
        setPosts(postsSnapshot.docs.map((post) => post.data()));
        setVolunteerPosts(
          volunteerPostsSnapshot.docs.map((volunteerPost) => volunteerPost.data()),
        );
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

    return users
      .map((user) => ({
        ...user,
        cleanedReports: cleanedReportsByUser[user.id] || 0,
        volunteeredCount: volunteerActivitiesByUser[user.id] || 0,
        points: Number(user.points) || 0,
      }))
      .filter((user) => user.cleanedReports > 0 || user.volunteeredCount > 0)
      .sort(
        (first, second) =>
          second.points - first.points ||
          second.cleanedReports - first.cleanedReports ||
          second.volunteeredCount - first.volunteeredCount,
      )
      .slice(0, 100);
  }, [posts, users, volunteerPosts]);

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require("../assets/images/rank.png")}
            style={styles.headerIcon}
          />
          <View>
            <Text style={styles.headerTitle}>Community Rank</Text>
            <Text style={styles.headerSubtitle}>
              Top 100 by Eco Points and cleaned reports
            </Text>
          </View>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Community leaderboard</Text>
            <Text style={styles.summaryText}>
              Admin-cleaned reports and completed volunteer cleanups count toward the ranking.
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color="#5F9C76" />
            </View>
          ) : rankings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image
                source={require("../assets/images/rank.png")}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>No rankings yet</Text>
              <Text style={styles.emptyText}>
                Members will appear here once they complete a cleaned report or cleanup.
              </Text>
            </View>
          ) : (
            rankings.map((user, index) => (
              <View key={user.id} style={styles.rankCard}>
                <View style={[styles.rankBadge, index < 3 && styles.topRankBadge]}>
                  <Text style={[styles.rankNumber, index < 3 && styles.topRankNumber]}>
                    {index + 1}
                  </Text>
                </View>

                <Image
                  source={require("../assets/images/profile2.png")}
                  style={styles.avatar}
                />

                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{displayName(user)}</Text>
                  <Text style={styles.reportCount}>
                    {user.cleanedReports} cleaned {user.cleanedReports === 1 ? "report" : "reports"}
                    {"  •  "}
                    {user.volunteeredCount} volunteered
                  </Text>
                </View>

                <View style={styles.pointsPill}>
                  <Image
                    source={require("../assets/images/ecopts.png")}
                    style={styles.pointsIcon}
                  />
                  <Text style={styles.pointsText}>{user.points}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F4F6F8", alignItems: "center" },
  container: { flex: 1, width: "100%", maxWidth: 500, backgroundColor: "#F4F6F8" },
  header: {
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: "center",
  },
  headerIcon: { width: 38, height: 38, resizeMode: "contain", tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  headerSubtitle: { color: "#E8F3EC", fontSize: 12, marginTop: 2 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  summaryContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  summaryCard: {
    backgroundColor: "#EAF4ED",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D6E9DA",
  },
  summaryTitle: { color: "#2F6F46", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  summaryText: { color: "#5F6F65", fontSize: 13, lineHeight: 19 },
  rankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EDF1EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  topRankBadge: { backgroundColor: "#DFF0E4" },
  rankNumber: { color: "#66756B", fontWeight: "700", fontSize: 13 },
  topRankNumber: { color: "#2F7D4A" },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 11 },
  userDetails: { flex: 1 },
  userName: { color: "#1F2937", fontSize: 15, fontWeight: "700" },
  reportCount: { color: "#6B7280", fontSize: 12, marginTop: 3 },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  pointsIcon: { width: 14, height: 14, marginRight: 4, tintColor: "#5F9C76" },
  pointsText: { color: "#2F7D4A", fontSize: 13, fontWeight: "700" },
  stateContainer: { paddingVertical: 44, alignItems: "center" },
  emptyCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 28 },
  emptyIcon: { width: 42, height: 42, resizeMode: "contain", tintColor: "#5F9C76", marginBottom: 12 },
  emptyTitle: { color: "#374151", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyText: { color: "#6B7280", fontSize: 13, lineHeight: 19, textAlign: "center" },
  navbarContainer: { borderTopWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
});
