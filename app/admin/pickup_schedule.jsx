import { Ionicons } from "@expo/vector-icons";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { normalizePurok } from "../../constants/locationFormat";
import { BARANGAYS } from "../../constants/barangays";
import { db } from "../../firebaseConfig";
import {
  formatPickupScheduleDate,
  getPickupRecurrenceLabel,
  hasUpcomingPickupDate,
} from "../../utils/formatPickupScheduleDate";

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
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const pagePadding = width < 768 ? 12 : width < 1024 ? 16 : 20;
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleSelectedDateCount, setVisibleSelectedDateCount] = useState(5);
  const [operations, setOperations] = useState([]);
  const [loadingMoreOperations, setLoadingMoreOperations] = useState(false);
  const [hasMoreOperations, setHasMoreOperations] = useState(true);
  const lastOperationRef = useRef(null);
  const hasMoreOperationsRef = useRef(true);
  const loadingOperationsRef = useRef(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [operationName, setOperationName] = useState("Waste Collection");
  const [barangay, setBarangay] = useState("");
  const [barangayDropdownOpen, setBarangayDropdownOpen] = useState(false);
  const [purok, setPurok] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [recurrence, setRecurrence] = useState("once");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingOperationId, setEditingOperationId] = useState(null);
  const [operationPendingDelete, setOperationPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [visibleAllCount, setVisibleAllCount] = useState(5);
  const [announcementBarangayFilter, setAnnouncementBarangayFilter] =
    useState("");
  const [purokSortOrder, setPurokSortOrder] = useState("asc");
  const calendarDays = getCalendarDays(visibleMonth);
  const upcomingAnnouncements = useMemo(
    () => operations.filter((operation) => hasUpcomingPickupDate(operation)),
    [operations],
  );
  const filteredAnnouncements = useMemo(() => {
    const filtered = upcomingAnnouncements.filter(
      (operation) =>
        !announcementBarangayFilter ||
        operation.barangay?.trim().toLocaleLowerCase() ===
          announcementBarangayFilter.toLocaleLowerCase(),
    );

    return filtered.sort((first, second) => {
      const comparison = String(first.purok || "").localeCompare(
        String(second.purok || ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
      return purokSortOrder === "asc" ? comparison : -comparison;
    });
  }, [upcomingAnnouncements, announcementBarangayFilter, purokSortOrder]);
  const selectedDateOperations = selectedDate
    ? operations.filter((operation) =>
        (operation.scheduledDateKeys || []).includes(
          formatDateKey(selectedDate),
        ),
      )
    : [];
  const matchingBarangays = BARANGAYS.filter((name) =>
    name.toLowerCase().includes(barangay.trim().toLowerCase()),
  );

  const resetForm = () => {
    setOperationName("Waste Collection");
    setBarangay("");
    setBarangayDropdownOpen(false);
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
    setBarangayDropdownOpen(false);
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
    setVisibleSelectedDateCount(5);
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
    setVisibleSelectedDateCount(5);
    if (date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(startOfMonth(date));
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { padding: pagePadding }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Scheduled Date</Text>
      <Text style={styles.subheading}>
        Select a date to view or add a collection schedule.
      </Text>

      <View style={[styles.calendarCard, isMobile && styles.calendarCardMobile]}>
        <View
          style={[
            styles.calendarToolbar,
            isMobile && styles.calendarToolbarMobile,
          ]}
        >
          <View>
            <Text
              style={[
                styles.monthTitle,
                isMobile && styles.monthTitleMobile,
              ]}
            >
              {visibleMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Text
              style={styles.monthHint}
              numberOfLines={isMobile ? 2 : 1}
            >
              Collection schedule calendar
            </Text>
          </View>

          <View
            style={[
              styles.calendarControls,
              isMobile && styles.calendarControlsMobile,
            ]}
          >
            <TouchableOpacity style={styles.todayButton} onPress={selectToday}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => changeMonth(-1)}
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => changeMonth(1)}
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEK_DAYS.map((day) => (
            <View
              key={day}
              style={[styles.weekCell, isMobile && styles.weekCellMobile]}
            >
              <Text style={[styles.weekText, isMobile && styles.weekTextMobile]}>
                {day}
              </Text>
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
                  isMobile && styles.dayCellMobile,
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
                {!isMobile &&
                  dateOperations.length > 0 &&
                  dateOperations.length <= 2 && (
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
                {isMobile && dateOperations.length > 0 && (
                  <View style={styles.compactDotRowMobile}>
                    {dateOperations.slice(0, 3).map((operation, index) => (
                      <View
                        key={operation.id}
                        style={[
                          styles.compactOperationDot,
                          {
                            backgroundColor:
                              EVENT_COLORS[index % EVENT_COLORS.length],
                          },
                        ]}
                      />
                    ))}
                    {dateOperations.length > 3 && (
                      <Text style={styles.operationCountMobile}>
                        +{dateOperations.length - 3}
                      </Text>
                    )}
                  </View>
                )}
                {!isMobile && dateOperations.length > 2 && (
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

      {/* All Announcements Panel */}
      <View style={styles.allAnnouncementsSection}>
        <View style={styles.allAnnouncementsHeader}>
          <View>
            <Text style={styles.allAnnouncementsTitle}>All Announcements</Text>
            <Text style={styles.allAnnouncementsSubtitle}>
              {filteredAnnouncements.length} upcoming announcement
              {filteredAnnouncements.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.toggleAllButton}
            onPress={() => {
              setShowAllAnnouncements((v) => {
                if (v) setVisibleAllCount(5); // reset batch on close
                return !v;
              });
            }}
          >
            <Text style={styles.toggleAllButtonText}>
              {showAllAnnouncements ? "Hide" : "View All"}
            </Text>
          </TouchableOpacity>
        </View>

        {showAllAnnouncements && (
          <ScrollView
            style={styles.allAnnouncementsList}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.announcementFilterSection}>
              <Text style={styles.announcementFilterLabel}>
                Filter by Barangay
              </Text>
              <View style={styles.barangayFilterList}>
                {["", ...BARANGAYS].map((name) => {
                  const isSelected = announcementBarangayFilter === name;
                  return (
                    <TouchableOpacity
                      key={name || "all-barangays"}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.barangayFilterChip,
                        isSelected && styles.barangayFilterChipSelected,
                      ]}
                      onPress={() => {
                        setAnnouncementBarangayFilter(name);
                        setVisibleAllCount(5);
                      }}
                    >
                      <Text
                        style={[
                          styles.barangayFilterChipText,
                          isSelected && styles.barangayFilterChipTextSelected,
                        ]}
                      >
                        {name || "All Barangays"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.purokSortRow}>
                <Text style={styles.announcementFilterLabel}>Sort by Purok</Text>
                {["asc", "desc"].map((order) => {
                  const isSelected = purokSortOrder === order;
                  return (
                    <TouchableOpacity
                      key={order}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.sortOrderButton,
                        isSelected && styles.sortOrderButtonSelected,
                      ]}
                      onPress={() => {
                        setPurokSortOrder(order);
                        setVisibleAllCount(5);
                      }}
                    >
                      <Ionicons
                        name={order === "asc" ? "arrow-up" : "arrow-down"}
                        size={13}
                        color={isSelected ? "#FFFFFF" : "#397A51"}
                      />
                      <Text
                        style={[
                          styles.sortOrderButtonText,
                          isSelected && styles.sortOrderButtonTextSelected,
                        ]}
                      >
                        {order === "asc" ? "Ascending" : "Descending"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {operations.length === 0 ? (
              <Text style={styles.noAnnouncementsText}>
                No announcements found.
              </Text>
            ) : filteredAnnouncements.length === 0 ? (
              <>
                <Text style={styles.noAnnouncementsText}>
                  {upcomingAnnouncements.length === 0
                    ? "No upcoming announcements found."
                    : "No upcoming announcements found for this barangay."}
                </Text>
                {hasMoreOperations && !loadingMoreOperations && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => loadOperations(false)}
                  >
                    <Text style={styles.loadMoreText}>
                      Load more from server
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {filteredAnnouncements
                  .slice(0, visibleAllCount)
                  .map((operation) => {
                  const recurrenceLabel =
                    getPickupRecurrenceLabel(operation);
                  return (
                    <View
                      key={operation.id}
                      style={styles.allAnnouncementCard}
                    >
                      <View style={styles.allAnnouncementTopRow}>
                        <View style={styles.allAnnouncementTitleRow}>
                          <Text style={styles.allAnnouncementItemTitle}>
                            {operation.title || "Waste Collection"}
                          </Text>
                          <View style={styles.announcementBadges}>
                            <View
                              style={[
                                styles.statusBadge,
                                styles.statusBadgeActive,
                              ]}
                            >
                              <Text style={styles.statusBadgeText}>
                                Upcoming
                              </Text>
                            </View>
                            {Boolean(recurrenceLabel) && (
                              <View style={styles.recurrenceDayBadge}>
                                <Text style={styles.recurrenceDayBadgeText}>
                                  {recurrenceLabel}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <View style={styles.allAnnouncementActions}>
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

                      <Text style={styles.allAnnouncementArea}>
                        {operation.area ||
                          `${operation.barangay || ""}, Pk. ${operation.purok || "-"}`}
                      </Text>
                      <Text style={styles.allAnnouncementSchedule}>
                        {operation.schedule}
                        {operation.time &&
                        !operation.schedule?.includes(operation.time)
                          ? ` · ${operation.time}`
                          : ""}
                      </Text>
                      {Boolean(operation.message) && (
                        <Text style={styles.allAnnouncementMessage}>
                          {operation.message}
                        </Text>
                      )}
                      <Text style={styles.allAnnouncementDates}>
                        Pickup: {formatPickupScheduleDate(operation)}
                      </Text>
                    </View>
                  );
                })}

                {/* Batch load-more / load-from-Firestore */}
                {visibleAllCount < filteredAnnouncements.length ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() =>
                      setVisibleAllCount((n) =>
                        Math.min(n + 5, filteredAnnouncements.length),
                      )
                    }
                  >
                    <Text style={styles.loadMoreText}>
                      Show{" "}
                      {Math.min(
                        5,
                        filteredAnnouncements.length - visibleAllCount,
                      )}{" "}
                      more
                    </Text>
                  </TouchableOpacity>
                ) : hasMoreOperations && !loadingMoreOperations ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => loadOperations(false)}
                  >
                    <Text style={styles.loadMoreText}>
                      Load more from server
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {loadingMoreOperations && (
                  <ActivityIndicator
                    color="#5F9C76"
                    style={styles.loadMoreIndicator}
                  />
                )}
              </>
            )}
          </ScrollView>
        )}
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
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {selectedDateOperations
            .slice(0, visibleSelectedDateCount)
            .map((operation) => (
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
          {visibleSelectedDateCount < selectedDateOperations.length && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() =>
                setVisibleSelectedDateCount((count) =>
                  Math.min(count + 5, selectedDateOperations.length),
                )
              }
            >
              <Text style={styles.loadMoreText}>
                Show{" "}
                {Math.min(
                  5,
                  selectedDateOperations.length - visibleSelectedDateCount,
                )}{" "}
                more for this date
              </Text>
            </TouchableOpacity>
          )}
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
                  <Ionicons name="close" size={20} color="#52675A" />
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
                <View style={[styles.halfField, styles.barangayHalfField]}>
                  <Text style={styles.fieldLabel}>Barangay</Text>
                  <View style={styles.barangayField}>
                    <TextInput
                      style={styles.input}
                      value={barangay}
                      onFocus={() => setBarangayDropdownOpen(true)}
                      onChangeText={(value) => {
                        setBarangay(value);
                        setBarangayDropdownOpen(true);
                      }}
                      placeholder="Example: Tajao"
                    />
                    {barangayDropdownOpen && (
                      <ScrollView
                        style={styles.barangayDropdown}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {matchingBarangays.map((name) => (
                          <TouchableOpacity
                            key={name}
                            style={styles.barangayOption}
                            onPress={() => {
                              setBarangay(name);
                              setBarangayDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.barangayOptionText}>
                              {name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {matchingBarangays.length === 0 && (
                          <Text style={styles.noBarangayMatch}>
                            No matching barangay. You can keep typing.
                          </Text>
                        )}
                      </ScrollView>
                    )}
                  </View>
                </View>
                <View style={[styles.halfField, styles.purokHalfField]}>
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
  calendarCardMobile: {
    padding: 10,
  },
  calendarToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  calendarToolbarMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 12,
  },
  monthTitle: {
    color: "#234B33",
    fontSize: 22,
    fontWeight: "800",
  },
  monthTitleMobile: {
    fontSize: 20,
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
  calendarControlsMobile: {
    alignSelf: "flex-end",
    gap: 6,
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
    fontSize: 16,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "700",
    includeFontPadding: false,
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
  weekCellMobile: {
    paddingVertical: 8,
  },
  weekText: {
    color: "#397A51",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  weekTextMobile: {
    fontSize: 10,
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
  dayCellMobile: {
    minHeight: 58,
    padding: 3,
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
    alignSelf: "center",
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
    lineHeight: 13,
    fontWeight: "700",
    includeFontPadding: false,
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
  compactDotRowMobile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 4,
  },
  operationCountMobile: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "800",
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
    fontSize: 26,
    lineHeight: 26,
    textAlign: "center",
    includeFontPadding: false,
    fontWeight: "400",
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
  recurrenceDayBadge: {
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
    alignItems: "center",
    gap: 8,
    marginLeft: 16,
    flexShrink: 0,
  },
  editButton: {
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#EDF7F0",
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 18,
    lineHeight: 18,
    textAlign: "center",
    includeFontPadding: false,
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
    outlineStyle: "none",
  },
  locationFields: {
    flexDirection: "row",
    gap: 12,
    position: "relative",
    zIndex: 4,
  },
  halfField: {
    flex: 1,
  },
  barangayField: {
    position: "relative",
    zIndex: 2,
  },
  barangayHalfField: {
    zIndex: 5,
  },
  purokHalfField: {
    zIndex: 1,
  },
  barangayDropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    maxHeight: 170,
    borderWidth: 1,
    borderColor: "#D8E2DC",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    elevation: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    zIndex: 3,
  },
  barangayOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F0",
  },
  barangayOptionText: {
    color: "#1F2937",
    fontSize: 14,
  },
  noBarangayMatch: {
    color: "#7A8A80",
    fontSize: 12,
    padding: 12,
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
    borderWidth: 0,
    outlineStyle: "none",
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
    outlineStyle: "none",
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

  /* All Announcements Panel */
  allAnnouncementsSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  allAnnouncementsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  allAnnouncementsTitle: {
    color: "#234B33",
    fontSize: 20,
    fontWeight: "800",
  },
  allAnnouncementsSubtitle: {
    color: "#7A8A80",
    fontSize: 12,
    marginTop: 2,
  },
  toggleAllButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#599A74",
  },
  toggleAllButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  allAnnouncementsList: {
    height: 340,
    borderWidth: 1,
    borderColor: "#E3EBE6",
    borderRadius: 12,
    backgroundColor: "#FAFCFB",
    padding: 10,
  },
  announcementFilterSection: {
    gap: 8,
    marginBottom: 12,
  },
  announcementFilterLabel: {
    color: "#52675A",
    fontSize: 12,
    fontWeight: "700",
  },
  barangayFilterList: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  barangayFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  barangayFilterChipSelected: {
    borderColor: "#397A51",
    backgroundColor: "#397A51",
  },
  barangayFilterChipText: {
    color: "#52675A",
    fontSize: 11,
    fontWeight: "600",
  },
  barangayFilterChipTextSelected: {
    color: "#FFFFFF",
  },
  purokSortRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  sortOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  sortOrderButtonSelected: {
    borderColor: "#397A51",
    backgroundColor: "#397A51",
  },
  sortOrderButtonText: {
    color: "#397A51",
    fontSize: 11,
    fontWeight: "700",
  },
  sortOrderButtonTextSelected: {
    color: "#FFFFFF",
  },
  noAnnouncementsText: {
    color: "#7A8A80",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 12,
  },
  allAnnouncementCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D8E6DC",
    gap: 4,
    marginBottom: 10,
  },
  allAnnouncementCardPast: {
    backgroundColor: "#F8F8F8",
    borderColor: "#E0E0E0",
    opacity: 0.8,
  },
  allAnnouncementTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  allAnnouncementTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  announcementBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  allAnnouncementItemTitle: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
  },
  allAnnouncementItemTitlePast: {
    color: "#9E9E9E",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  statusBadgeActive: {
    backgroundColor: "#E7F1EA",
  },
  recurrenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "#EAF0FF",
  },
  recurrenceDayBadgeText: {
    color: "#385A9A",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadgePast: {
    backgroundColor: "#F0F0F0",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#52675A",
  },
  allAnnouncementActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  allAnnouncementArea: {
    color: "#397A51",
    fontSize: 13,
    fontWeight: "600",
  },
  allAnnouncementSchedule: {
    color: "#4A5568",
    fontSize: 12,
  },
  allAnnouncementMessage: {
    color: "#7A8A80",
    fontSize: 12,
    fontStyle: "italic",
  },
  allAnnouncementDates: {
    color: "#9E9E9E",
    fontSize: 11,
    marginTop: 2,
  },
});
