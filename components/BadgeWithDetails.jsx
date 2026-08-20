import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function BadgeWithDetails({ badge, size = 20, tooltipPlacement = "below" }) {
  const [hovered, setHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const iconSize = Math.max(11, Math.round(size * 0.55));

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[
          styles.badge,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onLongPress={() => setShowModal(true)}
        delayLongPress={350}
        accessibilityLabel={`${badge.title}. Hold for badge details.`}
      >
        <Text style={[styles.icon, { fontSize: iconSize }]}>{badge.icon}</Text>
      </Pressable>

      {hovered && (
        <View
          style={[
            styles.tooltip,
            tooltipPlacement === "above" ? styles.tooltipAbove : styles.tooltipBelow,
          ]}
        >
          <Text style={styles.tooltipTitle}>{badge.title}</Text>
          {Boolean(badge.periodLabel) && (
            <Text style={styles.tooltipPeriod}>{badge.periodLabel}</Text>
          )}
          <Text style={styles.tooltipDescription}>{badge.description}</Text>
        </View>
      )}

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalIcon}>{badge.icon}</Text>
            <Text style={styles.modalTitle}>{badge.title}</Text>
            {Boolean(badge.periodLabel) && (
              <Text style={styles.modalPeriod}>{badge.periodLabel}</Text>
            )}
            <Text style={styles.modalDescription}>{badge.description}</Text>
            <Pressable style={styles.closeButton} onPress={() => setShowModal(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", zIndex: 30 },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B7DEC4",
    backgroundColor: "#F0FDF4",
  },
  icon: { textAlign: "center" },
  tooltip: {
    position: "absolute",
    zIndex: 100,
    left: -82,
    width: 190,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#25372C",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  tooltipAbove: { bottom: 28 },
  tooltipBelow: { top: 28 },
  tooltipTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  tooltipPeriod: { color: "#BDE3C8", fontSize: 11, fontWeight: "700", marginTop: 2 },
  tooltipDescription: { color: "#E7EEE9", fontSize: 10, lineHeight: 14, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15, 25, 19, 0.55)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 330,
    alignItems: "center",
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  modalIcon: { fontSize: 38 },
  modalTitle: { color: "#2F6F46", fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 8 },
  modalPeriod: { color: "#5F9C76", fontSize: 13, fontWeight: "700", marginTop: 4 },
  modalDescription: { color: "#66756B", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 10 },
  closeButton: { marginTop: 18, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 9, backgroundColor: "#5F9C76" },
  closeText: { color: "#FFFFFF", fontWeight: "700" },
});
