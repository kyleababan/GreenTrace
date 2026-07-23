import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { db } from "../../firebaseConfig";


export default function VolunteerList({ setActivePage }) {
  const [posts, setPosts] = useState([]);
const [search, setSearch] = useState("");

const loadVolunteerPosts = useCallback(async () => {

    try {

        const q = query(
            collection(db, "volunteer_posts"),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        const activePosts = await Promise.all(
            data.map(async (volunteerPost) => {
                if (volunteerPost.status === "cleaned") return null;
                if (!volunteerPost.postId) return volunteerPost;

                try {
                    const sourcePost = await getDoc(doc(db, "posts", volunteerPost.postId));

                    return sourcePost.exists() && sourcePost.data().status === "cleaned"
                        ? null
                        : volunteerPost;
                } catch (error) {
                    console.error("Unable to check volunteer post status:", error);
                    return volunteerPost;
                }
            })
        );

        setPosts(activePosts.filter(Boolean));

    } catch (error) {

        console.log(error);

    }

}, []);

useFocusEffect(
    useCallback(() => {
        loadVolunteerPosts();
    }, [loadVolunteerPosts])
);

const filteredPosts = useMemo(() => {

    const keyword = search.toLowerCase();

    return posts.filter(post =>

        post.status !== "cleaned" && (

            !keyword ||

            post.title?.toLowerCase().includes(keyword) ||

            post.description?.toLowerCase().includes(keyword) ||

            post.locationName?.toLowerCase().includes(keyword)

        )

    );

}, [posts, search]);

  return (
    <View style={styles.page}>
      <View style={styles.content}>

        {/* TOP BAR */}
        <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
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
          {filteredPosts.map(post => (
            <View key={post.id} style={styles.card}>

              {/* LEFT */}
              <View style={styles.cardLeft}>
                <Text style={styles.title}>{post.title}</Text>

                <Text style={styles.desc} numberOfLines={3}>
                 {post.description}
                </Text>

                <View style={styles.locationRow}>
                  <Image
                    source={require("../../assets/images/location.png")}
                    style={styles.locationIcon}
                  />
                  <Text style={styles.location}>{post.locationName}</Text>
                </View>

                {/* ✅ NAVIGATION FIX */}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() =>
    router.push({
        pathname: "/admin/assessments/post_view/VolunteerPostDetail",
        params: {
            volunteerId: post.id,
        },
    })
}

                >
                  <Text style={styles.buttonText}>Check</Text>
                </TouchableOpacity>
              </View>

              {/* RIGHT IMAGE */}
              <View style={styles.imageWrapper}>
         <Image
    source={{ uri: post.imageUrl }}
    style={styles.image}
/>
              </View>

            </View>
          ))}
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

  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10 },
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
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    flexDirection: "row",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },

  desc: {
    fontSize: 11,
    color: "#555",
    marginBottom: 6,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  locationIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },

  location: {
    fontSize: 11,
    color: "#333",
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

  imageWrapper: {
    width: 90,
    height: 90,
  },

  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
});
