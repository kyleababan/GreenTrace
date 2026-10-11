import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Navbar from "../components/navbar";
import PostLocationModal from "../components/PostLocationModal";
import { formatLocationWithPurok } from "../constants/locationFormat";
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

const formatMeetingDate = (value) => {
  if (!value) return "Date not specified";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function Volunteering() {
  const { volunteerId } = useLocalSearchParams();
  const activityId = Array.isArray(volunteerId) ? volunteerId[0] : volunteerId;
  const router = useRouter();

  const [activity, setActivity] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(activityId));
  const [joining, setJoining] = useState(false);
  const [loadError, setLoadError] = useState(
    activityId ? "" : "Volunteer activity not found.",
  );
  const [imageAspectRatio, setImageAspectRatio] = useState(null);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [showLateJoinModal, setShowLateJoinModal] = useState(false);
  const [showEmergencyLeaveModal, setShowEmergencyLeaveModal] = useState(false);

  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!activityId) return;

    queueMicrotask(() => {
      setLoading(true);
      setImageAspectRatio(null);
    });

    const unsubscribe = onSnapshot(
      doc(db, "volunteer_posts", activityId),
      async (activitySnapshot) => {
        if (!activitySnapshot.exists()) {
          setLoadError("This volunteer activity is no longer available.");
          setLoading(false);
          return;
        }

        const activityData = {
          id: activitySnapshot.id,
          ...activitySnapshot.data(),
        };

        if (activityData.postId) {
          try {
            const postSnapshot = await getDoc(
              doc(db, "posts", activityData.postId),
            );
            if (postSnapshot.exists()) {
              const postData = postSnapshot.data();
              if (!activityData.coordinates && postData.coordinates) {
                activityData.coordinates = postData.coordinates;
              }
              if (
                !activityData.coordinates &&
                postData.latitude &&
                postData.longitude
              ) {
                activityData.coordinates = {
                  latitude: postData.latitude,
                  longitude: postData.longitude,
                };
              }
              if (!activityData.purok && postData.purok) {
                activityData.purok = postData.purok;
              }
              if (
                !activityData.wasteClassification &&
                postData.wasteClassification
              ) {
                activityData.wasteClassification = postData.wasteClassification;
              }
              if (
                !activityData.afterImageUrl &&
                postData.afterImageUrl
              ) {
                activityData.afterImageUrl = postData.afterImageUrl;
              }
            }
          } catch (postErr) {
            console.error("Unable to load linked post coordinates:", postErr);
          }
        }

        setActivity(activityData);
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load volunteer activity:", error);
        setLoadError("Unable to load this volunteer activity.");
        setLoading(false);
      },
    );

    const signedInUser = auth.currentUser;
    if (signedInUser) {
      getDoc(doc(db, "users", signedInUser.uid))
        .then((userSnapshot) => {
          setCurrentUser({
            id: signedInUser.uid,
            ...(userSnapshot.exists() ? userSnapshot.data() : {}),
          });
        })
        .catch(() => setCurrentUser(null));
    } else {
      queueMicrotask(() => setCurrentUser(null));
    }

    return () => unsubscribe();
  }, [activityId]);

  const members = Array.isArray(activity?.volunteers)
    ? activity.volunteers
    : [];
  const isJoined = members.some(
    (member) => getMemberId(member) === currentUser?.id,
  );
  const maxVolunteers =
    Number(activity?.maxVolunteers ?? activity?.maxParticipants) || 0;
  const joinedCount = Number.isFinite(Number(activity?.joinedCount))
    ? Number(activity.joinedCount)
    : members.length;
  const isFull = !isJoined && maxVolunteers > 0 && joinedCount >= maxVolunteers;
  const isLocked = activity?.isLocked === true;

  const statusNormalized = String(activity?.status || "open").toLowerCase().trim();
  const isOngoing = ["ongoing", "on-going"].includes(statusNormalized);
  const isCompleted = ["completed", "cleaned"].includes(statusNormalized);
  const isCancelled = statusNormalized === "cancelled";
  const hasEarnedEcoPoints = Boolean(
    isCompleted &&
      currentUser?.id &&
      (Array.isArray(activity?.rewardedVolunteerIds)
        ? activity.rewardedVolunteerIds.includes(currentUser.id)
        : isJoined),
  );

  const handleVolunteerAction = () => {
    if (joining || !activity || !currentUser) return;
    if (isCompleted || isCancelled) return;

    if (isJoined) {
      if (isOngoing) {
        setShowEmergencyLeaveModal(true);
      } else {
        executeVolunteerToggle(false);
      }
      return;
    }

    if (isLocked && !isOngoing) {
      setShowLockedModal(true);
      return;
    }

    if (isFull) {
      Alert.alert("Activity Full", "All volunteer spots have been filled.");
      return;
    }

    if (isOngoing) {
      setShowLateJoinModal(true);
      return;
    }

    executeVolunteerToggle(false);
  };

  const executeVolunteerToggle = async (isLateArrival = false) => {
    if (joining || !activity || !currentUser) return;
    setShowLateJoinModal(false);
    setShowEmergencyLeaveModal(false);

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
          const ongoingCheck = ["ongoing", "on-going"].includes(
            String(data.status || "").toLowerCase(),
          );
          if (data.status !== "open" && !ongoingCheck)
            throw new Error("This activity is closed.");
          if (data.isLocked === true && !ongoingCheck)
            throw new Error("This activity is locked.");

          const capacity =
            Number(data.maxVolunteers ?? data.maxParticipants) || 0;
          if (capacity > 0 && currentMembers.length >= capacity)
            throw new Error("This activity is already full.");

          updatedMembers = [
            ...currentMembers,
            {
              userId: currentUser.id,
              firstName: currentUser.firstName || "",
              lastName: currentUser.lastName || "",
              email: currentUser.email || "",
              joinedLate: isLateArrival || ongoingCheck,
              joinedAt: new Date().toISOString(),
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
                joinedLate: isLateArrival || isOngoing,
                joinedAt: new Date().toISOString(),
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
          {/* STATUS PILL HEADER (LIVE / COMPLETED / CANCELLED) */}
          {isOngoing ? (
            <View style={styles.liveBadgeRow}>
              <View style={styles.livePulseContainer}>
                <Animated.View
                  style={[
                    styles.livePulseDotRing,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={styles.livePulseDot} />
              </View>
              <Text style={styles.liveBadgeText}>LIVE CLEANUP IN PROGRESS</Text>
            </View>
          ) : isCompleted ? (
            <View style={styles.completedBadgeRow}>
              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
              <Text style={styles.completedBadgeText}>ACTIVITY COMPLETED</Text>
            </View>
          ) : isCancelled ? (
            <View style={styles.cancelledBadgeRow}>
              <Ionicons name="close-circle" size={14} color="#DC2626" />
              <Text style={styles.cancelledBadgeText}>ACTIVITY CANCELLED</Text>
            </View>
          ) : null}

          {/* TITLE & DESCRIPTION */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {activity.title || "Volunteer Activity"}
            </Text>
            <Text style={styles.description}>
              {activity.description || "No description provided."}
            </Text>
          </View>

          {/* DYNAMIC CONTEXTUAL BANNER CARDS */}
          {isOngoing ? (
            <View style={styles.liveBannerCard}>
              <View style={styles.liveBannerHeader}>
                <Ionicons name="flash" size={18} color="#D97706" />
                <Text style={styles.liveBannerTitle}>
                  Cleanup Happening Right Now!
                </Text>
              </View>
              <Text style={styles.liveBannerDesc}>
                {isJoined
                  ? "You are registered! Head to the location and check in with the LGU coordinator on-site for attendance."
                  : "This cleanup has already started. Late arrivals are welcome to join—please report to the on-site coordinator."}
              </Text>
            </View>
          ) : isCompleted ? (
            <View style={styles.completedBannerCard}>
              <View style={styles.completedBannerHeader}>
                <Ionicons name="trophy" size={20} color="#15803D" />
                <Text style={styles.completedBannerTitle}>
                  Cleanup Successfully Completed!
                </Text>
              </View>
              <Text style={styles.completedBannerDesc}>
                {activity.completionSummary ||
                  "Thank you to all volunteers who participated in keeping our municipality clean and green!"}
              </Text>
              {hasEarnedEcoPoints && (
                <View style={styles.rewardPill}>
                  <Ionicons name="gift" size={15} color="#15803D" />
                  <Text style={styles.rewardPillText}>
                    +{activity.eventRewardPoints || 8} EcoPoints Credited
                  </Text>
                </View>
              )}
            </View>
          ) : isCancelled ? (
            <View style={styles.cancelledBannerCard}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelledBannerTitle}>
                  Activity Cancelled / Postponed
                </Text>
                <Text style={styles.cancelledBannerDesc}>
                  {activity.cancellationReason ||
                    "This volunteer activity was postponed or cancelled by the municipal administrator."}
                </Text>
              </View>
            </View>
          ) : null}

          {/* MAIN IMAGE */}
          {activity.imageUrl ? (
            <Image
              source={{ uri: activity.imageUrl }}
              style={[
                styles.mainImage,
                { aspectRatio: imageAspectRatio || 16 / 9 },
              ]}
              resizeMode="contain"
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

          {/* BEFORE & AFTER PHOTO GALLERY (IF COMPLETED) */}
          {isCompleted && Boolean(activity.afterImageUrl) && (
            <View style={styles.infoCard}>
              <Text style={styles.cardLabel}>Cleanup Results</Text>
              <View style={styles.beforeAfterRow}>
                <View style={styles.beforeAfterCol}>
                  <Text style={styles.beforeAfterLabel}>Before</Text>
                  {activity.imageUrl ? (
                    <Image
                      source={{ uri: activity.imageUrl }}
                      style={styles.beforeAfterImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.beforeAfterImg, styles.beforeAfterPlaceholder]}>
                      <Text style={styles.placeholderText}>No photo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.beforeAfterCol}>
                  <Text style={styles.beforeAfterLabel}>After Cleanup</Text>
                  <Image
                    source={{ uri: activity.afterImageUrl }}
                    style={styles.beforeAfterImg}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
          )}

          {/* LOCATION */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => setLocationModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View style={styles.locationLeft}>
              <View style={styles.locationIconWrap}>
                <Ionicons name="location-outline" size={18} color="#2E7D32" />
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationLabel}>LOCATION</Text>
                <Text style={styles.locationText} numberOfLines={2}>
                  {formatLocationWithPurok(
                    activity.meetingLocation || activity
                  ) || "Location not specified"}
                </Text>
              </View>
            </View>
            <View style={styles.viewMapBadge}>
              <Ionicons name="map-outline" size={13} color="#2E7D32" />
              <Text style={styles.viewMapBadgeText}>View Map</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.meetingRow}>
            <View style={styles.meetingItem}>
              <View style={styles.meetingIcon}>
                <Ionicons name="calendar-outline" size={18} color="#397A51" />
              </View>
              <View style={styles.meetingCopy}>
                <Text style={styles.meetingLabel}>DATE</Text>
                <Text style={styles.meetingText} numberOfLines={2}>
                  {formatMeetingDate(activity.meetingDate)}
                </Text>
              </View>
            </View>
            <View style={styles.meetingItem}>
              <View style={styles.meetingIcon}>
                <Ionicons name="time-outline" size={18} color="#397A51" />
              </View>
              <View style={styles.meetingCopy}>
                <Text style={styles.meetingLabel}>TIME</Text>
                <Text style={styles.meetingText} numberOfLines={2}>
                  {activity.meetingTime || "Time not specified"}
                </Text>
              </View>
            </View>
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
            <ScrollView
              style={styles.reqScroll}
              contentContainerStyle={styles.reqList}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
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
            </ScrollView>
          </View>

          {/* SAFETY & GEAR CHECKLIST CARD */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Safety & What to Bring</Text>
              <View style={styles.gearBadge}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={12}
                  color="#166534"
                />
                <Text style={styles.gearBadgeText}>Safety First</Text>
              </View>
            </View>
            <View style={styles.gearGrid}>
              <View style={styles.gearItem}>
                <Ionicons name="hand-left-outline" size={18} color="#276344" />
                <View style={styles.gearTextCol}>
                  <Text style={styles.gearTitle}>Heavy-Duty Gloves</Text>
                  <Text style={styles.gearDesc}>
                    Protect hands from glass & debris
                  </Text>
                </View>
              </View>
              <View style={styles.gearItem}>
                <Ionicons name="footsteps-outline" size={18} color="#276344" />
                <View style={styles.gearTextCol}>
                  <Text style={styles.gearTitle}>Closed-Toe Shoes</Text>
                  <Text style={styles.gearDesc}>
                    Wear sturdy shoes (no slippers)
                  </Text>
                </View>
              </View>
              <View style={styles.gearItem}>
                <Ionicons name="water-outline" size={18} color="#276344" />
                <View style={styles.gearTextCol}>
                  <Text style={styles.gearTitle}>Reusable Water Bottle</Text>
                  <Text style={styles.gearDesc}>
                    Stay hydrated; avoid single-use cups
                  </Text>
                </View>
              </View>
              <View style={styles.gearItem}>
                <Ionicons name="sunny-outline" size={18} color="#276344" />
                <View style={styles.gearTextCol}>
                  <Text style={styles.gearTitle}>Sun Protection</Text>
                  <Text style={styles.gearDesc}>
                    Cap, hat, or sunscreen for outdoors
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* OUTDOOR & WEATHER ADVISORY */}
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <Ionicons name="partly-sunny-outline" size={18} color="#D97706" />
              <Text style={styles.advisoryTitle}>Outdoor Clean-up Advisory</Text>
            </View>
            <Text style={styles.advisoryText}>
              Hydrate well before and during the activity. In the event of sudden severe weather or heavy rain, the LGU coordinator may adjust the rendezvous schedule.
            </Text>
          </View>

          {/* LGU / COORDINATOR HOTLINE CARD */}
          <View style={styles.coordinatorCard}>
            <View style={styles.coordinatorHeader}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#1E3A8A" />
              <Text style={styles.coordinatorTitle}>LGU Coordinator & Assistance</Text>
            </View>
            <Text style={styles.coordinatorText}>
              Need directions, arriving late, or require assistance on-site? Report to the MENRO / Barangay response desk upon arrival.
            </Text>
            <View style={styles.coordinatorHotlineRow}>
              <Ionicons name="call" size={12} color="#2563EB" />
              <Text style={styles.coordinatorHotlineText}>
                Official GreenTrace Municipal Field Desk
              </Text>
            </View>
          </View>

          {/* JOIN / LEAVE / STATUS BUTTON */}
          <TouchableOpacity
            disabled={
              joining ||
              isCompleted ||
              isCancelled ||
              (isFull && !isJoined && !isOngoing)
            }
            style={[
              styles.mainButton,
              isJoined && styles.joinedButton,
              !isJoined && isOngoing && styles.joinLateButton,
              isCompleted && styles.completedButton,
              (isCancelled || (isFull && !isJoined && !isOngoing)) &&
                styles.disabledButton,
              isLocked && !isJoined && !isOngoing && styles.lockedButton,
            ]}
            onPress={handleVolunteerAction}
            activeOpacity={0.8}
          >
            {isLocked && !isJoined && !isOngoing ? (
              <Ionicons name="lock-closed-outline" size={18} color="#EF4444" />
            ) : !isJoined && isOngoing ? (
              <Ionicons name="flash-outline" size={18} color="#FFFFFF" />
            ) : isCompleted ? (
              <Ionicons
                name="checkmark-done-circle-outline"
                size={18}
                color="#FFFFFF"
              />
            ) : null}

            <Text
              style={[
                styles.buttonText,
                isJoined && styles.joinedButtonText,
                isLocked && !isJoined && !isOngoing && styles.lockedButtonText,
              ]}
            >
              {joining
                ? "Updating..."
                : isCompleted
                  ? "Activity Completed"
                  : isCancelled
                    ? "Activity Cancelled"
                    : isJoined
                      ? isOngoing
                        ? "Leave Activity (In-Progress)"
                        : "Leave Activity"
                      : isOngoing
                        ? "Join In Progress (Late Arrival)"
                        : isLocked
                          ? "Activity Locked"
                          : isFull
                            ? "Activity Full"
                            : activity.eventType
                              ? "Join Event"
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

      {/* LATE JOIN NOTICE MODAL */}
      <Modal
        visible={showLateJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLateJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.lockedModal} accessibilityRole="alert">
            <View style={styles.lateJoinModalIcon}>
              <Ionicons name="flash" size={26} color="#D97706" />
            </View>
            <Text style={styles.lockedTitle}>Join In-Progress Cleanup?</Text>
            <Text style={styles.lockedMessage}>
              This cleanup has already started! Head directly to the location (
              {formatLocationWithPurok(
                activity?.meetingLocation || activity
              ) || "the site"}
              ) and report to the on-site LGU coordinator upon arrival so they can mark your attendance for EcoPoints.
            </Text>
            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowLateJoinModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmLateButton}
                onPress={() => executeVolunteerToggle(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>Confirm & Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EMERGENCY LEAVE MODAL */}
      <Modal
        visible={showEmergencyLeaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmergencyLeaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.lockedModal} accessibilityRole="alert">
            <View style={styles.leaveModalIcon}>
              <Ionicons name="exit-outline" size={26} color="#DC2626" />
            </View>
            <Text style={styles.lockedTitle}>Leave In-Progress Activity?</Text>
            <Text style={styles.lockedMessage}>
              This event is currently in progress. If you leave now, your volunteer slot will be released and you will not receive attendance EcoPoints.
            </Text>
            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEmergencyLeaveModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelButtonText}>Stay in Activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmLeaveButton}
                onPress={() => executeVolunteerToggle(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>Leave Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POST LOCATION MINI MAP MODAL */}
      <PostLocationModal
        post={activity}
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
      />
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
    minHeight: 220,
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
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  locationLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E1F0E5",
    alignItems: "center",
    justifyContent: "center",
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#5C7A68",
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#183B24",
    marginTop: 2,
    lineHeight: 18,
  },
  viewMapBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EAF9EE",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1E7D8",
  },
  viewMapBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  meetingRow: {
    flexDirection: "row",
    gap: 10,
  },
  meetingItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE9E0",
    backgroundColor: "#F5FAF6",
  },
  meetingIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#E1F0E5",
  },
  meetingCopy: {
    flex: 1,
    minWidth: 0,
  },
  meetingLabel: {
    color: "#7A8A80",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  meetingText: {
    color: "#234B33",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  /* ADVISORY & COORDINATOR CARDS */
  advisoryCard: {
    backgroundColor: "#FFFBEB",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 6,
  },
  advisoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  advisoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  advisoryText: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 17,
  },
  coordinatorCard: {
    backgroundColor: "#EFF6FF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 6,
  },
  coordinatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coordinatorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
  },
  coordinatorText: {
    fontSize: 12,
    color: "#1E3A8A",
    lineHeight: 17,
  },
  coordinatorHotlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  coordinatorHotlineText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563EB",
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
  reqScroll: {
    maxHeight: 250,
    flexGrow: 0,
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

  /* LIVE PULSING BADGE */
  liveBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  livePulseContainer: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  livePulseDotRing: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(217, 119, 6, 0.35)",
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D97706",
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.5,
  },

  /* STATUS BADGE ROWS */
  completedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.5,
  },
  cancelledBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.5,
  },

  /* CONTEXTUAL BANNER CARDS */
  liveBannerCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  liveBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  liveBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
  },
  liveBannerDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: "#78350F",
  },

  completedBannerCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  completedBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  completedBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },
  completedBannerDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: "#14532D",
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  rewardPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },

  cancelledBannerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cancelledBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 2,
  },
  cancelledBannerDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: "#7F1D1D",
  },

  /* BEFORE & AFTER PHOTO GALLERY */
  beforeAfterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  beforeAfterCol: {
    flex: 1,
  },
  beforeAfterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  beforeAfterImg: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  beforeAfterPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  /* SAFETY & GEAR CHECKLIST */
  gearBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gearBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
  },
  gearGrid: {
    gap: 10,
    marginTop: 4,
  },
  gearItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  gearTextCol: {
    flex: 1,
  },
  gearTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  gearDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },

  /* BUTTON VARIANTS */
  joinLateButton: {
    backgroundColor: "#D97706",
  },
  completedButton: {
    backgroundColor: "#16A34A",
    opacity: 0.9,
  },

  /* MODAL ICONS & ACTIONS */
  lateJoinModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 18,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButtonText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13,
  },
  modalConfirmLateButton: {
    flex: 1.2,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmLeaveButton: {
    flex: 1.2,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
});
