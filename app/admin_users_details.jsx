import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function UserDetailPage() {
  const router = useRouter();
  const { name } = useLocalSearchParams(); // Getting name from the previous screen

  return (
    <View style={styles.container}>
      {/* 1. Header with Back Button */}
      <View style={styles.header}>
  <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
    <Image source={require('../assets/images/back.png')} style={styles.icon} />
  </TouchableOpacity>

  <Text style={styles.headerTitle}>User Information</Text>
</View>

      <View style={styles.contentLayout}>
        {/* 2. Left Side: Profile Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image 
              source={require('../assets/images/profile.png')} 
              style={[styles.avatar, { tintColor: 'black' }]} // Makes white icon black
            />
          </View>
          <Text style={styles.pointsText}>123 pts</Text>
          <Text style={styles.userName}>{name || 'Peter Dawning'}</Text>
          <Text style={styles.userDetail}>Address, Address</Text>
          <Text style={styles.userDetail}>peterdawn@email.com</Text>
          <Text style={styles.userDetail}>#09000002</Text>
        </View>

        {/* 3. Right Side: User Posts */}
        <ScrollView style={styles.postsContainer}>
          <Text style={styles.sectionTitle}>{name || 'Peter Dawning'}'s Post</Text>
          
          {[1, 2].map((post) => (
            <View key={post} style={styles.postCard}>
              <View style={styles.postInfo}>
                <Text style={styles.postAuthor}>{name || 'Peter Dawning'}</Text>
                <Text style={styles.postDesc}>Garbage piling up near the alley</Text>
                
                <View style={styles.locationRow}>
                  <Image source={require('../assets/images/location.png')} style={styles.smallIcon} />
                  <Text style={styles.locationText}>Address, Address</Text>
                </View>

                <Pressable style={styles.seePostButton}>
                  <Text style={styles.buttonText}>See post?</Text>
                </Pressable>
              </View>
              
              <Image source={require('../assets/images/pic3.png')} style={styles.postImage} />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 24, height: 24, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  contentLayout: { flexDirection: 'row', flex: 1 },
  
  // Profile Column
  profileCard: { 
    width: '40%', 
    backgroundColor: 'white', 
    borderRadius: 10, 
    padding: 20, 
    alignItems: 'center',
    marginRight: 20,
    height: '80%'
  },
  avatarContainer: { marginBottom: 10 },
  avatar: { width: 80, height: 80 },
  pointsText: { color: '#0056b3', fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  userName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  userDetail: { color: '#444', marginTop: 4 },

  // Posts Column
  postsContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  postCard: { 
    backgroundColor: 'white', 
    borderRadius: 10, 
    flexDirection: 'row', 
    marginBottom: 15, 
    overflow: 'hidden' 
  },
  postInfo: { flex: 1, padding: 15 },
  postAuthor: { fontWeight: 'bold', fontSize: 16 },
  postDesc: { fontSize: 10, color: '#666', marginVertical: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  smallIcon: { width: 12, height: 12, marginRight: 5 },
  locationText: { fontSize: 10, color: '#444' },
  seePostButton: { backgroundColor: '#58A677', padding: 8, borderRadius: 5, alignItems: 'center', width: 100 },
  buttonText: { color: 'white', fontSize: 12 },
  postImage: { width: 120, height: '100%' },
});