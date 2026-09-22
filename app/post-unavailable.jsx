import { useRouter } from "expo-router";
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Navbar from "../components/navbar";

export default function PostUnavailable() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          <View style={styles.content}>
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.icon}
            />
            <Text style={styles.title}>Post unavailable</Text>
            <Text style={styles.message}>
              This post is no longer available or this page cannot be found.
            </Text>
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.8}
              onPress={() => router.replace("/home")}
            >
              <Text style={styles.buttonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: "center",
    backgroundColor: "#F4F6F8",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#F4F6F8",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  icon: {
    width: 64,
    height: 64,
    resizeMode: "contain",
    tintColor: "#5F9C76",
    marginBottom: 16,
  },
  title: {
    color: "#234B33",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    maxWidth: 320,
    marginTop: 8,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  navbarContainer: {
    borderTopWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
});
