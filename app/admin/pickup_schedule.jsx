import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function PickupSchedule() {
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState("");
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadItems = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) { console.log(error); }
  };

  useEffect(() => {
    const timer = setTimeout(() => { loadItems(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const publish = async () => {
    if (!title.trim() || !schedule.trim()) {
      Alert.alert("Add the title and pickup schedule first.");
      return;
    }
    try {
      setSaving(true);
      await addDoc(collection(db, "announcements"), {
        title: title.trim(), schedule: schedule.trim(), area: area.trim(), message: message.trim(), createdAt: serverTimestamp(),
      });
      setTitle(""); setSchedule(""); setArea(""); setMessage("");
      await loadItems();
    } catch (error) { Alert.alert("Could not publish announcement", error.message); }
    finally { setSaving(false); }
  };

  const remove = (id) => Alert.alert("Remove announcement?", "This will no longer appear to users.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => { await deleteDoc(doc(db, "announcements", id)); await loadItems(); } },
  ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Pickup Schedule</Text>
      <Text style={styles.subheading}>Publish collection schedules and announcements for residents.</Text>
      <View style={styles.form}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Announcement title" />
        <TextInput style={styles.input} value={schedule} onChangeText={setSchedule} placeholder="Schedule (example: Every Tuesday, 7:00 AM)" />
        <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="Coverage area / Purok (optional)" />
        <TextInput style={[styles.input, styles.message]} value={message} onChangeText={setMessage} placeholder="Additional instructions (optional)" multiline />
        <TouchableOpacity style={[styles.publish, saving && styles.disabled]} onPress={publish} disabled={saving}><Text style={styles.publishText}>{saving ? "PUBLISHING..." : "PUBLISH ANNOUNCEMENT"}</Text></TouchableOpacity>
      </View>
      <Text style={styles.listHeading}>Published announcements</Text>
      {items.map((item) => <View key={item.id} style={styles.card}><View style={styles.cardContent}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardSchedule}>{item.schedule}{item.area ? ` • ${item.area}` : ""}</Text>{Boolean(item.message) && <Text style={styles.cardMessage}>{item.message}</Text>}</View><TouchableOpacity onPress={() => remove(item.id)}><Text style={styles.remove}>Remove</Text></TouchableOpacity></View>)}
      {!items.length && <Text style={styles.empty}>No announcements published yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 }, heading: { color: "#599A74", fontSize: 32, fontWeight: "800" }, subheading: { color: "#64748B", fontSize: 15, marginTop: 6, marginBottom: 22 }, form: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 18 }, input: { borderWidth: 1, borderColor: "#D8E2DC", borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: "#FAFCFB" }, message: { minHeight: 88, textAlignVertical: "top" }, publish: { backgroundColor: "#599A74", borderRadius: 8, alignItems: "center", padding: 13 }, disabled: { opacity: 0.6 }, publishText: { color: "#FFFFFF", fontWeight: "800" }, listHeading: { color: "#599A74", fontSize: 20, fontWeight: "800", marginTop: 28, marginBottom: 12 }, card: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 10, padding: 15, marginBottom: 10 }, cardContent: { flex: 1 }, cardTitle: { color: "#234B33", fontSize: 16, fontWeight: "800" }, cardSchedule: { color: "#397A51", fontWeight: "700", marginTop: 4 }, cardMessage: { color: "#64748B", marginTop: 5 }, remove: { color: "#D9534F", fontWeight: "700", marginLeft: 12 }, empty: { color: "#64748B" },
});
