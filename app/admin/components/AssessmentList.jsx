import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  formatLocationWithPurok,
  normalizePurok,
} from "../../../constants/locationFormat";
import { db } from "../../../firebaseConfig";

const STATUS_DETAILS = {
  pending: { label: "Not Assessed", color: "#A5A5A5" },
  critical: { label: "Critical", color: "#FF5B5B" },
  moderate: { label: "Moderate", color: "#FFC940" },
  cleaned: { label: "Cleaned", color: "#34C759" },
  ongoing: { label: "On-going", color: "#7DD3FC" },
};

const getLocationParts = (locationName = "") =>
  locationName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const getPostPurok = (post) => {
  const savedPurok = normalizePurok(post.purok || "");
  if (savedPurok) return savedPurok.toLowerCase();

  const purokPart = getLocationParts(post.locationName).find((part) =>
    /^(?:purok|pk\.?)\s+/i.test(part),
  );
  return purokPart ? normalizePurok(purokPart).toLowerCase() : "";
};

const getPostBarangay = (post) => {
  if (post.barangay) return String(post.barangay).trim().toLowerCase();

  const locationParts = getLocationParts(post.locationName);
  const hasPurokSegment = locationParts.some((part) =>
    /^(?:purok|pk\.?)\s+/i.test(part),
  );
  const parts = locationParts.filter(
    (part) => !/^(?:purok|pk\.?)\s+/i.test(part),
  );

  // Current posts use "Province, Barangay, Pk.". Older posts generally use
  // "Barangay, Municipality", so their first segment is the barangay.
  const usesCurrentFormat =
    (hasPurokSegment || Boolean(post.purok)) && parts.length >= 2;
  return (usesCurrentFormat ? parts[1] : parts[0] || "").toLowerCase();
};

