import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from "react-native";
import Navbar from "../components/navbar";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";


export default function Home() {

  const router = useRouter();

  const [imageSizes, setImageSizes] = useState({});
  
  const [posts, setPosts] = useState([]);

  const [search, setSearch] = useState("");

  const [filteredPosts, setFilteredPosts] = useState([]);

  const [userReactions, setUserReactions] = useState({});
  const [animatingPost, setAnimatingPost] = useState(null);

  const [animations, setAnimations] = useState({});






useEffect(() => {
    loadPosts();
    loadUserReactions();
    
}, []);

const loadUserReactions = async () => {

  const currentUser = auth.currentUser;

  if (!currentUser) return;

  const q = query(
    collection(db, "post_reactions"),
    where("userId", "==", currentUser.uid)
  );

  const snapshot = await getDocs(q);

  const reacted = {};

  snapshot.forEach(doc => {
    reacted[doc.data().postId] = doc.id;
  });

  setUserReactions(reacted);

};

const playReactionAnimation = (postId) => {
  const scale = animations[postId];

  if (!scale) return;

  Animated.sequence([
    Animated.timing(scale, {
      toValue: 1.35,
      duration: 120,
      useNativeDriver: true,
    }),
    Animated.timing(scale, {
      toValue: 0.9,
      duration: 80,
      useNativeDriver: true,
    }),
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }),
  ]).start();
};

const toggleReaction = async (postId) => {
  
  playReactionAnimation(postId);

  const currentUser = auth.currentUser;

  if (!currentUser) return;

  const postRef = doc(db, "posts", postId);

  if (userReactions[postId]) {

    await deleteDoc(
      doc(db, "post_reactions", userReactions[postId])
    );

    await updateDoc(postRef, {
      reactionCount: increment(-1),
    });

    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              reactionCount: post.reactionCount - 1,
            }
          : post
      )
    );

    const updated = { ...userReactions };

    delete updated[postId];

    setUserReactions(updated);

  } else {

    const reaction = await addDoc(
      collection(db, "post_reactions"),
      {
        postId,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      }
    );

    const postSnapshot = await getDoc(postRef);

const postOwner = postSnapshot.data().userId;

if (postOwner !== currentUser.uid) {

    await addDoc(
        collection(db, "notifications"),
        {
            receiverId: postOwner,
            senderId: currentUser.uid,
            postId,
            type: "reaction",
            isRead: false,
            createdAt: serverTimestamp(),
        }
    );

}

    await updateDoc(postRef, {
      reactionCount: increment(1),
    });

    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              reactionCount: post.reactionCount + 1,
            }
          : post
      )
    );

    setUserReactions(prev => ({
      ...prev,
      [postId]: reaction.id,
    }));

  }

};

useEffect(() => {

  const keyword = search.toLowerCase().trim();

  if (!keyword) {
    setFilteredPosts(posts);
    return;
  }

  const filtered = posts.filter(post =>
    post.caption?.toLowerCase().includes(keyword) ||
    post.locationName?.toLowerCase().includes(keyword) ||
    post.firstName?.toLowerCase().includes(keyword) ||
    post.lastName?.toLowerCase().includes(keyword)
  );

  setFilteredPosts(filtered);

}, [search, posts]);


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
        setFilteredPosts(data);

        const anims = {};

data.forEach(post => {
  anims[post.id] = new Animated.Value(1);
});

setAnimations(anims);

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
        style={{
            width: 50,
            height: 50,
            marginRight: 10,
        }}
    />

                  <TextInput
  placeholder="Search"
  style={styles.searchInput}
  value={search}
  onChangeText={setSearch}
/>
                  <TouchableOpacity style={styles.addButton} onPress={() => router.push("/create_post")}>
                    <Text style={styles.addText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

      {/* POSTS */}
      <ScrollView style={styles.feed}>
        
    {filteredPosts.map(post => (

<View
key={post.id}
style={styles.card}
>

<View style={styles.userRow}>

<Image
source={require("../assets/images/ProfileIW.png")}
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
  style={[
    styles.postImage,
    imageSizes[post.id] && {
      aspectRatio:
        imageSizes[post.id].width /
        imageSizes[post.id].height,
    },
  ]}
  resizeMode="cover"
  onLoad={() => {
    Image.getSize(post.imageUrl, (width, height) => {
      setImageSizes(prev => ({
        ...prev,
        [post.id]: { width, height },
      }));
    });
  }}
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


<TouchableOpacity
  style={styles.likeSection}
  onPress={() => toggleReaction(post.id)}
  
>

<Animated.Image
  source={
    userReactions[post.id]
      ? require("../assets/images/priorityreact.png")
      : require("../assets/images/priorityreact_gray.png")
  }
  style={[
    styles.actionIcon,
    {
      transform: [
        {
          scale: animations[post.id] || 1,
        },
      ],
    },
  ]}
/>

<Text style={styles.actionText}>
  {post.reactionCount}
</Text>

</TouchableOpacity>

<TouchableOpacity
style={styles.commentBox}
onPress={() =>
router.push({
pathname: "/post",
params: {
id: post.id,
},
})
}
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
    backgroundColor: "#f8f6f6",
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
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: "#ddd",
  maxHeight: 250,
},

postImage: {
  width: "100%",
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