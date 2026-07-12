import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";

import { db, } from "../../../../firebaseConfig";

export default function VolunteerPostCreate({ setSelectedVolunteerPost, post, setSelectedPost}) {
  const [title, setTitle] = useState("Need Volunteers");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [requirements, setRequirements] = useState([
    ""
]);
  const [location, setLocation] = useState(post.locationName || "");
  const [maxVolunteers, setMaxVolunteers] = useState("");

  const { width } = useWindowDimensions();
  const isMobile = width < 600;


const saveVolunteerPost = async () => {

    if (saving) return;

    setSaving(true);

    if (!desc.trim()) {
        alert("Please enter a description.");
        setSaving(false);
        return;
    }

    if (requirements.filter(r => r.trim() !== "").length === 0) {
        alert("Please add at least one requirement.");
        setSaving(false);
        return;
    }

    if (!location.trim()) {
        alert("Please enter a location.");
        setSaving(false);
        return;
    }

    if (!maxVolunteers) {
        alert("Please enter the maximum volunteers.");
        setSaving(false);
        return;
    }

    
    const existingQuery = query(
    collection(db, "volunteer_posts"),
    where("postId", "==", post.id),
    where("status", "==", "open")
);

const existingSnapshot = await getDocs(existingQuery);

if (!existingSnapshot.empty) {

    alert("This report already has an active volunteer activity.");
    setSaving(false);

    return;

}

    try {

        await addDoc(
            collection(db, "volunteer_posts"),
            {

                postId: post.id,

                title,

                description: desc,

                requirements: requirements.filter(r => r.trim() !== ""),

                imageUrl: post.imageUrl,

                firstName: post.firstName,

                lastName: post.lastName,

                locationName: location,

                maxVolunteers: Number(maxVolunteers),

                joinedCount: 0,

                volunteers: [],

                status: "open",

                createdAt: serverTimestamp(),

            }
        );

        await updateDoc(

    doc(db,"posts",post.id),

    {
        status:"ongoing",
    }

);

        alert("Volunteer activity created!");

        setSelectedVolunteerPost(null);

   } catch (error) {

    console.log(error);

    alert("Something went wrong.");

    setSaving(false);

}

};

const addRequirement = () => {

    setRequirements([
        ...requirements,
        "",
    ]);

};

const removeRequirement = (index) => {

    const updated = [...requirements];

    updated.splice(index, 1);

    setRequirements(updated);

};

const updateRequirement = (text, index) => {

    const updated = [...requirements];

    updated[index] = text;

    setRequirements(updated);

};

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* BACK BUTTON */}
       <TouchableOpacity
    style={styles.backBtn}
    onPress={() => {
        setSelectedVolunteerPost(null);
        setSelectedPost(post);
    }}
>
          <Image source={require("../../../../assets/images/backG.png")} style={styles.backIcon} />
        </TouchableOpacity>

        {/* MAIN ROW */}
        <View style={[styles.row, { flexDirection: isMobile ? "column" : "row" }]}>
          {/* LEFT CARD */}
          <View style={[styles.card, { flex: isMobile ? 0 : 1 }]}>
            <Image
    source={{ uri: post.imageUrl }}
    style={[styles.cardImage, { height: isMobile ? 200 : 300 }]}
    resizeMode="cover"
/>
          </View>

          {/* RIGHT EDIT FIELDS */}
          <View style={[styles.editSection, { flex: isMobile ? 0 : 1 }]}>
            <View style={styles.inputBox}>
              <TextInput placeholder="Title..." value={title} onChangeText={setTitle} style={styles.input} />
              <Image source={require("../../../../assets/images/edit.png")} style={styles.smallEdit} />
            </View>
            <View style={[styles.inputBox, { minHeight: 100 }]}>
              <TextInput placeholder="Write something" value={desc} onChangeText={setDesc} multiline style={[styles.input, { minHeight: 100 }]} />
              <Image source={require("../../../../assets/images/edit.png")} style={styles.smallEdit} />
            </View>
