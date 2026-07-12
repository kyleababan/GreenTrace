import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";

import { db } from "../../../../firebaseConfig";
import { deleteRelatedDocuments } from "../../../guards/deletePostHelper";

export default function PostDetail({ post, setSelectedPost, setSelectedVolunteerPost, }) {

  const [comments, setComments] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);

const [showOtherModal, setShowOtherModal] = useState(false);

const [showConfirmModal, setShowConfirmModal] = useState(false);

const [selectedReason, setSelectedReason] = useState("");

const [customReason, setCustomReason] = useState("");

const [deleting, setDeleting] = useState(false);

const deleteReasons = [

    "Inappropriate Content",

    "Issue Already Resolved",

    "Duplicate Report",

    "Other Reason",

];


useEffect(() => {
    loadComments();
}, []);

const chooseReason = (reason)=>{

    if(reason==="Other Reason"){

        setShowReasonModal(false);

        setShowOtherModal(true);

        return;

    }

    setSelectedReason(reason);

    setShowReasonModal(false);

    setShowConfirmModal(true);

};

const continueCustomReason=()=>{

    if(customReason.trim()===""){

        alert("Please enter a reason.");

        return;

    }

    setSelectedReason(customReason);

    setShowOtherModal(false);

    setShowConfirmModal(true);

};

const sendDeleteNotification = async ()=>{

    await addDoc(

        collection(db,"notifications"),

        {

            userId:post.userId,

            title:"Report Removed",

            message:`Your waste report was removed by the LGU.\n\nReason: ${selectedReason}`,

            type:"deleted_post",

            read:false,

            createdAt:serverTimestamp(),

        }

    );

};

const deletePost = async () => {

    if (deleting) return;

    setDeleting(true);

    try {

        // Notify the user first
        await sendDeleteNotification();

        // Delete the post and all related documents
        await deleteRelatedDocuments(post.id);

        alert("Report deleted successfully.");

        setShowConfirmModal(false);

        setSelectedPost(null);

    } catch (error) {

        console.log(error);

        alert("Something went wrong.");

        setDeleting(false);

    }

};

const loadComments = async () => {

    const q = query(
        collection(db, "comments"),
        where("postId", "==", post.id)
    );

    const snapshot = await getDocs(q);

    const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    }));

    setComments(data);

};

const setToOngoing = async () => {

    if (updating) return;

    setUpdating(true);

    try {

        await updateDoc(
            doc(db, "posts", post.id),
            {
                status: "ongoing",
            }
        );

        alert("Post has been set to On-going.");

        setSelectedPost(null);

    } catch (error) {

        console.log(error);

        alert("Failed to update the post.");

        setUpdating(false);

    }

};

  return (
    <View style={styles.screen}>

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
      
        <TouchableOpacity
    onPress={() => setSelectedPost(null)}
>
          <Image source={require("../../../../assets/images/backG.png")} style={styles.profileImage} />
        </TouchableOpacity> 

        <View style={{ alignItems: 'center', width: '96%', justifyContent: 'space-between', flexDirection: 'row' }}>
          <Text style={styles.title}>Post Details</Text>
          <TouchableOpacity
    style={{
        backgroundColor:"#fff",
        padding:12,
        borderRadius:5,
    }}
    onPress={()=>{
        setShowReasonModal(true);
    }}
>
            <Text style={{ color:'#FF6666' }}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN LAYOUT */}
      <View style={styles.mainContainer}>

        {/* LEFT - POST */}
        <View style={styles.left}>
          <View style={styles.card}>
            <Image
    source={{ uri: post.imageUrl }}
    style={styles.postImage}
/>

            <View style={styles.postInfo}>
              {/* PROFILE */}
              <View style={styles.row}>
                <Image source={require("../../../../assets/images/ProfileIG.png")} style={styles.profileImage} />
                <Text style={styles.profileName}>
    {post.firstName} {post.lastName}
</Text>
              </View>

              {/* DESCRIPTION */}
            <Text style={styles.description}>
    {post.caption}
</Text>

              {/* REACTIONS */}
              <View style={styles.reactions}>
                <View style={styles.reactBox}>
                  <Image source={require("../../../../assets/images/priorityreact.png")} style={styles.smallIcon} />
                 <Text style={styles.reactionCount}>
    {post.reactionCount || 0}
</Text>
                </View>
                <View style={styles.commentBox}>
                  <Image source={require("../../../../assets/images/comment.png")} style={styles.smallIcon} />
                <Text style={styles.count}>
    {comments.length}
</Text>
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
            <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
    >

{comments.length > 0 ? (

    comments.map((comment) => (

        <View
    key={comment.id}
    style={styles.commentCard}
>

            <Image
                source={require("../../../../assets/images/ProfileIG.png")}
                style={styles.profileImage}
            />

            <View style={{ flex: 1 }}>

                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                    }}
                >

                    <Text style={styles.userName}>
                        {comment.firstName} {comment.lastName}
                    </Text>

                    <Text
                        style={{
                            color: "#2C5FA5",
                            fontWeight: "bold",
                        }}
                    >
                        {comment.points} pts
                    </Text>

                </View>

               <Text style={styles.commentText}>
    {comment.comment}
</Text>
            </View>

        </View>

    ))

) : (

    <Text>No comments yet.</Text>

)}

  </ScrollView>
          </View>

          {/* LOCATION */}
          <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.row}>
              <Image source={require("../../../../assets/images/location.png")} style={styles.icon} />
             <Text>
    {post.locationName}
