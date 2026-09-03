import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { normalizePurok } from "../../constants/locationFormat";
import { db } from "../../firebaseConfig";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_COLORS = ["#599A74", "#E69B45", "#5B8DEF", "#C76DBA", "#D85B5B"];
const SCHEDULES_PER_PAGE = 10;

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isSameDate = (first, second) =>
  Boolean(first && second) &&
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const formatDateKey = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const normalizeLocationPart = (value = "") => value.trim().toLowerCase();

const isDuplicateDateLocation = (
  operation,
  barangay,
  purok,
  selectedDateKey,
  excludedOperationId,
) => {
  if (operation.id === excludedOperationId) return false;

  const sameBarangay =
    normalizeLocationPart(operation.barangay) ===
    normalizeLocationPart(barangay);
  const samePurok =
    normalizeLocationPart(normalizePurok(operation.purok)) ===
    normalizeLocationPart(purok);
  const occursOnSelectedDate = (operation.scheduledDateKeys || []).includes(
    selectedDateKey,
  );

  return sameBarangay && samePurok && occursOnSelectedDate;
};

const getMatchingWeekdaysInMonth = (date) => {
  const dates = [];
  const cursor = new Date(date.getFullYear(), date.getMonth(), 1);

  while (cursor.getMonth() === date.getMonth()) {
    if (cursor.getDay() === date.getDay()) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const getCalendarDays = (month) => {
  const firstDay = startOfMonth(month);
  const calendarStart = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    1 - firstDay.getDay(),
  );

  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        calendarStart.getFullYear(),
        calendarStart.getMonth(),
        calendarStart.getDate() + index,
      ),
  );
};

