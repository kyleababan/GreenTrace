import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";
import { auth, db } from "../firebaseConfig";

export default function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEcoLabel, setShowEcoLabel] = useState(false);
  const ecoLabelAnimation = useRef(new Animated.Value(0)).current;

  const router = useRouter();

  const toggleEcoLabel = () => {
    Animated.timing(ecoLabelAnimation, {
      toValue: showEcoLabel ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();

    setShowEcoLabel((isVisible) => !isVisible);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const snapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      }
    } catch (error) {
      console.log("Error loading user:", error);
    }
  };

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
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.container}>
          <View style={styles.stateContainer}>
            <ActivityIndicator size="small" color="#5F9C76" />
          </View>
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        {/* HEADER SECTION */}

        <View style={styles.header}>
          <Text style={styles.headerText}>Profile</Text>
          <View style={styles.userInfoContainer}>
            <Image
              source={require("../assets/images/profile.png")}
              style={styles.profileAvatar}
            />
            <View style={styles.userTextDetails}>
              <Text style={styles.userName}>
                {userData.firstName} {userData.lastName}
              </Text>

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
                          outputRange: [0, 75],
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

              {userData.cellNumber && (
                <Text style={styles.phoneText}>#{userData.cellNumber}</Text>
              )}
            </View>
          </View>
        </View>

        {/* MENU LIST SECTION */}
        <View style={styles.content}>
          <View style={styles.menuList}>
            {/* Edit Profile */}
            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.6}
              onPress={() => router.push("/edit_profile")}
            >
              <View style={styles.menuRowLeft}>
                <Image
                  source={require("../assets/images/EditProfile.png")}
                  style={styles.menuIcon}
                  resizeMode="contain"
                />
                <Text style={styles.menuText}>Edit Profile</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* Report Posts */}
            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.6}
              onPress={() => router.push("/report_post")}
            >
              <View style={styles.menuRowLeft}>
                <Image
                  source={require("../assets/images/post.png")}
                  style={styles.menuIcon}
                  resizeMode="contain"
                />
                <Text style={styles.menuText}>Report Posts</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* Security */}
            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.6}
              onPress={() => router.push("/security")}
            >
              <View style={styles.menuRowLeft}>
                <Image
                  source={require("../assets/images/Securitiy.png")}
                  style={styles.menuIcon}
                  resizeMode="contain"
                />
                <Text style={styles.menuText}>Security</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* FAQ */}
            <TouchableOpacity
              style={[styles.menuRow, styles.lastMenuRow]}
              activeOpacity={0.6}
              onPress={() => router.push("/faq")}
            >
              <View style={styles.menuRowLeft}>
                <Image
                  source={require("../assets/images/faq.png")}
                  style={styles.menuIcon}
                  resizeMode="contain"
                />
                <Text style={styles.menuText}>FAQ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* LOGOUT BUTTON */}
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.7}
            onPress={() => setShowLogoutModal(true)}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM NAVBAR & MODAL */}
        <View style={styles.navbarContainer}>
          <Navbar />

          <Modal visible={showLogoutModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.logoutModal}>
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
                  activeOpacity={0.6}
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
  wrapper: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
  },

  headerText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f9f9f9",
    marginBottom: 16,
  },

  container: {
    width: "100%",
    maxWidth: 480,
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* HEADER STYLES */
  header: {
    backgroundColor: "#5F9C76",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#5F9C76",
  },
  userTextDetails: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f9f9f9",
    letterSpacing: -0.3,
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
    tintColor: "#5F9C76",
    marginRight: 4,
  },
  ecoLabelContainer: {
    overflow: "hidden",
  },
  ecoPointsLabel: {
    color: "#5F9C76",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  pointsValue: {
    color: "#5F9C76",
    fontWeight: "700",
    fontSize: 13,
  },
  phoneText: {
    color: "#f9f9f9",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },

  /* CONTENT & LIST STYLES */
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  menuList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  lastMenuRow: {
    borderBottomWidth: 0,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 20,
    height: 20,
    tintColor: "#5F9C76",
    marginRight: 14,
  },
  menuText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#334155",
  },
  chevron: {
    fontSize: 18,
    color: "#CBD5E1",
    fontWeight: "400",
  },

  /* LOGOUT BUTTON */
  logoutButton: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "600",
    fontSize: 15,
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoutModal: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  logoutTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  logoutMessage: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
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
    fontWeight: "600",
    fontSize: 15,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  cancelLogoutText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },

  /* NAVBAR */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
});
