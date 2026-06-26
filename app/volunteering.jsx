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
import { useState } from "react"; // ✅ FIXED

export default function Volunteering() {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.topSection}>
          {/* BACK BUTTON */}
              <TouchableOpacity onPress={() => router.back()}>
                <Image
                  source={require("../assets/images/back.png")} // 👈 add your icon
                  style={styles.backIcon}
                />
              </TouchableOpacity>
        </View>

        {/* CONTENT */}
        <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.title}>Need Volunteers</Text>

          <Text style={styles.description}>
            Responsible for sorting and organizing garbage to ensure proper transfer 
            to a nearby landfill, supporting efficient and safe waste management.
          </Text>

          {/* IMAGE */}
          <Image 
            source={require("../assets/images/pic1.png")} // ✅ FIXED
            style={styles.mainImage}
          />

          {/* LOCATION */}
          <View style={styles.locationRow}>
            <Image
              source={require("../assets/images/location.png")} // ✅ FIXED
              style={styles.locationIcon}
            />
            <Text style={styles.locationText}>
              Poblacion, Pinamungajan
            </Text>
          </View>

          {/* INFO GRID */}
          <View style={styles.infoGrid}>
            
            {/* VOLUNTEERS */}
            <View style={styles.volunteerColumn}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>People who volunteer</Text>
                <Text style={styles.count}>4/4</Text>
              </View>

              <View style={styles.avatarRow}>
  {[1, 2, 3, 4].map((i) => (
    <Image
      key={i}
      source={require("../assets/images/profile2.png")} // 👈 your avatar
      style={styles.avatarCircle}
    />
  ))}
</View>
            </View>

            {/* REQUIREMENTS */}
            <View style={styles.requirementsColumn}>
              <Text style={styles.label}>Requirements:</Text>
              <Text style={styles.reqItem}>• Broom</Text>
              <Text style={styles.reqItem}>• Dust pan</Text>
              <Text style={styles.reqItem}>• Gloves</Text>
            </View>

          </View>

          {/* BUTTON */}
          <TouchableOpacity 
            style={[
              styles.mainButton,
              isJoined && styles.buttonYellow
            ]}
            onPress={() => setIsJoined(!isJoined)}
          >
            <Text style={[
              styles.buttonText,
              isJoined && styles.textDark
            ]}>
              {isJoined ? "Joined" : "Volunteer"}
            </Text>
          </TouchableOpacity>

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
    backgroundColor: "#fff",
  },

  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#fff",
  },

  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },

  topSection: {
    padding: 25,
    backgroundColor: "#5F9C76",
  },

  feed: {
    padding: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 6,
  },

  description: {
    fontSize: 15,
    color: "#000000",
    marginBottom: 12,
    alignItems: "center",
  },

  mainImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  locationIcon: {
    width: 16,
    height: 16,
    marginRight: 5,
  },

  locationText: {
    fontSize: 12,
    color: "#000000",
    fontWeight: "bold",
  },

  infoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  volunteerColumn: {
    flex: 1,
    marginRight: 10,
  },

  requirementsColumn: {
    flex: 1,
    fontWeight: "bold",
  },

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  label: {
    fontWeight: "bold",
    fontSize: 12,
    
  },

  count: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "bold",
  },

  avatarRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ffffff",
    marginRight: 6,
  },

  reqItem: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "bold",
  },

  mainButton: {
    backgroundColor: "#5F9C76",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonYellow: {
    backgroundColor: "#FFD54F",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  textDark: {
    color: "#333",
  },

  backIcon: {
    top: 13,
    right: 17,
  },
});