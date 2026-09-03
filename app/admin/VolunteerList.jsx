import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { db } from "../../firebaseConfig";

const POSTS_PER_PAGE = 10;

const getMemberId = (member) =>
  typeof member === "string"
    ? member
    : member?.userId || member?.uid || member?.id || "";

const getMemberName = (member) => {
  if (typeof member === "string") return "Volunteer";

  return (
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
    member?.name ||
    "Volunteer"
  );
};

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "V";

const loadVolunteerProfiles = async (volunteers) =>
  Promise.all(
    volunteers.slice(0, 4).map(async (member) => {
      const memberId = getMemberId(member);
      if (!memberId) return member;

      try {
        const memberSnapshot = await getDoc(doc(db, "users", memberId));
        return memberSnapshot.exists()
          ? { ...member, ...memberSnapshot.data() }
          : member;
      } catch (error) {
        console.error("Unable to load volunteer profile:", error);
        return member;
      }
    }),
  );

export default function VolunteerList({ setActivePage }) {
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastPostRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const loadVolunteerPosts = useCallback(async (reset = true) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;

    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const constraints = [orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE)];
      if (!reset && lastPostRef.current) {
        constraints.splice(1, 0, startAfter(lastPostRef.current));
      }

      const q = query(collection(db, "volunteer_posts"), ...constraints);

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const activePosts = await Promise.all(
        data.map(async (volunteerPost) => {
          if (volunteerPost.status === "cleaned") return null;
          const volunteers = Array.isArray(volunteerPost.volunteers)
            ? volunteerPost.volunteers
            : [];

          if (!volunteerPost.postId) {
            return {
              ...volunteerPost,
              volunteerProfiles: await loadVolunteerProfiles(volunteers),
            };
          }

          try {
            const sourcePost = await getDoc(
              doc(db, "posts", volunteerPost.postId),
            );

            if (sourcePost.exists() && sourcePost.data().status === "cleaned") {
              return null;
            }

            return {
              ...volunteerPost,
              volunteerProfiles: await loadVolunteerProfiles(volunteers),
            };
          } catch (error) {
            console.error("Unable to check volunteer post status:", error);
            const volunteers = Array.isArray(volunteerPost.volunteers)
              ? volunteerPost.volunteers
              : [];
            return {
              ...volunteerPost,
              volunteerProfiles: await loadVolunteerProfiles(volunteers),
            };
          }
        }),
      );

      const nextPosts = activePosts.filter(Boolean);
      setPosts((currentPosts) =>
        reset ? nextPosts : [...currentPosts, ...nextPosts],
      );
      lastPostRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      hasMoreRef.current = snapshot.docs.length === POSTS_PER_PAGE;
      setHasMore(hasMoreRef.current);
    } catch (error) {
      console.log(error);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      lastPostRef.current = null;
      hasMoreRef.current = true;
      setHasMore(true);
      loadVolunteerPosts(true);
    }, [loadVolunteerPosts]),
  );

  const filteredPosts = useMemo(() => {
    const keyword = search.toLowerCase();

    return posts.filter(
      (post) =>
        post.status !== "cleaned" &&
        (!keyword ||
          post.title?.toLowerCase().includes(keyword) ||
          post.description?.toLowerCase().includes(keyword) ||
          post.locationName?.toLowerCase().includes(keyword)),
    );
  }, [posts, search]);

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        {/* TOP BAR */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#888"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search"
            style={styles.searchInput}
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* GRID */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={true}
        >
          {filteredPosts.map((post) => (
            <View
              key={post.id}
              style={[
                styles.card,
                { width: width < 600 ? "100%" : width < 1024 ? "48%" : "30%" },
              ]}
            >
              <Image source={{ uri: post.imageUrl }} style={styles.image} />

              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {post.title || "Volunteer activity"}
                  </Text>
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>Open</Text>
                  </View>
                </View>

                <Text style={styles.desc} numberOfLines={3}>
                  {post.description || "No description provided."}
                </Text>

                <Text style={styles.requirementsLabel}>Requirements</Text>
                {post.requirements?.length ? (
                  post.requirements.slice(0, 2).map((requirement, index) => (
                    <Text
                      key={`${post.id}-requirement-${index}`}
                      style={styles.requirement}
                      numberOfLines={1}
                    >
                      • {requirement}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.requirement}>
                    No requirements listed.
                  </Text>
                )}

                <View style={styles.locationRow}>
                  <Image
                    source={require("../../assets/images/location.png")}
                    style={styles.locationIcon}
                  />
                  <Text style={styles.location} numberOfLines={1}>
                    {post.locationName || "Location not specified"}
                  </Text>
                </View>

                <View style={styles.footerRow}>
                  <View style={styles.avatarRow}>
                    {(post.volunteerProfiles || [])
                      .slice(0, 4)
                      .map((member, index) => {
                        const name = getMemberName(member);
                        const avatarUrl =
                          member?.imageUrl ||
                          member?.photoURL ||
                          member?.profileImage;
                        const key = `${post.id}-volunteer-${getMemberId(member) || index}`;

                        return avatarUrl ? (
                          <Image
                            key={key}
                            source={{ uri: avatarUrl }}
                            style={[
                              styles.avatar,
                              index > 0 && styles.avatarOverlap,
                            ]}
                          />
                        ) : (
                          <View
                            key={key}
                            style={[
                              styles.avatarFallback,
                              index > 0 && styles.avatarOverlap,
                            ]}
                          >
                            <Text style={styles.avatarText}>
                              {getInitials(name)}
                            </Text>
                          </View>
                        );
                      })}
                    <View
                      style={[
                        styles.countAvatar,
                        (post.volunteerProfiles || []).length > 0 &&
                          styles.avatarOverlap,
                      ]}
                    >
                      <Text style={styles.countText}>
                        +{post.joinedCount ?? post.volunteers?.length ?? 0}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={() =>
                      router.push({
                        pathname:
                          "/admin/assessments/post_view/VolunteerPostDetail",
                        params: { volunteerId: post.id },
                      })
                    }
                  >
                    <Text style={styles.buttonText}>Check</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          {hasMore && !loadingMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => loadVolunteerPosts(false)}
            >
              <Text style={styles.loadMoreText}>Load more activities</Text>
            </TouchableOpacity>
          )}
          {loadingMore && <ActivityIndicator color="#5F9C76" />}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "row",
  },

  content: {
    flex: 1,
    padding: 20,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40 },

  filterBtn: {
    marginLeft: 10,
    width: 45,
    height: 45,
    backgroundColor: "#fff",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: {
    flex: 1,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "30%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },

  image: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    resizeMode: "cover",
  },

  cardContent: {
    paddingTop: 10,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },

  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#234B33",
  },

  desc: {
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
    marginBottom: 10,
  },

  requirementsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#234B33",
    marginBottom: 3,
  },

  requirement: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },

  locationIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },

  location: {
    flex: 1,
    fontSize: 11,
    color: "#333",
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
  },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#fff",
  },

  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  avatarOverlap: {
    marginLeft: -9,
  },

  avatarText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  countAvatar: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 5,
    borderRadius: 15,
    backgroundColor: "#E4F1E8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  countText: {
    color: "#3F7656",
    fontSize: 10,
    fontWeight: "700",
  },

  openBadge: {
    backgroundColor: "#E4F1E8",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  openBadgeText: {
    color: "#3F7656",
    fontSize: 10,
    fontWeight: "700",
  },

  loadMoreButton: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },

  loadMoreText: {
    color: "#599A74",
    fontWeight: "700",
  },

  button: {
    backgroundColor: "#5F9C76",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    width: 80,
  },

  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
