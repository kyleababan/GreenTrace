import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState("");
  const lastUserRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const loadUsers = useCallback(async (reset = true) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;

    loadingRef.current = true;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setLoadError("");

    try {
      const constraints = [orderBy("firstName", "asc"), limit(USERS_PER_PAGE)];
      if (!reset && lastUserRef.current) {
        constraints.splice(1, 0, startAfter(lastUserRef.current));
      }
      const snapshot = await getDocs(
        query(collection(db, "users"), ...constraints),
      );
      const data = snapshot.docs.map((user) => ({
        id: user.id,
        ...user.data(),
      }));

      data.sort((firstUser, secondUser) =>
        getFullName(firstUser).localeCompare(getFullName(secondUser)),
      );
      setUsers((currentUsers) => (reset ? data : [...currentUsers, ...data]));
      lastUserRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      hasMoreRef.current = snapshot.docs.length === USERS_PER_PAGE;
      setHasMore(hasMoreRef.current);
    } catch (error) {
      console.error("Unable to load users:", error);
      setLoadError("Unable to load users. Please try again.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(true);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) =>
      [user.firstName, user.lastName, user.email, user.cellNumber, user.address]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [search, users]);

  const isTwoColumns = width >= 560;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
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
        />
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#5F9C76" />
        </View>
      ) : loadError ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{loadError}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {filteredUsers.map((user) => {
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
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.subtext} numberOfLines={1}>
                    {user.email || user.cellNumber || "No contact information"}
                  </Text>
                  <Text style={styles.points}>
                    {Number(user.points) || 0} pts
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {!filteredUsers.length && (
            <Text style={styles.emptyText}>No users match your search.</Text>
          )}
          {hasMore && !loadingMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => loadUsers(false)}
            >
              <Text style={styles.loadMoreText}>Load more users</Text>
            </TouchableOpacity>
          )}
          {loadingMore && <ActivityIndicator color="#5F9C76" />}
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
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: "#25332a" },
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
  cardText: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 14, color: "#1d2b21" },
  subtext: { fontSize: 12, color: "#63756a", marginTop: 2 },
  points: { fontSize: 12, color: "#27734d", marginTop: 3, fontWeight: "700" },
  emptyText: {
    width: "100%",
    color: "#63756a",
    textAlign: "center",
    marginTop: 25,
  },
  loadMoreButton: { width: "100%", alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: "#599A74", fontWeight: "700" },
});
