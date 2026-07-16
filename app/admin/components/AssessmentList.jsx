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

import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../../firebaseConfig";

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

  const filteredPosts = useMemo(() => {

    return posts.filter(post => {

      const matchesStatus =
        (post.status || "").toLowerCase() === status.toLowerCase();

      const keyword = searchText.toLowerCase();

      const matchesSearch =
        !keyword ||
        `${post.firstName} ${post.lastName}`
          .toLowerCase()
          .includes(keyword) ||
        (post.caption || "")
          .toLowerCase()
          .includes(keyword) ||
        (post.locationName || "")
          .toLowerCase()
          .includes(keyword);

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

          {filteredPosts.map(post => (

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
                status === "critical"
                    ? "#FF3B30"
                    : status === "moderate"
                    ? "#FFC107"
                    : status === "cleaned"
                    ? "#2DCC6F"
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
    {post.points || 0} pts
  </Text>

</View>

                <Text style={styles.postDescription}>
                  {post.caption}
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
  profileRow:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center",
},

userInfo:{
    flexDirection:"row",
    alignItems:"center",
    flex:1,
},

profileImage:{
    width:42,
    height:42,
    borderRadius:21,
},

profileName:{
    marginLeft:10,
    fontWeight:"bold",
    fontSize:16,
},

pointsText:{
    color:"#599A74",
    fontWeight:"bold",
    fontSize:13,
},

  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  profileName: {
    marginLeft: 10,
    fontWeight: "bold",
  },

  postDescription: {
    marginTop: 10,
  },

    statusCircle: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    zIndex: 5,
},

reactionRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    marginTop:12,
},

priorityContainer:{
    flexDirection:"row",
    alignItems:"center",
},

commentContainer:{
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:"#E7E7E7",
    borderRadius:6,
    paddingHorizontal:85,
    paddingVertical:5,
},



smallIcon:{
    width:18,
    height:18,
    marginRight:5,
},
});