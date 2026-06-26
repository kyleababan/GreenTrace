import { View, Text, TextInput, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import Navbar from "../components/navbar";
import { useRouter } from "expo-router";

export default function Volunteer() {
  const router = useRouter();

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

        {/* POSTS FEED */}
        <ScrollView style={styles.feed} contentContainerStyle={{ paddingVertical: 20 }}>
          
          {/* VOLUNTEER CARD */}
          <View style={styles.card}>
  <View style={styles.cardContent}>
    
    {/* LEFT */}
    <View style={styles.cardLeft}>
      <Text style={styles.cardTitle}>Need Volunteers</Text>

      <Text style={styles.cardDescription} numberOfLines={4}>
        Responsible for sorting and organizing garbage to ensure proper transfer...
      </Text>

      {/* LOCATION */}
      <View style={styles.locationRow}>
        <Image
          source={require("../assets/images/location.png")}
          style={styles.locationIcon}
        />
        <Text style={styles.locationText}>Address, Address</Text>
      </View>

      {/* BUTTON */}
      <TouchableOpacity style={styles.volunteerButton}
      onPress={() => router.push("/volunteering")}>
        <Text style={styles.volunteerButtonText}>Volunteer?</Text>

        <View style={styles.statusDotRed} />
      </TouchableOpacity>
    </View>

    {/* RIGHT IMAGE */}
    <View style={styles.cardRight}>
      <Image 
        source={require("../assets/images/pic1.png")}
        style={styles.cardImage}
      />
    </View>

  </View>
</View>

        </ScrollView>

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
    width: "100%",
    maxWidth: 500, // 👈 THIS PREVENTS STRETCHING
    flex: 1,
    backgroundColor: "#eeebeb",
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

  cardContent: {
    flexDirection: "row", // Puts text on left, image on right
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flex: 1, // Takes up remaining space
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 11,
    color: "#444",
    lineHeight: 14,
    marginBottom: 10,
  },
  locationContainer: {
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    fontWeight: "600",
  },
  volunteerButton: {
    backgroundColor: "#5F9C76",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'flex-start',
    position: 'relative', // 👈 Important for the dot
    overflow: 'visible',  // 👈 Allows dot to sit on edge
    top: 5,
  },
  volunteerButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  cardRight: {
    width: 100,
    height: 100,
    marginLeft: 10,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    resizeMode: "cover",
  },
  
});