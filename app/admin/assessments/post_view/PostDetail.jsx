import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Receive setShowPostDetail from SituationAssessment
export default function PostDetail({ setShowPostDetail, setActivePage }) {

  return (
    <View style={styles.screen}>

      {/* TITLE */}
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        {/* Use setShowPostDetail to go back */}
        <TouchableOpacity onPress={() => setShowPostDetail(false)}>
          {/* <Image source={require("../../../assets/backG.png")} style={styles.profileImage} /> */}
        </TouchableOpacity>

        <View style={{ alignItems: 'center', width: '96%', justifyContent: 'space-between', flexDirection: 'row' }}>
          <Text style={styles.title}>Post Details</Text>
          <TouchableOpacity style={{ backgroundColor: '#fff', padding: 12, borderRadius: 5 }}>
            <Text style={{ color:'#FF6666' }}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN LAYOUT */}
      <View style={styles.mainContainer}>

        {/* LEFT - POST */}
        <View style={styles.left}>
          <View style={styles.card}>
            {/* <Image source={require("../../../assets/Post1.png")} style={styles.postImage}/> */}

            <View style={styles.postInfo}>
              {/* PROFILE */}
              <View style={styles.row}>
                {/* <Image source={require("../../../assets/ProfileIG.png")} style={styles.profileImage} /> */}
                <Text style={styles.profileName}>Peter Dawning</Text>
              </View>

              {/* DESCRIPTION */}
              <Text style={styles.description}>Garbage piling up near the alley</Text>

              {/* REACTIONS */}
              <View style={styles.reactions}>
                <View style={styles.reactBox}>
                  {/* <Image source={require("../../../assets/PriorityReact.png")} style={styles.smallIcon} /> */}
                  <Text style={styles.count}>21</Text>
                </View>
                <View style={styles.commentBox}>
                  {/* <Image source={require("../../../assets/Comment.png")} style={styles.smallIcon} /> */}
                  <Text style={styles.count}>5</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* RIGHT - COMMENTS + LOCATION */}
        <View style={styles.right}>
          {/* COMMENTS */}
          <View style={styles.commentSection}>
            <Text style={styles.sectionTitle}>Comments</Text>

            {[1,2,3].map(i => (
              <View key={i} style={styles.commentRow}>
                {/* <Image source={require("../../../assets/ProfileIG.png")} style={styles.profileIcon} /> */}
                <View>
                  <Text style={styles.userName}>SomeoneYouKnow{i}</Text>
                  <Text>Something long sentence</Text>
                </View>
              </View>
            ))}
          </View>

          {/* LOCATION */}
          <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.row}>
              {/* <Image source={require("../../../assets/Location.png")} style={styles.icon} /> */}
              <Text>Poblacion, Pinamungajan</Text>
            </View>
          </View>
        </View>
      </View>

      {/* BUTTON */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, gap: 5, }}>
        <TouchableOpacity style={[styles.helpBTN, { width: '100%', flex: 1 }]} onPress={() => {volunteerpostcreate}}>
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.helpBTN, { backgroundColor: '#ff4848ff', width: '100%', flex: 1, }]} onPress={() => {}}>
          <Text style={styles.helpText}>Clean</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Keep your existing styles as-is
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between', // push button to bottom
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#599A74',
    marginBottom: 10,
    alignContent: 'center',
    justifyContent: 'center',
  },
  mainContainer: {
    flexDirection: 'row',
    flex: 1,          // take full remaining vertical space
    gap: 20,
    marginBottom: 0,
  },
  left: {
    flex: 1
  },

  right: { 
    flex: 1, 
    gap: 15, 
    justifyContent: 'space-between'
  },

  card: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    padding: 10 
  },

    postImage: { 
      width: 'auto', 
      height: 'auto', 
      aspectRatio: 16 / 9, 
      borderRadius: 10, 
      resizeMode: 'cover' 
    },

    postInfo: { 
      marginTop: 10 
    },
    row: { 
      flexDirection: 'row', 
      alignItems: 'center' 
    },

    profileImage: { 
      width: 40, 
      height: 40, 
      borderRadius: 20 
    },

    profileName: { 
      marginLeft: 10, 
      fontWeight: 'bold' 
    },
    profileIcon:{ 
      width: 40, 
      height: 40, 
      marginRight: 5 
    },
    icon: { 
      width: 20, 
      height: 20, 
      marginRight: 5 
    },
    locationText: { 
      fontSize: 14 
    },
    description: { 
      marginVertical: 10, 
      marginBottom: 90 
    },
    reactions: { 
      flexDirection: 'row', 
      gap: 10, 
      justifyContent: 'space-between', 
      bottom:0, 
      padding: 10 
    },
    count:{ 
      fontWeight: 'bold' 
    },
    reactBox: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      width: '10%', 
      justifyContent: 'center', 
      padding: 10 
    },
    commentBox: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: '#E4E4E4', 
      borderRadius: 5, 
      width: '90%', 
      justifyContent: 'center', 
      padding: 10 
    },
    smallIcon: { 
      width: 20, 
      height: 20, 
      marginRight: 5 
    },
    sectionTitle: { 
      fontWeight: 'bold', 
      marginBottom: 10 
    },
    commentSection: { 
      backgroundColor: '#fff', 
      padding: 10, 
      borderRadius: 10, 
      gap: 20, 
      paddingBottom: 20 
    },
    commentRow: { 
      flexDirection: 'row', 
      alignItems: 'center' 
    },
    userName: { 
      fontWeight: 'bold' 
    },
    locationSection: { 
      backgroundColor: '#fff', 
      padding: 10, 
      borderRadius: 10 
    },
    helpBTN: { 
      backgroundColor: '#599A74', 
      padding: 16, 
      borderRadius: 8, 
      alignItems: 'center' 
    },
    helpText: { 
      color: '#fff', 
      fontWeight: 'bold', 
      fontSize: 18 
    },
});