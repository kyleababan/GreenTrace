import { Ionicons } from '@expo/vector-icons';
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


export default function VolunteerList({ setActivePage }) {
  const posts = Array(6).fill(null);

  return (
    <View style={styles.page}>
      <View style={styles.content}>

        {/* TOP BAR */}
        <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput 
          placeholder="Search" 
          style={styles.searchInput}
          placeholderTextColor="#888"
        />
      </View>

        {/* GRID */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={true}
        >
          {posts.map((_, index) => (
            <View key={index} style={styles.card}>

              {/* LEFT */}
              <View style={styles.cardLeft}>
                <Text style={styles.title}>Need Volunteers</Text>

                <Text style={styles.desc} numberOfLines={3}>
                  Responsible for sorting and organizing garbage to ensure proper transfer to a nearby landfill.
                </Text>

                <View style={styles.locationRow}>
                  <Image
                    source={require("../../assets/images/location.png")}
                    style={styles.locationIcon}
                  />
                  <Text style={styles.location}>Address, Address</Text>
                </View>

                {/* ✅ NAVIGATION FIX */}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setActivePage('volunteerdetails')}
                >
                  <Text style={styles.buttonText}>Check</Text>
                </TouchableOpacity>
              </View>

              {/* RIGHT IMAGE */}
              <View style={styles.imageWrapper}>
                <Image
                  source={require("../../assets/images/Post1.png")}
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
    flexDirection: "row",
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

  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40 },

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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  locationIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
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