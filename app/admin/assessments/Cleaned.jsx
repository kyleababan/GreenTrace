import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export default function ModerateSituation({ setShowPostDetail }) {
  const { width } = useWindowDimensions();
  const isTablet = width < 1024 && width >= 600;
  const isMobile = width < 600;

  const getCardWidth = () => {
    if (isMobile) return '100%';
    if (isTablet) return '100%';
    return '30%';
  };

  const getImageHeight = () => {
    if (width >= 1024) return 200;
    if (width >= 600) return 150;
    return 120;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Moderate Situation</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.postContainer}>
          {[...Array(6)].map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.postCard, { width: getCardWidth() }]}
              onPress={() => setShowPostDetail(true)}
            >
              <View>
                <Image
                  source={require("../../../assets/images/Post1.png")}
                  style={[styles.image, { height: getImageHeight() }]}
                />
                <View style={styles.status} />
              </View>

              <View style={styles.postInfo}>
                <View style={styles.profile}>
                  <Image source={require("../../../assets/images/ProfileIG.png")} style={styles.profileImage} />
                  <Text style={styles.profileName}>Peter Dawning</Text>
                </View>
                <Text style={styles.postDescription}>Garbage piling up near the alley</Text>
              </View>

              <View style={styles.postReact}>
                <View style={styles.reactContainer}>
                  <Image source={require("../../../assets/images/priorityreact.png")} style={styles.reactIcon} />
                  <Text style={styles.reactCount}>21</Text>
                </View>
                <View style={styles.commentContainer}>
                  <Image source={require("../../../assets/images/comment.png")} style={styles.commentIcon} />
                  <Text style={styles.commentCount}>5</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, marginBottom: 20, color: '#599A74' },
  postContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  postCard: { backgroundColor: '#fff', padding: 10, borderRadius: 10, marginBottom: 15 },
  postInfo: { padding: 10 },
  profile: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 40, height: 40, borderRadius: 20 },
  profileName: { marginLeft: 10, fontSize: 16, fontWeight: 'bold' },
  postDescription: { paddingTop: 10, paddingBottom: 15 },
  postReact: { flexDirection: 'row', justifyContent: 'center', margin: 10, gap: 10 },
  reactContainer: { flexDirection: 'row', alignItems: 'center', width: '20%', padding: 5 },
  commentContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4E4E4', borderRadius: 5, width: '80%', padding: 5 },
  reactIcon: { width: 16, height: 16, marginRight: 5 },
  commentIcon: { width: 16, height: 16, marginRight: 5 },
  reactCount: { fontSize: 12, fontWeight: 'bold' },
  commentCount: { fontSize: 12, fontWeight: 'bold' },
  status: { width: 25, height: 25, borderRadius: 12.5, backgroundColor: '#2DCC6F', position: 'absolute', right: 5, top: 5, zIndex: 1 },
  image: { width: '100%', borderRadius: 10, resizeMode: 'cover' },
});