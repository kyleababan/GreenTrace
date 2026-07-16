import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { db } from "../../../../firebaseConfig";

export default function VolunteerPostCreate({
  setSelectedVolunteerPost,
  post: suppliedPost,
  setSelectedPost,
}) {
  const { volunteerId } = useLocalSearchParams();
  const router = useRouter();
  const isEditing = Boolean(volunteerId);
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [volunteerPost, setVolunteerPost] = useState(isEditing ? null : suppliedPost || null);
  const [title, setTitle] = useState(suppliedPost?.title || "Need Volunteers");
  const [desc, setDesc] = useState(suppliedPost?.description || "");
  const [requirements, setRequirements] = useState(suppliedPost?.requirements?.length ? suppliedPost.requirements : [""]);
  const [location, setLocation] = useState(suppliedPost?.locationName || "");
  const [maxVolunteers, setMaxVolunteers] = useState(
    suppliedPost?.maxVolunteers ? String(suppliedPost.maxVolunteers) : ""
  );
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    const loadVolunteerPost = async () => {
      try {
        const snapshot = await getDoc(doc(db, "volunteer_posts", volunteerId));

        if (!snapshot.exists()) {
          alert("This volunteer activity is no longer available.");
          router.back();
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() };
        setVolunteerPost(data);
        setTitle(data.title || "Need Volunteers");
        setDesc(data.description || "");
        setRequirements(data.requirements?.length ? data.requirements : [""]);
        setLocation(data.locationName || "");
        setMaxVolunteers(data.maxVolunteers ? String(data.maxVolunteers) : "");
      } catch (error) {
        console.error("Unable to load volunteer activity:", error);
        alert("Unable to load this volunteer activity.");
      } finally {
        setLoading(false);
      }
    };

    loadVolunteerPost();
  }, [isEditing, router, volunteerId]);

  const goBack = () => {
    if (isEditing) {
      router.back();
      return;
    }

    setSelectedVolunteerPost?.(null);
    setSelectedPost?.(suppliedPost);
  };

  const saveVolunteerPost = async () => {
    if (saving) return;

    const cleanedRequirements = requirements.map((item) => item.trim()).filter(Boolean);

    if (!title.trim()) return alert("Please enter a title.");
    if (!desc.trim()) return alert("Please enter a description.");
    if (!cleanedRequirements.length) return alert("Please add at least one requirement.");
    if (!location.trim()) return alert("Please enter a location.");
    if (!maxVolunteers || Number(maxVolunteers) < 1) return alert("Please enter the maximum volunteers.");

    setSaving(true);

    try {
      if (isEditing) {
        await updateDoc(doc(db, "volunteer_posts", volunteerPost.id), {
          title: title.trim(),
          description: desc.trim(),
          requirements: cleanedRequirements,
          locationName: location.trim(),
          maxVolunteers: Number(maxVolunteers),
        });

        alert("Volunteer activity updated!");
        router.replace("/admin/VolunteerList");
        return;
      }

      const existingSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", suppliedPost.id),
          where("status", "==", "open")
        )
      );

      if (!existingSnapshot.empty) {
        alert("This report already has an active volunteer activity.");
        return;
      }

      await addDoc(collection(db, "volunteer_posts"), {
        postId: suppliedPost.id,
        title: title.trim(),
        description: desc.trim(),
        requirements: cleanedRequirements,
        imageUrl: suppliedPost.imageUrl || "",
        firstName: suppliedPost.firstName || "",
        lastName: suppliedPost.lastName || "",
        locationName: location.trim(),
        maxVolunteers: Number(maxVolunteers),
        joinedCount: 0,
        volunteers: [],
        status: "open",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", suppliedPost.id), { status: "ongoing" });

      alert("Volunteer activity created!");
      router.replace("/admin/VolunteerList");
    } catch (error) {
      console.error("Unable to save volunteer activity:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addRequirement = () => setRequirements((current) => [...current, ""]);

  const removeRequirement = (index) => {
    setRequirements((current) => current.filter((_, requirementIndex) => requirementIndex !== index));
  };

  const updateRequirement = (text, index) => {
    setRequirements((current) => current.map((item, itemIndex) => (itemIndex === index ? text : item)));
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#5F9C76" /></View>;
  }

  const imageUrl = volunteerPost?.imageUrl || suppliedPost?.imageUrl;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityLabel="Go back">
          <Image source={require("../../../../assets/images/backG.png")} style={styles.backIcon} />
        </TouchableOpacity>

        <View style={[styles.row, { flexDirection: isMobile ? "column" : "row" }]}>
          <View style={[styles.card, { flex: isMobile ? 0 : 1 }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={[styles.cardImage, { height: isMobile ? 200 : 300 }]} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, { height: isMobile ? 200 : 300 }]}>
                <Ionicons name="image-outline" size={42} color="#71907d" />
                <Text style={styles.placeholderText}>No image available</Text>
              </View>
            )}
          </View>

          <View style={[styles.editSection, { flex: isMobile ? 0 : 1 }]}>
            <Text style={styles.heading}>{isEditing ? "Edit volunteer activity" : "Create volunteer activity"}</Text>
            <View style={styles.inputBox}>
              <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
            </View>
            <View style={[styles.inputBox, { minHeight: 100 }]}>
              <TextInput placeholder="Write something" value={desc} onChangeText={setDesc} multiline style={[styles.input, { minHeight: 100 }]} textAlignVertical="top" />
            </View>

            <View style={styles.requirementBox}>
              <Text style={styles.fieldLabel}>Requirements</Text>
              {requirements.map((item, index) => (
                <View key={`requirement-${index}`} style={styles.requirementRow}>
                  <TextInput placeholder="Requirement" value={item} onChangeText={(text) => updateRequirement(text, index)} style={styles.requirementInput} />
                  {requirements.length > 1 && (
                    <TouchableOpacity onPress={() => removeRequirement(index)} accessibilityLabel="Remove requirement">
                      <Ionicons name="close-circle" size={22} color="#b94b4b" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addButton} onPress={addRequirement}>
                <Ionicons name="add-circle-outline" size={22} color="#276344" />
                <Text style={styles.addButtonText}>Add requirement</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomRow}>
              <View style={[styles.inputBox, { flex: 2 }]}>
                <Ionicons name="location-outline" size={20} color="#276344" />
                <TextInput placeholder="Location" value={location} onChangeText={setLocation} style={[styles.input, { marginLeft: 8 }]} />
              </View>
              <View style={[styles.inputBox, { flex: 1 }]}>
                <Ionicons name="people-outline" size={20} color="#276344" />
                <TextInput placeholder="Max" keyboardType="numeric" value={maxVolunteers} onChangeText={(text) => setMaxVolunteers(text.replace(/[^0-9]/g, ""))} maxLength={3} style={styles.maxVolunteerInput} />
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity disabled={saving} style={[styles.saveBtn, saving && styles.disabledButton]} onPress={saveVolunteerPost}>
          <Text style={styles.saveText}>{saving ? "Saving..." : isEditing ? "Save changes" : "Create activity"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 20 },
  backBtn: { alignSelf: "flex-start" },
  backIcon: { width: 45, height: 45 },
  row: { gap: 20 },
  card: { borderRadius: 10, overflow: "hidden" },
  cardImage: { width: "100%", borderRadius: 10, backgroundColor: "#dfe8e2" },
  imagePlaceholder: { width: "100%", borderRadius: 10, backgroundColor: "#dfe8e2", alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderText: { color: "#577061" },
  editSection: { gap: 12 },
  heading: { fontSize: 20, fontWeight: "700", color: "#1d2b21" },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, fontSize: 15, paddingVertical: 10 },
  requirementBox: { backgroundColor: "#fff", borderRadius: 8, padding: 12, gap: 8 },
  fieldLabel: { fontWeight: "700", color: "#1d2b21" },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  requirementInput: { flex: 1, backgroundColor: "#f1f4f2", borderRadius: 6, paddingHorizontal: 10, height: 42 },
  addButton: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, paddingTop: 2 },
  addButtonText: { color: "#276344", fontWeight: "600" },
  bottomRow: { flexDirection: "row", gap: 12 },
  maxVolunteerInput: { flex: 1, textAlign: "center", fontWeight: "700", paddingVertical: 10 },
  saveBtn: { backgroundColor: "#5F9C76", padding: 15, borderRadius: 8, alignItems: "center" },
  disabledButton: { opacity: 0.6 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
