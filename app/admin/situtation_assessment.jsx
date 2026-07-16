import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import PostDetail from './assessments/post_view/PostDetail.jsx';
import VolunteerPostCreate from "./assessments/post_view/VolunteerPostCreate";
import AssessmentList from "./components/AssessmentList";

export default function SituationAssessment() {
  const [activeTab, setActiveTab] = useState('ongoing');
  const [selectedPost, setSelectedPost] = useState(null);
const [search, setSearch] = useState("");
const [selectedVolunteerPost, setSelectedVolunteerPost] = useState(null);

const renderContent = () => {

    if (selectedVolunteerPost) {

        return (
            <VolunteerPostCreate
                post={selectedVolunteerPost}
                setSelectedVolunteerPost={setSelectedVolunteerPost}
                setSelectedPost={setSelectedPost}
            />
        );

    }


    if (selectedPost) {

        return (
<PostDetail
    post={selectedPost}
    currentTab={activeTab}
    setSelectedPost={setSelectedPost}
    setSelectedVolunteerPost={setSelectedVolunteerPost}
/>
        );

    }

    return (

        <AssessmentList
            status={activeTab}
            searchText={search}
            setSelectedPost={setSelectedPost}
        />

    );

};

  return (
    <View style={styles.container}>
      {!selectedPost && (
        <>
          <View style={styles.cardsRow}>
            <Text
              style={[{ backgroundColor: '#FF6666', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'critical' && styles.activeTab]}
              onPress={() => { setActiveTab('critical'); setSelectedPost(null); }}
            >
              Critical
            </Text>
            <Text
              style={[{ backgroundColor: '#FFCF30', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'moderate' && styles.activeTab]}
              onPress={() => { setActiveTab('moderate'); setSelectedPost(null); }}
            >
              Moderate
            </Text>
            <Text
              style={[{ backgroundColor: '#2DCC6F', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'cleaned' && styles.activeTab]}
              onPress={() => { setActiveTab('cleaned'); setSelectedPost(null); }}
            >
              Cleaned
            </Text>
            <Text
              style={[{ backgroundColor: '#A5A5A5', color: '#fff', borderRadius: 5, width: '24%', height: '100%', textAlign: 'center', paddingVertical: 10 }, activeTab === 'ongoing' && styles.activeTab]}
              onPress={() => { setActiveTab('ongoing'); setSelectedPost(null); }}
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
    value={search}
    onChangeText={setSearch}
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