</Text>
            </View>
          </View>
        </View>
      </View>

      {/* BUTTON */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, gap: 5, }}>
        <TouchableOpacity style={[styles.helpBTN, { width: '100%', flex: 1 }]} onPress={() => {setSelectedVolunteerPost(post)}}>
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
<TouchableOpacity
    disabled={updating}
    style={[
        styles.helpBTN,
        {
            backgroundColor: "rgb(161, 158, 158)",
            width: "100%",
            flex: 1,
            opacity: updating ? 0.6 : 1,
        },
    ]}
    onPress={setToOngoing}
>
    <Text style={styles.helpText}>
        {updating ? "Updating..." : "Set to On-Going"}
    </Text>
</TouchableOpacity>
      </View>

      <Modal
    visible={showReasonModal}
    transparent
    animationType="fade"
>

<View style={styles.modalOverlay}>

<View style={styles.modal}>

<Text style={styles.modalTitle}>
Delete Report
</Text>

{
deleteReasons.map((reason)=>(

<TouchableOpacity

key={reason}

style={styles.reasonButton}

onPress={()=>chooseReason(reason)}

>

<Text>{reason}</Text>

</TouchableOpacity>

))
}

<TouchableOpacity

onPress={()=>setShowReasonModal(false)}

>

<Text style={{color:"red"}}>
Cancel
</Text>

</TouchableOpacity>

</View>

</View>

</Modal>

<Modal
visible={showOtherModal}
transparent
animationType="fade"
>

<View style={styles.modalOverlay}>

<View style={styles.modal}>

<View style={styles.modalHeader}>

    <TouchableOpacity
        onPress={() => {
            setShowOtherModal(false);
            setShowReasonModal(true);
        }}
    >
        <Image
            source={require("../../../../assets/images/backG.png")}
            style={styles.modalBackIcon}
        />
    </TouchableOpacity>

    <Text style={styles.modalTitle}>
        Other Reason
    </Text>

</View>

<TextInput

placeholder="Write reason..."

multiline

value={customReason}

onChangeText={setCustomReason}

style={styles.reasonInput}

/>

<TouchableOpacity

style={styles.confirmButton}

onPress={continueCustomReason}

>

<Text style={{color:"#fff"}}>

Continue

</Text>

</TouchableOpacity>

</View>

</View>

</Modal>

<Modal
visible={showConfirmModal}
transparent
animationType="fade"
>

<View style={styles.modalOverlay}>

<View style={styles.modal}>

<Text style={styles.modalTitle}>

Delete Report?

</Text>

<Text>

Are you sure you want to delete this report?

</Text>

<View
style={{
flexDirection:"row",
justifyContent:"space-between",
marginTop:20,
}}
>

<TouchableOpacity

style={styles.cancelButton}

onPress={()=>setShowConfirmModal(false)}

>

<Text>

No

</Text>

</TouchableOpacity>

<TouchableOpacity

disabled={deleting}

style={styles.confirmButton}

onPress={deletePost}

>

<Text style={{color:"#fff"}}>

{deleting ? "Deleting..." : "Yes"}

</Text>

</TouchableOpacity>

</View>

</View>

</View>

</Modal>
    </View>
  );
}

// Keep your existing styles as-is
const styles = StyleSheet.create({

  modalHeader:{
    flexDirection:"row",
    alignItems:"center",
    marginBottom:20,
},

modalBackIcon:{
    width:38,
    height:38,
    marginRight:10,
},

  modalOverlay:{
    flex:1,
    justifyContent:"center",
    alignItems:"center",
    backgroundColor:"rgba(0,0,0,0.4)",
},

modal:{
    width:420,
    backgroundColor:"#fff",
    borderRadius:10,
    padding:20,
},

modalTitle:{
    fontSize:22,
    fontWeight:"bold",
    marginBottom:20,
},

reasonButton:{
    padding:15,
    borderBottomWidth:1,
    borderColor:"#eee",
},

reasonInput:{
    height:120,
    borderWidth:1,
    borderColor:"#ddd",
    borderRadius:8,
    padding:10,
    marginTop:10,
    textAlignVertical:"top",
},

confirmButton:{
    backgroundColor:"#599A74",
    padding:12,
    borderRadius:8,
    paddingHorizontal:25,
},

cancelButton:{
    backgroundColor:"#eee",
    padding:12,
    borderRadius:8,
    paddingHorizontal:25,
},
  commentCard:{
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:"#F4F4F4",
    borderRadius:8,
    padding:10,
    marginBottom:10,
},
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
      flex: 1,
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
    },
    reactions: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      marginTop: "auto",
      paddingTop: 10 
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
commentSection:{
    flex:1,
    backgroundColor:"#fff",
    borderRadius:10,
    padding:15,
},
    commentRow: { 
      flexDirection: 'row', 
      alignItems: 'center' 
    },
    userName: { 
      fontWeight: 'bold',
      fontSize: 16,
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
    commentText:{
    color:"#666",
    marginTop:2,
},
});
