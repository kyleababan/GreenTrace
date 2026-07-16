import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Navbar from "../components/navbar";
import { db } from "../firebaseConfig";

export default function Volunteer() {
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setLoadError("");
    try {
      const snapshot = await getDocs(collection(db, "volunteer_posts"));
      const openActivities = snapshot.docs
        .map((activity) => ({ id: activity.id, ...activity.data() }))
        .filter((activity) => activity.status === "open")
        .sort((firstActivity, secondActivity) =>
          (secondActivity.createdAt?.seconds || 0) - (firstActivity.createdAt?.seconds || 0)
        );

      setActivities(openActivities);
    } catch (error) {
      console.error("Unable to load volunteer activities:", error);
      setLoadError("Unable to load volunteer activities. Please pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities])
  );

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return activities;

    return activities.filter((activity) =>
      [activity.title, activity.description, activity.locationName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [activities, search]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <View style={styles.searchRow}>
            <Image source={require("../assets/images/minicon.png")} style={styles.logo} />
            <View style={styles.searchBox}>
              <Ionicons name="search" size={19} color="#6b7b70" />
              <TextInput placeholder="Search volunteer activities" style={styles.searchInput} placeholderTextColor="#6b7b70" value={search} onChangeText={setSearch} />
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateContainer}><ActivityIndicator size="large" color="#5F9C76" /></View>
        ) : (
          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActivities(true)} colors={["#5F9C76"]} />}
          >
            {loadError ? <Text style={styles.emptyText}>{loadError}</Text> : null}
            {filteredActivities.map((activity) => {
              const memberCount = Number.isFinite(Number(activity.joinedCount)) ? Number(activity.joinedCount) : activity.volunteers?.length || 0;
              const maxVolunteers = activity.maxVolunteers || 0;

              return (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.card}
                  onPress={() => router.push({ pathname: "/volunteering", params: { volunteerId: activity.id } })}
                >
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{activity.title || "Volunteer activity"}</Text>
                    <Text style={styles.cardDescription} numberOfLines={3}>{activity.description || "No description provided."}</Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={15} color="#4d6756" />
                      <Text style={styles.locationText} numberOfLines={1}>{activity.locationName || "Location not specified"}</Text>
                    </View>
                    <View style={styles.cardFooter}>
                      <Text style={styles.memberCount}>{memberCount} / {maxVolunteers} joined</Text>
                      <View style={styles.volunteerButton}><Text style={styles.volunteerButtonText}>View</Text></View>
                    </View>
                  </View>
                  {activity.imageUrl ? <Image source={{ uri: activity.imageUrl }} style={styles.cardImage} /> : <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={28} color="#71907d" /></View>}
                </TouchableOpacity>
              );
            })}
            {!loadError && !filteredActivities.length ? <Text style={styles.emptyText}>No open volunteer activities found.</Text> : null}
          </ScrollView>
        )}

        <View style={styles.navbarContainer}><Navbar /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: "center", backgroundColor: "#f5f6f5" },
  container: { flex: 1, width: "100%", maxWidth: 500, backgroundColor: "#f5f6f5" },
  topSection: { padding: 20, backgroundColor: "#5F9C76" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 46, height: 46 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: 42, color: "#223229" },
  stateContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  feed: { flex: 1, paddingHorizontal: 16 },
  feedContent: { paddingVertical: 16, gap: 12, flexGrow: 1 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 12, minHeight: 138 },
  cardLeft: { flex: 1, justifyContent: "space-between", minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1d2b21" },
  cardDescription: { fontSize: 12, color: "#4c5d51", lineHeight: 17, marginTop: 5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  locationText: { flex: 1, fontSize: 12, color: "#4d6756" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  memberCount: { fontSize: 12, color: "#27734d", fontWeight: "700" },
  volunteerButton: { backgroundColor: "#5F9C76", paddingVertical: 7, paddingHorizontal: 15, borderRadius: 7 },
  volunteerButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  cardImage: { width: 102, height: 102, borderRadius: 9, alignSelf: "center" },
  imagePlaceholder: { width: 102, height: 102, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#dfe8e2", alignSelf: "center" },
  emptyText: { textAlign: "center", color: "#63756a", marginTop: 28, paddingHorizontal: 20 },
  navbarContainer: { borderTopWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
});