export default function PickupSchedule() {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(null);
  const [operations, setOperations] = useState([]);
  const [loadingMoreOperations, setLoadingMoreOperations] = useState(false);
  const [hasMoreOperations, setHasMoreOperations] = useState(true);
  const lastOperationRef = useRef(null);
  const hasMoreOperationsRef = useRef(true);
  const loadingOperationsRef = useRef(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [operationName, setOperationName] = useState("Waste Collection");
  const [barangay, setBarangay] = useState("");
  const [purok, setPurok] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [recurrence, setRecurrence] = useState("once");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingOperationId, setEditingOperationId] = useState(null);
  const [operationPendingDelete, setOperationPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const calendarDays = getCalendarDays(visibleMonth);
  const selectedDateOperations = selectedDate
    ? operations.filter((operation) =>
        (operation.scheduledDateKeys || []).includes(
          formatDateKey(selectedDate),
        ),
      )
    : [];

  const resetForm = () => {
    setOperationName("Waste Collection");
    setBarangay("");
    setPurok("");
    setPickupTime("");
    setInstructions("");
    setRecurrence("once");
    setEditingOperationId(null);
    setFormError("");
  };

  const openAddModal = () => {
    resetForm();
    setShowScheduleModal(true);
  };

  const openEditModal = (operation) => {
    setOperationName(operation.title || "Waste Collection");
    setBarangay(operation.barangay || "");
    setPurok(operation.purok || "");
    setPickupTime(operation.time || "");
    setInstructions(operation.message || "");
    setRecurrence(operation.recurrence || "once");
    setEditingOperationId(operation.id);
    setFormError("");
    setShowScheduleModal(true);
  };

  const loadOperations = useCallback(async (reset = true) => {
    if (
      loadingOperationsRef.current ||
      (!reset && !hasMoreOperationsRef.current)
    ) {
      return;
    }

    loadingOperationsRef.current = true;
    setLoadingMoreOperations(true);

    try {
      const constraints = [
        orderBy("createdAt", "desc"),
        limit(SCHEDULES_PER_PAGE),
      ];
      if (!reset && lastOperationRef.current) {
        constraints.splice(1, 0, startAfter(lastOperationRef.current));
      }

      const snapshot = await getDocs(
        query(collection(db, "announcements"), ...constraints),
      );
      const nextOperations = snapshot.docs.map((operation) => ({
        id: operation.id,
        ...operation.data(),
      }));

      setOperations((currentOperations) =>
        reset ? nextOperations : [...currentOperations, ...nextOperations],
      );
      lastOperationRef.current =
        snapshot.docs[snapshot.docs.length - 1] || null;
      hasMoreOperationsRef.current =
        snapshot.docs.length === SCHEDULES_PER_PAGE;
      setHasMoreOperations(hasMoreOperationsRef.current);
    } catch (error) {
      console.log("Unable to load scheduled operations:", error);
    } finally {
      loadingOperationsRef.current = false;
      setLoadingMoreOperations(false);
    }
  }, []);

  useEffect(() => {
    loadOperations(true);
  }, [loadOperations]);

  const changeMonth = (amount) => {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  };

  const selectToday = () => {
    const currentDate = new Date();
    setVisibleMonth(startOfMonth(currentDate));
    setSelectedDate(currentDate);
  };

  const saveOperation = async () => {
    if (!selectedDate || saving) return;

    setFormError("");
    const normalizedPurok = normalizePurok(purok);
    if (
      !operationName.trim() ||
      !barangay.trim() ||
      !normalizedPurok ||
      !pickupTime.trim()
    ) {
      setFormError("Add the operation name, Barangay, Purok, and pickup time.");
      return;
    }

    const scheduledDates =
      recurrence === "monthly"
        ? getMatchingWeekdaysInMonth(selectedDate)
        : [selectedDate];
    const weekday = selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
    });
    const month = selectedDate.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const selectedDateKey = formatDateKey(selectedDate);
    const schedule =
      recurrence === "monthly"
        ? `Every ${weekday} in ${month}, ${pickupTime.trim()}`
        : `${selectedDate.toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}, ${pickupTime.trim()}`;

    try {
      setSaving(true);
      const freshSnapshot = await getDocs(collection(db, "announcements"));
      const duplicateExists = freshSnapshot.docs.some((operationDocument) =>
        isDuplicateDateLocation(
          { id: operationDocument.id, ...operationDocument.data() },
          barangay,
          normalizedPurok,
          selectedDateKey,
          editingOperationId,
        ),
      );

      if (duplicateExists) {
        setFormError(
          "A schedule for this Barangay and Purok already exists on this date.",
        );
        return;
      }

      const operationData = {
        title: operationName.trim(),
        barangay: barangay.trim(),
        normalizedBarangay: normalizeLocationPart(barangay),
        purok: normalizedPurok,
        normalizedPurok: normalizeLocationPart(normalizedPurok),
        area: `${barangay.trim()}, Pk. ${normalizedPurok}`,
        time: pickupTime.trim(),
        message: instructions.trim(),
        recurrence,
        schedule,
        scheduledDateKeys: scheduledDates.map(formatDateKey),
      };

      if (editingOperationId) {
        await updateDoc(doc(db, "announcements", editingOperationId), {
          ...operationData,
          updatedAt: serverTimestamp(),
        });
        setOperations((current) =>
          current.map((operation) =>
            operation.id === editingOperationId
              ? { ...operation, ...operationData, updatedAt: new Date() }
              : operation,
          ),
        );
      } else {
        const savedOperation = await addDoc(collection(db, "announcements"), {
          ...operationData,
          createdAt: serverTimestamp(),
        });
        setOperations((current) => [
          {
            id: savedOperation.id,
            ...operationData,
            createdAt: new Date(),
          },
          ...current,
        ]);
      }

      setShowScheduleModal(false);
      resetForm();
    } catch (error) {
      const message = error?.message || "Please try again.";
      console.error("Could not save schedule:", error);
      setFormError(`Could not save schedule: ${message}`);
      Alert.alert("Could not save schedule", message);
    } finally {
      setSaving(false);
    }
  };

  const deleteOperation = async () => {
    if (!operationPendingDelete || deleting) return;

    try {
      setDeleting(true);
      await deleteDoc(doc(db, "announcements", operationPendingDelete.id));
      setOperations((current) =>
        current.filter(
          (operation) => operation.id !== operationPendingDelete.id,
        ),
      );
      setOperationPendingDelete(null);
    } catch (error) {
      Alert.alert(
        "Could not delete schedule",
        error?.message || "Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const selectDate = (date) => {
    setSelectedDate(date);
    if (date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(startOfMonth(date));
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Scheduled Date</Text>
      <Text style={styles.subheading}>
        Select a date to view or add a collection schedule.
      </Text>

      <View style={styles.calendarCard}>
        <View style={styles.calendarToolbar}>
          <View>
            <Text style={styles.monthTitle}>
              {visibleMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Text style={styles.monthHint}>Collection schedule calendar</Text>
          </View>

          <View style={styles.calendarControls}>
            <TouchableOpacity style={styles.todayButton} onPress={selectToday}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => changeMonth(-1)}
              accessibilityLabel="Previous month"
            >
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => changeMonth(1)}
              accessibilityLabel="Next month"
            >
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEK_DAYS.map((day) => (
            <View key={day} style={styles.weekCell}>
              <Text style={styles.weekText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((date) => {
            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
            const isToday = isSameDate(date, today);
            const isSelected = isSameDate(date, selectedDate);
            const dateOperations = operations.filter((operation) =>
              (operation.scheduledDateKeys || []).includes(formatDateKey(date)),
            );

            return (
              <TouchableOpacity
                key={date.toISOString()}
                style={[
                  styles.dayCell,
                  !isCurrentMonth && styles.outsideMonthCell,
                  isSelected && styles.selectedDayCell,
                ]}
                activeOpacity={0.7}
                onPress={() => selectDate(date)}
              >
                <View
                  style={[
                    styles.dayNumberCircle,
                    isToday && styles.todayCircle,
                    isSelected && styles.selectedDayCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !isCurrentMonth && styles.outsideMonthText,
                      isToday && styles.todayText,
                      isSelected && styles.selectedDayText,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                {dateOperations.length > 0 && dateOperations.length <= 2 && (
                  <View style={styles.operationLabels}>
                    {dateOperations.map((operation, index) => (
                      <View
                        key={operation.id}
                        style={styles.operationMarkerRow}
                      >
                        <View
                          style={[
                            styles.operationDot,
                            { backgroundColor: EVENT_COLORS[index] },
                          ]}
                        />
                        <Text
                          style={styles.operationMarkerText}
                          numberOfLines={1}
                        >
                          {operation.barangay || operation.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {dateOperations.length > 2 && (
                  <View style={styles.compactDotRow}>
                    {dateOperations.slice(0, 5).map((operation, index) => (
                      <View
                        key={operation.id}
                        style={[
                          styles.compactOperationDot,
                          { backgroundColor: EVENT_COLORS[index] },
                        ]}
                      />
                    ))}
                    {dateOperations.length > 5 && (
                      <Text style={styles.operationCount}>
                        +{dateOperations.length - 5}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedDate ? (
        <View style={styles.selectedSection}>
          <View style={styles.selectedDateCard}>
            <View style={styles.selectedDateIcon}>
              <Text style={styles.selectedDateDay}>
                {selectedDate.getDate()}
              </Text>
            </View>
            <View style={styles.selectedDateDetails}>
              <Text style={styles.selectedDateLabel}>Selected date</Text>
              <Text style={styles.selectedDateValue}>
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <Text style={styles.selectedDateHint}>
                {selectedDateOperations.length
                  ? `${selectedDateOperations.length} scheduled operation${selectedDateOperations.length === 1 ? "" : "s"}`
                  : "Add a waste collection operation for this date."}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addScheduleButton}
              onPress={openAddModal}
              accessibilityLabel="Add scheduled operation"
            >
              <Text style={styles.addScheduleIcon}>+</Text>
            </TouchableOpacity>
          </View>

          {selectedDateOperations.map((operation) => (
            <View key={operation.id} style={styles.savedScheduleCard}>
              <View style={styles.savedScheduleDetails}>
                <View style={styles.savedScheduleHeader}>
                  <Text style={styles.savedScheduleTitle}>
                    {operation.title}
                  </Text>
                  <Text style={styles.recurrenceBadge}>
                    {operation.recurrence === "monthly"
                      ? "Monthly repeat"
                      : "One-time"}
                  </Text>
                </View>
                <Text style={styles.savedScheduleArea}>
                  {operation.area ||
                    `${operation.barangay || "Unknown Barangay"}, Pk. ${operation.purok || "-"}`}
                </Text>
                <Text style={styles.savedScheduleTime}>
                  {operation.time || operation.schedule}
                </Text>
                {Boolean(operation.message) && (
                  <Text style={styles.savedScheduleMessage}>
                    {operation.message}
                  </Text>
                )}
              </View>
              <View style={styles.savedScheduleActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(operation)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => setOperationPendingDelete(operation)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {hasMoreOperations && !loadingMoreOperations && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => loadOperations(false)}
            >
              <Text style={styles.loadMoreText}>Load more schedules</Text>
            </TouchableOpacity>
          )}
          {loadingMoreOperations && (
            <ActivityIndicator
              color="#5F9C76"
              style={styles.loadMoreIndicator}
            />
          )}
        </View>
      ) : (
        <View style={styles.selectionPrompt}>
          <Text style={styles.selectionPromptTitle}>
            Select a calendar date
          </Text>
          <Text style={styles.selectionPromptText}>
            A plus button will appear here so you can add a scheduled operation.
          </Text>
        </View>
      )}

      <Modal
        visible={showScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingOperationId
                      ? "Edit scheduled operation"
                      : "Add scheduled operation"}
                  </Text>
                  <Text style={styles.modalDate}>
                    {selectedDate?.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowScheduleModal(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Operation name</Text>
              <TextInput
                style={styles.input}
                value={operationName}
                onChangeText={setOperationName}
                placeholder="Example: Waste Collection"
              />

              <View style={styles.locationFields}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Barangay</Text>
                  <TextInput
                    style={styles.input}
                    value={barangay}
                    onChangeText={setBarangay}
                    placeholder="Example: Tajao"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Purok</Text>
                  <View style={styles.purokInputRow}>
                    <Text style={styles.purokPrefix}>Pk.</Text>
                    <TextInput
                      style={styles.purokInput}
                      value={purok}
                      onChangeText={setPurok}
                      placeholder="Example: 3"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Pickup time</Text>
              <TextInput
                style={styles.input}
                value={pickupTime}
                onChangeText={setPickupTime}
                placeholder="Example: 7:00 AM"
              />

              <Text style={styles.fieldLabel}>Repeat</Text>
              <View style={styles.recurrenceRow}>
                <TouchableOpacity
                  style={[
                    styles.recurrenceOption,
                    recurrence === "once" && styles.recurrenceOptionSelected,
                  ]}
                  onPress={() => setRecurrence("once")}
                >
                  <Text
                    style={[
                      styles.recurrenceTitle,
                      recurrence === "once" && styles.recurrenceTextSelected,
                    ]}
                  >
                    Set only this date
                  </Text>
                  <Text style={styles.recurrenceDescription}>
                    One-time pickup
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.recurrenceOption,
                    recurrence === "monthly" && styles.recurrenceOptionSelected,
                  ]}
                  onPress={() => setRecurrence("monthly")}
                >
                  <Text
                    style={[
                      styles.recurrenceTitle,
                      recurrence === "monthly" && styles.recurrenceTextSelected,
                    ]}
                  >
                    Every{" "}
                    {selectedDate?.toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </Text>
                  <Text style={styles.recurrenceDescription}>
                    For the selected month
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Additional instructions</Text>
              <TextInput
                style={[styles.input, styles.instructionsInput]}
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Optional notes for residents"
                multiline
              />

              {Boolean(formError) && (
                <View style={styles.formErrorBox}>
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowScheduleModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={saveOperation}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingOperationId ? "Save changes" : "Save schedule"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(operationPendingDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setOperationPendingDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Delete schedule?</Text>
            <Text style={styles.deleteModalMessage}>
              {operationPendingDelete?.recurrence === "monthly"
                ? "This removes the recurring operation from every matching date in the month."
                : "This removes the operation from the selected date."}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setOperationPendingDelete(null)}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  deleting && styles.disabledButton,
                ]}
                onPress={deleteOperation}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete schedule</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    color: "#599A74",
    fontSize: 32,
    fontWeight: "800",
  },
  subheading: {
    color: "#64748B",
    fontSize: 15,
    marginTop: 6,
    marginBottom: 22,
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  calendarToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  monthTitle: {
    color: "#234B33",
    fontSize: 22,
    fontWeight: "800",
  },
  monthHint: {
    color: "#7A8A80",
    fontSize: 12,
    marginTop: 3,
  },
  calendarControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayButton: {
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CFE0D5",
    backgroundColor: "#F7FBF8",
  },
  todayButtonText: {
    color: "#397A51",
    fontWeight: "700",
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#599A74",
  },
  arrowText: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 27,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
    backgroundColor: "#EDF5F0",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  weekCell: {
    width: "14.285714%",
    alignItems: "center",
    paddingVertical: 11,
  },
  weekText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: "#E5ECE8",
  },
  dayCell: {
    width: "14.285714%",
    minHeight: 78,
    padding: 9,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5ECE8",
    backgroundColor: "#FFFFFF",
  },
  outsideMonthCell: {
    backgroundColor: "#FAFCFB",
  },
  selectedDayCell: {
    backgroundColor: "#EDF7F0",
  },
  dayNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCircle: {
    borderWidth: 1,
    borderColor: "#599A74",
  },
  selectedDayCircle: {
    backgroundColor: "#599A74",
    borderColor: "#599A74",
  },
  dayNumber: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  outsideMonthText: {
    color: "#B0BBB4",
  },
  todayText: {
    color: "#397A51",
  },
  selectedDayText: {
    color: "#FFFFFF",
  },
  operationMarkerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  operationLabels: {
    marginTop: 7,
    gap: 3,
  },
  operationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  operationMarkerText: {
    flex: 1,
    color: "#397A51",
    fontSize: 10,
    fontWeight: "700",
  },
  operationCount: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
  },
  compactDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  compactOperationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  selectedSection: {
    marginTop: 18,
    gap: 10,
  },
  selectedDateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  selectedDateIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#599A74",
    marginRight: 14,
  },
  selectedDateDay: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
  },
  selectedDateDetails: {
    flex: 1,
  },
  selectedDateLabel: {
    color: "#599A74",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  selectedDateValue: {
    color: "#234B33",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  selectedDateHint: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
  },
  addScheduleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#599A74",
    marginLeft: 16,
  },
  addScheduleIcon: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
  },
  savedScheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  savedScheduleDetails: {
    flex: 1,
  },
  savedScheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savedScheduleTitle: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
  },
  recurrenceBadge: {
    color: "#397A51",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "#EDF7F0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savedScheduleArea: {
    color: "#52675A",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  savedScheduleTime: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
  },
  savedScheduleMessage: {
    color: "#7A8A80",
    fontSize: 12,
    marginTop: 4,
  },
  savedScheduleActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 16,
  },
  editButton: {
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#EDF7F0",
  },
  editButtonText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
  },
  deleteButton: {
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FEF2F2",
  },
  deleteButtonText: {
    color: "#C24141",
    fontSize: 12,
    fontWeight: "800",
  },
  loadMoreButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  loadMoreText: {
    color: "#599A74",
    fontWeight: "700",
  },
  loadMoreIndicator: {
    paddingVertical: 12,
  },
  selectionPrompt: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    alignItems: "center",
  },
  selectionPromptTitle: {
    color: "#234B33",
    fontSize: 16,
    fontWeight: "800",
  },
  selectionPromptText: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "92%",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  modalContent: {
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#234B33",
    fontSize: 21,
    fontWeight: "800",
  },
  modalDate: {
    color: "#599A74",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F2",
  },
  closeButtonText: {
    color: "#52675A",
    fontSize: 23,
    lineHeight: 25,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#FAFCFB",
    marginBottom: 14,
  },
  locationFields: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  purokInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 8,
    backgroundColor: "#FAFCFB",
    marginBottom: 14,
  },
  purokPrefix: {
    color: "#334155",
    fontWeight: "700",
    paddingLeft: 12,
  },
  purokInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1F2937",
  },
  recurrenceRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  recurrenceOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FAFCFB",
  },
  recurrenceOptionSelected: {
    borderColor: "#599A74",
    backgroundColor: "#EDF7F0",
  },
  recurrenceTitle: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  recurrenceTextSelected: {
    color: "#397A51",
  },
  recurrenceDescription: {
    color: "#7A8A80",
    fontSize: 11,
    marginTop: 3,
  },
  instructionsInput: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  formErrorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  formErrorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 2,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8E2DC",
  },
  cancelButtonText: {
    color: "#52675A",
    fontWeight: "700",
  },
  saveButton: {
    minWidth: 145,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#599A74",
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 22,
    backgroundColor: "#FFFFFF",
  },
  deleteModalTitle: {
    color: "#7F1D1D",
    fontSize: 20,
    fontWeight: "800",
  },
  deleteModalMessage: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  confirmDeleteButton: {
    minWidth: 150,
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#DC4C4C",
  },
  confirmDeleteText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
