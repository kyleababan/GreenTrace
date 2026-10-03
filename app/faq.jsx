import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Navbar from "../components/navbar";

const FAQ_DATA = [
  {
    question: "What is GreenTrace?",
    answer:
      "GreenTrace is a community waste management application that allows barangay residents to report waste management concerns directly to the Local Government Unit (LGU) of Pinamungajan.",
  },
  {
    question: "Where can I post a report?",
    answer:
      'You can report a waste management concern from the Home tab by tapping the "+" button at the top header. Take a clear photo, select the location and waste category, and submit.',
  },
  {
    question: "What are Eco Points?",
    answer:
      "Eco Points are part of GreenTrace's community engagement system. Users earn points when a reported waste concern is verified and cleaned by the LGU, or when participating in volunteer clean-up drives.",
  },
  {
    question: "What can I do with Eco Points?",
    answer:
      "Eco Points highlight active, reliable community members and contribute toward monthly leaderboards and badge milestones. Higher points show that your reports are trustworthy and help the LGU prioritize responses.",
  },
  {
    question: "Where can I volunteer?",
    answer:
      "You can find and join open LGU cleanup drives from the Volunteering section or by tapping active announcements on the Home screen.",
  },
  {
    question: "How do I know when my report is cleaned?",
    answer:
      "When the LGU team or barangay sweeps and cleans the reported location, they post a verified cleanup photo. You will receive an instant notification in your Notifications tab.",
  },
];

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FAQ() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleExpand = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.topSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTextWrapper}>
                <Text style={styles.headerTitle}>FAQ</Text>
                <Text style={styles.headerSubtitle}>
                  Answers to common GreenTrace questions
                </Text>
              </View>
            </View>
          </View>

          {/* CONTENT */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* INTRO BANNER */}
            <View style={styles.introCard}>
              <View style={styles.introIconCircle}>
                <Ionicons name="help-buoy-outline" size={24} color="#397A51" />
              </View>
              <View style={styles.introTextWrapper}>
                <Text style={styles.introTitle}>How can we help?</Text>
                <Text style={styles.introSubtitle}>
                  Tap any question below to learn how GreenTrace works and how
                  to participate.
                </Text>
              </View>
            </View>

            {/* QUESTIONS LIST */}
            {FAQ_DATA.map((item, index) => {
              const isExpanded = expandedIndex === index;

              return (
                <View key={item.question} style={styles.cardWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => toggleExpand(index)}
                    style={[
                      styles.faqCard,
                      isExpanded && styles.faqCardExpanded,
                    ]}
                  >
                    <View style={styles.questionRow}>
                      <View style={styles.questionTextWrapper}>
                        <Text
                          style={[
                            styles.questionText,
                            isExpanded && styles.questionTextExpanded,
                          ]}
                        >
                          {item.question}
                        </Text>
                        <Text style={styles.tapHint}>
                          {isExpanded ? "Tap to collapse" : "Tap to read more"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.chevronCircle,
                          isExpanded && styles.chevronCircleExpanded,
                        ]}
                      >
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={isExpanded ? "#2E7D32" : "#64748B"}
                        />
                      </View>
                    </View>

                    {isExpanded && (
                      <View style={styles.answerSection}>
                        <View style={styles.answerDivider} />
                        <Text style={styles.answerText}>{item.answer}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* HELP FOOTER */}
            <View style={styles.helpFooter}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#5F9C76"
              />
              <Text style={styles.helpFooterText}>
                Need further assistance? Contact your local Pinamungajan
                Barangay LGU office.
              </Text>
            </View>
          </ScrollView>

          {/* NAVBAR */}
          <View style={styles.navbarContainer}>
            <Navbar />
          </View>
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
    flex: 1,
    backgroundColor: "#F5F5F5",
    maxWidth: 500,
    width: "100%",
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    color: "#E8F3EC",
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },

  /* INTRO CARD */
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    gap: 12,
  },
  introIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  introTextWrapper: {
    flex: 1,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F3326",
    marginBottom: 2,
  },
  introSubtitle: {
    fontSize: 12,
    color: "#4B6B58",
    lineHeight: 16,
  },

  /* CARDS */
  cardWrapper: {
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  faqCardExpanded: {
    borderColor: "#B7DEC4",
    backgroundColor: "#FAFDFB",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  questionTextWrapper: {
    flex: 1,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F3326",
    lineHeight: 20,
  },
  questionTextExpanded: {
    color: "#2E7D32",
  },
  tapHint: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    marginTop: 4,
  },
  chevronCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  chevronCircleExpanded: {
    backgroundColor: "#DCFCE7",
  },
  answerSection: {
    marginTop: 12,
  },
  answerDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginBottom: 12,
  },
  answerText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },

  /* HELP FOOTER */
  helpFooter: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  helpFooterText: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },

  /* NAVBAR */
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
