import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";

export default function CreateVolunteerList() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Simple check for responsive layout

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* HEADER / BACK BUTTON */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Image
              source={require("../assets/images/back.png")}
              style={[styles.backIcon, { tintColor: '#5F9C76' }]} // Using your green theme
            />
          </TouchableOpacity>
        </View>

        {/* MAIN FORM AREA */}
        <View style={[styles.mainRow, isMobile && { flexDirection: 'column' }]}>
          
          {/* LEFT SIDE: PREVIEW CARD */}
          <View style={styles.left}>
            <View style={styles.cardPreview}>
              <Image
                source={require("../assets/images/pic3.png")}
                style={styles.mainImage}
              />
              <View style={styles.cardFooter}>
                <View style={styles.userRow}>
                   <View style={styles.avatarCircle}>
                      <Image 
                        source={require("../assets/images/profile.png")} 
                        style={{width: 20, height: 20, tintColor: 'black'}} 
                      />
                   </View>
                   <Text style={styles.userName}>Peter Dawning</Text>
                </View>
                <Text style={styles.cardDesc}>Garbage piling up near the alley</Text>
                
                <View style={styles.statsRow}>
                   <Text style={styles.statText}> 
                    <Image 
                    source={require("../assets/images/priorityreact.png")} 
                    style={styles.reactIcon} /> 
                    20</Text>
                   <Text style={styles.statText}>  <Image 
                    source={require("../assets/images/comment.png")} 
                    style={styles.commentIcon} />  5</Text>
                </View>
              </View>
            </View>
          </View>

          {/* RIGHT SIDE: INPUT FIELDS */}
          <View style={styles.right}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title:.....</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder="Enter title" />
                <Image source={require("../assets/images/edit.png")} style={styles.editIcon} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Write something</Text>
              <View style={styles.inputWrapper}>
                <TextInput 
                  style={[styles.input, { height: 100 }]} 
                  multiline 
                  placeholder="Describe the task..." 
                />
                <Image source={require("../assets/images/edit.png")} style={styles.editIcon} />
              </View>
            </View>

            <View style={styles.inputGroup}>
               <View style={styles.inputWrapper}>
                <Image source={require("../assets/images/location.png")} style={styles.locIcon} />
                <TextInput style={styles.input} placeholder="Location" />
                <Image source={require("../assets/images/edit.png")} style={styles.editIcon} />
              </View>
            </View>
          </View>
        </View>

        {/* BOTTOM ACTION BUTTON */}
        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createText}>Create new volunteer list</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#E5E7EB" },
  content: { padding: 30, gap: 20 },
  topRow: { marginBottom: 10 },
  backIcon: { width: 45, height: 45 },
  
  mainRow: { flexDirection: "row", gap: 30 },
  
  // Left Column (The Card)
  left: { flex: 1 },
  cardPreview: {
    backgroundColor: "white",
    borderRadius: 15,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  mainImage: { width: "100%", height: 250, resizeMode: "cover" },
  cardFooter: { padding: 15 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  avatarCircle: { width: 30, height: 30, borderRadius: 15, borderWith: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  userName: { fontWeight: "bold", fontSize: 18 },
  cardDesc: { fontSize: 12, color: "#666", marginBottom: 15 },
  statsRow: { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, alignContent: "center", },
  statText: { color: '#888', alignContent: "center", },

  // Right Column (The Form)
  right: { flex: 1.2, gap: 20 },
  inputGroup: { gap: 5 },
  label: { fontSize: 14, color: "#444" },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  input: { flex: 1, height: 50, fontSize: 16 },
  editIcon: { width: 20, height: 20, opacity: 0.6, }, // Mocking an edit pen
  locIcon: { width: 20, height: 20, marginRight: 10 },

  // Large Button
  createButton: {
    backgroundColor: "#5F9C76",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  createText: { color: "#fff", fontWeight: "bold", fontSize: 18 },

  commentIcon: {
    height: 25,
    width: 25,
    resizeMode: "contain",
  }
});