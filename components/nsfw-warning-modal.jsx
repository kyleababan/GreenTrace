import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function NsfwWarningModal({
  visible,
  isBanned = false,
  warningsCount = 1,
  reason = "",
  onClose,
  onSignOut,
}) {
  const warningsLeft = Math.max(0, 3 - warningsCount);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isBanned ? onSignOut : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityRole="alert">
          {isBanned ? (
            <>
              <View style={[styles.iconWrapper, styles.bannedIconWrapper]}>
                <Ionicons name="ban" size={44} color="#D93025" />
              </View>

              <Text style={styles.bannedTitle}>Account Banned</Text>

              <View style={styles.bannedBadge}>
                <Text style={styles.bannedBadgeText}>
                  3 of 3 Violations Reached
                </Text>
              </View>

              <Text style={styles.description}>
                Your account has been permanently banned for repeated violations
                of our Terms and Policy by attempting to upload inappropriate or
                NSFW content.
              </Text>

              {reason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Flagged reason:</Text>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, styles.bannedButton]}
                onPress={onSignOut}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>LOG OUT</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.iconWrapper, styles.warningIconWrapper]}>
                <Ionicons name="warning" size={44} color="#D97706" />
              </View>

              <Text style={styles.warningTitle}>Terms & Policy Warning</Text>

              {/* Warnings Left Badge */}
              <View style={styles.warningBanner}>
                <View style={styles.warningPill}>
                  <Text style={styles.warningPillText}>
                    Warning {warningsCount} of 3
                  </Text>
                </View>
                <Text style={styles.warningsLeftText}>
                  ⚠️ You have{" "}
                  <Text style={styles.boldText}>
                    {warningsLeft} warning{warningsLeft === 1 ? "" : "s"} left
                  </Text>{" "}
                  before your account is permanently banned.
                </Text>
              </View>

              <Text style={styles.description}>
                You attempted to upload content that violates GreenTrace
                Community Guidelines. All photos must only depict public waste,
                sanitation, or community environmental issues. Nudity,
                suggestive posing, and NSFW media are strictly prohibited.
              </Text>

              {reason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Flagged reason:</Text>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>I UNDERSTAND</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  warningIconWrapper: {
    backgroundColor: "#FEF3C7",
  },
  bannedIconWrapper: {
    backgroundColor: "#FEE2E2",
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 10,
  },
  bannedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#D93025",
    textAlign: "center",
    marginBottom: 8,
  },
  warningBanner: {
    width: "100%",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  warningPill: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  warningPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  warningsLeftText: {
    color: "#92400E",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  boldText: {
    fontWeight: "800",
    color: "#78350F",
  },
  bannedBadge: {
    backgroundColor: "#D93025",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  bannedBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  description: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 12,
  },
  reasonBox: {
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 17,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#5F9C76",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  bannedButton: {
    backgroundColor: "#D93025",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
