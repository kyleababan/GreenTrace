import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

import { db } from "../../firebaseConfig";

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

const USERS_PER_PAGE = 10;

export default function UserList() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [users, setUsers] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(USERS_PER_PAGE);
  const [loadError, setLoadError] = useState("");
  const loadingRef = useRef(false);

  const loadUsers = useCallback(async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setLoadError("");

    try {
      const snapshot = await getDocs(
        query(collection(db, "users"), orderBy("firstName", "asc")),
      );
      const data = snapshot.docs.map((user) => ({
        id: user.id,
        ...user.data(),
      }));

      data.sort((firstUser, secondUser) =>
        getFullName(firstUser).localeCompare(getFullName(secondUser)),
      );
      setUsers(data);
      setVisibleCount(USERS_PER_PAGE);
    } catch (error) {
      console.error("Unable to load users:", error);
      setLoadError("Unable to load users. Please try again.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers]),
  );

  useEffect(() => {
    setVisibleCount(USERS_PER_PAGE);
  }, [search]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      const fullName = getFullName(user).toLowerCase();
      return (
        fullName.includes(keyword) ||
        [
          user.firstName,
          user.lastName,
          user.email,
          user.cellNumber,
          user.address,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword))
      );
    });
  }, [search, users]);

  const displayedUsers = useMemo(() => {
    return filteredUsers.slice(0, visibleCount);
  }, [filteredUsers, visibleCount]);

  const hasMore = visibleCount < filteredUsers.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + USERS_PER_PAGE);
  };

  const isTwoColumns = width >= 560;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchContainer,
          searchFocused && styles.searchContainerFocused,
        ]}
      >
        <Ionicons
          name="search"
          size={20}
          color="#78847c"
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Search users"
          style={styles.searchInput}
          placeholderTextColor="#78847c"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#5F9C76" />
        </View>
      ) : loadError ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.loadMoreButton, { marginTop: 12 }]}
            onPress={loadUsers}
          >
            <Text style={styles.loadMoreText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {displayedUsers.map((user) => {
            const name = getFullName(user);

            return (
              <TouchableOpacity
                key={user.id}
                style={[styles.card, isTwoColumns && styles.twoColumnCard]}
                onPress={() =>
                  router.push({
                    pathname: "/admin/assessments/post_view/UserPostDetail",
                    params: { userId: user.id },
                  })
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(name)}</Text>
                </View>
                <View style={styles.cardText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {user.isBanned ? (
                      <View style={styles.bannedPill}>
                        <Text style={styles.bannedPillText}>Banned</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.subtext} numberOfLines={1}>
                    {user.email || user.cellNumber || "No contact information"}
                  </Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.points}>
                      {Number(user.points) || 0} pts
                    </Text>
                    {Boolean(user.nsfwWarnings && user.nsfwWarnings > 0) && (
                      <Text style={styles.warningCountText}>
                        {user.nsfwWarnings} warning
                        {user.nsfwWarnings > 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {!filteredUsers.length && (
            <Text style={styles.emptyText}>No users match your search.</Text>
          )}
          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
            >
              <Text style={styles.loadMoreText}>Load more users</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f6f5" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    minHeight: 44,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchContainerFocused: {
    borderColor: "#5F9C76",
    shadowColor: "#5F9C76",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    color: "#25332a",
    borderWidth: 0,
    backgroundColor: "transparent",
    outlineStyle: "none",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  stateText: { color: "#5d6b61", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 20 },
  card: {
    width: "100%",
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  twoColumnCard: { width: "48.5%" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontWeight: "700", fontSize: 14, color: "#1d2b21", flexShrink: 1 },
  bannedPill: {
    backgroundColor: "#fff0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffd6d6",
  },
  bannedPillText: {
    color: "#c62828",
    fontSize: 10,
    fontWeight: "700",
  },
  subtext: { fontSize: 12, color: "#63756a", marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  points: { fontSize: 12, color: "#27734d", fontWeight: "700" },
  warningCountText: {
    fontSize: 11,
    color: "#d97706",
    fontWeight: "600",
  },
  emptyText: {
    width: "100%",
    color: "#63756a",
    textAlign: "center",
    marginTop: 25,
  },
  loadMoreButton: { width: "100%", alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: "#599A74", fontWeight: "700" },
});
