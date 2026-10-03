import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
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
import { formatLocationWithPurok } from "../constants/locationFormat";
import { auth, db } from "../firebaseConfig";
import { hideBadWords } from "../utils/hideBadWords";

const formatReportDate = (timestamp) => {
  if (!timestamp) return "Recently";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getStatusBadge = (status) => {
  switch (status) {
    case "critical":
      return { label: "Critical", bg: "#FF5B5B" };
    case "moderate":
      return { label: "Moderate", bg: "#FF8C40" };
    case "cleaned":
      return { label: "Cleaned", bg: "#34C759" };
    case "ongoing":
      return { label: "On-going", bg: "#FFC940" };
    default:
      return { label: "Pending", bg: "#94A3B8" };
  }
};

export default function ReportPosts() {
  const router = useRouter();
  const [reportPosts, setReportPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReportPosts = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "posts"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setReportPosts(posts);
    } catch (error) {
      console.log("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReportPosts();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* HEADER SECTION */}
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
                <Text style={styles.headerTitle}>My Reports</Text>
                <Text style={styles.headerSubtitle}>
                  Track your submitted waste concerns
                </Text>
              </View>
              <View style={styles.reportCountBadge}>
                <Text style={styles.reportCountText}>{reportPosts.length}</Text>
              </View>
            </View>
          </View>

          {/* MAIN CONTENT */}
          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#5F9C76" />
            </View>
          ) : (
            <ScrollView
              style={styles.feed}
              contentContainerStyle={styles.feedContent}
              showsVerticalScrollIndicator={false}
            >
              {reportPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name="document-text-outline"
                      size={36}
                      color="#5F9C76"
                    />
                  </View>
                  <Text style={styles.emptyTitle}>No reports submitted</Text>
                  <Text style={styles.emptySubtitle}>
                    Waste concerns you report to your barangay and LGU will
                    appear here.
                  </Text>
                  <TouchableOpacity
                    style={styles.createReportButton}
                    onPress={() => router.push("/create_post")}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.createReportButtonText}>
                      Report a Concern
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                reportPosts.map((post) => {
                  const statusInfo = getStatusBadge(post.status);
                  const locationLabel = formatLocationWithPurok(
                    post.locationName,
                    post.purok,
                  );

                  return (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.reportCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: "/post",
                          params: { id: post.id },
                        })
                      }
                    >
                      <View style={styles.cardLeft}>
                        {/* STATUS BADGE & DATE */}
                        <View style={styles.cardMetaRow}>
                          <View
                            style={[
                              styles.statusTag,
                              { backgroundColor: statusInfo.bg },
                            ]}
                          >
                            <Text style={styles.statusText}>
                              {statusInfo.label}
                            </Text>
                          </View>
                          <Text style={styles.dateText}>
                            {formatReportDate(post.createdAt)}
                          </Text>
                        </View>

                        {/* TITLE */}
                        <Text style={styles.reportTitle} numberOfLines={2}>
                          {hideBadWords(post.title) || "Untitled waste report"}
                        </Text>

                        {/* LOCATION */}
                        <View style={styles.locationRow}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color="#397A51"
                          />
                          <Text style={styles.locationText} numberOfLines={1}>
                            {locationLabel}
                          </Text>
                        </View>

                        {/* VIEW POST ACTION */}
                        <View style={styles.actionRow}>
                          <Text style={styles.seePostText}>View Details</Text>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color="#397A51"
                          />
                        </View>
                      </View>

                      {/* THUMBNAIL */}
                      <View style={styles.cardRight}>
                        {post.imageUrl ? (
                          <ExpoImage
                            source={{ uri: post.imageUrl }}
                            style={styles.postImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            recyclingKey={post.imageUrl}
                          />
                        ) : (
                          <View style={styles.imagePlaceholder}>
                            <Ionicons
                              name="image-outline"
                              size={24}
                              color="#94A3B8"
                            />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
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
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    maxWidth: 500,
    width: "100%",
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
  reportCountBadge: {
    backgroundColor: "#E4F1E8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportCountText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    paddingBottom: 24,
  },

  /* EMPTY STATE */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E4F1E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F3326",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  createReportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5F9C76",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  createReportButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* REPORT CARD */
  reportCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F3326",
    lineHeight: 20,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seePostText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "700",
  },
  cardRight: {
    alignSelf: "center",
  },
  postImage: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  imagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  /* NAVBAR */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
