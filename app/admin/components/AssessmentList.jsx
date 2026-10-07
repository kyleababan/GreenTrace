import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
    formatWasteLabel,
    getWasteCategoryColor,
} from "../../../constants/wasteCategories";
import { db } from "../../../firebaseConfig";
import { getNameInitials } from "../../../utils/getNameInitials";
import { hideBadWords } from "../../../utils/hideBadWords";

const STATUS_DETAILS = {
  pending: { label: "Not Assessed", color: "#A5A5A5", textColor: "#FFFFFF" },
  critical: { label: "Critical", color: "#FF5B5B", textColor: "#FFFFFF" },
  moderate: { label: "Moderate", color: "#ff8c40", textColor: "#3D2B00" },
  cleaned: { label: "Cleaned", color: "#34C759", textColor: "#FFFFFF" },
  ongoing: { label: "On-going", color: "#FFC940", textColor: "#FFFFFF" },
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

const getTimestampMillis = (timestamp) => {
  if (!timestamp) return 0;

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : typeof timestamp.seconds === "number"
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export default function AssessmentList({
  status,
  searchText = "",
  filters = {},
  enabledFilters = [],
  setSelectedPost,
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const initialBatchSize = isMobile ? 5 : width < 1250 ? 5 : 6;
  const nextBatchSize = isMobile ? 4 : width < 1250 ? 4 : 6;
  const [posts, setPosts] = useState([]);
  const [authorPoints, setAuthorPoints] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [volunteerPostMap, setVolunteerPostMap] = useState({});
  const [completedEvents, setCompletedEvents] = useState([]);
  const [pagination, setPagination] = useState({ key: "", count: 0 });
  const loadedNearEnd = useRef(false);
  const paginationKey = JSON.stringify([
    status,
    searchText,
    enabledFilters,
    filters,
  ]);
  const visibleCount =
    pagination.key === paginationKey ? pagination.count : initialBatchSize;

  useEffect(() => {
    loadedNearEnd.current = false;
  }, [paginationKey]);

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
    const unsubscribeVolunteerPosts = onSnapshot(
      collection(db, "volunteer_posts"),
      (snapshot) => {
        const map = {};
        const events = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.postId) {
            map[data.postId] = doc.id;
          } else if (
            data.eventType &&
            ["completed", "cleaned"].includes(
              String(data.status || "").toLowerCase(),
            )
          ) {
            events.push({
              id: doc.id,
              ...data,
              status: "cleaned",
              isVolunteerEvent: true,
            });
          }
        });
        setVolunteerPostMap(map);
        setCompletedEvents(events);
      },
      (error) => console.error("Unable to load volunteer events:", error),
    );
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);

    return () => {
      unsubscribePosts();
      unsubscribeUsers();
      unsubscribeVolunteerPosts();
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

  const filteredEvents = useMemo(() => {
    if (status.toLowerCase() !== "cleaned") return [];

    const keyword = searchText.toLowerCase().trim();
    return completedEvents.filter((event) => {
      const matchesSearch =
        !keyword ||
        event.title?.toLowerCase().includes(keyword) ||
        event.description?.toLowerCase().includes(keyword) ||
        event.locationName?.toLowerCase().includes(keyword);
      const matchesFilters = enabledFilters.every((filterName) => {
        const filterValue = (filters[filterName] || "").toLowerCase().trim();
        if (!filterValue) return true;
        if (filterName === "resident") return false;
        if (filterName === "purok") {
          return (
            getPostPurok(event) === normalizePurok(filterValue).toLowerCase()
          );
        }
        if (filterName === "barangay") {
          return getPostBarangay(event).includes(filterValue);
        }
        return true;
      });

      return matchesSearch && matchesFilters;
    });
  }, [completedEvents, enabledFilters, filters, searchText, status]);

  const sortedItems = useMemo(
    () =>
      [...filteredPosts, ...filteredEvents].sort((firstItem, secondItem) => {
        const firstCompletion = firstItem.isVolunteerEvent
          ? firstItem.completedAt || firstItem.createdAt
          : firstItem.cleanedAt ||
            firstItem.completedAt ||
            firstItem.createdAt;
        const secondCompletion = secondItem.isVolunteerEvent
          ? secondItem.completedAt || secondItem.createdAt
          : secondItem.cleanedAt ||
            secondItem.completedAt ||
            secondItem.createdAt;
        return (
          getTimestampMillis(secondCompletion) -
          getTimestampMillis(firstCompletion)
        );
      }),
    [filteredEvents, filteredPosts],
  );

  const hasVisibleItems = sortedItems.length > 0;
  const visibleItems = sortedItems.slice(0, visibleCount);
  const hasMoreItems = visibleCount < sortedItems.length;
  const cardWidth = isMobile ? "100%" : width < 1250 ? "48%" : "31%";
  const statusDetails =
    STATUS_DETAILS[status.toLowerCase()] || STATUS_DETAILS.pending;

  const handleListScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const loadThreshold = 180;

    if (distanceFromEnd > loadThreshold * 1.5) {
      loadedNearEnd.current = false;
      return;
    }

    if (
      contentOffset.y > 0 &&
      distanceFromEnd <= loadThreshold &&
      hasMoreItems &&
      !loadedNearEnd.current
    ) {
      loadedNearEnd.current = true;
      setPagination((current) => ({
        key: paginationKey,
        count:
          (current.key === paginationKey
            ? current.count
            : initialBatchSize) + nextBatchSize,
      }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.title}>{statusDetails.label}</Text>
          <Text style={styles.resultCount}>
            {status.toLowerCase() === "cleaned"
              ? `${filteredPosts.length} report${filteredPosts.length === 1 ? "" : "s"} · ${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"}`
              : `${filteredPosts.length} report${filteredPosts.length === 1 ? "" : "s"}`}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
      >
        {hasVisibleItems ? (
          <View style={styles.postContainer}>
            {visibleItems.map((item) => {
              if (item.isVolunteerEvent) {
                const event = item;
                const completedAt = event.completedAt || event.createdAt;

                return (
                  <TouchableOpacity
                    key={`event-${event.id}`}
                    style={[
                      styles.postCard,
                      isMobile && styles.postCardMobile,
                      { width: cardWidth },
                    ]}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname:
                          "/admin/assessments/post_view/VolunteerPostDetail",
                        params: { volunteerId: event.id },
                      })
                    }
                  >
                    <View style={styles.eventHeader}>
                      <View style={styles.eventIcon}>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color="#276344"
                        />
                      </View>
                      <View style={styles.eventTitleContainer}>
                        <Text style={styles.profileName} numberOfLines={1}>
                          {hideBadWords(event.title || "Volunteer event")}
                        </Text>
                        <Text style={styles.postedAt}>
                          Completed {formatRelativeTime(completedAt, now)}
                        </Text>
                      </View>
                      <View style={styles.eventTag}>
                        <Text style={styles.eventTagText}>Event</Text>
                      </View>
                    </View>
                    <View style={styles.tagsRow}>
                      <View
                        style={[
                          styles.statusTag,
                          { backgroundColor: STATUS_DETAILS.cleaned.color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: STATUS_DETAILS.cleaned.textColor },
                          ]}
                        >
                          Cleaned
                        </Text>
                      </View>
                    </View>
                    {event.locationName ? (
                      <View style={styles.locationRow}>
                        <Image
                          source={require("../../../assets/images/location.png")}
                          style={styles.locationIcon}
                        />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {formatLocationWithPurok(
                            event.locationName,
                            event.purok,
                          )}
                        </Text>
                      </View>
                    ) : null}
                    {event.imageUrl ? (
                      <View
                        style={[
                          styles.imageContainer,
                          isMobile && styles.imageContainerMobile,
                        ]}
                      >
                        <Image
                          source={{ uri: event.imageUrl }}
                          style={styles.image}
                          resizeMode="cover"
                        />
                      </View>
                    ) : null}
                    {event.description ? (
                      <Text style={styles.postDescription} numberOfLines={3}>
                        {hideBadWords(event.description)}
                      </Text>
                    ) : null}
                    <Text style={styles.eventOpenDetails}>
                      View event details ›
                    </Text>
                  </TouchableOpacity>
                );
              }

              const post = item;
              const postStatus =
                STATUS_DETAILS[(post.status || "pending").toLowerCase()] ||
                STATUS_DETAILS.pending;
              const displayDate =
                post.status?.toLowerCase() === "cleaned"
                  ? post.cleanedAt || post.completedAt || post.createdAt
                  : post.createdAt;

              return (
                <View
                  key={post.id}
                  style={[styles.postCardWrapper, { width: cardWidth }]}
                >
                  <TouchableOpacity
                    style={[
                      styles.postCard,
                      isMobile && styles.postCardMobile,
                      { width: "100%" },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedPost(post)}
                  >
                  <View style={styles.authorRow}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>
                        {getNameInitials(
                          `${post.firstName || ""} ${post.lastName || ""}`,
                        )}
                      </Text>
                    </View>
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
                        {Boolean(volunteerPostMap[post.id]) && (
                          <View style={styles.activityIndicatorBadge}>
                            <Ionicons
                              name="calendar-outline"
                              size={11}
                              color="#205A38"
                            />
                            <Text style={styles.activityIndicatorText}>
                              Activity Exists
                            </Text>
                          </View>
                        )}
                        <Text style={styles.postedAt}>
                          {formatRelativeTime(displayDate, now)}
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

                      {/* Report Status & Waste Category Tags */}
                      <View style={styles.tagsRow}>
                        <View
                          style={[
                            styles.statusTag,
                            { backgroundColor: postStatus.color },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              { color: postStatus.textColor },
                            ]}
                          >
                            {postStatus.label}
                          </Text>
                        </View>

                        {Boolean(
                          formatWasteLabel(post.wasteClassification),
                        ) && (
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
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.imageContainer,
                      isMobile && styles.imageContainerMobile,
                    ]}
                  >
                    <Image
                      source={{ uri: post.imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </View>

                  {Boolean(post.title) && (
                    <Text style={styles.postTitle} numberOfLines={1}>
                      {hideBadWords(post.title)}
                    </Text>
                  )}
                  {Boolean(post.caption) && (
                    <Text style={styles.postDescription} numberOfLines={3}>
                      {hideBadWords(post.caption)}
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
                </View>
              );
            })}
            {hasMoreItems && (
              <Text style={styles.loadMoreHint}>
                Scroll to load more reports
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No {statusDetails.label.toLowerCase()} items found</Text>
            <Text style={styles.emptyText}>
              Reports and completed events matching this status and search will
              appear here.
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
    marginBottom: 12,
  },
  title: {
    color: "#234B33",
    fontSize: 24,
    fontWeight: "800",
  },
  resultCount: {
    color: "#52675A",
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: { paddingBottom: 30 },
  postContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 14,
  },
  loadMoreHint: {
    width: "100%",
    paddingVertical: 12,
    color: "#7A8A80",
    fontSize: 12,
    textAlign: "center",
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
  postCardWrapper: {
    minWidth: 0,
  },
  postCardMobile: {
    padding: 12,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF4ED",
  },
  eventTitleContainer: { flex: 1, minWidth: 0 },
  eventTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#EAF4ED",
  },
  eventTagText: { color: "#205A38", fontSize: 10, fontWeight: "700" },
  eventDate: { color: "#63756a", fontSize: 11, alignSelf: "center" },
  eventOpenDetails: {
    color: "#276344",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "right",
  },
  authorRow: { flexDirection: "row", alignItems: "flex-start" },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
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
  postedAt: { color: "#888888", fontSize: 10, flexShrink: 0 },
  activityIndicatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF5EF",
    borderWidth: 1,
    borderColor: "#A9D5BA",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    gap: 4,
    flexShrink: 0,
  },
  activityIndicatorText: {
    color: "#205A38",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  locationIcon: {
    width: 12,
    height: 12,
    resizeMode: "contain",
    tintColor: "#666666",
    marginRight: 4,
  },
  locationText: { flex: 1, color: "#666666", fontSize: 12 },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  statusTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  wasteTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wasteTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
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
  imageContainerMobile: {
    height: 190,
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
  actionText: {
    color: "#405047",
    fontSize: 12,
    fontWeight: "600",
  },
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
