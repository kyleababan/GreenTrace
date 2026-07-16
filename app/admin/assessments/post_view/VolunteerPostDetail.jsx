import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { doc, getDoc, runTransaction } from "firebase/firestore";

import { db } from "../../../../firebaseConfig";

const getMemberId = (member) =>
  typeof member === "string"
    ? member
    : member?.userId || member?.uid || member?.id || "";

const getMemberName = (member) => {
  if (typeof member === "string") return "Volunteer";

  return (
    [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
    member?.name ||
    "Volunteer"
  );
};

const initialsFor = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "V";

export default function VolunteerPostDetail({
  setSelectedVolunteerPost,
  post: suppliedPost,
  setSelectedPost,
}) {
  const { volunteerId } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [post, setPost] = useState(suppliedPost || null);
  const [loading, setLoading] = useState(!suppliedPost);
  const [loadError, setLoadError] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [profileMember, setProfileMember] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [memberProfiles, setMemberProfiles] = useState({});

  useEffect(() => {
    if (suppliedPost || !volunteerId) return;

    const loadVolunteerPost = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const snapshot = await getDoc(doc(db, "volunteer_posts", volunteerId));

        if (!snapshot.exists()) {
          setLoadError("This volunteer activity is no longer available.");
          return;
        }

        setPost({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        console.error("Unable to load volunteer post:", error);
        setLoadError("Unable to load this volunteer activity.");
      } finally {
        setLoading(false);
      }
    };

    loadVolunteerPost();
  }, [suppliedPost, volunteerId]);

  const members = useMemo(
    () => (Array.isArray(post?.volunteers) ? post.volunteers : []),
    [post?.volunteers]
  );
  const joinedCount = Number.isFinite(Number(post?.joinedCount))
    ? Number(post.joinedCount)
    : members.length;
  const maxVolunteers = post?.maxVolunteers ?? post?.maxParticipants ?? 0;

  useEffect(() => {
    const memberIds = members.map(getMemberId).filter(Boolean);
    if (!memberIds.length) {
      setMemberProfiles({});
      return undefined;
    }

    let isCurrent = true;

    Promise.all(
      memberIds.map(async (memberId) => {
        const snapshot = await getDoc(doc(db, "users", memberId));
        return [memberId, snapshot.exists() ? snapshot.data() : null];
      })
    )
      .then((profiles) => {
        if (!isCurrent) return;
        setMemberProfiles(
          Object.fromEntries(profiles.filter(([, profile]) => profile))
        );
      })
      .catch((error) => console.error("Unable to load volunteer profiles:", error));

    return () => {
      isCurrent = false;
    };
  }, [members]);

  const goBack = () => {
    if (setSelectedVolunteerPost) {
      setSelectedVolunteerPost(null);
      if (setSelectedPost && post?.postId) setSelectedPost({ id: post.postId });
      return;
    }

    router.back();
  };

  const editVolunteerActivity = () => {
    router.push({
      pathname: "/admin/assessments/post_view/VolunteerPostCreate",
      params: { volunteerId: post.id },
    });
  };

  const confirmKick = (member) => {
    const memberId = getMemberId(member);
    const memberName = getMemberName(member);

    if (!memberId) {
      Alert.alert("Unable to remove", "This volunteer does not have a user ID.");
      return;
    }

    Alert.alert("Kick volunteer?", `Remove ${memberName} from this activity?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Kick",
        style: "destructive",
        onPress: () => kickMember(memberId),
      },
    ]);
  };

  const kickMember = async (memberId) => {
    if (!post?.id || removingMemberId) return;

    setRemovingMemberId(memberId);
    try {
      await runTransaction(db, async (transaction) => {
        const postRef = doc(db, "volunteer_posts", post.id);
        const snapshot = await transaction.get(postRef);

        if (!snapshot.exists()) throw new Error("Volunteer post no longer exists.");

        const data = snapshot.data();
        const currentMembers = Array.isArray(data.volunteers) ? data.volunteers : [];
        const updatedMembers = currentMembers.filter(
          (member) => getMemberId(member) !== memberId
        );

        if (updatedMembers.length === currentMembers.length) return;

        transaction.update(postRef, {
          volunteers: updatedMembers,
          joinedCount: updatedMembers.length,
        });
      });

      setPost((currentPost) => {
        const updatedMembers = (currentPost?.volunteers || []).filter(
          (member) => getMemberId(member) !== memberId
        );

        return {
          ...currentPost,
          volunteers: updatedMembers,
          joinedCount: updatedMembers.length,
        };
      });
      setSelectedMember(null);
    } catch (error) {
      console.error("Unable to kick volunteer:", error);
      Alert.alert("Unable to remove", "Please try again.");
    } finally {
      setRemovingMemberId("");
    }
  };

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color="#5F9C76" size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>{loadError || "Volunteer activity not found."}</Text>
        <TouchableOpacity style={styles.backToListButton} onPress={goBack}>
          <Text style={styles.backToListText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityLabel="Go back">
            <Image source={require("../../../../assets/images/backG.png")} style={styles.backIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.editButton} onPress={editVolunteerActivity}>
            <Ionicons name="create-outline" size={19} color="#fff" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.row, { flexDirection: isMobile ? "column" : "row" }]}>
          <View style={[styles.leftColumn, { flex: isMobile ? 0 : 1 }]}>
            {post.imageUrl ? (
              <Image
                source={{ uri: post.imageUrl }}
                style={[styles.cardImage, { height: isMobile ? 200 : 300 }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imagePlaceholder, { height: isMobile ? 200 : 300 }]}>
                <Ionicons name="image-outline" size={42} color="#71907d" />
                <Text style={styles.placeholderText}>No image available</Text>
              </View>
            )}

            <Text style={styles.titleText}>{post.title || "Volunteer activity"}</Text>
            <Text style={styles.descriptionText}>{post.description || "No description provided."}</Text>
          </View>

          <View style={[styles.detailsColumn, { flex: isMobile ? 0 : 1 }]}>
            <TouchableOpacity
              style={styles.membersSummary}
              onPress={() => setShowMembers(true)}
              accessibilityRole="button"
              accessibilityLabel="View joined volunteers"
            >
              <View>
                <Text style={styles.sectionLabel}>Members</Text>
                <Text style={styles.membersHint}>Tap to view joined volunteers</Text>
              </View>
              <View style={styles.countBadge}>
                <Ionicons name="people-outline" size={20} color="#276344" />
                <Text style={styles.countText}>{joinedCount} / {maxVolunteers}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.requirementBox}>
              <Text style={styles.sectionLabel}>Requirements</Text>
              {post.requirements?.length ? (
                post.requirements.map((item, index) => (
                  <Text key={`${item}-${index}`} style={styles.requirementText}>• {item}</Text>
                ))
              ) : (
                <Text style={styles.mutedText}>No requirements listed.</Text>
              )}
            </View>

            <View style={styles.locationBox}>
              <Ionicons name="location" size={20} color="#276344" />
              <Text style={styles.locationText}>{post.locationName || "Location not specified"}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showMembers} transparent animationType="fade" onRequestClose={() => setShowMembers(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.membersModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Joined volunteers</Text>
                <Text style={styles.modalSubtitle}>{joinedCount} of {maxVolunteers} participants</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMembers(false)} accessibilityLabel="Close members">
                <Ionicons name="close" size={26} color="#222" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.membersList}>
              {members.length ? members.map((member, index) => {
                const memberId = getMemberId(member) || `member-${index}`;
                const displayMember = {
                  ...(memberProfiles[getMemberId(member)] || {}),
                  ...(typeof member === "object" ? member : { userId: member }),
                };
                const name = getMemberName(displayMember);
                const isSelected = selectedMember === memberId;
                const avatarUrl = displayMember.imageUrl || displayMember.photoURL || displayMember.profileImage;

                return (
                  <View key={memberId} style={styles.memberCard}>
                    <TouchableOpacity
                      style={styles.memberRow}
                      onPress={() => setSelectedMember(isSelected ? null : memberId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show actions for ${name}`}
                    >
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarInitials}>{initialsFor(name)}</Text>
                        </View>
                      )}
                      <Text style={styles.memberName}>{name}</Text>
                      <Ionicons name={isSelected ? "chevron-up" : "chevron-down"} size={20} color="#5f6f65" />
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={styles.memberActions}>
                        <TouchableOpacity style={styles.viewProfileButton} onPress={() => setProfileMember(displayMember)}>
                          <Ionicons name="person-outline" size={18} color="#276344" />
                          <Text style={styles.viewProfileText}>View profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.kickButton}
                          disabled={removingMemberId === getMemberId(member)}
                          onPress={() => confirmKick(displayMember)}
                        >
                          <Ionicons name="person-remove-outline" size={18} color="#bf3030" />
                          <Text style={styles.kickText}>{removingMemberId === getMemberId(member) ? "Removing..." : "Kick"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }) : (
                <Text style={styles.emptyText}>No volunteers have joined yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(profileMember)} transparent animationType="fade" onRequestClose={() => setProfileMember(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.profileModal}>
            <TouchableOpacity style={styles.closeProfile} onPress={() => setProfileMember(null)} accessibilityLabel="Close profile">
              <Ionicons name="close" size={24} color="#222" />
            </TouchableOpacity>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>{initialsFor(getMemberName(profileMember))}</Text>
            </View>
            <Text style={styles.profileName}>{getMemberName(profileMember)}</Text>
            <Text style={styles.profileDetail}>{profileMember?.email || "Volunteer"}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5" },
  content: { padding: 20, gap: 20 },
  stateContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  stateText: { fontSize: 16, textAlign: "center", color: "#4d5e53" },
  backToListButton: { backgroundColor: "#5F9C76", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  backToListText: { color: "#fff", fontWeight: "700" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { alignSelf: "flex-start" },
  backIcon: { width: 45, height: 45 },
  editButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#5F9C76", paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8 },
  editButtonText: { color: "#fff", fontWeight: "700" },
  row: { gap: 24 },
  leftColumn: { gap: 10 },
  detailsColumn: { gap: 14 },
  cardImage: { width: "100%", borderRadius: 10, backgroundColor: "#dfe8e2" },
  imagePlaceholder: { width: "100%", borderRadius: 10, backgroundColor: "#dfe8e2", alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderText: { color: "#577061" },
  titleText: { fontSize: 22, fontWeight: "700", color: "#172119" },
  descriptionText: { color: "#3f4c43", lineHeight: 20 },
  membersSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#e5ece7", padding: 14, borderRadius: 10, gap: 12 },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: "#1d2b21" },
  membersHint: { marginTop: 3, color: "#63756a", fontSize: 12 },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18 },
  countText: { fontWeight: "700", color: "#276344" },
  requirementBox: { backgroundColor: "#fff", borderRadius: 10, padding: 14, gap: 5 },
  requirementText: { color: "#304036" },
  mutedText: { color: "#728078" },
  locationBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#e0e3e1", padding: 13, borderRadius: 8 },
  locationText: { color: "#243129", flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  membersModal: { width: "100%", maxWidth: 520, maxHeight: "80%", backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalTitle: { fontSize: 21, fontWeight: "700", color: "#172119" },
  modalSubtitle: { marginTop: 3, color: "#63756a" },
  membersList: { gap: 10 },
  memberCard: { borderWidth: 1, borderColor: "#e2e8e3", borderRadius: 10, overflow: "hidden" },
  memberRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#5F9C76", alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontWeight: "700" },
  memberName: { flex: 1, fontWeight: "600", color: "#1d2b21" },
  memberActions: { flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: "#e2e8e3", padding: 10, backgroundColor: "#f8faf8" },
  viewProfileButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, padding: 10, borderRadius: 7, backgroundColor: "#e6f0e9" },
  viewProfileText: { color: "#276344", fontWeight: "600" },
  kickButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, padding: 10, borderRadius: 7, backgroundColor: "#fff0f0" },
  kickText: { color: "#bf3030", fontWeight: "600" },
  emptyText: { color: "#728078", textAlign: "center", paddingVertical: 24 },
  profileModal: { width: "100%", maxWidth: 330, backgroundColor: "#fff", borderRadius: 14, padding: 24, alignItems: "center" },
  closeProfile: { alignSelf: "flex-end" },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#5F9C76", alignItems: "center", justifyContent: "center", marginTop: -10 },
  profileInitials: { color: "#fff", fontSize: 24, fontWeight: "700" },
  profileName: { marginTop: 12, fontSize: 20, fontWeight: "700", color: "#172119" },
  profileDetail: { marginTop: 4, color: "#63756a" },
});
