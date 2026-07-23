
import { useRouter } from "expo-router";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Navbar from "../components/navbar";

import { useEffect, useState } from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";

export default function Notification() {
  const router = useRouter();


      const currentUser = auth.currentUser;

    const getActorText = (item) => {

    const names = item.actorNames || [];

    if (names.length === 0) return "Someone";

    if (names.length === 1) return names[0];

    if (names.length === 2)
        return `${names[0]} & ${names[1]}`;

    return `${names[0]}, ${names[1]} and ${names.length - 2} more`;

};

  // This creates 5 placeholder notifications
 const [notifications, setNotifications] = useState([]);

const loadNotifications = async () => {



    if (!currentUser) return;

    const q = query(
        collection(db, "notifications"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    const data = await Promise.all(

        snapshot.docs.map(async notification => {

            const item = {
                id: notification.id,
                ...notification.data(),
            };

            try {

                const postSnap = await getDoc(
                    doc(db, "posts", item.postId)
                );

                if (postSnap.exists()) {

                    item.postImage =
                        postSnap.data().imageUrl;

                }

            } catch (e) {}

            return item;

        })

    );

    setNotifications(data);

};

 useEffect(() => {
    loadNotifications();
}, []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.topSection}>
          <View style={styles.headerRow}>
            
            <Text style={styles.headerTitle}>Notification</Text>
          </View>
        </View>

        {/* CONTENT */}
        <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
          {notifications.map((item) => (
            <TouchableOpacity
    key={item.id}
    style={styles.notificationCard}
    activeOpacity={0.8}
    onPress={() =>
        router.push({
            pathname: "/post",
            params: {
                id: item.postId,
            },
        })
    }
>
              
              {/* LEFT: Avatar/Profile Icon */}
              <Image
  source={require("../assets/images/profile2.png")}
  style={styles.avatar}
/>  
            
              {/* CENTER: Text Content */}
              <View style={styles.textContainer}>
<Text style={styles.userName}>

{item.type === "deleted_post"
    ? "GreenTrace LGU"
    : getActorText(item)}

</Text>

<Text style={styles.userAction}>

{item.type === "comment"
    ? "commented on your post."

    : item.type === "reaction" || item.type === "priority"

    ? "Increased your priority."

    : item.message}

</Text>
              </View>

              {/* RIGHT: Small Thumbnail of the post */}
              {item.postImage ? (

<Image
    source={{ uri: item.postImage }}
    style={styles.postThumbnail}
/>

) : (

<View style={styles.postThumbnail} />

)}

            </TouchableOpacity>
          ))}

          {notifications.length === 0 && (

<View
    style={{
        marginTop: 60,
        alignItems: "center",
    }}
>

<Text
    style={{
        color: "#777",
        fontSize: 16,
    }}
>
    No notifications yet.
</Text>

</View>

)}
        </ScrollView>

        {/* NAVBAR */}
        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  postThumbnail: {

    width: 60,

    height: 60,

    borderRadius: 10,

    backgroundColor: "#DDD",

},

  wrapper: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F5F5F5", // Light grey background makes white cards pop
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F5F5F5",
  },
  topSection: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    backgroundColor: "#5F9C76",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backIcon: {
    width: 40,
    height: 40,
    resizeMode: "contain",
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  feed: {
    flex: 1,
    padding: 16,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    // Adds a subtle shadow
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: "#5F9C76",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  textContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  userName: {
    fontWeight: "bold",
    fontSize: 14,
  },
  userAction: {
    fontSize: 12,
    color: "#666",
  },
  
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
});