<View style={styles.requirementBox}>

    <ScrollView
        style={{ maxHeight: 130 }}
        showsVerticalScrollIndicator={false}
    >

        {requirements.map((item, index) => (

            <View
                key={index}
                style={styles.requirementRow}
            >

                <TextInput
                    placeholder="Requirement..."
                    value={item}
                    onChangeText={(text)=>
                        updateRequirement(text,index)
                    }
                    style={styles.requirementInput}
                />

                {requirements.length > 1 && (

                    <TouchableOpacity
                        onPress={() =>
                            removeRequirement(index)
                        }
                    >

                        <Image
                            source={require("../../../../assets/images/close.png")}
                            style={styles.requirementIcon}
                        />

                    </TouchableOpacity>

                )}

            </View>

        ))}

    </ScrollView>

    <TouchableOpacity
        style={styles.addButton}
        onPress={addRequirement}
    >

        <Image
            source={require("../../../../assets/images/plus.png")}
            style={styles.requirementIcon}
        />

    </TouchableOpacity>

</View>
<View style={styles.bottomRow}>

  {/* LOCATION */}

  <View style={[styles.inputBox, { flex: 2 }]}>
    <Image
      source={require("../../../../assets/images/location.png")}
      style={styles.locationIcon}
    />

    <TextInput
      placeholder="Location"
      value={location}
      onChangeText={setLocation}
      style={[styles.input, { marginLeft: 8 }]}
    />

    <Image
      source={require("../../../../assets/images/edit.png")}
      style={styles.smallEdit}
    />
  </View>

  {/* MAX VOLUNTEERS */}

  <View style={[styles.inputBox, { flex: 1 }]}>

    <Text
      style={styles.peopleIcon}
    >
      <Image
      source={require("../../../../assets/images/acc.png")}
      style={styles.smallEdit}
    />
    </Text>

<TextInput
    placeholder="Max Participants"
    keyboardType="numeric"
    value={maxVolunteers}
    onChangeText={(text) => {

        const numbersOnly = text.replace(/[^0-9]/g, "");

        setMaxVolunteers(numbersOnly);

    }}
    maxLength={2}
    style={styles.maxVolunteerInput}
/>


  </View>

</View>
          </View>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity
    disabled={saving}
    style={[
        styles.saveBtn,
        saving && {
            opacity:0.6,
        }
    ]}
    onPress={saveVolunteerPost}
>
          <Text style={styles.saveText}>
    {saving ? "Saving..." : "Save Changes"}
</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({

  requirementBox:{
    backgroundColor:"#D9D9D9",
    borderRadius:6,
    padding:10,
    minHeight:100,
},

requirementRow:{
    flexDirection:"row",
    alignItems:"center",
    marginBottom:8,
},

requirementInput:{
    flex:1,
    backgroundColor:"#bdb9b9b7",
    borderRadius:5, 
    paddingHorizontal:10,
    height:40,
},

requirementIcon:{
    width:20,
    height:20,
    marginLeft:10,
},

addButton:{
    alignItems:"flex-end",
    marginTop:5,
},

  maxVolunteerInput:{
    width:125,
    textAlign:"center",
    fontWeight:"bold",
},

  page: { flex: 1 },
  content: { padding: 20, gap: 20 },

  backBtn: { marginBottom: 10 },
  backIcon: { width: 45, height: 45 },

  row: { gap: 20 },

  card: { backgroundColor: "#fff", borderRadius: 10, overflow: 'hidden' },
  cardImage: { width: "100%", borderRadius: 10 },

  editSection: { gap: 12 },

  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#D9D9D9", borderRadius: 6, paddingHorizontal: 10, minHeight: 45 },
  input: { flex: 1, fontSize: 14 },

  smallEdit: { width: 18, height: 18 },
  locationIcon: { width: 18, height: 18 },

  saveBtn: { marginTop: 20, backgroundColor: "#5F9C76", padding: 15, borderRadius: 8, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  bottomRow: {
    flexDirection: "row",
    gap: 12,
},

peopleIcon: {
    fontSize: 18,
},
});