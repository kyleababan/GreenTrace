import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, increment, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { db } from "../../../../firebaseConfig";

const getFullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unnamed user";

const getInitials = (name) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

export default function UserPostDetail() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const userSnapshot = await getDoc(doc(db, "users", userId));
        if (!userSnapshot.exists()) {
          setLoadError("This user is no longer available.");
          return;
        }

        const postsSnapshot = await getDocs(
          query(collection(db, "posts"), where("userId", "==", userId))
        );

        const userPosts = postsSnapshot.docs.map((post) => ({ id: post.id, ...post.data() }));
        userPosts.sort((firstPost, secondPost) =>
          (secondPost.createdAt?.seconds || 0) - (firstPost.createdAt?.seconds || 0)
        );

        setUser({ id: userSnapshot.id, ...userSnapshot.data() });
        setPosts(userPosts);
      } catch (error) {
        console.error("Unable to load user details:", error);
        setLoadError("Unable to load this user.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) loadUserData();
  }, [userId]);

  const addPoints = async () => {
    const amount = Number(pointsToAdd);
    if (!Number.isInteger(amount) || amount < 1) {
      Alert.alert("Invalid points", "Enter a whole number greater than zero.");
      return;
    }

    setAddingPoints(true);
    try {
      await updateDoc(doc(db, "users", user.id), { points: increment(amount) });
      setUser((currentUser) => ({ ...currentUser, points: (Number(currentUser.points) || 0) + amount }));
      setPointsToAdd("");
      setShowPointsModal(false);
    } catch (error) {
      console.error("Unable to add points:", error);
      Alert.alert("Unable to add points", "Please try again.");
    } finally {
      setAddingPoints(false);
    }
  };

  if (loading) return <View style={styles.stateContainer}><ActivityIndicator size="large" color="#5F9C76" /></View>;

  if (!user) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>{loadError || "User not found."}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backButtonText}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const name = getFullName(user);

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backIconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>User information</Text>
      </View>

      <View style={[styles.content, { flexDirection: isMobile ? "column" : "row" }]}>
        <View style={[styles.userPanel, isMobile && styles.mobileUserPanel]}>
          <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{getInitials(name)}</Text></View>
          <View style={styles.pointsRow}>
            <Text style={styles.pointsValue}>{Number(user.points) || 0} pts</Text>
            <TouchableOpacity style={styles.addPointsButton} onPress={() => setShowPointsModal(true)} accessibilityLabel="Add eco points">
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userDetail}>{user.email || "No email address"}</Text>
          <Text style={styles.userDetail}>{user.cellNumber || "No phone number"}</Text>
          {user.birthDate ? <Text style={styles.userDetail}>Birth date: {user.birthDate}</Text> : null}
        </View>

        <View style={styles.postsPanel}>
          <Text style={styles.sectionTitle}>{name}{"'s reports"}</Text>
          <ScrollView contentContainerStyle={styles.postList} showsVerticalScrollIndicator={false}>
            {posts.length ? posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postCopy}>
                  <Text style={styles.postTitle} numberOfLines={1}>{post.caption || "Waste report"}</Text>
                  <Text style={styles.postLocation} numberOfLines={1}>{post.locationName || "Location not specified"}</Text>
                  <Text style={styles.postStatus}>{post.status || "pending"}</Text>
                </View>
                {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.postImage} /> : <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={25} color="#71907d" /></View>}
              </View>
            )) : <Text style={styles.emptyText}>This user has not submitted any reports.</Text>}
          </ScrollView>
        </View>
      </View>

      <Modal visible={showPointsModal} transparent animationType="fade" onRequestClose={() => setShowPointsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add eco points</Text>
            <Text style={styles.modalText}>Enter the number of points to add for {name}.</Text>
            <TextInput placeholder="Points" keyboardType="numeric" value={pointsToAdd} onChangeText={(value) => setPointsToAdd(value.replace(/[^0-9]/g, ""))} style={styles.pointsInput} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPointsModal(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, addingPoints && styles.disabledButton]} disabled={addingPoints} onPress={addPoints}><Text style={styles.confirmButtonText}>{addingPoints ? "Adding..." : "Add points"}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5", padding: 20 },
  stateContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  stateText: { color: "#5d6b61", textAlign: "center" },
  backButton: { backgroundColor: "#5F9C76", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { color: "#fff", fontWeight: "700" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  backIconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#5F9C76", alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 22, fontWeight: "700", color: "#1d2b21" },
  content: { flex: 1, gap: 20 },
  userPanel: { width: 230, backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: "center", alignSelf: "flex-start" },
  mobileUserPanel: { width: "100%" },
  profileAvatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#5F9C76", alignItems: "center", justifyContent: "center" },
  profileInitials: { color: "#fff", fontSize: 30, fontWeight: "700" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  pointsValue: { color: "#287650", fontSize: 17, fontWeight: "700" },
  addPointsButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#5F9C76", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 21, fontWeight: "700", color: "#1d2b21", marginTop: 8, textAlign: "center" },
  userDetail: { color: "#4d5d52", fontSize: 13, marginTop: 5, textAlign: "center" },
  postsPanel: { flex: 1, minHeight: 0 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1d2b21", marginBottom: 10 },
  postList: { gap: 10, paddingBottom: 20 },
  postCard: { flexDirection: "row", minHeight: 104, backgroundColor: "#fff", borderRadius: 10, padding: 10, gap: 10 },
  postCopy: { flex: 1, justifyContent: "center" },
  postTitle: { color: "#1d2b21", fontWeight: "700", fontSize: 15 },
  postLocation: { color: "#63756a", fontSize: 12, marginTop: 5 },
  postStatus: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "#e6f0e9", color: "#276344", fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  postImage: { width: 112, height: 84, borderRadius: 7, alignSelf: "center" },
  imagePlaceholder: { width: 112, height: 84, borderRadius: 7, backgroundColor: "#dfe8e2", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  emptyText: { color: "#63756a", textAlign: "center", marginTop: 30 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1d2b21" },
  modalText: { color: "#5d6b61", marginTop: 8, lineHeight: 20 },
  pointsInput: { borderWidth: 1, borderColor: "#d7dfd9", borderRadius: 8, paddingHorizontal: 12, height: 46, marginTop: 16 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 7, backgroundColor: "#edf0ee" },
  confirmButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 7, backgroundColor: "#5F9C76" },
  disabledButton: { opacity: 0.6 },
  confirmButtonText: { color: "#fff", fontWeight: "700" },
});
