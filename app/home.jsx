import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Navbar from "../components/navbar";

import {
  collection,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";

import { db } from "../firebaseConfig";


export default function Home() {
  const router = useRouter();

  

  const [posts, setPosts] = useState([]);

useEffect(() => {
    loadPosts();
}, []);

const loadPosts = async () => {
    try {

        const q = query(
            collection(db, "posts"),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        setPosts(data);

    } catch (error) {
        console.log(error);
    }
};
  return (
    <View style={styles.wrapper}>
    <View style={styles.container}>
      
      {/* TOP SECTION */}
      <View style={styles.topSection}>
                <View style={styles.searchRow}>
                  <Image
                    source={require("../assets/images/minicon.png")}
                    style={{ width: 50, height: 50, marginRight: 10 }}
                  />
                  <TextInput placeholder="Search" style={styles.searchInput} />
                  <TouchableOpacity style={styles.addButton} onPress={() => router.push("/create_post")}>
                    <Text style={styles.addText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

      {/* POSTS */}
      <ScrollView style={styles.feed}>
        
    {posts.map(post => (

<View
key={post.id}
style={styles.card}
>

<View style={styles.userRow}>

<Image
source={require("../assets/images/profile.png")}
style={styles.avatar}
/>

<View>

<Text style={styles.username}>
{post.firstName} {post.lastName}
<Text style={styles.points}>
{" "}
{post.points}pts
</Text>
</Text>

<View style={styles.locationRow}>
<Image
source={require("../assets/images/location.png")}
style={styles.locationIcon}
/>

<Text style={styles.locationText}>
{post.locationName}
</Text>

</View>

</View>

</View>

<Text style={styles.caption}>
{post.caption}
</Text>

<TouchableOpacity
style={styles.imageContainer}
onPress={() =>
router.push({
pathname: "/post",
params: {
id: post.id,
},
})
}
>

  

<Image
source={{ uri: post.imageUrl }}
style={styles.postImage}
 resizeMode="cover"
/>

</TouchableOpacity>

<View
style={
post.status === "critical"
? styles.statusDotRed
: styles.statusDotYellow
}
/>

<View style={styles.actionsContainer}>

<View style={styles.likeSection}>

<Image
source={require("../assets/images/priorityreact.png")}
style={styles.actionIcon}
/>

<Text style={styles.actionText}>
{post.reactionCount}
</Text>

</View>

<TouchableOpacity
style={styles.commentBox}
>

<View style={styles.commentContent}>

<Image
source={require("../assets/images/comment.png")}
style={styles.actionIcon}
/>

<Text style={styles.actionText}>
{post.commentCount}
</Text>

</View>

</TouchableOpacity>

</View>

</View>

))}




      </ScrollView>

      {/* BOTTOM NAVBAR */}
      <View style={styles.navbarContainer}>
                <Navbar />
              </View>

    </View>
</View>
  );
}

const styles = StyleSheet.create({

  navbarContainer: {
  borderTopWidth: 1,
  borderColor: "#ddd",
  backgroundColor: "#fff",
},
    wrapper: {
        flex: 1,
        // backgroundColor: "#FFFFFF",
        alignItems: "center",
    },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 500, // 👈 THIS PREVENTS STRETCHING
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  topSection: {
    padding: 25,
    backgroundColor: "#5F9C76",
    
  },

  searchRow: {
    top: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  iconPlaceholder: {
    width: 28,
    height: 28,
    right: 10,
    borderRadius: 20,
    marginRight: 10,
  },

   searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 23,
    height: 40,
  },

  addButton: {
    marginLeft: 10,
    backgroundColor: "#fff",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    right: -10,
  },

  addText: {
    fontSize: 20,
    fontWeight: "bold",
  },

  feed: {
    flex: 1,
    paddingHorizontal: 16,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000000",
    marginRight: 10,
    resizeMode: "cover",
  },

  username: {
    fontWeight: "600",
  },

  points: {
    color: "blue",
  },

  locationRow: {
  flexDirection: "row",
  alignItems: "center",
},

locationIcon: {
  width: 14,
  height: 14,
  marginRight: 4,
  resizeMode: "contain",
},

locationText: {
  fontSize: 12,
  color: "gray",
},

  caption: {
    marginBottom: 8,
  },

  imageContainer: {
  width: "100%",
  height: 200,
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: "#ddd",
},

postImage: {
  width: "100%",
  height: "100%",
},

  statusDotRed: {
    width: 25,
    height: 25,
    backgroundColor: "red",
    borderRadius: 30,
    position: "absolute",
    right: 20,
    top: 90,
  },

  statusDotYellow: {
    width: 25,
    height: 25,
    backgroundColor: "yellow",
    borderRadius: 30,
    position: "absolute",
    right: 20,
    top: 90,
  },

 actionsContainer: {
  flexDirection: "row",
  marginTop: 10,
  alignItems: "center",
},

likeSection: {
  flexDirection: "row",
  alignItems: "center",
  marginRight: 10,
  gap: 6,
},

commentBox: {
  flex: 1,
  backgroundColor: "#E5E5E5",
  borderRadius: 8,
  paddingVertical: 6,
  paddingHorizontal: 30,
  flexDirection: "row",
  justifyContent: "center",
},

commentContent: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center", // 👈 THIS FIXES YOUR ISSUE
  gap: 6,
},

  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
  },

  navItem: {
    alignItems: "center",
  },

  navIcon: {
    width: 24,
    height: 24,
    backgroundColor: "#ccc",
    borderRadius: 6,
  },

  activeLine: {
    width: 20,
    height: 3,
    backgroundColor: "#5F9C76",
    marginTop: 4,
    borderRadius: 2,
  },
});