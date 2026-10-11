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
  const pagePadding = width < 768 ? 12 : width < 1024 ? 16 : 20;
  const [users, setUsers] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
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
  }, [search, activeFilter]);

  const userCounts = useMemo(() => {
    let active = 0;
    let warned = 0;
    let banned = 0;
    let topPoints = 0;

    for (const u of users) {
      if (u.isBanned) {
        banned++;
      } else if (u.nsfwWarnings && u.nsfwWarnings > 0) {
        warned++;
      } else {
        active++;
      }

      if (Number(u.points) > 0) {
        topPoints++;
      }
    }

    return {
      all: users.length,
      active,
      warned,
      banned,
      topPoints,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    let list = users.filter((user) => {
      // 1. Status Filter
      if (activeFilter === "active") {
        if (user.isBanned || (user.nsfwWarnings && user.nsfwWarnings > 0)) {
          return false;
        }
      } else if (activeFilter === "warned") {
        if (user.isBanned || !user.nsfwWarnings || user.nsfwWarnings <= 0) {
          return false;
        }
      } else if (activeFilter === "banned") {
        if (!user.isBanned) return false;
      } else if (activeFilter === "top_points") {
        if (!user.points || Number(user.points) <= 0) return false;
      }

      // 2. Search Keyword
      if (!keyword) return true;
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

    if (activeFilter === "top_points") {
      list = [...list].sort(
        (firstUser, secondUser) =>
          (Number(secondUser.points) || 0) - (Number(firstUser.points) || 0),
      );
    }

    return list;
  }, [search, users, activeFilter]);

  const displayedUsers = useMemo(() => {
    return filteredUsers.slice(0, visibleCount);
  }, [filteredUsers, visibleCount]);

  const hasMore = visibleCount < filteredUsers.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + USERS_PER_PAGE);
  };

  const isTwoColumns = width >= 560;

  return (
    <View style={[styles.container, { padding: pagePadding }]}>
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

      <View style={styles.filterPillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterPillsScroll}
          contentContainerStyle={styles.filterPillsContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "all" && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter("all")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "all" && styles.filterPillTextActive,
              ]}
            >
              All ({userCounts.all})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "active" && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter("active")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "active" && styles.filterPillTextActive,
              ]}
            >
              Active ({userCounts.active})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "warned" && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter("warned")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "warned" && styles.filterPillTextActive,
              ]}
            >
              Warned ({userCounts.warned})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "banned" && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter("banned")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "banned" && styles.filterPillTextActive,
              ]}
            >
              Banned ({userCounts.banned})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "top_points" && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter("top_points")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "top_points" && styles.filterPillTextActive,
              ]}
            >
              Top Points ({userCounts.topPoints})
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
            <Text style={styles.emptyText}>
              {search
                ? "No users match your search."
                : activeFilter === "warned"
                ? "No users currently have policy warnings."
                : activeFilter === "banned"
                ? "No banned users on record."
                : activeFilter === "top_points"
                ? "No users have accumulated EcoPoints yet."
                : activeFilter === "active"
                ? "No active users found."
                : "No users registered yet."}
            </Text>
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
    marginBottom: 12,
    minHeight: 44,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterPillsWrapper: {
    height: 38,
    flexShrink: 0,
    marginBottom: 14,
  },
  filterPillsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 38,
  },
  filterPillsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 2,
    paddingRight: 16,
  },
  filterPill: {
    height: 32,
    alignSelf: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7dfd9",
  },
  filterPillActive: {
    backgroundColor: "#276344",
    borderColor: "#276344",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5d50",
    textAlign: "center",
  },
  filterPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
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
