import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { db } from "../firebaseConfig";
import { mergeUniqueById } from "../utils/pagination";

const ACTIVITIES_PER_PAGE = 5;

export default function Volunteer() {
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const loadActivities = useCallback(
    async (isRefresh = false, loadNext = false, reset = false) => {
      if (loadingRef.current) return;
      if (loadNext && !hasMoreRef.current) return;

      loadingRef.current = true;
      if (isRefresh || reset) {
        lastDocRef.current = null;
        hasMoreRef.current = true;
        setHasMore(true);
      }
      if (isRefresh) {
        setRefreshing(true);
      } else if (loadNext) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setLoadError("");
      try {
        const constraints = [
          where("status", "==", "open"),
          orderBy("createdAt", "desc"),
          limit(ACTIVITIES_PER_PAGE),
        ];
        if (loadNext && lastDocRef.current) {
          constraints.splice(2, 0, startAfter(lastDocRef.current));
        }

        const snapshot = await getDocs(
          query(collection(db, "volunteer_posts"), ...constraints),
        );
        const volunteerActivities = snapshot.docs.map((activity) => ({
          id: activity.id,
          ...activity.data(),
        }));

        const checkedActivities = await Promise.all(
          volunteerActivities.map(async (activity) => {
            if (!activity.postId) return activity;

            try {
              const sourcePost = await getDoc(
                doc(db, "posts", activity.postId),
              );
              return sourcePost.exists() &&
                sourcePost.data().status !== "cleaned"
                ? activity
                : null;
            } catch (error) {
              console.error("Unable to check linked report status:", error);
              return activity;
            }
          }),
        );

        const openActivities = checkedActivities.filter(Boolean);

        setActivities((current) =>
          isRefresh || reset || !loadNext
            ? openActivities
            : mergeUniqueById(current, openActivities),
        );
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
        hasMoreRef.current = snapshot.docs.length === ACTIVITIES_PER_PAGE;
        setHasMore(hasMoreRef.current);
      } catch (error) {
        console.error("Unable to load volunteer activities:", error);
        setLoadError(
          "Unable to load volunteer activities. Please pull to refresh.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadActivities(false, false, true);
    }, [loadActivities]),
  );

  const handleFeedScroll = ({ nativeEvent }) => {
    const reachedBottom =
      nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
      nativeEvent.contentSize.height - 160;

    if (reachedBottom) loadActivities(false, true);
  };

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return activities;

    return activities.filter((activity) =>
      [activity.title, activity.description, activity.locationName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [activities, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* HOME-STYLE VOLUNTEER HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <Image
                source={require("../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#6B7B70" />
                <TextInput
                  placeholder="Search volunteer activities..."
                  style={styles.searchInput}
                  placeholderTextColor="#6B7B70"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
              onScroll={handleFeedScroll}
              scrollEventThrottle={200}
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
                const memberCount = Number.isFinite(
                  Number(activity.joinedCount),
                )
                  ? Number(activity.joinedCount)
                  : activity.volunteers?.length || 0;
                const maxVolunteers = activity.maxVolunteers || 0;

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
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {memberCount}/{maxVolunteers}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {activity.description || "No description provided."}
                      </Text>

                      <View style={styles.cardFooter}>
                        <View style={styles.locationRow}>
                          <Ionicons
                            name="location-outline"
                            size={14}
                            color="#64748B"
                          />
                          <Text style={styles.locationText} numberOfLines={1}>
                            {activity.locationName || "Location not specified"}
                          </Text>
                        </View>
                        <Text style={styles.viewLink}>View details ›</Text>
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
                <Text style={styles.emptyText}>
                  No open volunteer activities found.
                </Text>
              ) : null}
              {hasMore && !loadingMore && (
                <TouchableOpacity onPress={() => loadActivities(false, true)}>
                  <Text style={styles.emptyText}>Load more activities</Text>
                </TouchableOpacity>
              )}
              {loadingMore && <ActivityIndicator color="#5F9C76" />}
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

  /* HEADER STYLES - ALIGNED WITH HOME FEED */
  topSection: {
    height: 82,
    justifyContent: "center",
    backgroundColor: "#5F9C76",
    paddingHorizontal: 16,
    paddingVertical: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 38,
    height: 38,
    tintColor: "#f6f6f6",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: "#0F172A",
    fontSize: 14,
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
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5F9C76",
  },
  cardDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
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
