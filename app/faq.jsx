import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import Navbar from "../components/navbar";

// Enable LayoutAnimation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FAQ() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const faqData = [
    {
      question: "What is GreenTrace?",
      answer: "GreenTrace is a mobile application that allows barangay residents to report waste management concerns directly to the LGU of Pinamungajan.",
    },
    {
      question: "Where can i post a Report?",
      answer: "You can report a waste management concern in the Home tab (house icon) by tapping the “+” icon at the top of the screen or by clicking here.",
    },
    {
      question: "What is Eco Points?",
      answer: "Eco Points are part of GreenTrace’s gamification system, where users can earn points when their reported waste concern is successfully cleaned by the LGU or when they participate in voluntary clean-up activities.",
    },
    {
      question: "What can i do with Eco Points?",
      answer: "Eco Points are for fun and community engagement. They cannot be exchanged for rewards, but having more Eco Points shows that your reports are trustworthy. This helps the LGU identify reliable reports and respond with confidence.",
    },
    {
      question: "Where can i volunteer?",
      answer: "You can participate a LGU activity (if there is one) in the Volunteer tab, next to the Home tab or by clicking here.",
    },
  ];

  const toggleExpand = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
            <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Image
              source={require("../assets/images/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          
          </View>
          <Text style={styles.headerTitle}>FAQ</Text>
        </View>

        {/* FAQ LIST */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {faqData.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => toggleExpand(index)}
                style={[styles.faqBox, isExpanded && styles.faqBoxExpanded]}
              >
                <Text style={styles.questionText}>{item.question}</Text>
                <Text style={styles.tapHint}>
                  {isExpanded ? "Tap to hide" : "Tap to view"}
                </Text>

                {isExpanded && (
                  <Text style={styles.answerText}>{item.answer}</Text>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Bottom spacer so last item isn't hidden by navbar */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* NAVBAR */}
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
    backgroundColor: "#ffffff",
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
    paddingHorizontal: 20,
    paddingBottom: 50,
    paddingTop: 10,
  },
 
  backIcon: {
    width: 43,
    height: 43,
    resizeMode: "contain",
    top: 3,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginRight: 40, // Offsets the back button to center the text
    top: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  faqBox: {
    backgroundColor: "#5F9C76",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: "center",
    // Shadow
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  faqBoxExpanded: {
    paddingBottom: 20,
  },
  questionText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  tapHint: {
    color: "#FFF",
    fontSize: 10,
    marginTop: 2,
    opacity: 0.9,
  },
  answerText: {
    color: "#FFF",
    fontSize: 13,
    textAlign: "left",
    marginTop: 15,
    lineHeight: 18,
  },
  navbarContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },

  headerContent: {
    top: 30,
    
  },
});