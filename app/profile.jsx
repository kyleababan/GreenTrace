import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BadgeWithDetails from "../components/BadgeWithDetails";
import Navbar from "../components/navbar";
import {
  BADGES,
  getUserContributionStats,
  isBadgeEarned,
} from "../constants/badges";
import { auth, db } from "../firebaseConfig";
import { getNameInitials } from "../utils/getNameInitials";

export default function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEcoLabel, setShowEcoLabel] = useState(false);
  const [badgeStats, setBadgeStats] = useState(null);
  const [ecoLabelAnimation] = useState(() => new Animated.Value(0));

  const router = useRouter();

  const toggleEcoLabel = () => {
    Animated.timing(ecoLabelAnimation, {
      toValue: showEcoLabel ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();

    setShowEcoLabel((isVisible) => !isVisible);
  };

  const loadUser = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const [snapshot, postsSnapshot, volunteerPostsSnapshot] =
        await Promise.all([
          getDoc(doc(db, "users", currentUser.uid)),
          getDocs(collection(db, "posts")),
          getDocs(collection(db, "volunteer_posts")),
        ]);
      if (snapshot.exists()) {
        setUserData(snapshot.data());
        setBadgeStats(
          getUserContributionStats(
            currentUser.uid,
            postsSnapshot.docs.map((post) => post.data()),
            volunteerPostsSnapshot.docs.map((post) => post.data()),
          ),
        );
      }
    } catch (error) {
      console.log("Error loading user:", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      router.replace("/signin");
    } catch (error) {
      console.log("Logout error:", error);
      setShowLogoutModal(false);
    }
  };

  if (!userData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wrapper}>
          <View style={styles.container}>
            <View style={styles.topSection}>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>
                Manage your GreenTrace account
              </Text>
            </View>
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#5F9C76" />
            </View>
            <View style={styles.navbarContainer}>
              <Navbar />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const earnedBadges = badgeStats
    ? BADGES.filter((badge) => isBadgeEarned(badge, badgeStats))
    : [];
  const contributorBadges = Array.isArray(userData.contributorBadges)
    ? userData.contributorBadges
    : [];
  const displayedBadges = [...contributorBadges, ...earnedBadges];
  const visibleBadges = displayedBadges.slice(0, 3);
  const remainingBadgeCount = Math.max(0, displayedBadges.length - 3);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* HEADER SECTION */}
          <View style={styles.topSection}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>
              Manage your GreenTrace account
            </Text>
          </View>

          {/* MAIN SCROLLABLE CONTENT */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* USER INFO CARD */}
            <View style={styles.profileCard}>
              <View style={styles.userInfoRow}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {getNameInitials(
                      `${userData.firstName || ""} ${userData.lastName || ""}`,
                    )}
                  </Text>
                </View>
                <View style={styles.userTextDetails}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {userData.firstName} {userData.lastName}
                  </Text>

                  {userData.cellNumber ? (
                    <Text style={styles.phoneText}>#{userData.cellNumber}</Text>
                  ) : null}

                  <View style={styles.pointsRow}>
                    <TouchableOpacity
                      onPress={toggleEcoLabel}
                      activeOpacity={0.7}
                      hitSlop={8}
                      style={styles.pointsPill}
                    >
                      <Image
                        source={require("../assets/images/ecopts.png")}
                        style={styles.ecoIcon}
                      />
                      <Animated.View
                        style={[
                          styles.ecoLabelContainer,
                          {
                            width: ecoLabelAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 72],
                            }),
                            opacity: ecoLabelAnimation,
                          },
                        ]}
                      >
                        <Text style={styles.ecoPointsLabel} numberOfLines={1}>
                          Eco Points
                        </Text>
                      </Animated.View>
                      <Text style={styles.pointsValue}>
                        {userData.points ?? 0} pts
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {displayedBadges.length > 0 && (
                <View style={styles.badgeShowcase}>
                  <Text style={styles.badgeShowcaseLabel}>Earned Badges</Text>
                  <View style={styles.badgeSlots}>
                    {visibleBadges.map((badge) => (
                      <BadgeWithDetails
                        key={badge.id}
                        badge={badge}
                        size={26}
                        tooltipPlacement="below"
                      />
                    ))}
                    {remainingBadgeCount > 0 && (
                      <View style={styles.badgeSlot}>
                        <Text style={styles.badgeOverflowText}>
                          +{remainingBadgeCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* SECTION LABEL */}
            <Text style={styles.sectionLabel}>Account Settings</Text>

            {/* MENU LIST CARD */}
            <View style={styles.menuList}>
              {/* Edit Profile */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push("/edit_profile")}
              >
                <View style={styles.menuRowLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="person-outline" size={18} color="#397A51" />
                  </View>
                  <Text style={styles.menuText}>Edit Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Report Posts */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push("/report_post")}
              >
                <View style={styles.menuRowLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#397A51"
                    />
                  </View>
                  <Text style={styles.menuText}>My Reports</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Badges */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push("/badges")}
              >
                <View style={styles.menuRowLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="ribbon-outline" size={18} color="#397A51" />
                  </View>
                  <Text style={styles.menuText}>Badge List</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Security */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => router.push("/security")}
              >
                <View style={styles.menuRowLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color="#397A51"
                    />
                  </View>
                  <Text style={styles.menuText}>Security</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* FAQ */}
              <TouchableOpacity
                style={[styles.menuRow, styles.lastMenuRow]}
                activeOpacity={0.7}
                onPress={() => router.push("/faq")}
              >
                <View style={styles.menuRowLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name="help-circle-outline"
                      size={18}
                      color="#397A51"
                    />
                  </View>
                  <Text style={styles.menuText}>FAQ</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* LOGOUT BUTTON */}
            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.8}
              onPress={() => setShowLogoutModal(true)}
            >
              <View style={styles.logoutIconCircle}>
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              </View>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* BOTTOM NAVBAR & MODAL */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>

          <Modal visible={showLogoutModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.logoutModal}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="log-out-outline" size={28} color="#EF4444" />
                </View>
                <Text style={styles.logoutTitle}>Log Out</Text>
                <Text style={styles.logoutMessage}>
                  Are you sure you want to log out of your account?
                </Text>

                <TouchableOpacity
                  style={styles.confirmLogoutButton}
                  activeOpacity={0.8}
                  onPress={handleLogout}
                >
                  <Text style={styles.confirmLogoutText}>Log Out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.cancelLogoutText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#5F9C76",
  },
  wrapper: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 500,
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  topSection: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    color: "#E8F3EC",
    fontSize: 12,
    marginTop: 2,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  /* PROFILE CARD */
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  userTextDetails: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F3326",
    letterSpacing: -0.2,
  },
  phoneText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  ecoIcon: {
    width: 14,
    height: 14,
    tintColor: "#397A51",
    marginRight: 4,
  },
  ecoLabelContainer: {
    overflow: "hidden",
  },
  ecoPointsLabel: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  pointsValue: {
    color: "#2E7D32",
    fontWeight: "700",
    fontSize: 12,
  },
  badgeShowcase: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeShowcaseLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  badgeSlots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeSlot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  badgeOverflowText: {
    fontSize: 10,
    color: "#397A51",
    fontWeight: "800",
  },

  /* SECTION LABEL */
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* MENU LIST */
  menuList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  lastMenuRow: {
    borderBottomWidth: 0,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E4F1E8",
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#234B33",
  },

  /* LOGOUT BUTTON */
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 16,
    gap: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 14,
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoutModal: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoutTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  logoutMessage: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmLogoutButton: {
    width: "100%",
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmLogoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelLogoutText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },

  /* NAVBAR CONTAINER */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
