import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PostDetail from "./assessments/post_view/PostDetail.jsx";
import VolunteerPostCreate from "./assessments/post_view/VolunteerPostCreate";
import AssessmentList from "./components/AssessmentList";

export default function SituationAssessment() {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedPost, setSelectedPost] = useState(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [enabledFilters, setEnabledFilters] = useState([]);
  const [filters, setFilters] = useState({
    purok: "",
    barangay: "",
    resident: "",
  });
  const [selectedVolunteerPost, setSelectedVolunteerPost] = useState(null);

  const renderContent = () => {
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
          currentTab={activeTab}
          setSelectedPost={setSelectedPost}
          setSelectedVolunteerPost={setSelectedVolunteerPost}
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
      {!selectedPost && (
        <>
          <View style={styles.cardsRow}>
            <Text
              style={[
                {
                  backgroundColor: "#A5A5A5",
                  color: "#fff",
                  borderRadius: 5,
                  width: "19%",
                  height: "100%",
                  textAlign: "center",
                  paddingVertical: 10,
                },
                activeTab === "pending" && styles.activeTab,
              ]}
              onPress={() => {
                setActiveTab("pending");
                setSelectedPost(null);
              }}
            >
              Not Assessed
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#FF6666",
                  color: "#fff",
                  borderRadius: 5,
                  width: "19%",
                  height: "100%",
                  textAlign: "center",
                  paddingVertical: 10,
                },
                activeTab === "critical" && styles.activeTab,
              ]}
              onPress={() => {
                setActiveTab("critical");
                setSelectedPost(null);
              }}
            >
              Critical
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#FFCF30",
                  color: "#fff",
                  borderRadius: 5,
                  width: "19%",
                  height: "100%",
                  textAlign: "center",
                  paddingVertical: 10,
                },
                activeTab === "moderate" && styles.activeTab,
              ]}
              onPress={() => {
                setActiveTab("moderate");
                setSelectedPost(null);
              }}
            >
              Moderate
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#2DCC6F",
                  color: "#fff",
                  borderRadius: 5,
                  width: "19%",
                  height: "100%",
                  textAlign: "center",
                  paddingVertical: 10,
                },
                activeTab === "cleaned" && styles.activeTab,
              ]}
              onPress={() => {
                setActiveTab("cleaned");
                setSelectedPost(null);
              }}
            >
              Cleaned
            </Text>
            <Text
              style={[
                {
                  backgroundColor: "#7DD3FC",
                  color: "#0F172A",
                  borderRadius: 5,
                  width: "19%",
                  height: "100%",
                  textAlign: "center",
                  paddingVertical: 10,
                },
                activeTab === "ongoing" && styles.activeTab,
              ]}
              onPress={() => {
                setActiveTab("ongoing");
                setSelectedPost(null);
              }}
            >
              On-going
            </Text>
          </View>

          <View style={styles.searchContainer}>
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
                          style={styles.filterInput}
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
  container: { flex: 1, padding: 2 },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  activeTab: { fontWeight: "bold" },
  tabContent: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
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
  searchInput: { flex: 1, height: 40 },
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
  filterOption: { flex: 1, minWidth: 190 },
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
  },
});
