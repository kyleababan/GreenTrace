import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";

export default function VolunteerPostCreate({ setActivePage }) {
  const [title, setTitle] = useState("Need Volunteers");
  const [desc, setDesc] = useState("");
  const [reqs, setReqs] = useState("");
  const [location, setLocation] = useState("");

  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* BACK BUTTON */}
        <TouchableOpacity style={styles.backBtn} onPress={() => setActivePage("postdetail")}>
          {/* <Image source={require("../../../assets/backG.png")} style={styles.backIcon} /> */}
        </TouchableOpacity>

        {/* MAIN ROW */}
        <View style={[styles.row, { flexDirection: isMobile ? "column" : "row" }]}>
          {/* LEFT CARD */}
          <View style={[styles.card, { flex: isMobile ? 0 : 1 }]}>
            {/* <Image 
              source={require("../../../assets/Post1.png")} 
              style={[styles.cardImage, { height: isMobile ? 200 : 300 }]} 
              resizeMode="cover" 
            /> */}
          </View>

          {/* RIGHT EDIT FIELDS */}
          <View style={[styles.editSection, { flex: isMobile ? 0 : 1 }]}>
            <View style={styles.inputBox}>
              <TextInput placeholder="Title..." value={title} onChangeText={setTitle} style={styles.input} />
              {/* <Image source={require("../../../assets/Edit.png")} style={styles.smallEdit} /> */}
            </View>
            <View style={[styles.inputBox, { minHeight: 100 }]}>
              <TextInput placeholder="Write something" value={desc} onChangeText={setDesc} multiline style={[styles.input, { minHeight: 100 }]} />
              {/* <Image source={require("../../../assets/Edit.png")} style={styles.smallEdit} /> */}
            </View>
            <View style={[styles.inputBox, { minHeight: 80 }]}>
              <TextInput placeholder="Requirements..." value={reqs} onChangeText={setReqs} multiline style={[styles.input, { minHeight: 80 }]} />
              {/* <Image source={require("../../../assets/Edit.png")} style={styles.smallEdit} /> */}
            </View>
            <View style={styles.inputBox}>
              {/* <Image source={require("../../../assets/Location.png")} style={styles.locationIcon} /> */}
              <TextInput placeholder="Location" value={location} onChangeText={setLocation} style={[styles.input, { marginLeft: 8 }]} />
              {/* <Image source={require("../../../assets/Edit.png")} style={styles.smallEdit} /> */}
            </View>
          </View>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity style={styles.saveBtn} onPress={() => setActivePage("postdetail")}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
});