import { collection, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";

import { db } from "../../../firebaseConfig";

export default function AssessmentList({
  status,
  searchText = "",
  post,
  setSelectedPost,
}) {
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState([]);
  const [authorPoints, setAuthorPoints] = useState({});

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const pointsByUserId = {};

      snapshot.forEach((userDocument) => {
        pointsByUserId[userDocument.id] = userDocument.data().points ?? 0;
      });

      setAuthorPoints(pointsByUserId);
    });

    return unsubscribe;
  }, []);

  const loadPosts = async () => {
    try {
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPosts(data);
    } catch (error) {
      console.log(error);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesStatus =
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
                  {post.title || "Untitled waste report"}
                </Text>
                <Text style={styles.postDescription}>{post.caption}</Text>
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
});
