import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Navbar from "../components/navbar";
import { auth, db } from "../firebaseConfig";

const getMemberId = (member) => typeof member === "string" ? member : member?.userId || member?.uid || member?.id || "";
const getMemberName = (member) => typeof member === "string" ? "Volunteer" : [member?.firstName, member?.lastName].filter(Boolean).join(" ") || "Volunteer";
const getInitials = (name) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "V";

export default function Volunteering() {
  const { volunteerId } = useLocalSearchParams();
  const router = useRouter();
  const [activity, setActivity] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState(null);
  const [showLockedModal, setShowLockedModal] = useState(false);

  useEffect(() => {
    const loadActivity = async () => {
      setLoading(true);
      setImageAspectRatio(null);
      try {
        const signedInUser = auth.currentUser;
        if (!signedInUser) {
          setLoadError("Please sign in to volunteer.");
          return;
        }

        const [activitySnapshot, userSnapshot] = await Promise.all([
          getDoc(doc(db, "volunteer_posts", volunteerId)),
          getDoc(doc(db, "users", signedInUser.uid)),
        ]);

        if (!activitySnapshot.exists()) {
          setLoadError("This volunteer activity is no longer available.");
          return;
        }

        setActivity({ id: activitySnapshot.id, ...activitySnapshot.data() });
        setCurrentUser({ id: signedInUser.uid, ...(userSnapshot.exists() ? userSnapshot.data() : {}) });
      } catch (error) {
        console.error("Unable to load volunteer activity:", error);
        setLoadError("Unable to load this volunteer activity.");
      } finally {
        setLoading(false);
      }
    };

    if (volunteerId) loadActivity();
    else {
      setLoadError("Volunteer activity not found.");
      setLoading(false);
    }
  }, [volunteerId]);

  const members = useMemo(() => Array.isArray(activity?.volunteers) ? activity.volunteers : [], [activity?.volunteers]);
  const isJoined = members.some((member) => getMemberId(member) === currentUser?.id);
  const maxVolunteers = Number(activity?.maxVolunteers) || 0;
  const joinedCount = Number.isFinite(Number(activity?.joinedCount)) ? Number(activity.joinedCount) : members.length;
  const isFull = !isJoined && joinedCount >= maxVolunteers;
  const isLocked = activity?.isLocked === true;

  const toggleVolunteer = async () => {
    if (joining || !activity || !currentUser) return;
    if (isLocked && !isJoined) {
      setShowLockedModal(true);
      return;
    }

    setJoining(true);
    try {
      await runTransaction(db, async (transaction) => {
        const activityRef = doc(db, "volunteer_posts", activity.id);
        const snapshot = await transaction.get(activityRef);
        if (!snapshot.exists()) throw new Error("This activity no longer exists.");

        const data = snapshot.data();
        const currentMembers = Array.isArray(data.volunteers) ? data.volunteers : [];
        const alreadyJoined = currentMembers.some((member) => getMemberId(member) === currentUser.id);
        let updatedMembers;

        if (alreadyJoined) {
          updatedMembers = currentMembers.filter((member) => getMemberId(member) !== currentUser.id);
        } else {
          if (data.status !== "open") throw new Error("This activity is closed.");
          if (data.isLocked === true) throw new Error("This activity is locked.");

          const capacity = Number(data.maxVolunteers) || 0;
          if (currentMembers.length >= capacity) throw new Error("This activity is already full.");

          updatedMembers = [
            ...currentMembers,
            {
              userId: currentUser.id,
              firstName: currentUser.firstName || "",
              lastName: currentUser.lastName || "",
              email: currentUser.email || "",
            },
          ];
        }

        transaction.update(activityRef, { volunteers: updatedMembers, joinedCount: updatedMembers.length });
      });

      setActivity((currentActivity) => {
        const currentMembers = Array.isArray(currentActivity.volunteers) ? currentActivity.volunteers : [];
        const alreadyJoined = currentMembers.some((member) => getMemberId(member) === currentUser.id);
        const updatedMembers = alreadyJoined
          ? currentMembers.filter((member) => getMemberId(member) !== currentUser.id)
          : [...currentMembers, { userId: currentUser.id, firstName: currentUser.firstName || "", lastName: currentUser.lastName || "", email: currentUser.email || "" }];

        return { ...currentActivity, volunteers: updatedMembers, joinedCount: updatedMembers.length };
      });
    } catch (error) {
      console.error("Unable to update volunteer status:", error);
      if (error.message === "This activity is locked.") {
        setActivity((currentActivity) => ({ ...currentActivity, isLocked: true }));
        setShowLockedModal(true);
      } else {
        Alert.alert("Unable to update", error.message || "Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <View style={styles.stateContainer}><ActivityIndicator size="large" color="#5F9C76" /></View>;
  if (!activity) return <View style={styles.stateContainer}><Text style={styles.stateText}>{loadError || "Volunteer activity not found."}</Text><TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backButtonText}>Go back</Text></TouchableOpacity></View>;

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <TouchableOpacity style={styles.backIconButton} onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        </View>

        <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{activity.title || "Volunteer activity"}</Text>
          <Text style={styles.description}>{activity.description || "No description provided."}</Text>
          {activity.imageUrl ? (
            <Image
              source={{ uri: activity.imageUrl }}
              style={[styles.mainImage, imageAspectRatio && { aspectRatio: imageAspectRatio }]}
              resizeMode="contain"
              onLoad={({ nativeEvent }) => {
                const { width, height } = nativeEvent?.source || {};
                if (width && height) setImageAspectRatio(width / height);
              }}
            />
          ) : <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={42} color="#71907d" /><Text style={styles.placeholderText}>No image available</Text></View>}

          <View style={styles.locationRow}><Ionicons name="location-outline" size={18} color="#276344" /><Text style={styles.locationText}>{activity.locationName || "Location not specified"}</Text></View>

          <View style={styles.infoBox}>
            <View style={styles.labelRow}><Text style={styles.label}>Volunteers</Text><Text style={styles.count}>{joinedCount} / {maxVolunteers}</Text></View>
            <View style={styles.avatarRow}>
              {members.length ? members.slice(0, 8).map((member, index) => { const name = getMemberName(member); return <View key={`${getMemberId(member)}-${index}`} style={styles.avatarCircle}><Text style={styles.avatarText}>{getInitials(name)}</Text></View>; }) : <Text style={styles.emptyMembers}>No volunteers have joined yet.</Text>}
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Requirements</Text>
            {activity.requirements?.length ? activity.requirements.map((requirement, index) => <Text key={`${requirement}-${index}`} style={styles.reqItem}>• {requirement}</Text>) : <Text style={styles.emptyMembers}>No requirements listed.</Text>}
          </View>

          <TouchableOpacity disabled={joining || (isFull && !isLocked)} style={[styles.mainButton, isJoined && styles.joinedButton, isFull && styles.disabledButton, isLocked && !isJoined && styles.lockedButton]} onPress={toggleVolunteer}>
            {isLocked && !isJoined ? <Ionicons name="lock-closed" size={19} color="#fff" /> : null}
            <Text style={[styles.buttonText, isJoined && styles.joinedButtonText]}>{joining ? "Updating..." : isJoined ? "Leave activity" : isLocked ? "Activity locked" : isFull ? "Activity full" : "Volunteer"}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.navbarContainer}><Navbar /></View>
      </View>

      <Modal visible={showLockedModal} transparent animationType="fade" onRequestClose={() => setShowLockedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.lockedModal} accessibilityRole="alert">
            <View style={styles.lockedIcon}><Ionicons name="lock-closed" size={30} color="#bf3030" /></View>
            <Text style={styles.lockedTitle}>Activity locked</Text>
            <Text style={styles.lockedMessage}>This volunteer activity is not accepting new volunteers right now.</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowLockedModal(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: "center", backgroundColor: "#fff" },
  container: { flex: 1, width: "100%", maxWidth: 500, backgroundColor: "#fff" },
  topSection: { padding: 20, backgroundColor: "#5F9C76" },
  backIconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  stateContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  stateText: { color: "#5d6b61", textAlign: "center" },
  backButton: { backgroundColor: "#5F9C76", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  backButtonText: { color: "#fff", fontWeight: "700" },
  feed: { flex: 1 },
  feedContent: { padding: 16, gap: 14 },
  title: { fontSize: 25, fontWeight: "700", color: "#1d2b21" },
  description: { fontSize: 15, color: "#46564b", lineHeight: 21 },
  mainImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: "#dfe8e2" },
  imagePlaceholder: { width: "100%", height: 210, borderRadius: 10, backgroundColor: "#dfe8e2", alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderText: { color: "#577061" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  locationText: { flex: 1, color: "#276344", fontWeight: "600" },
  infoBox: { backgroundColor: "#f3f6f4", padding: 14, borderRadius: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#1d2b21", fontWeight: "700", fontSize: 15 },
  count: { color: "#27734d", fontWeight: "700" },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#5F9C76", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  emptyMembers: { color: "#718078", fontSize: 13, marginTop: 8 },
  reqItem: { color: "#435248", marginTop: 7 },
  mainButton: { backgroundColor: "#5F9C76", paddingVertical: 14, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 2 },
  joinedButton: { backgroundColor: "#e7c853" },
  disabledButton: { backgroundColor: "#adb5af" },
  lockedButton: { backgroundColor: "#bf3030" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  joinedButtonText: { color: "#373116" },
  navbarContainer: { borderTopWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  lockedModal: { width: "100%", maxWidth: 360, borderRadius: 14, backgroundColor: "#fff", padding: 24, alignItems: "center" },
  lockedIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff0f0", alignItems: "center", justifyContent: "center" },
  lockedTitle: { marginTop: 14, fontSize: 20, fontWeight: "700", color: "#172119" },
  lockedMessage: { marginTop: 8, color: "#63756a", lineHeight: 20, textAlign: "center" },
  modalButton: { width: "100%", marginTop: 22, paddingVertical: 12, borderRadius: 8, backgroundColor: "#5F9C76", alignItems: "center" },
  modalButtonText: { color: "#fff", fontWeight: "700" },
});
