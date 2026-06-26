import { Ionicons } from '@expo/vector-icons';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const USERS = [
  { id: '1', name: 'Peter Dawning', address: 'Poblacion, Pinamungajan', points: 150 },
  { id: '2', name: 'Peter Dawning', address: 'Poblacion, Pinamungajan', points: 150 },
];

export default function UserList({ setActivePage }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput 
          placeholder="Search" 
          style={styles.searchInput}
          placeholderTextColor="#888"
        />
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {USERS.map(user => (
          <TouchableOpacity 
            key={user.id} 
            style={styles.card}
            onPress={() => setActivePage('profile')}
          >
            <Image 
              source={require('../../assets/images/ProfileIG.png')} 
              style={styles.avatar} 
            />
            <View style={styles.cardText}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.address}>{user.address}</Text>
              <Text style={styles.points}>{user.points} pts</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40 },
  grid: { paddingBottom: 20 },
  card: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  cardText: { flex: 1 },
  name: { fontWeight: 'bold', fontSize: 14 },
  address: { fontSize: 12, color: '#555' },
  points: { fontSize: 12, color: '#333', marginTop: 2 },
});