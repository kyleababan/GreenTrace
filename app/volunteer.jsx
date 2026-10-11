import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Navbar from "../components/navbar";
import { formatLocationWithPurok } from "../constants/locationFormat";
import { auth, db } from "../firebaseConfig";

const formatMeetingDate = (value) => {
  if (!value) return "";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const FILTER_TABS = [
  { id: "all", label: "All Activities", icon: "grid-outline" },
  { id: "my_activities", label: "My Activities", icon: "checkmark-circle-outline" },
  { id: "ongoing", label: "On-Going", icon: "flash-outline" },
  { id: "events", label: "Events", icon: "calendar-outline" },
  { id: "cleanups", label: "Cleanups", icon: "trash-bin-outline" },
  { id: "open", label: "Open Slots", icon: "people-outline" },
];

export default function Volunteer() {
  const router = useRouter();
  const currentUserId = auth.currentUser?.uid || "";

  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setLoadError("");
    try {
      const snapshot = await getDocs(collection(db, "volunteer_posts"));
      const volunteerActivities = snapshot.docs
        .map((activity) => ({ id: activity.id, ...activity.data() }))
        .filter((activity) => {
          const status = String(activity.status || "").toLowerCase();
          const isCompleted = ["completed", "cleaned"].includes(status);
          const isVisible = [
            "open",
            "ongoing",
            "on-going",
            "cancelled",
          ].includes(status);
          return isVisible && !isCompleted;
        });

      const checkedActivities = await Promise.all(
        volunteerActivities.map(async (activity) => {
          if (!activity.postId) return activity;

          try {
            const sourcePost = await getDoc(doc(db, "posts", activity.postId));
            return sourcePost.exists() && sourcePost.data().status !== "cleaned"
              ? activity
              : null;
          } catch (error) {
            console.error("Unable to check linked report status:", error);
            return activity;
          }
        }),
      );

      const openActivities = checkedActivities
        .filter(Boolean)
        .sort(
          (firstActivity, secondActivity) =>
            (secondActivity.createdAt?.seconds || 0) -
            (firstActivity.createdAt?.seconds || 0),
        );

      setActivities(openActivities);
    } catch (error) {
      console.error("Unable to load volunteer activities:", error);
      setLoadError(
        "Unable to load volunteer activities. Please pull to refresh.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities]),
  );

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const isStandaloneEvent =
        !activity.postId && Boolean(activity.eventType);
      const memberCount = Number.isFinite(Number(activity.joinedCount))
        ? Number(activity.joinedCount)
        : activity.volunteers?.length || 0;
      const maxVolunteers = Number(activity.maxVolunteers) || 0;
      const isFull = maxVolunteers > 0 && memberCount >= maxVolunteers;
      const status = String(activity.status || "").toLowerCase();
      const isOngoing = ["ongoing", "on-going"].includes(status);
      const isCancelled = status === "cancelled";

      // Category Filter Check
      if (selectedFilter === "my_activities") {
        if (!currentUserId) return false;
        const vols = Array.isArray(activity.volunteers) ? activity.volunteers : [];
        const isUserJoined = vols.some((v) => {
          const uid = typeof v === "string" ? v : v?.userId || v?.uid || v?.id;
          return uid === currentUserId;
        });
        if (!isUserJoined) return false;
      } else if (selectedFilter === "ongoing" && !isOngoing) {
        return false;
      } else if (selectedFilter === "events" && !isStandaloneEvent) {
        return false;
      } else if (selectedFilter === "cleanups" && isStandaloneEvent) {
        return false;
      } else if (selectedFilter === "open" && (isFull || isCancelled)) {
        return false;
      }

      // Keyword Search Check
      if (keyword) {
        const matchesKeyword = [
          activity.title,
          activity.description,
          activity.locationName,
          activity.purok,
          activity.barangay,
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(keyword));

        if (!matchesKeyword) return false;
      }

      return true;
    });
  }, [activities, search, selectedFilter, currentUserId]);

  const myJoinedCount = useMemo(() => {
    if (!currentUserId) return 0;
    return activities.filter((activity) => {
      const vols = Array.isArray(activity.volunteers) ? activity.volunteers : [];
      return vols.some(
        (v) =>
          (typeof v === "string" ? v : v?.userId || v?.uid || v?.id) ===
          currentUserId,
      );
    }).length;
  }, [activities, currentUserId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* TOP HEADER SECTION */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Volunteer Activities</Text>
                <Text style={styles.headerSubtitle}>
                  Join community cleanup drives & earn EcoPoints
                </Text>
              </View>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* FIXED CONTROLS BELOW HEADER: SEARCH BAR + FILTER TABS */}
          <View style={styles.controlsWrapper}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color="#5C7366" />
              <TextInput
                placeholder="Search activity, purok, or location..."
                style={styles.searchInput}
                placeholderTextColor="#7C9083"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Tabs Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {FILTER_TABS.map((tab) => {
                const isActive = selectedFilter === tab.id;
                const labelText =
                  tab.id === "my_activities" && myJoinedCount > 0
                    ? `${tab.label} (${myJoinedCount})`
                    : tab.label;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedFilter(tab.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={13}
                      color={isActive ? "#FFFFFF" : "#4A6153"}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {labelText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#5F9C76" />
            </View>
          ) : (
            <ScrollView
              style={styles.feed}
              contentContainerStyle={styles.feedContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadActivities(true)}
                  colors={["#5F9C76"]}
                />
              }
            >
              {loadError ? (
                <Text style={styles.emptyText}>{loadError}</Text>
              ) : null}
              {filteredActivities.map((activity) => {
                const isStandaloneEvent =
                  !activity.postId && Boolean(activity.eventType);
                const memberCount = Number.isFinite(
                  Number(activity.joinedCount),
                )
                  ? Number(activity.joinedCount)
                  : activity.volunteers?.length || 0;
                const maxVolunteers = Number(activity.maxVolunteers) || 0;
                const isFull =
                  maxVolunteers > 0 && memberCount >= maxVolunteers;
                const status = String(activity.status || "").toLowerCase();
                const isOngoing = ["ongoing", "on-going"].includes(status);
                const isCancelled = status === "cancelled";
                const isUserJoined =
                  Boolean(currentUserId) &&
                  Array.isArray(activity.volunteers) &&
                  activity.volunteers.some((v) => {
                    const uid = typeof v === "string" ? v : v?.userId || v?.uid || v?.id;
                    return uid === currentUserId;
                  });

                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={styles.card}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: "/volunteering",
                        params: { volunteerId: activity.id },
                      })
                    }
                  >
                    <View style={styles.cardLeft}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {activity.title || "Volunteer Activity"}
                        </Text>
                        <View style={styles.cardBadges}>
                          {isUserJoined && (
                            <View style={styles.joinedBadge}>
                              <Ionicons
                                name="checkmark-circle"
                                size={10}
                                color="#166534"
                                style={{ marginRight: 2 }}
                              />
                              <Text style={styles.joinedBadgeText}>Joined</Text>
                            </View>
                          )}
                          {isCancelled ? (
                            <View style={styles.cancelledBadge}>
                              <Ionicons
                                name="close-circle"
                                size={10}
                                color="#DC2626"
                                style={{ marginRight: 2 }}
                              />
                              <Text style={styles.cancelledBadgeText}>
                                Cancelled
                              </Text>
                            </View>
                          ) : isOngoing ? (
                            <View style={styles.ongoingBadge}>
                              <Ionicons
                                name="flash"
                                size={10}
                                color="#D97706"
                                style={{ marginRight: 2 }}
                              />
                              <Text style={styles.ongoingBadgeText}>
                                On-Going
                              </Text>
                            </View>
                          ) : isStandaloneEvent ? (
                            <View style={styles.eventBadge}>
                              <Text style={styles.eventBadgeText}>Event</Text>
                            </View>
                          ) : null}

                          <View
                            style={[
                              styles.badge,
                              isFull && styles.badgeFull,
                              isOngoing && styles.badgeOngoing,
                              isCancelled && styles.badgeCancelled,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                isFull && styles.badgeTextFull,
                                isCancelled && styles.badgeTextCancelled,
                              ]}
                            >
                              {isCancelled
                                ? "Cancelled"
                                : isFull
                                  ? `Full ${memberCount}/${maxVolunteers}`
                                  : `${memberCount}/${maxVolunteers}`}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {isCancelled && Boolean(activity.cancellationReason) ? (
                        <Text style={styles.cancellationReasonText} numberOfLines={1}>
                          Cancelled: {activity.cancellationReason}
                        </Text>
                      ) : null}

                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {activity.description || "No description provided."}
                      </Text>

                      {isStandaloneEvent && activity.meetingDate ? (
                        <View style={styles.eventDateRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color="#64748B"
                          />
                          <Text style={styles.eventDateText}>
                            {formatMeetingDate(activity.meetingDate)}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.cardFooter}>
                        <View style={styles.locationRow}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color="#64748B"
                          />
                          <Text style={styles.locationText} numberOfLines={1}>
                            {formatLocationWithPurok(activity) ||
                              "Location not specified"}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.viewLink,
                            isOngoing && styles.viewLinkOngoing,
                          ]}
                        >
                          {isOngoing
                            ? "Happening now ›"
                            : isStandaloneEvent
                              ? "Join event ›"
                              : "View details ›"}
                        </Text>
                      </View>
                    </View>

                    {activity.imageUrl ? (
                      <Image
                        source={{ uri: activity.imageUrl }}
                        style={styles.cardImage}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons
                          name="image-outline"
                          size={22}
                          color="#CBD5E1"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {!loadError && !filteredActivities.length ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={38} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No activities found</Text>
                  <Text style={styles.emptySubtext}>
                    {search.trim() || selectedFilter !== "all"
                      ? "No volunteer activities match your search or filter."
                      : "There are currently no open volunteer activities."}
                  </Text>
                  {(search.trim() || selectedFilter !== "all") && (
                    <TouchableOpacity
                      style={styles.resetFilterBtn}
                      onPress={() => {
                        setSearch("");
                        setSelectedFilter("all");
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resetFilterBtnText}>
                        Reset search & filters
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </ScrollView>
          )}

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
    backgroundColor: "#f6f6f6",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#f6f6f6",
  },

  /* HEADER STYLES - ALIGNED WITH NOTIFICATIONS & PROFILE */
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: "#5F9C76",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#E8F3EC",
    marginTop: 2,
  },
  logo: {
    width: 36,
    height: 36,
    tintColor: "#FFFFFF",
    opacity: 0.95,
  },

  /* FIXED CONTROLS BELOW HEADER */
  controlsWrapper: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F3",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2EBE5",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: "#0F172A",
    fontSize: 13,
  },
  filterChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F3",
    borderWidth: 1,
    borderColor: "#E2EBE5",
  },
  filterChipActive: {
    backgroundColor: "#276344",
    borderColor: "#276344",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#556E60",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },

  /* SUB-FILTERS & SORTING ROW */
  subFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
    paddingBottom: 2,
  },
  subFilterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 2,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sortChipActive: {
    backgroundColor: "#334155",
    borderColor: "#334155",
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  sortChipTextActive: {
    color: "#FFFFFF",
  },
  subFilterDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },

  /* USER MILESTONE BANNER */
  milestoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: -4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 10,
  },
  milestoneIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065F46",
  },
  milestoneSubtext: {
    fontSize: 11,
    color: "#047857",
    marginTop: 1,
  },
  milestoneBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  milestoneBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  /* CONTENT STYLES */
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feed: {
    flex: 1,
    paddingHorizontal: 16,
  },
  feedContent: {
    paddingVertical: 16,
    gap: 12,
    flexGrow: 1,
  },
  feedContentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  /* CARD STYLES */
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardLeft: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  badge: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  badgeFull: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5F9C76",
  },
  badgeTextFull: {
    color: "#DC2626",
  },
  joinedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    flexDirection: "row",
    alignItems: "center",
  },
  joinedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  eventBadge: {
    backgroundColor: "#EAF4ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#276344",
  },
  ongoingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexDirection: "row",
    alignItems: "center",
  },
  ongoingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },
  cancelledBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
  },
  cancelledBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#DC2626",
  },
  badgeOngoing: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  badgeCancelled: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  badgeTextCancelled: {
    color: "#DC2626",
  },
  cancellationReasonText: {
    fontSize: 11,
    color: "#DC2626",
    fontStyle: "italic",
    marginTop: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
  },
  eventDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  eventDateText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "400",
  },
  viewLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5F9C76",
  },
  viewLinkOngoing: {
    color: "#D97706",
    fontWeight: "700",
  },
  cardImage: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  imagePlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 45,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 8,
    backgroundColor: "#EAF4ED",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#276344",
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 32,
    paddingHorizontal: 20,
  },

  /* NAVBAR CONTAINER */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
});
