import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Cleaned from './assessments/Cleaned.jsx';
import CriticalSituation from './assessments/CriticalSituation.jsx';
import ModerateSituation from './assessments/ModerateSituation.jsx';
import OnGoing from './assessments/OnGoing.jsx';
import PostDetail from './assessments/post_view/PostDetail.jsx';
import { Ionicons } from '@expo/vector-icons';

export default function SituationAssessment() {
  const [activeTab, setActiveTab] = useState('ongoing');
  const [showPostDetail, setShowPostDetail] = useState(false);

  const renderContent = () => {
    if (showPostDetail) return <PostDetail setShowPostDetail={setShowPostDetail} />;

    switch (activeTab) {
      case 'critical':
        return <CriticalSituation setShowPostDetail={setShowPostDetail} />;
      case 'moderate':
        return <ModerateSituation setShowPostDetail={setShowPostDetail} />;
      case 'cleaned':
        return <Cleaned setShowPostDetail={setShowPostDetail} />;
      default:
        return <OnGoing setShowPostDetail={setShowPostDetail} />;
    }
  };

  return (
    <View style={styles.container}>
      {!showPostDetail && (
        <>
          <View style={styles.cardsRow}>
            <Text
              style={[{ backgroundColor: '#FF6666', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'critical' && styles.activeTab]}
              onPress={() => { setActiveTab('critical'); setShowPostDetail(false); }}
            >
              Critical
            </Text>
            <Text
              style={[{ backgroundColor: '#FFCF30', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'moderate' && styles.activeTab]}
              onPress={() => { setActiveTab('moderate'); setShowPostDetail(false); }}
            >
              Moderate
            </Text>
            <Text
              style={[{ backgroundColor: '#2DCC6F', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'cleaned' && styles.activeTab]}
              onPress={() => { setActiveTab('cleaned'); setShowPostDetail(false); }}
            >
              Cleaned
            </Text>
            <Text
              style={[{ backgroundColor: '#A5A5A5', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'ongoing' && styles.activeTab]}
              onPress={() => { setActiveTab('ongoing'); setShowPostDetail(false); }}
            >
              On-going
            </Text>
          </View>

         <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput 
          placeholder="Search" 
          style={styles.searchInput}
          placeholderTextColor="#888"
        />
      </View>
        </>
      )}

      {/* SPA Content */}
      <View style={styles.tabContent}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 2 },
  cardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tabCard: {
    backgroundColor: '#A5A5A5',
    color: '#fff',
    borderRadius: 5,
    width: '24%',
    height: '100%',
    textAlign: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    fontWeight: 'bold',
  },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 5, backgroundColor: '#fff' },
  tabContent: { flex: 1 },

   searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40 },
});