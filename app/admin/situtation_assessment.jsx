import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import PostDetail from "./assessments/post_view/PostDetail.jsx";
import VolunteerPostCreate from "./assessments/post_view/VolunteerPostCreate";
import AssessmentList from "./components/AssessmentList";
import { db } from "../../firebaseConfig";

const ASSESSMENT_STATUSES = ["critical", "moderate", "ongoing", "cleaned"];

export default function SituationAssessment() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const { status, postId, commentId, from } = useLocalSearchParams();
  const requestedStatus = Array.isArray(status) ? status[0] : status;
  const requestedPostId = Array.isArray(postId) ? postId[0] : postId;
  const requestedCommentId = Array.isArray(commentId) ? commentId[0] : commentId;
  const requestedFrom = Array.isArray(from) ? from[0] : from;
  const activeTab = ASSESSMENT_STATUSES.includes(requestedStatus)
    ? requestedStatus
    : "critical";
  const [selectedPost, setSelectedPost] = useState(null);
  const [postLoadError, setPostLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [focusedFilter, setFocusedFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [enabledFilters, setEnabledFilters] = useState([]);
  const [filters, setFilters] = useState({
    purok: "",
    barangay: "",
    resident: "",
  });
  const [selectedVolunteerPost, setSelectedVolunteerPost] = useState(null);

  useEffect(() => {
    if (!requestedPostId) return undefined;

    let isActive = true;
    const loadRequestedPost = async () => {
      try {
        const snapshot = await getDoc(doc(db, "posts", requestedPostId));
        if (!isActive) return;
        if (!snapshot.exists()) {
          setPostLoadError({
            postId: requestedPostId,
            message: "This report is no longer available.",
          });
          return;
        }
        setPostLoadError(null);
        setSelectedPost({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        console.error("Unable to open requested assessment report:", error);
        if (isActive) {
          setPostLoadError({
            postId: requestedPostId,
            message: "Unable to load this report.",
          });
        }
      }
    };

    loadRequestedPost();
    return () => {
      isActive = false;
    };
  }, [requestedPostId]);

  const closeSelectedPost = () => {
    if (requestedFrom === "user_logs") {
      router.back();
      return;
    }
    setSelectedPost(null);
    if (requestedPostId) {
      router.setParams({ postId: undefined, commentId: undefined, from: undefined });
    }
  };

  const renderContent = () => {
    if (
      requestedPostId &&
      selectedPost?.id !== requestedPostId
    ) {
      return (
        <View style={styles.requestedPostState}>
          {postLoadError?.postId === requestedPostId ? (
            <Text style={styles.requestedPostError}>
              {postLoadError.message}
            </Text>
          ) : (
            <ActivityIndicator size="small" color="#5F9C76" />
          )}
        </View>
      );
    }

    if (selectedVolunteerPost) {
      return (
        <VolunteerPostCreate
          post={selectedVolunteerPost}
          setSelectedVolunteerPost={setSelectedVolunteerPost}
          setSelectedPost={setSelectedPost}
        />
      );
    }

    if (selectedPost) {
      return (
        <PostDetail
          post={selectedPost}
          currentTab={selectedPost.status || activeTab}
          setSelectedPost={closeSelectedPost}
          setSelectedVolunteerPost={setSelectedVolunteerPost}
          highlightedCommentId={requestedCommentId}
        />
      );
    }

    return (
      <AssessmentList
        status={activeTab}
        searchText={search}
        filters={filters}
        enabledFilters={enabledFilters}
        setSelectedPost={setSelectedPost}
      />
    );
  };

  return (
    <View style={styles.container}>
      {!selectedPost && !selectedVolunteerPost && (
        <>
          <View style={styles.cardsRow}>
            <Text
              style={[
                {
                  backgroundColor: "#FF5B5B",
                  color: "#FFFFFF",
                  borderRadius: 5,
                  flex: 1,
                  textAlign: "center",
                  paddingVertical: 10,
                  fontSize: isMobile ? 12 : 14,
                },
                activeTab === "critical" && styles.activeTab,
              ]}
              onPress={() => {
                router.setParams({ status: "critical" });
                closeSelectedPost();
              }}
            >
              Critical
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#ff8c40",
                  color: "#FFFFFF",
                  borderRadius: 5,
                  flex: 1,
                  textAlign: "center",
                  paddingVertical: 10,
                  fontSize: isMobile ? 12 : 14,
                },
                activeTab === "moderate" && styles.activeTab,
              ]}
              onPress={() => {
                router.setParams({ status: "moderate" });
                closeSelectedPost();
              }}
            >
              Moderate
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#FFC940",
                  color: "#FFFFFF",
                  borderRadius: 5,
                  flex: 1,
                  textAlign: "center",
                  paddingVertical: 10,
                  fontSize: isMobile ? 12 : 14,
                },
                activeTab === "ongoing" && styles.activeTab,
              ]}
              onPress={() => {
                router.setParams({ status: "ongoing" });
                closeSelectedPost();
              }}
            >
              On-going
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#34C759",
                  color: "#FFFFFF",
                  borderRadius: 5,
                  flex: 1,
                  textAlign: "center",
                  paddingVertical: 10,
                  fontSize: isMobile ? 12 : 14,
                },
                activeTab === "cleaned" && styles.activeTab,
              ]}
              onPress={() => {
                router.setParams({ status: "cleaned" });
                closeSelectedPost();
              }}
            >
              Cleaned
            </Text>
          </View>

          <View
            style={[
              styles.searchContainer,
              searchFocused && styles.inputActive,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                enabledFilters.length > 0 && styles.filterButtonActive,
              ]}
              onPress={() => setShowFilters((current) => !current)}
              accessibilityLabel="Show report filters"
            >
              <Ionicons
                name="filter"
                size={20}
                color={enabledFilters.length > 0 ? "#FFFFFF" : "#5E9F79"}
              />
              {enabledFilters.length > 0 && (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>
                    {enabledFilters.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
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

          {showFilters && (
            <View style={styles.filterPanel}>
              <View style={styles.filterHeader}>
                <View>
                  <Text style={styles.filterTitle}>Filter reports</Text>
                  <Text style={styles.filterHint}>
                    Select one or more filters.
                  </Text>
                </View>
                {enabledFilters.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setEnabledFilters([]);
                      setFilters({ purok: "", barangay: "", resident: "" });
                    }}
                  >
                    <Text style={styles.clearText}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterOptions}>
                {[
                  { id: "purok", label: "Purok", placeholder: "Enter purok" },
                  {
                    id: "barangay",
                    label: "Barangay",
                    placeholder: "Enter barangay",
                  },
                  {
                    id: "resident",
                    label: "Residents",
                    placeholder: "Enter resident name",
                  },
                ].map((option) => {
                  const isEnabled = enabledFilters.includes(option.id);

                  return (
                    <View key={option.id} style={styles.filterOption}>
                      <TouchableOpacity
                        style={[
                          styles.filterChoice,
                          isEnabled && styles.filterChoiceActive,
                        ]}
                        onPress={() => {
                          setEnabledFilters((current) =>
                            current.includes(option.id)
                              ? current.filter((filter) => filter !== option.id)
                              : [...current, option.id],
                          );
                        }}
                      >
                        <Ionicons
                          name={isEnabled ? "checkbox" : "square-outline"}
                          size={19}
                          color={isEnabled ? "#5E9F79" : "#8C9891"}
                        />
                        <Text
                          style={[
                            styles.filterChoiceText,
                            isEnabled && styles.filterChoiceTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>

                      {isEnabled && (
                        <TextInput
                          value={filters[option.id]}
                          onChangeText={(value) =>
                            setFilters((current) => ({
                              ...current,
                              [option.id]: value,
                            }))
                          }
                          placeholder={option.placeholder}
                          placeholderTextColor="#929C96"
                          style={[
                            styles.filterInput,
                            focusedFilter === option.id && styles.inputActive,
                          ]}
                          onFocus={() => setFocusedFilter(option.id)}
                          onBlur={() => setFocusedFilter("")}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.tabContent}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: "#F4F8F5",
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 14,
  },
  activeTab: {
    fontWeight: "800",
    borderWidth: 2,
    borderColor: "#234B33",
    overflow: "hidden",
  },
  tabContent: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputActive: {
    borderColor: "#5F9C76",
    shadowColor: "#5F9C76",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginRight: 8,
  },
  filterButtonActive: { backgroundColor: "#5E9F79" },
  filterCount: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#234B33",
  },
  filterCountText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    color: "#24352A",
    fontSize: 14,
    borderWidth: 0,
    outlineStyle: "none",
  },
  filterPanel: {
    marginTop: -7,
    marginBottom: 15,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE8E0",
    backgroundColor: "#FFFFFF",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterTitle: { color: "#284E36", fontSize: 15, fontWeight: "700" },
  filterHint: { color: "#7B8980", fontSize: 12, marginTop: 2 },
  clearText: { color: "#D64C4C", fontSize: 12, fontWeight: "600" },
  filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  filterOption: { flex: 1, minWidth: 0 },
  filterChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },
  filterChoiceActive: { opacity: 1 },
  filterChoiceText: { color: "#66736B", fontSize: 13, fontWeight: "600" },
  filterChoiceTextActive: { color: "#397A51" },
  filterInput: {
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    color: "#28362D",
    backgroundColor: "#F8FAF9",
    outlineStyle: "none",
  },
});
