import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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
      "GreenTrace is a mobile application that allows barangay residents to report waste management concerns directly to the LGU of Pinamungajan.",
  },
  {
    question: "Where can I post a report?",
    answer:
      'You can report a waste management concern from the Home tab by tapping the "+" icon at the top of the screen.',
  },
  {
    question: "What are Eco Points?",
    answer:
      "Eco Points are part of GreenTrace's community system. Users earn points when a reported concern is successfully cleaned or when they participate in volunteer clean-up activities.",
  },
  {
    question: "What can I do with Eco Points?",
    answer:
      "Eco Points are for fun and community engagement. They cannot be exchanged for rewards, but more points show that your reports are trustworthy and help the LGU respond with confidence.",
  },
  {
    question: "Where can I volunteer?",
    answer:
      "You can join an available LGU activity from the Volunteer tab next to the Home tab.",
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
  const cardEntrances = useRef(
    FAQ_DATA.map(() => new Animated.Value(0)),
  ).current;
  const chevrons = useRef(FAQ_DATA.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      80,
      cardEntrances.map((entrance) =>
        Animated.spring(entrance, {
          toValue: 1,
          damping: 14,
          stiffness: 120,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [cardEntrances]);

  const toggleExpand = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextIndex = expandedIndex === index ? null : index;

    if (expandedIndex !== null && expandedIndex !== index) {
      Animated.timing(chevrons[expandedIndex], {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }

    Animated.spring(chevrons[index], {
      toValue: nextIndex === null ? 0 : 1,
      damping: 15,
      stiffness: 180,
      useNativeDriver: true,
    }).start();

    setExpandedIndex(nextIndex);
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.75}
          >
            <Image
              source={require("../assets/images/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FAQ</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={styles.introTitle}>How can we help?</Text>
            <Text style={styles.introText}>
              Tap a question below to discover more about GreenTrace.
            </Text>
          </View>

          {FAQ_DATA.map((item, index) => {
            const isExpanded = expandedIndex === index;

            return (
              <Animated.View
                key={item.question}
                style={{
                  opacity: cardEntrances[index],
                  transform: [
                    {
                      translateY: cardEntrances[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                    {
                      scale: cardEntrances[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.97, 1],
                      }),
                    },
                  ],
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => toggleExpand(index)}
                  style={[styles.faqBox, isExpanded && styles.faqBoxExpanded]}
                >
                  <View style={styles.questionRow}>
                    <View style={styles.questionCopy}>
                      <Text style={styles.questionText}>{item.question}</Text>
                      <Text style={styles.tapHint}>
                        {isExpanded ? "Tap to close" : "Tap to learn more"}
                      </Text>
                    </View>
                    <Animated.Text
                      style={[
                        styles.chevron,
                        {
                          transform: [
                            {
                              rotate: chevrons[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0deg", "180deg"],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      ⌄
                    </Animated.Text>
                  </View>

                  {isExpanded && (
                    <View style={styles.answerSection}>
                      <View style={styles.answerDivider} />
                      <Text style={styles.answerText}>{item.answer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.navbarContainer}>
          <Navbar />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2",
    maxWidth: 500,
    width: "100%",
  },
  header: {
    backgroundColor: "#5F9C76",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  intro: {
    marginBottom: 16,
  },
  introTitle: {
    color: "#263C2E",
    fontSize: 21,
    fontWeight: "700",
  },
  introText: {
    color: "#647067",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  faqBox: {
    backgroundColor: "#5F9C76",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  faqBoxExpanded: {
    backgroundColor: "#548B69",
    paddingBottom: 18,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  questionCopy: {
    flex: 1,
  },
  questionText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  tapHint: {
    color: "#FFFFFF",
    fontSize: 11,
    marginTop: 4,
    opacity: 0.78,
  },
  chevron: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 28,
    marginLeft: 12,
  },
  answerSection: {
    overflow: "hidden",
  },
  answerDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginTop: 14,
  },
  answerText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
    opacity: 0.95,
  },
  bottomSpacer: {
    height: 24,
  },
  navbarContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#DDDDDD",
  },
});
