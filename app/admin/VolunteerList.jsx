import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { formatLocationWithPurok } from "../../constants/locationFormat";
import {
  formatWasteLabel,
  getWasteCategoryColor,
} from "../../constants/wasteCategories";
import { db } from "../../firebaseConfig";
import { hideBadWords } from "../../utils/hideBadWords";

const STATUS_CONFIG = {
  pending: { label: "Not Assessed", bg: "#A5A5A5", text: "#FFFFFF" },
  critical: { label: "Critical", bg: "#FF5B5B", text: "#FFFFFF" },
  moderate: { label: "Moderate", bg: "#ff8c40", text: "#FFFFFF" },
  ongoing: { label: "On-going", bg: "#FFC940", text: "#FFFFFF" },
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Just now";
  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function VolunteerList({ setActivePage }) {
  const { width: windowWidth } = useWindowDimensions();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Activity creation options modal state
  const [choiceModalVisible, setChoiceModalVisible] = useState(false);

  // Situation assessment post selector state
  const [postSelectorVisible, setPostSelectorVisible] = useState(false);
  const [assessmentPosts, setAssessmentPosts] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [assessmentSearchFocused, setAssessmentSearchFocused] = useState(false);
  const [assessmentTab, setAssessmentTab] = useState("all");
  const [volunteerPostMap, setVolunteerPostMap] = useState({});

  // Follow AssessmentList structure for card width calculation
  const cardWidth =
    windowWidth < 850 ? "100%" : windowWidth < 1250 ? "48.5%" : "32%";

  const loadVolunteerPosts = useCallback(async () => {
    try {
      const q = query(
        collection(db, "volunteer_posts"),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const vMap = {};
      data.forEach((vp) => {
        if (vp.postId && vp.status !== "cleaned") {
          vMap[vp.postId] = vp.id;
        }
      });
      setVolunteerPostMap(vMap);

      const activePosts = await Promise.all(
        data.map(async (volunteerPost) => {
          if (volunteerPost.status === "cleaned") return null;

          if (!volunteerPost.postId) {
            return volunteerPost;
          }

          try {
            const sourcePost = await getDoc(
              doc(db, "posts", volunteerPost.postId),
            );

            if (!sourcePost.exists()) return volunteerPost;

            const sourceData = sourcePost.data();
            if (sourceData.status === "cleaned") return null;

            return volunteerPost;
          } catch (error) {
            console.error("Unable to check volunteer post status:", error);
            return volunteerPost;
          }
        }),
      );

      setPosts(activePosts.filter(Boolean));
    } catch (error) {
      console.log(error);
    }
  }, []);

  const loadAssessmentPosts = useCallback(async () => {
    setLoadingAssessments(true);
    try {
      const [postsSnap, volSnap] = await Promise.all([
        getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "volunteer_posts")),
      ]);

      const vMap = {};
      volSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.postId && d.status !== "cleaned") {
          vMap[d.postId] = doc.id;
        }
      });
      setVolunteerPostMap(vMap);

      const list = postsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.status !== "cleaned"); // strictly exclude cleaned posts
      setAssessmentPosts(list);
    } catch (error) {
      console.error("Error loading assessment posts:", error);
    } finally {
      setLoadingAssessments(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVolunteerPosts();
    }, [loadVolunteerPosts]),
  );

  const filteredPosts = useMemo(() => {
    const keyword = search.toLowerCase();

    return posts.filter(
      (post) =>
        (post.status !== "cleaned" && !keyword) ||
        post.title?.toLowerCase().includes(keyword) ||
        post.description?.toLowerCase().includes(keyword) ||
        post.locationName?.toLowerCase().includes(keyword),
    );
  }, [posts, search]);

  const filteredAssessments = useMemo(() => {
    const q = assessmentSearch.trim().toLowerCase();
    return assessmentPosts.filter((post) => {
      if (assessmentTab !== "all" && post.status !== assessmentTab) {
        return false;
      }
      if (!q) return true;
      const fullName =
        `${post.firstName || ""} ${post.lastName || ""}`.toLowerCase();
      const title = (post.title || "").toLowerCase();
      const caption = (post.caption || post.description || "").toLowerCase();
      const location = (post.locationName || "").toLowerCase();
      return (
        fullName.includes(q) ||
        title.includes(q) ||
        caption.includes(q) ||
        location.includes(q)
      );
    });
  }, [assessmentPosts, assessmentTab, assessmentSearch]);

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View
            style={[
              styles.searchContainer,
              searchFocused && styles.searchContainerFocused,
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color="#888"
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search"
              style={styles.searchInput}
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>
          <TouchableOpacity
            style={styles.addEventButton}
            activeOpacity={0.75}
            onPress={() => setChoiceModalVisible(true)}
            accessibilityLabel="Create activity options"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addEventText}>Create Activity</Text>
          </TouchableOpacity>
        </View>

        {/* GRID OF VOLUNTEER POSTS */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={true}
        >
          {filteredPosts.map((post) => (
            <View key={post.id} style={styles.card}>
              {/* LEFT */}
              <View style={styles.cardLeft}>
                <Text style={styles.title}>{hideBadWords(post.title)}</Text>

                <Text style={styles.desc} numberOfLines={3}>
                  {hideBadWords(post.description)}
                </Text>

                <View style={styles.locationRow}>
                  <Image
                    source={require("../../assets/images/location.png")}
                    style={styles.locationIcon}
                  />
                  <Text style={styles.location}>{post.locationName}</Text>
                </View>

                <TouchableOpacity
                  style={styles.button}
                  onPress={() =>
                    router.push({
                      pathname:
                        "/admin/assessments/post_view/VolunteerPostDetail",
                      params: {
                        volunteerId: post.id,
                      },
                    })
                  }
                >
                  <Text style={styles.buttonText}>Check</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.imageWrapper}>
                <Image source={{ uri: post.imageUrl }} style={styles.image} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* TWO OPTIONS CHOICE MODAL */}
      <Modal
        visible={choiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChoiceModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setChoiceModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.choiceModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.choiceModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceModalTitle}>Create Activity</Text>
                <Text style={styles.choiceModalSubtitle}>
                  Choose how you want to create a volunteer activity
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setChoiceModalVisible(false)}
                style={styles.choiceCloseBtn}
              >
                <Ionicons name="close" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            <View style={styles.choiceOptionsList}>
              {/* Option 1: Standalone Activity */}
              <TouchableOpacity
                style={styles.choiceOptionCard}
                activeOpacity={0.7}
                onPress={() => {
                  setChoiceModalVisible(false);
                  router.push("/admin/add_event");
                }}
              >
                <View style={styles.choiceOptionIconWrap}>
                  <Ionicons
                    name="add-circle-outline"
                    size={26}
                    color="#276344"
                  />
                </View>
                <View style={styles.choiceOptionTextWrap}>
                  <Text style={styles.choiceOptionTitle}>Create Activity</Text>
                  <Text style={styles.choiceOptionDesc}>
                    Create a standalone volunteer activity or event from scratch
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8DA396" />
              </TouchableOpacity>

              {/* Option 2: From Situation Assessment */}
              <TouchableOpacity
                style={styles.choiceOptionCard}
                activeOpacity={0.7}
                onPress={() => {
                  setChoiceModalVisible(false);
                  setSelectedPostId(null);
                  setAssessmentSearch("");
                  setAssessmentTab("all");
                  setPostSelectorVisible(true);
                  loadAssessmentPosts();
                }}
              >
                <View style={styles.choiceOptionIconWrap}>
                  <Ionicons
                    name="document-text-outline"
                    size={26}
                    color="#276344"
                  />
                </View>
                <View style={styles.choiceOptionTextWrap}>
                  <Text style={styles.choiceOptionTitle}>
                    Choose from Situation Assessment
                  </Text>
                  <Text style={styles.choiceOptionDesc}>
                    Pick an uncleaned report to turn into a volunteer activity
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8DA396" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ASSESSMENT POST SELECTOR MODAL */}
      <Modal
        visible={postSelectorVisible}
        animationType="slide"
        onRequestClose={() => setPostSelectorVisible(false)}
      >
        <View style={styles.selectorPage}>
          {/* TOP BAR / HEADER */}
          <View style={styles.selectorHeader}>
            <TouchableOpacity
              style={styles.selectorBackBtn}
              onPress={() => setPostSelectorVisible(false)}
            >
              <Ionicons name="arrow-back" size={22} color="#276344" />
            </TouchableOpacity>
            <View style={styles.selectorHeaderTitles}>
              <Text style={styles.selectorHeaderTitle}>
                Choose from Situation Assessment
              </Text>
              <Text style={styles.selectorHeaderSubtitle}>
                Select an uncleaned post to convert into a volunteer activity
              </Text>
            </View>
          </View>

          {/* SEARCH & FILTERS */}
          <View style={styles.selectorControls}>
            <View
              style={[
                styles.selectorSearchWrap,
                assessmentSearchFocused && styles.selectorSearchFocused,
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color="#888"
                style={{ marginRight: 8 }}
              />
              <TextInput
                placeholder="Search by title, location, description, or resident..."
                placeholderTextColor="#888"
                style={styles.selectorSearchInput}
                value={assessmentSearch}
                onChangeText={setAssessmentSearch}
                onFocus={() => setAssessmentSearchFocused(true)}
                onBlur={() => setAssessmentSearchFocused(false)}
              />
              {assessmentSearch ? (
                <TouchableOpacity onPress={() => setAssessmentSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* STATUS FILTER TABS (EXCLUDING CLEANED) */}
            <View style={styles.selectorTabsRow}>
              {[
                { key: "all", label: "All" },
                { key: "critical", label: "Critical", color: "#FF5B5B" },
                { key: "moderate", label: "Moderate", color: "#ff8c40" },
                { key: "ongoing", label: "On-going", color: "#FFC940" },
              ].map((tab) => {
                const isActive = assessmentTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.selectorTab,
                      isActive && styles.selectorTabActive,
                    ]}
                    onPress={() => setAssessmentTab(tab.key)}
                  >
                    {tab.color && (
                      <View
                        style={[
                          styles.tabColorDot,
                          { backgroundColor: tab.color },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.selectorTabText,
                        isActive && styles.selectorTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* POSTS LIST / GRID */}
          {loadingAssessments ? (
            <View style={styles.selectorCenterLoading}>
              <ActivityIndicator size="large" color="#5F9C76" />
              <Text style={styles.selectorLoadingText}>
                Loading situation assessment posts...
              </Text>
            </View>
          ) : filteredAssessments.length === 0 ? (
            <View style={styles.selectorEmpty}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color="#A9BDB0"
              />
              <Text style={styles.selectorEmptyTitle}>No posts found</Text>
              <Text style={styles.selectorEmptySub}>
                {assessmentSearch
                  ? "Try searching with different keywords."
                  : "There are no uncleaned situation assessment posts right now."}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.selectorScroll}
              contentContainerStyle={styles.selectorScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Following AssessmentList's postContainer with alignItems: flex-start and gap: 18 */}
              <View style={styles.postContainer}>
                {filteredAssessments.map((item) => {
                  const isSelected = selectedPostId === item.id;
                  const existingVolunteerId = volunteerPostMap[item.id];
                  const hasActivity = Boolean(existingVolunteerId);
                  const postStatus =
                    STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  const wasteLabel = formatWasteLabel(item.wasteClassification);
                  const wasteColor = getWasteCategoryColor(
                    item.wasteClassification?.category,
                  );

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.postCard,
                        { width: cardWidth },
                        isSelected && styles.postCardSelected,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (hasActivity) {
                          setPostSelectorVisible(false);
                          router.push({
                            pathname:
                              "/admin/assessments/post_view/VolunteerPostDetail",
                            params: {
                              volunteerId: existingVolunteerId,
                            },
                          });
                          return;
                        }
                        setSelectedPostId(isSelected ? null : item.id);
                      }}
                    >
                      {/* Author Row (Matching AssessmentList) */}
                      <View style={styles.authorRow}>
                        <Image
                          source={require("../../assets/images/profile2.png")}
                          style={styles.profileImage}
                        />
                        <View style={styles.authorDetails}>
                          <View style={styles.authorHeader}>
                            <Text style={styles.profileName} numberOfLines={1}>
                              {item.firstName || "Anonymous"}{" "}
                              {item.lastName || ""}
                            </Text>

                            {hasActivity && (
                              <View style={styles.activityIndicatorBadge}>
                                <Ionicons
                                  name="calendar-outline"
                                  size={11}
                                  color="#205A38"
                                />
                                <Text style={styles.activityIndicatorText}>
                                  Activity Exists
                                </Text>
                              </View>
                            )}

                            <View style={styles.authorHeaderRight}>
                              <Text style={styles.postedAt}>
                                {formatRelativeTime(item.createdAt)}
                              </Text>
                              {!hasActivity ? (
                                <View
                                  style={[
                                    styles.cardCheckbox,
                                    isSelected && styles.cardCheckboxChecked,
                                  ]}
                                >
                                  {isSelected ? (
                                    <Ionicons
                                      name="checkmark"
                                      size={14}
                                      color="#FFFFFF"
                                    />
                                  ) : null}
                                </View>
                              ) : (
                                <View style={styles.cardViewAction}>
                                  <Ionicons
                                    name="open-outline"
                                    size={15}
                                    color="#205A38"
                                  />
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.cardLocationRow}>
                            <Image
                              source={require("../../assets/images/location.png")}
                              style={styles.locationIcon}
                            />
                            <Text style={styles.locationText} numberOfLines={1}>
                              {formatLocationWithPurok(
                                item.locationName,
                                item.purok,
                              )}
                            </Text>
                          </View>

                          {/* Report Status & Waste Category Tags */}
                          <View style={styles.tagsRow}>
                            <View
                              style={[
                                styles.statusTag,
                                { backgroundColor: postStatus.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  { color: postStatus.text },
                                ]}
                              >
                                {postStatus.label}
                              </Text>
                            </View>

                            {Boolean(wasteLabel) && (
                              <View
                                style={[
                                  styles.wasteTag,
                                  { backgroundColor: wasteColor },
                                ]}
                              >
                                <Text style={styles.wasteTagText}>
                                  {wasteLabel}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Image Container (Matching AssessmentList) */}
                      {item.imageUrl ? (
                        <View style={styles.imageContainer}>
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.cardImage}
                            resizeMode="cover"
                          />
                        </View>
                      ) : null}

                      {/* Title & Caption (Matching AssessmentList) */}
                      {Boolean(item.title) && (
                        <Text style={styles.postTitle} numberOfLines={1}>
                          {hideBadWords(item.title)}
                        </Text>
                      )}
                      {Boolean(item.caption || item.description) && (
                        <Text style={styles.postDescription} numberOfLines={3}>
                          {hideBadWords(item.caption || item.description)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* BOTTOM ACTION BAR */}
          <View style={styles.selectorFooter}>
            <TouchableOpacity
              style={styles.selectorCancelBtn}
              onPress={() => setPostSelectorVisible(false)}
            >
              <Text style={styles.selectorCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorProceedBtn,
                !selectedPostId && styles.selectorProceedBtnDisabled,
              ]}
              disabled={!selectedPostId}
              onPress={() => {
                const targetId = selectedPostId;
                setPostSelectorVisible(false);
                setSelectedPostId(null);
                router.push({
                  pathname: "/admin/assessments/post_view/VolunteerPostCreate",
                  params: {
                    postId: targetId,
                  },
                });
              }}
            >
              <Text style={styles.selectorProceedText}>
                {selectedPostId
                  ? "Proceed to Create Activity"
                  : "Select a Post to Proceed"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "row",
  },

  content: {
    flex: 1,
    padding: 20,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minHeight: 44,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchContainerFocused: {
    borderColor: "#5F9C76",
    shadowColor: "#5F9C76",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    color: "#25332a",
    borderWidth: 0,
    backgroundColor: "transparent",
    outlineStyle: "none",
  },

  addEventButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#5F9C76",
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 44,
    flexShrink: 0,
    cursor: "pointer",
  },
  addEventText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  scroll: {
    flex: 1,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 18,
  },

  card: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    flexDirection: "row",
  },

  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },

  desc: {
    fontSize: 11,
    color: "#555",
    marginBottom: 6,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  locationIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },

  location: {
    fontSize: 11,
    color: "#333",
  },

  button: {
    backgroundColor: "#5F9C76",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    width: 80,
  },

  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },

  imageWrapper: {
    width: 90,
    height: 90,
  },

  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },

  /* CHOICE MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  choiceModalContent: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  choiceModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  choiceModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E382B",
  },
  choiceModalSubtitle: {
    fontSize: 12,
    color: "#687B70",
    marginTop: 2,
  },
  choiceCloseBtn: {
    padding: 4,
  },
  choiceOptionsList: {
    gap: 12,
  },
  choiceOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAF9",
    borderWidth: 1.5,
    borderColor: "#E3ECE6",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    cursor: "pointer",
  },
  choiceOptionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EAF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceOptionTextWrap: {
    flex: 1,
  },
  choiceOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E382B",
    marginBottom: 2,
  },
  choiceOptionDesc: {
    fontSize: 12,
    color: "#5C7366",
    lineHeight: 16,
  },

  /* POST SELECTOR MODAL */
  selectorPage: {
    flex: 1,
    backgroundColor: "#F6F9F7",
  },
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBE6",
    gap: 12,
  },
  selectorBackBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F0F5F2",
  },
  selectorHeaderTitles: {
    flex: 1,
  },
  selectorHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E382B",
  },
  selectorHeaderSubtitle: {
    fontSize: 12,
    color: "#687B70",
    marginTop: 2,
  },
  selectorCloseBtn: {
    padding: 6,
  },
  selectorControls: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBF1ED",
    gap: 10,
  },
  selectorSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F6F4",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectorSearchFocused: {
    borderColor: "#5F9C76",
    backgroundColor: "#FFFFFF",
  },
  selectorSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#25332a",
    borderWidth: 0,
    backgroundColor: "transparent",
    outlineStyle: "none",
  },
  selectorTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  selectorTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F4F2",
    gap: 6,
    cursor: "pointer",
  },
  selectorTabActive: {
    backgroundColor: "#276344",
  },
  tabColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectorTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4C6154",
  },
  selectorTabTextActive: {
    color: "#FFFFFF",
  },

  /* SELECTOR SCROLL & POST CONTAINER (Matching AssessmentList) */
  selectorScroll: {
    flex: 1,
  },
  selectorScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  postContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 18,
  },

  selectorCenterLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  selectorLoadingText: {
    color: "#5C7366",
    fontSize: 14,
  },
  selectorEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 8,
  },
  selectorEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#33493C",
  },
  selectorEmptySub: {
    fontSize: 13,
    color: "#74887C",
    textAlign: "center",
    maxWidth: 320,
  },

  /* POST CARDS IN SELECTOR (Matching AssessmentList) */
  postCard: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    boxSizing: "border-box",
    cursor: "pointer",
  },
  postCardSelected: {
    borderColor: "#5F9C76",
    borderWidth: 2,
    backgroundColor: "#F2F9F5",
    shadowColor: "#5F9C76",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  authorDetails: {
    flex: 1,
  },
  authorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  authorHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  profileName: {
    flexShrink: 1,
    color: "#222222",
    fontWeight: "700",
    fontSize: 14,
  },
  postedAt: {
    color: "#888888",
    fontSize: 10,
    flexShrink: 0,
  },
  activityIndicatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF5EF",
    borderWidth: 1,
    borderColor: "#A9D5BA",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    gap: 4,
    flexShrink: 0,
  },
  activityIndicatorText: {
    color: "#205A38",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardViewAction: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#EAF5EF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#BAC7BF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardCheckboxChecked: {
    borderColor: "#5F9C76",
    backgroundColor: "#5F9C76",
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  cardLocationIcon: {
    width: 12,
    height: 12,
    resizeMode: "contain",
    tintColor: "#666666",
    marginRight: 4,
  },
  cardLocationText: {
    flex: 1,
    color: "#666666",
    fontSize: 12,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  statusTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  wasteTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wasteTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  imageContainer: {
    width: "100%",
    height: 200,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#C9DCCF",
    backgroundColor: "#EBEBEB",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  postTitle: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },
  postDescription: {
    color: "#333333",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },

  /* FOOTER */
  selectorFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EBE6",
  },
  selectorCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D2DDD6",
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
  },
  selectorCancelText: {
    color: "#52675A",
    fontWeight: "600",
    fontSize: 14,
  },
  selectorProceedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
    cursor: "pointer",
  },
  selectorProceedBtnDisabled: {
    backgroundColor: "#A8C7B5",
    opacity: 0.7,
    cursor: "default",
  },
  selectorProceedText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
