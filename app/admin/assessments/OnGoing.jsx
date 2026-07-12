import { StyleSheet } from 'react-native';
import AssessmentList from "../components/AssessmentList";

export default function OnGoing(props) {

    return (

        <AssessmentList
            status="On-going"
            color="#A5A5A5"
            {...props}
        />

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
  status: { width: 25, height: 25, borderRadius: 12.5, backgroundColor: '#A5A5A5', position: 'absolute', right: 5, top: 5, zIndex: 1 },
  image: { width: '100%', borderRadius: 10, resizeMode: 'cover' },
});