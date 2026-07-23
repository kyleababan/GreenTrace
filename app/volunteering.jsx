import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, runTransaction } from "firebase/firestore";
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
} from "react-native";

import Navbar from "../components/navbar";
import { auth, db } from "../firebaseConfig";

const getMemberId = (member) =>
  typeof member === "string"
    ? member
    : member?.userId || member?.uid || member?.id || "";

const getMemberName = (member) =>
  typeof member === "string"
    ? "Volunteer"
    : [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
      "Volunteer";

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "V";

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
        setCurrentUser({
          id: signedInUser.uid,
          ...(userSnapshot.exists() ? userSnapshot.data() : {}),
        });
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

  const members = useMemo(
    () => (Array.isArray(activity?.volunteers) ? activity.volunteers : []),
    [activity?.volunteers],
  );
  const isJoined = members.some(
    (member) => getMemberId(member) === currentUser?.id,
  );
  const maxVolunteers = Number(activity?.maxVolunteers) || 0;
  const joinedCount = Number.isFinite(Number(activity?.joinedCount))
    ? Number(activity.joinedCount)
    : members.length;
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
        if (!snapshot.exists())
          throw new Error("This activity no longer exists.");

        const data = snapshot.data();
        const currentMembers = Array.isArray(data.volunteers)
          ? data.volunteers
          : [];
        const alreadyJoined = currentMembers.some(
          (member) => getMemberId(member) === currentUser.id,
        );
        let updatedMembers;

        if (alreadyJoined) {
          updatedMembers = currentMembers.filter(
            (member) => getMemberId(member) !== currentUser.id,
          );
        } else {
          if (data.status !== "open")
            throw new Error("This activity is closed.");
          if (data.isLocked === true)
            throw new Error("This activity is locked.");

          const capacity = Number(data.maxVolunteers) || 0;
          if (currentMembers.length >= capacity)
            throw new Error("This activity is already full.");

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

        transaction.update(activityRef, {
          volunteers: updatedMembers,
          joinedCount: updatedMembers.length,
        });
      });

      setActivity((currentActivity) => {
        const currentMembers = Array.isArray(currentActivity.volunteers)
          ? currentActivity.volunteers
          : [];
        const alreadyJoined = currentMembers.some(
          (member) => getMemberId(member) === currentUser.id,
        );
        const updatedMembers = alreadyJoined
          ? currentMembers.filter(
              (member) => getMemberId(member) !== currentUser.id,
            )
          : [
              ...currentMembers,
              {
                userId: currentUser.id,
                firstName: currentUser.firstName || "",
                lastName: currentUser.lastName || "",
                email: currentUser.email || "",
              },
            ];

        return {
          ...currentActivity,
          volunteers: updatedMembers,
          joinedCount: updatedMembers.length,
        };
      });
    } catch (error) {
      console.error("Unable to update volunteer status:", error);
      if (error.message === "This activity is locked.") {
        setActivity((currentActivity) => ({
          ...currentActivity,
          isLocked: true,
        }));
        setShowLockedModal(true);
      } else {
        Alert.alert("Unable to update", error.message || "Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading)
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color="#5F9C76" />
      </View>
    );

  if (!activity)
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>
          {loadError || "Volunteer activity not found."}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* HEADER SECTION */}
        <View style={styles.topSection}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            activeOpacity={0.8}
          >
            <Image source={require("../assets/images/back.png")} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TITLE & DESCRIPTION */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {activity.title || "Volunteer Activity"}
            </Text>
            <Text style={styles.description}>
              {activity.description || "No description provided."}
            </Text>
          </View>

          {/* MAIN IMAGE */}
          {activity.imageUrl ? (
            <Image
              source={{ uri: activity.imageUrl }}
              style={[
                styles.mainImage,
                imageAspectRatio && { aspectRatio: imageAspectRatio },
              ]}
              resizeMode="cover"
              onLoad={({ nativeEvent }) => {
                const { width, height } = nativeEvent?.source || {};
                if (width && height) setImageAspectRatio(width / height);
              }}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#CBD5E1" />
              <Text style={styles.placeholderText}>No image provided</Text>
            </View>
          )}

          {/* LOCATION */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#5F9C76" />
            <Text style={styles.locationText}>
              {activity.locationName || "Location not specified"}
            </Text>
          </View>

          {/* VOLUNTEERS CARD */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Volunteers Joined</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {joinedCount} / {maxVolunteers}
                </Text>
              </View>
            </View>

            <View style={styles.avatarRow}>
              {members.length ? (
                members.slice(0, 8).map((member, index) => {
                  const name = getMemberName(member);
                  return (
                    <View
                      key={`${getMemberId(member)}-${index}`}
                      style={[
                        styles.avatarCircle,
                        index !== 0 && { marginLeft: -8 },
                      ]}
                    >
                      <Text style={styles.avatarText}>{getInitials(name)}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>
                  No volunteers have joined yet.
                </Text>
              )}
            </View>
          </View>

          {/* REQUIREMENTS CARD */}
          <View style={styles.infoCard}>
            <Text style={styles.cardLabel}>Requirements</Text>
            <View style={styles.reqList}>
              {activity.requirements?.length ? (
                activity.requirements.map((requirement, index) => (
                  <View
                    key={`${requirement}-${index}`}
                    style={styles.reqItemRow}
                  >
                    <View style={styles.bulletPoint} />
                    <Text style={styles.reqText}>{requirement}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No requirements listed.</Text>
              )}
            </View>
          </View>

          {/* JOIN / LEAVE BUTTON */}
          <TouchableOpacity
            disabled={joining || (isFull && !isLocked)}
            style={[
              styles.mainButton,
              isJoined && styles.joinedButton,
              isFull && styles.disabledButton,
              isLocked && !isJoined && styles.lockedButton,
            ]}
            onPress={toggleVolunteer}
            activeOpacity={0.8}
          >
            {isLocked && !isJoined ? (
              <Ionicons name="lock-closed-outline" size={18} color="#EF4444" />
            ) : null}
            <Text
              style={[
                styles.buttonText,
                isJoined && styles.joinedButtonText,
                isLocked && !isJoined && styles.lockedButtonText,
              ]}
            >
              {joining
                ? "Updating..."
                : isJoined
                  ? "Leave activity"
                  : isLocked
                    ? "Activity locked"
                    : isFull
                      ? "Activity full"
                      : "Volunteer Now"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>

      {/* LOCKED MODAL */}
      <Modal
        visible={showLockedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLockedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.lockedModal} accessibilityRole="alert">
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed" size={26} color="#EF4444" />
            </View>
            <Text style={styles.lockedTitle}>Activity Locked</Text>
            <Text style={styles.lockedMessage}>
              This volunteer activity is currently not accepting new
              participants.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowLockedModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f6f6f6",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#f6f6f6",
  },

  /* HEADER STYLES */
  topSection: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    backgroundColor: "#5F9C76",
  },
  backIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* STATE STYLES */
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  stateText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#5F9C76",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },

  /* MAIN FEED */
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    gap: 16,
  },
  titleSection: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },

  /* MEDIA & LOCATION */
  mainImage: {
    width: "100%",
    minHeight: 180,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
  },
  imagePlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  placeholderText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#0F172A",
  },

  /* CARDS */
  infoCard: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 14,
  },
  badge: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5F9C76",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#5F9C76",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 11,
  },
  reqList: {
    gap: 8,
  },
  reqItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulletPoint: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#5F9C76",
  },
  reqText: {
    fontSize: 13,
    color: "#475569",
    flex: 1,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 13,
  },

  /* ACTION BUTTON */
  mainButton: {
    backgroundColor: "#5F9C76",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  joinedButton: {
    backgroundColor: "#FEF9C3",
    borderWidth: 1,
    borderColor: "#FEF08A",
  },
  disabledButton: {
    backgroundColor: "#E2E8F0",
  },
  lockedButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  joinedButtonText: {
    color: "#854D0E",
  },
  lockedButtonText: {
    color: "#EF4444",
  },

  /* NAVBAR & MODAL */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  lockedModal: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 20,
    alignItems: "center",
  },
  lockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  lockedMessage: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    textAlign: "center",
  },
  modalButton: {
    width: "100%",
    marginTop: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#5F9C76",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
