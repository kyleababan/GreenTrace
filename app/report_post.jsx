import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from "react-native";
import Navbar from "../components/navbar";
import { useRouter } from "expo-router";

export default function ReportPosts() {
  const router = useRouter();

  // Placeholder data for your history/recent posts
  const reportPosts = [1, 2, 3];

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER SECTION */}
        <View style={styles.topSection}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Image
                source={require("../assets/images/back.png")}
                style={styles.backIcon}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Report Posts</Text>
          </View>
        </View>

        {/* FEED SECTION */}
        <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
          {reportPosts.map((item) => (
            <View key={item} style={styles.reportCard}>
              
              {/* LEFT CONTENT */}
              <View style={styles.cardLeft}>
                <Text style={styles.userName}>Lois Token</Text>
                <Text style={styles.reportDescription} numberOfLines={2}>
                  Garbage piling up near the alley
                </Text>

                <View style={styles.locationRow}>
                  <Image 
                    source={require("../assets/images/location.png")} 
                    style={styles.locationIcon} 
                  />
                  <Text style={styles.locationText}>Address, Address</Text>
                </View>

                <TouchableOpacity style={styles.seePostButton}>
                  <Text style={styles.seePostText}>See post?</Text>
                </TouchableOpacity>
              </View>

              {/* RIGHT IMAGE */}
              <View style={styles.cardRight}>
                <Image
                  source={require("../assets/images/pic1.png")}
                  style={styles.postImage}
                />
              </View>

            </View>
          ))}
        </ScrollView>

        {/* NAVBAR */}
        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2",
    maxWidth: 500,
    width: "100%",
  },
  topSection: {
    paddingTop: 20,
    paddingBottom: 45,
    paddingHorizontal: 20,
    backgroundColor: "#5F9C76",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    top: 25,
  },
  backIcon: {
    width: 45,
    height: 45,
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  feed: {
    flex: 1,
    padding: 16,
  },
  reportCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardLeft: {
    flex: 1,
    justifyContent: 'space-between',
  },
  userName: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#000",
  },
  reportDescription: {
    fontSize: 12,
    color: "#333",
    marginVertical: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  locationIcon: {
    width: 14,
    height: 14,
    marginRight: 5,
    tintColor: '#000',
  },
  locationText: {
    fontSize: 11,
    fontWeight: '500',
    color: "#000",
  },
  seePostButton: {
    backgroundColor: "#5F9C76",
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  seePostText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cardRight: {
    marginLeft: 10,
  },
  postImage: {
    width: 110,
    height: 90,
    borderRadius: 8,
  },
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
});