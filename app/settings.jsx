import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import Navbar from "../components/navbar"; // Assuming your navbar is already styled

export default function ProfileScreen() {
  const router = useRouter();

  // Placeholder data - replace with your actual state/props
  const userData = {
    name: "Lois Token",
    points: 123,
    phoneNumber: "09000001"
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER SECTION */}
        <View style={styles.header}>

          <View style={styles.userInfoContainer}>
            <Image
              source={require("../assets/images/profile.png")} 
              style={styles.profileAvatar}
            />
            <View style={styles.userTextDetails}>
              <Text style={styles.userName}>{userData.name}</Text>
              <View style={styles.pointsRow}>
                <Image source={require("../assets/images/ecopts.png")} style={styles.ecoIcon} />
                <Text style={styles.ecoPointsLabel}>Eco Points</Text>
                <Text style={styles.pointsValue}> {userData.points} pts</Text>
              </View>
              <Text style={styles.phonePlaceholder}>#{userData.phoneNumber}</Text>
            </View>
          </View>
        </View>

        {/* MENU GRID SECTION */}
        <View style={styles.content}>
          <View style={styles.grid}>
            {/* Edit Profile */}
            <TouchableOpacity style={styles.menuTile}
            onPress={() => router.push("/edit_profile")}
            >
              <Image source={require("../assets/images/EditProfile.png")} style={styles.tileIcon} resizeMode="contain" />
              <Text style={styles.tileText}>Edit Profile</Text>
             
            </TouchableOpacity>

            {/* Report Posts */}
            <TouchableOpacity style={styles.menuTile}
             onPress={() => router.push("/report_post")}
            >
               <Image source={require("../assets/images/post.png")} style={styles.tileIcon} resizeMode="contain" />
              <Text style={styles.tileText}>Report Posts</Text>
            </TouchableOpacity>

            {/* Security */}
            <TouchableOpacity style={styles.menuTile}
            onPress={() => router.push("/security")}
            >
               <Image source={require("../assets/images/Securitiy.png")} style={styles.tileIcon} resizeMode="contain" />
              <Text style={styles.tileText}>Security</Text>
            </TouchableOpacity>

            {/* FAQ */}
            <TouchableOpacity style={styles.menuTile}
            onPress={() => router.push("/faq")}
            >
               <Image source={require("../assets/images/faq.png")} style={styles.tileIcon} resizeMode="contain" />
              <Text style={styles.tileText}>FAQ</Text>
            </TouchableOpacity>
          </View>

          {/* LOGOUT BUTTON */}
          <TouchableOpacity style={styles.logoutButton}
          onPress={() => router.push("/signin")}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM NAVBAR */}
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
    width: "100%",
    maxWidth: 500, // 👈 THIS PREVENTS STRETCHING
    flex: 1,
    backgroundColor: "#eeebeb",

  },
  header: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingBottom: 53,
    paddingTop: 10,
  },
  backButton: {
    backgroundColor: "#FFF",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    right: -10,
    top: 35,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#5F9C76",
  },
  userTextDetails: {
    marginLeft: 15,
  },
  userName: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#FFF",
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ecoIcon: {
    width: 18,
    height: 18,
    marginRight: 5,
  },
  ecoPointsLabel: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "600",
  },
  pointsValue: {
    color: "#2D5AF0", // Blue color for points
    fontWeight: "bold",
    fontSize: 16,
  },
  phonePlaceholder: {
    color: "#FFF",
    fontSize: 17,
    marginTop: 2,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  menuTile: {
    backgroundColor: "#FFF",
    width: "47%",
    height: 120,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    // Elevation for Android
    elevation: 4,
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tileIcon: {
    width: 40,
    height: 40,
    marginBottom: 10,
    tintColor: '#5F9C76' // Forces your images to follow the green theme
  },
  faqSymbol: {
    fontSize: 35,
    color: '#5F9C76',
    fontWeight: '300',
    marginBottom: 5
  },
  tileText: {
    color: "#5F9C76",
    fontWeight: "600",
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: "#FFF",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 10,
    elevation: 2,
  },
  logoutText: {
    color: "#FF5C5C", // Red for logout
    fontWeight: "bold",
    fontSize: 18,
  },
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
});