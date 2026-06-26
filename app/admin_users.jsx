import React from 'react';
import { View, Text, TextInput, Image, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; 

// Mock data for the users
const USERS = Array(8).fill({
  name: 'Peter Dawning',
  address: 'Address, Address',
  points: '123 pts',
});

const UserPage = () => {
    const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput 
          placeholder="Search" 
          style={styles.searchInput}
          placeholderTextColor="#888"
        />
      </View>

      {/* 2. User Grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {USERS.map((user, index) => (
          <TouchableOpacity 
  key={index} 
  style={styles.card}
  onPress={() => router.push("/admin_users_details")} // 👈 route here
>
            {/* TOMS need og black ni siya nga picture ayaw ning puti */}
            <Image 
              source={require('../assets/images/profile.png')} 
              style={[styles.avatar, { tintColor: 'black' }]} 
            />
            <View style={styles.cardText}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.address}>{user.address}</Text>
              <Text style={styles.points}>{user.points}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: 'white',
    width: '48%', // Allows 2 cards per row with a gap
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 2,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,

  },
  cardText: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  address: {
    fontSize: 10,
    color: '#666',
  },
  points: {
    fontSize: 12,
    color: '#0056b3', // Blue color from image
    fontWeight: '600',
    marginTop: 2,
  },
});

export default UserPage;