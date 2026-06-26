import { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";

export default function VolunteerDetails({ setActivePage }) {
  const [isCleaned, setIsCleaned] = useState(false);
  const members = [1, 2, 3, 4];

  const { width } = useWindowDimensions();
  const isTablet = width >= 600 && width < 1024;
  const isMobile = width < 600;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* TOP ROW */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => setActivePage("volunteer")}>
            <Image
              source={require("../assets/images/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.editBtn} onPress={() => setActivePage("volunteeredit")}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainRow}>
          {/* LEFT SIDE */}
          <View style={styles.left}>
            <Image
              source={require("../assets/images/pic1.png")}
              style={[styles.mainImage, { height: isMobile ? 200 : isTablet ? 250 : 300 }]}
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
              <Image
                source={require("../assets/images/location.png")}
                style={styles.locationIcon}
              />
              <Text>Poblacion, Pinamungajan</Text>
            </View>
          </View>
        </View>

        {/* ACTION BUTTON */}
        <TouchableOpacity
          style={[styles.cleanButton, isCleaned && styles.cleanedState]}
          onPress={() => setIsCleaned(!isCleaned)}
        >
          <Text style={styles.cleanText}>
            {isCleaned ? "Area Cleaned ✓" : "Area Cleaned"}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f5f6fa",

  },
  content: {
    padding: 20,
    gap: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  backIcon: {
    width: 40,
    height: 40,
  },
  editBtn: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editText: { color: "#fff", fontWeight: "bold" },
  mainRow: {
    flexDirection: "row",
    gap: 20,
    flexWrap: "wrap",
  },
  left: {
    flex: 1,
    width: "100%",
    height: 580,
  },
  right: {
    flex: 1,
    justifyContent: "flex-start",
  },
  mainImage: {
    width: "auto",
    height: 'auto',
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: "cover",
  },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 5 },
  desc: { fontSize: 13, color: "#444" },
  sectionTitle: { fontWeight: "bold", marginVertical: 5 },
  avatarRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  req: { fontSize: 12, marginBottom: 2 },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#ccc",
    padding: 10,
    borderRadius: 6,
    gap: 5,
  },
  locationIcon: { width: 20, height: 20 },
  cleanButton: {
    marginTop: 20,
    backgroundColor: "#5F9C76",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  cleanedState: { backgroundColor: "#3CB371" },
  cleanText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});