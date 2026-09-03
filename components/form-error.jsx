import { StyleSheet, Text, View } from "react-native";

export default function FormError({ message, light = false }) {
  if (!message) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, light && styles.lightBox]}
    >
      <Text style={[styles.text, light && styles.lightText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#FDECEC",
    borderColor: "#E8A0A0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  lightBox: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  lightText: {
    color: "#FFFFFF",
  },
});
