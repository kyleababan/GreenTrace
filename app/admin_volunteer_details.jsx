import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

export default function AdminVolunteerDetails() {
  const [isCleaned, setIsCleaned] = useState(false);

  const members = [1, 2, 3, 4]; // placeholder
  const router = useRouter();
  return (
    <View style={styles.page}>
      <View style={styles.content}>

        <ScrollView showsVerticalScrollIndicator={true}>
          
          {/* TOP ROW */}
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                          source={require("../assets/images/back.png")}
                          style={styles.backIcon}
                        />
                      </TouchableOpacity>

            <TouchableOpacity style={styles.editBtn}
            onPress={() => router.push("/admin_edit")}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* MAIN CONTENT */}
          <View style={styles.mainRow}>

            {/* LEFT SIDE */}
            <View style={styles.left}>
              <Image
                source={require("../assets/images/pic1.png")}
                style={styles.mainImage}
              />

              <Text style={styles.title}>Need Volunteers</Text>

              <Text style={styles.desc}>
                Responsible for sorting and organizing garbage to ensure proper
                transfer to a nearby landfill, supporting efficient and safe waste
                management.
              </Text>
            </View>

            {/* RIGHT SIDE */}
            <View style={styles.right}>
              
              <Text style={styles.sectionTitle}>Members</Text>

              <View style={styles.avatarRow}>
                {members.map((m, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.avatar}
                    onPress={() => alert("Kick member (placeholder)")}
                  >
                    
                   <Image
                     source={require("../assets/images/profile2.png")}
                     style={styles.avatar}
                   />  
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Requirements:</Text>
              <Text style={styles.req}>- Broom</Text>
              <Text style={styles.req}>- Dust pan</Text>
              <Text style={styles.req}>- Gloves</Text>

              <View style={styles.locationBox}>
                <Text>  <Image
                 source={require("../assets/images/location.png")}
                 style={styles.locationIcon}/> 
                 Poblacion, Pinamungajan</Text>
              </View>

            </View>
          </View>

          {/* ACTION BUTTON */}
          <TouchableOpacity
            style={[
              styles.cleanButton,
              isCleaned && styles.cleanedState,
            ]}
            onPress={() => setIsCleaned(!isCleaned)}
          >
            <Text style={styles.cleanText}>
              {isCleaned ? "Area Cleaned ✓" : "Area Cleaned"}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#E6E6E6",
  },

  content: {
    flex: 1,
    padding: 20,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: "#5F9C76",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  editBtn: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 8,
  },

  editText: {
    color: "#fff",
    fontWeight: "bold",
  },

  mainRow: {
    flexDirection: "row",
    gap: 20,
  },

  left: {
    flex: 2,
  },

  right: {
    flex: 1,
  },

  mainImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },

  desc: {
    fontSize: 13,
    color: "#444",
  },

  sectionTitle: {
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },

  avatarRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },

  req: {
    fontSize: 12,
  },

  locationBox: {
    marginTop: 10,
    backgroundColor: "#ccc",
    padding: 10,
    borderRadius: 6,
  },

  cleanButton: {
    marginTop: 20,
    backgroundColor: "#5F9C76",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },

  cleanedState: {
    backgroundColor: "#3CB371", // greener when done
  },

  cleanText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  backIcon: {
    color: "#5F9C76",
  }
});