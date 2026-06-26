import { View, Text, TextInput, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import Navbar from "../components/navbar";
import { useRouter } from "expo-router";


export default function Post() {
  const router = useRouter();
  return (
    <View style={styles.wrapper}>
    <View style={styles.container}>
      
      {/* TOP SECTION */}
      <View style={styles.topSection}>
  <View style={styles.headerRow}>

    {/* BACK BUTTON */}
    <TouchableOpacity onPress={() => router.back()}>
      <Image
        source={require("../assets/images/back.png")} // 👈 add your icon
        style={styles.backIcon}
      />
    </TouchableOpacity>

    {/* TITLE */}
    <Text style={styles.headerTitle}>
      Peter Dawning’s Post
    </Text>

  </View>
</View>

      {/* POSTS */}
      <ScrollView style={styles.feed}>
        
        {/* POST CARD */}
    <View style={styles.card}>
          
          {/* USER INFO */}
          <View style={styles.userRow}>
            <Image
  source={require("../assets/images/profile2.png")} // 👈 your image
  style={styles.avatar}
/>
            <View>
              <Text style={styles.username}>
                Peter Dawning <Text style={styles.points}>123pts</Text>
              </Text>
                <View style={styles.locationRow}>
                     <Image
                     source={require("../assets/images/location.png")}
                    style={styles.locationIcon}
                    />
            <Text style={styles.locationText}>
            Pandacan, Pinamungajan
            </Text>
                </View>
            </View>
          </View>

          <Text style={styles.caption}>
            Garbage piling up near the alley
          </Text>

          {/* IMAGE */}

<TouchableOpacity
  style={styles.imageContainer}
  onPress={() => router.push("/post")}
>
  <Image
    source={require("../assets/images/pic2.png")}
    style={styles.postImage}
  />

  {/* ✅ MOVE HERE */}
  <View style={styles.statusDotYellow} />
</TouchableOpacity>
    </View>

    {/* COMMENT INPUT */}
<View style={styles.commentInputRow}>
  <Text style={styles.commentLabel}>Comments</Text>

  <TextInput
    placeholder="Write a comment..."
    style={styles.commentInput}
  />
</View>

{/* COMMENTS LIST */}

<View style={styles.commentCard}>
  <View style={styles.commentUserRow}>
    <Image
  source={require("../assets/images/profile2.png")} // 👈 your image
  style={styles.avatar}
/>
    <View>
      <Text style={styles.username}>
        SomeoneTheyKnow <Text style={styles.points}>20pts</Text>
      </Text>
      <Text style={styles.commentText}>
        Something long sentence....
      </Text>
    </View>
  </View>
</View>

<View style={styles.commentCard}>
  <View style={styles.commentUserRow}>
    <Image
  source={require("../assets/images/profile2.png")} // 👈 your image
  style={styles.avatar}
/>
    <View>
      <Text style={styles.username}>
        SomeoneYouKnow <Text style={styles.points}>22pts</Text>
      </Text>
      <Text style={styles.commentText}>
        Something long sentence....
      </Text>
    </View>
  </View>
</View>


      </ScrollView>

      {/* BOTTOM NAVBAR */}
      <View style={styles.navbar}>
        
       <Navbar />

      </View>

    </View>
</View>
  );
}

const styles = StyleSheet.create({

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
  height: 160,
  borderRadius: 10,
  overflow: "hidden", // 👈 keeps image inside rounded corners
  backgroundColor: "#ddd",
  position: "relative", // 👈 needed for status dot
},

postImage: {
  width: "100%",
  height: "100%",
  resizeMode: "cover", // 👈 fills the container nicely
},

  statusDotRed: {
    width: 25,
    height: 25,
    backgroundColor: "red",
    borderRadius: 30,
    position: "absolute",
    right: 10,
    top: 10,
  },

  statusDotYellow: {
    width: 25,
    height: 25,
    backgroundColor: "yellow",
    borderRadius: 30,
    position: "absolute",
    right: 10,
    top: 10,
  },

 actionsContainer: {
  flexDirection: "row",
  marginTop: 10,
  alignItems: "center",
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

  headerRow: {
  flexDirection: "row",
  alignItems: "center",
},

backIcon: {
  width: 50,
  height: 50,
  marginRight: 10,
  resizeMode: "contain",
},

headerTitle: {
  color: "#fff",
  fontSize: 24,
  fontWeight: "600",
},
commentInputRow: {
  marginTop: 10,
},

commentLabel: {
  fontWeight: "600",
  marginBottom: 6,
},

commentInput: {
  backgroundColor: "#E5E5E5",
  borderRadius: 20,
  paddingHorizontal: 15,
  height: 40,
},

commentCard: {
  backgroundColor: "#F2F2F2",
  borderRadius: 10,
  padding: 10,
  marginTop: 10,
},

commentUserRow: {
  flexDirection: "row",
  alignItems: "center",
},

commentText: {
  fontSize: 12,
  color: "#555",
},
});