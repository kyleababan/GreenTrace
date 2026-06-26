import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Navbar from "../components/navbar";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function Notification() {
  const router = useRouter();

  // This creates 5 placeholder notifications
  const notifications = [1, 2, 3, ];

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
            <View key={item} style={styles.notificationCard}>
              
              {/* LEFT: Avatar/Profile Icon */}
              <Image
  source={require("../assets/images/profile2.png")}
  style={styles.avatar}
/>  
            
              {/* CENTER: Text Content */}
              <View style={styles.textContainer}>
                <Text style={styles.userName}>SomeoneYouKnow</Text>
                <Text style={styles.userAction} numberOfLines={1}>
                  Something long sentence....
                </Text>
              </View>

              {/* RIGHT: Small Thumbnail of the post */}
              <View style={styles.postThumbnail}>
                 {/* Replace with <Image source={...} /> later */}
              </View>

            </View>
          ))}
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