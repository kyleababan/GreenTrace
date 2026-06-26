import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

export default function AdminEdit() {
  const [title, setTitle] = useState("Need Volunteers");
  const [desc, setDesc] = useState("");
  const [reqs, setReqs] = useState("");
  const [location, setLocation] = useState("");
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={styles.content}>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* TOP */}
          <TouchableOpacity style={styles.backBtn}
          onPress={() => router.back()}
          >
            <Image
              source={require("../assets/images/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>

          {/* MAIN ROW */}
          <View style={styles.row}>

            {/* LEFT CARD */}
            <View style={styles.card}>

              <View>
                <Image
                  source={require("../assets/images/pic1.png")}
                  style={styles.cardImage}
                />

                {/* Edit image button */}
                <TouchableOpacity style={styles.imageEdit}>
                  <Image
                    source={require("../assets/images/edit.png")}
                    style={styles.editIcon}
                  />
                </TouchableOpacity>
              </View>

              {/* USER */}
              <View style={styles.userRow}>
                <View style={styles.avatar} />
                <View>
                  <Text style={styles.userName}>Peter Dawning</Text>
                  <Text style={styles.userSub}>
                    Garbage piling up near the alley
                  </Text>
                </View>
              </View>

              {/* STATS */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Image
                    source={require("../assets/images/priorityreact.png")}
                    style={styles.statIcon}
                  />
                  <Text>20</Text>
                </View>

                <View style={styles.statBox}>
                  <Text>💬</Text>
                  <Text>5</Text>
                </View>
              </View>
            </View>

            {/* RIGHT EDIT FIELDS */}
            <View style={styles.editSection}>

              {/* TITLE */}
              <View style={styles.inputBox}>
                <TextInput
                  placeholder="Title..."
                  value={title}
                  onChangeText={setTitle}
                  style={styles.input}
                />
                <TouchableOpacity>
                  <Image
                    source={require("../assets/images/edit.png")}
                    style={styles.smallEdit}
                  />
                </TouchableOpacity>
              </View>

              {/* DESCRIPTION */}
              <View style={[styles.inputBox, { height: 100 }]}>
                <TextInput
                  placeholder="Write something"
                  value={desc}
                  onChangeText={setDesc}
                  multiline
                  style={styles.input}
                />
                <TouchableOpacity>
                  <Image
                    source={require("../assets/images/edit.png")}
                    style={styles.smallEdit}
                  />
                </TouchableOpacity>
              </View>

              {/* REQUIREMENTS */}
              <View style={[styles.inputBox, { height: 80 }]}>
                <TextInput
                  placeholder="Requirements..."
                  value={reqs}
                  onChangeText={setReqs}
                  multiline
                  style={styles.input}
                />
                <TouchableOpacity>
                  <Image
                    source={require("../assets/images/edit.png")}
                    style={styles.smallEdit}
                  />
                </TouchableOpacity>
              </View>

              {/* LOCATION */}
              <View style={styles.inputBox}>
                <Image
                  source={require("../assets/images/location.png")}
                  style={styles.locationIcon}
                />

                <TextInput
                  placeholder="Location"
                  value={location}
                  onChangeText={setLocation}
                  style={[styles.input, { marginLeft: 8 }]}
                />

                <TouchableOpacity>
                  <Image
                    source={require("../assets/images/edit.png")}
                    style={styles.smallEdit}
                  />
                </TouchableOpacity>
              </View>

            </View>
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity style={styles.saveBtn}>
            <Text style={styles.saveText}>Save Changes?</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#E6E6E6",
  },

  content: {
    flex: 1,
    padding: 20,
  },

  backBtn: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: "#5F9C76",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  backIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },

  row: {
    flexDirection: "row",
    gap: 20,
  },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
  },

  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: 10,
  },

  imageEdit: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#ddd",
    width: 35,
    height: 35,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  editIcon: {
    width: 16,
    height: 16,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ccc",
    marginRight: 10,
  },

  userName: {
    fontWeight: "bold",
  },

  userSub: {
    fontSize: 12,
    color: "#555",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  statBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  statIcon: {
    width: 16,
    height: 16,
  },

  editSection: {
    flex: 1,
    gap: 12,
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D9D9D9",
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 45,
  },

  input: {
    flex: 1,
    fontSize: 14,
  },

  smallEdit: {
    width: 18,
    height: 18,
  },

  locationIcon: {
    width: 18,
    height: 18,
  },

  saveBtn: {
    marginTop: 25,
    backgroundColor: "#5F9C76",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});