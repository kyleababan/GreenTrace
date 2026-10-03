import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";
import {
  BADGES,
  getUserContributionStats,
  isBadgeEarned,
} from "../constants/badges";
import { auth, db } from "../firebaseConfig";

export default function BadgesScreen() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [contributorBadges, setContributorBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBadges = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [userSnapshot, posts, volunteerPosts] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDocs(collection(db, "posts")),
          getDocs(collection(db, "volunteer_posts")),
        ]);

        if (userSnapshot.exists()) {
          const savedBadges = userSnapshot.data().contributorBadges;
          setContributorBadges(Array.isArray(savedBadges) ? savedBadges : []);
        }

        setStats(
          getUserContributionStats(
            user.uid,
            posts.docs.map((item) => item.data()),
            volunteerPosts.docs.map((item) => item.data()),
          ),
        );
      } catch (error) {
        console.log("Unable to load badges:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBadges();
  }, []);

  const badges = useMemo(
    () => [
      ...contributorBadges.map((badge) => ({
        ...badge,
        earned: true,
        contributor: true,
      })),
      ...BADGES.map((badge) => ({
        ...badge,
        earned: stats && isBadgeEarned(badge, stats),
      })),
    ],
    [contributorBadges, stats],
  );

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTextWrapper}>
                <Text style={styles.headerTitle}>Badge List</Text>
                <Text style={styles.headerSubtitle}>
                  Collect badges through community action
                </Text>
              </View>
            </View>
          </View>

          {/* CONTENT */}
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#5F9C76" />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {/* PROGRESS SUMMARY CARD */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryTitle}>Your Badge Progress</Text>
                  <Text style={styles.summarySubtitle}>
                    {earnedCount} of {badges.length} badges unlocked
                  </Text>
                  {/* Progress Bar */}
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${badges.length ? (earnedCount / badges.length) * 100 : 0}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.summaryBadgeCircle}>
                  <Ionicons name="trophy" size={26} color="#F59E0B" />
                </View>
              </View>

              {/* BADGE LIST */}
              {badges.map((badge) => {
                const isEarned = Boolean(badge.earned);
                const currentCount =
                  badge.type === "reports"
                    ? (stats?.cleanedReports ?? 0)
                    : (stats?.volunteeredCount ?? 0);

                return (
                  <View
                    key={badge.id}
                    style={[styles.card, !isEarned && styles.lockedCard]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        isEarned
                          ? styles.iconCircleEarned
                          : styles.iconCircleLocked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeIcon,
                          !isEarned && styles.lockedIcon,
                        ]}
                      >
                        {badge.icon}
                      </Text>
                    </View>

                    <View style={styles.details}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.badgeTitle,
                            !isEarned && styles.lockedText,
                          ]}
                          numberOfLines={1}
                        >
                          {badge.title}
                        </Text>
                        {isEarned ? (
                          <View style={styles.earnedTag}>
                            <Ionicons
                              name="checkmark-circle"
                              size={13}
                              color="#15803D"
                            />
                            <Text style={styles.earnedTagText}>Earned</Text>
                          </View>
                        ) : (
                          <View style={styles.lockedTag}>
                            <Ionicons
                              name="lock-closed"
                              size={11}
                              color="#94A3B8"
                            />
                            <Text style={styles.lockedTagText}>Locked</Text>
                          </View>
                        )}
                      </View>

                      {Boolean(badge.periodLabel) && (
                        <Text style={styles.periodLabel}>
                          {badge.periodLabel}
                        </Text>
                      )}

                      <Text style={styles.description}>
                        {badge.description}
                      </Text>

                      {!isEarned && badge.required && (
                        <Text style={styles.requirement}>
                          Progress: {currentCount} / {badge.required} completed
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* NAVBAR */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>
        </View>
      </View>
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
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F5F5F5",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topSection: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    color: "#E8F3EC",
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },

  /* PROGRESS SUMMARY */
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  summaryLeft: {
    flex: 1,
    marginRight: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F3326",
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 10,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#5F9C76",
  },
  summaryBadgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },

  /* BADGE CARDS */
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    alignItems: "center",
    gap: 14,
  },
  lockedCard: {
    backgroundColor: "#FBFDFB",
    opacity: 0.85,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleEarned: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
  },
  iconCircleLocked: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeIcon: {
    fontSize: 26,
  },
  lockedIcon: {
    opacity: 0.35,
  },
  details: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badgeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    flex: 1,
  },
  lockedText: {
    color: "#64748B",
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#397A51",
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
    marginTop: 3,
  },
  requirement: {
    fontSize: 11,
    fontWeight: "700",
    color: "#397A51",
    marginTop: 5,
  },
  earnedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  earnedTagText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "700",
  },
  lockedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  lockedTagText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
  },

  /* NAVBAR */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
