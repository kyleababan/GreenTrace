import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

export default function AdminVolunteerList() {
  const posts = Array(6).fill(null); // placeholder
  const router = useRouter();

  return (
    <View style={styles.page}>

      {/* MAIN CONTENT */}
      <View style={styles.content}>

        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View style={styles.searchBox}>
            <TextInput placeholder="Search" style={styles.searchInput} />
          </View>

          <TouchableOpacity style={styles.filterBtn}>
            <Text style={{ fontSize: 18 }}>⚲</Text>
          </TouchableOpacity>
        </View>

        {/* SCROLLABLE GRID */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={true}
        >
          {posts.map((_, index) => (
            <View key={index} style={styles.card}>

              {/* LEFT SIDE */}
              <View style={styles.cardLeft}>
                <Text style={styles.title}>Need Volunteers</Text>

                <Text style={styles.desc} numberOfLines={3}>
                  Responsible for sorting and organizing garbage to ensure proper transfer to a nearby landfill, supporting efficient and safe waste management.
                </Text>

                <View style={styles.locationRow}>
                    <Image
                                         source={require("../../assets/images/location.png")}
                                        style={styles.locationIcon}
                                        />
                  <Text style={styles.location}>Address, Address</Text>
                </View>

                <TouchableOpacity style={styles.button}
                onPress={() => router.push("../admin_volunteer_details")}
                >
                  <Text style={styles.buttonText}>Check</Text>
                </TouchableOpacity>
              </View>

              {/* RIGHT IMAGE */}
              <View style={styles.imageWrapper}>
                <Image
                  source={require("../../assets/images/pic1.png")}
                  style={styles.image}
                />
              </View>

            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "row", // 👈 important for sidebar layout
    backgroundColor: "#E6E6E6",
  },

  content: {
    flex: 1,
    padding: 20,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  searchBox: {
    flex: 1,
    backgroundColor: "#DCDCDC",
    borderRadius: 25,
    height: 45,
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  searchInput: {
    fontSize: 14,
  },

  filterBtn: {
    marginLeft: 10,
    width: 45,
    height: 45,
    backgroundColor: "#fff",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: {
    flex: 1,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    flexDirection: "row",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },

  desc: {
    fontSize: 11,
    color: "#555",
    marginBottom: 6,
  },

  locationRow: {
    marginBottom: 8,
  },

  location: {
    fontSize: 11,
    color: "#333",
  },

  button: {
    backgroundColor: "#5F9C76",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    width: 80,
  },

  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },

  imageWrapper: {
    width: 90,
    height: 90,
  },

  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
});