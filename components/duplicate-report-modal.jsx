import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function DuplicateReportModal({
  visible,
  mode = "warning", // 'warning' (same user) | 'notice' (different user)
  existingReport = null,
  onCancel,
  onConfirm,
  loading = false,
}) {
  const isWarning = mode === "warning";

  const reportTitle = existingReport?.title || "Existing Waste Report";
  const distance = existingReport?.distanceMeters;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityRole="alert">
          {/* ICON HEADER */}
          <View
            style={[
              styles.iconWrapper,
              isWarning ? styles.warningIconWrapper : styles.noticeIconWrapper,
            ]}
          >
            <Ionicons
              name={isWarning ? "alert-circle" : "information-circle"}
              size={40}
              color={isWarning ? "#D97706" : "#2E7D32"}
            />
          </View>

          {/* TITLE */}
          <Text style={styles.title}>
            {isWarning
              ? "Duplicate Report Warning"
              : "Nearby Active Report Found"}
          </Text>

          {/* BADGE */}
          <View
            style={[
              styles.badge,
              isWarning ? styles.warningBadge : styles.noticeBadge,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isWarning ? styles.warningBadgeText : styles.noticeBadgeText,
              ]}
            >
              {isWarning
                ? "Same Vicinity Detected"
                : distance != null
                  ? `~${distance}m away from your location`
                  : "Same Barangay & Purok"}
            </Text>
          </View>

          {/* DESCRIPTION */}
          <Text style={styles.description}>
            {isWarning
              ? `You already submitted an active report near this spot ("${reportTitle}"). Multiple submissions for the same pile are considered duplicates.`
              : `Another resident already submitted a report in this immediate vicinity ("${reportTitle}"). Your report will be linked to this cleanup site.`}
          </Text>

          {/* NOTICE BOX */}
          <View
            style={[
              styles.infoBox,
              isWarning ? styles.warningInfoBox : styles.noticeInfoBox,
            ]}
          >
            <Ionicons
              name={isWarning ? "close-circle" : "checkmark-circle"}
              size={18}
              color={isWarning ? "#DC2626" : "#16A34A"}
              style={{ marginTop: 1 }}
            />
            <Text
              style={[
                styles.infoBoxText,
                isWarning ? styles.warningInfoText : styles.noticeInfoText,
              ]}
            >
              {isWarning
                ? "You will NOT receive Eco Points for this duplicate submission."
                : "You will be awarded Eco Points once this site is verified and cleaned by the LGU."}
            </Text>
          </View>

          {/* ACTIONS */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                isWarning ? styles.warningConfirmBtn : styles.noticeConfirmBtn,
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {isWarning ? "Submit Anyway (No Pts)" : "Proceed & Link"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
    padding: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  warningIconWrapper: {
    backgroundColor: "#FEF3C7",
  },
  noticeIconWrapper: {
    backgroundColor: "#E8F5E9",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  warningBadge: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  noticeBadge: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  warningBadgeText: {
    color: "#B45309",
  },
  noticeBadgeText: {
    color: "#15803D",
  },
  description: {
    fontSize: 13,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 14,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    width: "100%",
    marginBottom: 20,
  },
  warningInfoBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  noticeInfoBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  warningInfoText: {
    color: "#B91C1C",
  },
  noticeInfoText: {
    color: "#166534",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  confirmButton: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  warningConfirmBtn: {
    backgroundColor: "#D97706",
  },
  noticeConfirmBtn: {
    backgroundColor: "#2E7D32",
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

