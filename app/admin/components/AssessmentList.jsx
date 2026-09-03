import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";

import { db } from "../../../firebaseConfig";
import { censorText } from "../../../utils/censorText";
import {
  getUserPointsMap,
  mergeUniqueById,
  POSTS_PER_PAGE,
} from "../../../utils/pagination";

export default function AssessmentList({
  status,
  color,
  searchText = "",
  post,
  setSelectedPost,
}) {
  const { width } = useWindowDimensions();

  const isTablet = width < 1024 && width >= 600;
  const isMobile = width < 600;

  const [posts, setPosts] = useState([]);
  const [authorPoints, setAuthorPoints] = useState({});
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const lastPostDocRef = useRef(null);
  const hasMorePostsRef = useRef(true);
  const loadingPostsRef = useRef(false);

  useEffect(() => {
    lastPostDocRef.current = null;
    hasMorePostsRef.current = true;
    setHasMorePosts(true);
    loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadPosts = async (reset = false) => {
    if (loadingPostsRef.current || (!reset && !hasMorePostsRef.current)) return;

    loadingPostsRef.current = true;
    setLoadingMorePosts(true);

    try {
      const normalizedStatus = status.toLowerCase();
      const constraints = [
        ...(normalizedStatus === "all"
          ? []
          : [where("status", "==", normalizedStatus)]),
        orderBy("createdAt", "desc"),
        limit(POSTS_PER_PAGE),
      ];

      if (!reset && lastPostDocRef.current) {
        constraints.splice(
          constraints.length - 2,
          0,
          startAfter(lastPostDocRef.current),
        );
      }

      const snapshot = await getDocs(
        query(collection(db, "posts"), ...constraints),
      );
      const data = snapshot.docs.map((postDocument) => ({
        id: postDocument.id,
        ...postDocument.data(),
      }));

      setPosts((currentPosts) =>
        reset ? data : mergeUniqueById(currentPosts, data),
      );

      const pointsMap = await getUserPointsMap(
        db,
        data.map((post) => post.userId),
      );
      setAuthorPoints((currentPoints) => ({ ...currentPoints, ...pointsMap }));

      lastPostDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      hasMorePostsRef.current = snapshot.docs.length === POSTS_PER_PAGE;
      setHasMorePosts(hasMorePostsRef.current);
    } catch (error) {
      console.log(error);
    } finally {
      loadingPostsRef.current = false;
      setLoadingMorePosts(false);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesStatus =
        status.toLowerCase() === "all" ||
        (post.status || "").toLowerCase() === status.toLowerCase();

      const keyword = searchText.toLowerCase();

      const matchesSearch =
        !keyword ||
        `${post.firstName} ${post.lastName}`.toLowerCase().includes(keyword) ||
        (post.caption || "").toLowerCase().includes(keyword) ||
        (post.title || "").toLowerCase().includes(keyword) ||
        (post.locationName || "").toLowerCase().includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [posts, searchText, status]);

  const cardWidth = () => {
    if (isMobile) return "100%";
    if (isTablet) return "100%";
    return "30%";
  };

  const imageHeight = () => {
    if (width >= 1024) return 200;
    if (width >= 600) return 150;
    return 120;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.postContainer}>
          {filteredPosts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={[
                styles.postCard,
                {
                  width: cardWidth(),
                },
              ]}
              onPress={() => {
                setSelectedPost(post);
              }}
            >
              <View>
                <View
                  style={[
                    styles.statusCircle,
                    {
                      backgroundColor:
                        post.status === "critical"
                          ? "#FF5B5B"
                          : post.status === "moderate"
                            ? "#FFC940"
                            : post.status === "cleaned"
                              ? "#34C759"
                              : "#A5A5A5",
                    },
                  ]}
                />
                <Image
                  source={{
                    uri: post.imageUrl,
                  }}
                  style={[
                    styles.image,
                    {
                      height: imageHeight(),
                    },
                  ]}
                />
              </View>

              <View style={styles.postInfo}>
                <View style={styles.profileRow}>
                  <View style={styles.userInfo}>
                    <Image
                      source={require("../../../assets/images/ProfileIG.png")}
                      style={styles.profileImage}
                    />

                    <Text style={styles.profileName}>
                      {post.firstName} {post.lastName}
                    </Text>
                  </View>

                  <Text style={styles.pointsText}>
                    {authorPoints[post.userId] ?? post.points ?? 0} pts
                  </Text>
                </View>

                <Text style={styles.postTitle}>
                  {censorText(post.title) || "Untitled waste report"}
                </Text>
                <Text style={styles.postDescription}>
                  {censorText(post.caption)}
                </Text>
                <View style={styles.reactionRow}>
                  <View style={styles.priorityContainer}>
                    <Image
                      source={require("../../../assets/images/priorityreact.png")}
                      style={styles.smallIcon}
                    />

                    <Text>{post.reactionCount ?? 0}</Text>
                  </View>

                  <View style={styles.commentContainer}>
                    <Image
                      source={require("../../../assets/images/comment.png")}
                      style={styles.smallIcon}
                    />

                    <Text>{post.commentCount ?? 0}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {hasMorePosts && !loadingMorePosts && (
          <TouchableOpacity
            onPress={() => loadPosts()}
            style={styles.loadMoreButton}
          >
            <Text style={styles.loadMoreText}>Load more reports</Text>
          </TouchableOpacity>
        )}
        {loadingMorePosts && <ActivityIndicator color="#5F9C76" />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  title: {
    fontSize: 24,
    marginBottom: 20,
    color: "#599A74",
  },

  postContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 40,
  },

  postCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
  },

  image: {
    width: "100%",
    borderRadius: 10,
    resizeMode: "cover",
  },

  status: {
    width: 25,
    height: 25,
    borderRadius: 20,
    position: "absolute",
    right: 5,
    top: 5,
  },

  postInfo: {
    padding: 10,
  },

  profile: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  profileName: {
    marginLeft: 10,
    fontWeight: "bold",
    fontSize: 16,
  },

  pointsText: {
    color: "#599A74",
    fontWeight: "bold",
    fontSize: 13,
  },

  postDescription: {
    marginTop: 10,
  },
  postTitle: {
    marginTop: 10,
    fontWeight: "bold",
    fontSize: 16,
    color: "#234B33",
  },

  statusCircle: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    zIndex: 5,
  },

  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },

  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  commentContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7E7E7",
    borderRadius: 6,
    paddingHorizontal: 85,
    paddingVertical: 5,
  },

  smallIcon: {
    width: 18,
    height: 18,
    marginRight: 5,
  },
  loadMoreButton: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 10,
  },
  loadMoreText: {
    color: "#599A74",
    fontSize: 14,
    fontWeight: "700",
  },
});