const formatRelativeTime = (timestamp, now) => {
  if (!timestamp) return "Just now";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  let relativeTime;

  if (seconds < 60) relativeTime = `${seconds}s`;
  else if (seconds < 3600) relativeTime = `${Math.floor(seconds / 60)}m`;
  else if (seconds < 86400) relativeTime = `${Math.floor(seconds / 3600)}h`;
  else relativeTime = `${Math.floor(seconds / 86400)}d`;

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${dateLabel} • ${relativeTime}`;
};

export default function AssessmentList({
  status,
  searchText = "",
  filters = {},
  enabledFilters = [],
  setSelectedPost,
}) {
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState([]);
  const [authorPoints, setAuthorPoints] = useState({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          snapshot.docs.map((postDocument) => ({
            id: postDocument.id,
            ...postDocument.data(),
          })),
        );
      },
      (error) => console.log("Unable to load assessment posts:", error),
    );
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const pointsByUserId = {};
      snapshot.forEach((userDocument) => {
        pointsByUserId[userDocument.id] = userDocument.data().points ?? 0;
      });
      setAuthorPoints(pointsByUserId);
    });
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);

    return () => {
      unsubscribePosts();
      unsubscribeUsers();
      clearInterval(timer);
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const keyword = searchText.toLowerCase().trim();

    return posts.filter((post) => {
      const matchesStatus =
        (post.status || "pending").toLowerCase() === status.toLowerCase();
      const matchesSearch =
        !keyword ||
        `${post.firstName || ""} ${post.lastName || ""}`
          .toLowerCase()
          .includes(keyword) ||
        (post.caption || "").toLowerCase().includes(keyword) ||
        (post.title || "").toLowerCase().includes(keyword) ||
        (post.locationName || "").toLowerCase().includes(keyword) ||
        (post.purok || "").toLowerCase().includes(keyword);

      const resident =
        `${post.firstName || ""} ${post.lastName || ""}`.toLowerCase();
      const matchesFilters = enabledFilters.every((filterName) => {
        const filterValue = (filters[filterName] || "").toLowerCase().trim();
        if (!filterValue) return true;

        if (filterName === "purok") {
          const normalizedFilter = normalizePurok(filterValue).toLowerCase();
          const postPurok = getPostPurok(post);
          return Boolean(postPurok) && postPurok === normalizedFilter;
        }
        if (filterName === "barangay") {
          return getPostBarangay(post).includes(filterValue);
        }
        if (filterName === "resident") return resident.includes(filterValue);
        return true;
      });

      return matchesStatus && matchesSearch && matchesFilters;
    });
  }, [enabledFilters, filters, posts, searchText, status]);

  const cardWidth = width < 850 ? "100%" : width < 1250 ? "48.5%" : "32%";
  const statusDetails =
    STATUS_DETAILS[status.toLowerCase()] || STATUS_DETAILS.pending;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.title}>{statusDetails.label}</Text>
          <Text style={styles.resultCount}>
            {filteredPosts.length} report{filteredPosts.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredPosts.length ? (
          <View style={styles.postContainer}>
            {filteredPosts.map((post) => {
              const postStatus =
                STATUS_DETAILS[(post.status || "pending").toLowerCase()] ||
                STATUS_DETAILS.pending;

              return (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.postCard, { width: cardWidth }]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedPost(post)}
                >
                  <View style={styles.authorRow}>
                    <Image
                      source={require("../../../assets/images/profile2.png")}
                      style={styles.profileImage}
                    />
                    <View style={styles.authorDetails}>
                      <View style={styles.authorHeader}>
                        <Text style={styles.profileName} numberOfLines={1}>
                          {post.firstName} {post.lastName}
                          <Text style={styles.pointsText}>
                            {" "}
                            • {authorPoints[post.userId] ??
                              post.points ??
                              0}{" "}
                            pts
                          </Text>
                        </Text>
                        <Text style={styles.postedAt}>
                          {formatRelativeTime(post.createdAt, now)}
                        </Text>
                      </View>

                      <View style={styles.locationRow}>
                        <Image
                          source={require("../../../assets/images/location.png")}
                          style={styles.locationIcon}
                        />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {formatLocationWithPurok(
                            post.locationName,
                            post.purok,
                          )}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusTag,
                          { backgroundColor: postStatus.color },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {postStatus.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: post.imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </View>

                  {Boolean(post.title) && (
                    <Text style={styles.postTitle} numberOfLines={1}>
                      {post.title}
                    </Text>
                  )}
                  {Boolean(post.caption) && (
                    <Text style={styles.postDescription} numberOfLines={3}>
                      {post.caption}
                    </Text>
                  )}

                  <View style={styles.reactionRow}>
                    <View style={styles.priorityContainer}>
                      <Image
                        source={require("../../../assets/images/priorityreact_gray.png")}
                        style={styles.smallIcon}
                      />
                      <Text style={styles.actionText}>
                        {post.reactionCount ?? 0}
                      </Text>
                    </View>
                    <View style={styles.commentContainer}>
                      <Image
                        source={require("../../../assets/images/comment.png")}
                        style={styles.smallIcon}
                      />
                      <Text style={styles.actionText}>
                        {post.commentCount ?? 0} Comments
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No reports found</Text>
            <Text style={styles.emptyText}>
              Reports matching this status and search will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { color: "#397A51", fontSize: 24, fontWeight: "800" },
  resultCount: { color: "#7A8A80", fontSize: 12, marginTop: 2 },
  scrollContent: { paddingBottom: 30 },
  postContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 18,
  },
  postCard: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  authorRow: { flexDirection: "row", alignItems: "flex-start" },
  profileImage: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  authorDetails: { flex: 1 },
  authorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  profileName: {
    flexShrink: 1,
    color: "#222222",
    fontWeight: "700",
    fontSize: 14,
  },
  pointsText: { color: "#2E7D32", fontWeight: "600", fontSize: 12 },
  postedAt: { color: "#888888", fontSize: 10 },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  locationIcon: {
    width: 12,
    height: 12,
    resizeMode: "contain",
    tintColor: "#666666",
    marginRight: 4,
  },
  locationText: { flex: 1, color: "#666666", fontSize: 12 },
  statusTag: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  postTitle: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },
  postDescription: {
    color: "#333333",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  imageContainer: {
    width: "100%",
    height: 230,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#C9DCCF",
    backgroundColor: "#EBEBEB",
  },
  image: { width: "100%", height: "100%" },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
  },
  commentContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
  },
  smallIcon: { width: 19, height: 19, resizeMode: "contain" },
  actionText: { color: "#555555", fontSize: 12, fontWeight: "600" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CCDAD1",
    backgroundColor: "#FAFCFB",
  },
  emptyTitle: { color: "#397A51", fontSize: 17, fontWeight: "800" },
  emptyText: {
    color: "#7A8A80",
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },
});
