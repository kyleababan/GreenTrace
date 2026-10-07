import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { BARANGAYS } from "../constants/barangays";
import { db } from "../firebaseConfig";
import {
  formatPickupScheduleDate,
  getPickupRecurrenceLabel,
  hasUpcomingPickupDate,
} from "../utils/formatPickupScheduleDate";

// ---------------------------------------------------------------------------
// Constants & Date Helpers
// ---------------------------------------------------------------------------

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_COLORS = ["#599A74", "#E69B45", "#5B8DEF", "#C76DBA", "#D85B5B"];

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

export default function ScheduleCalendarModal({ visible, onClose }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [visibleSelectedDateCount, setVisibleSelectedDateCount] = useState(3);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [visibleAllCount, setVisibleAllCount] = useState(3);
  const [announcementBarangayFilter, setAnnouncementBarangayFilter] =
    useState("");
  const [purokSortOrder, setPurokSortOrder] = useState("asc");

  // Sync visibleMonth and selectedDate when modal opens
  useEffect(() => {
    if (visible) {
      const now = new Date();
      setVisibleMonth(startOfMonth(now));
      setSelectedDate(now);
      setVisibleSelectedDateCount(3);
    }
  }, [visible]);

  // Real-time listener for LGU announcements
  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    const announcementsQuery = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        const nextOps = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setOperations(nextOps);
        setLoading(false);
      },
      (error) => {
        console.warn("Unable to load collection schedules:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [visible]);

  const changeMonth = useCallback((amount) => {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }, []);

  const selectToday = useCallback(() => {
    const now = new Date();
    setVisibleMonth(startOfMonth(now));
    setSelectedDate(now);
    setVisibleSelectedDateCount(3);
  }, []);

  const calendarDays = useMemo(
    () => getCalendarDays(visibleMonth),
    [visibleMonth],
  );

  const selectedDateKey = useMemo(
    () => (selectedDate ? formatDateKey(selectedDate) : null),
    [selectedDate],
  );

  const selectedDateOperations = useMemo(() => {
    if (!selectedDateKey) return [];
    return operations.filter(
      (op) =>
        Array.isArray(op.scheduledDateKeys) &&
        op.scheduledDateKeys.includes(selectedDateKey),
    );
  }, [operations, selectedDateKey]);

  const filteredAnnouncements = useMemo(() => {
    const upcomingOperations = operations.filter((operation) =>
      hasUpcomingPickupDate(operation),
    );
    const filtered = upcomingOperations.filter(
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
  }, [operations, announcementBarangayFilter, purokSortOrder]);
  const upcomingAnnouncementCount = operations.filter((operation) =>
    hasUpcomingPickupDate(operation),
  ).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContainer, { width: isMobile ? "94%" : 720 }]}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="calendar" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.modalTitle}>LGU Scheduled Dates</Text>
                <Text style={styles.modalSubtitle}>
                  Waste collection & community cleanup schedule
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#52675A" />
            </TouchableOpacity>
          </View>

          {/* Read-Only Notice Banner */}
          <View style={styles.readOnlyNotice}>
            <Ionicons name="information-circle" size={18} color="#2A6440" />
            <Text style={styles.readOnlyNoticeText}>
              Official schedule managed by LGU administration. View-only for
              residents.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#599A74" />
              <Text style={styles.loadingText}>
                Loading collection schedules...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Calendar Card */}
              <View style={styles.calendarCard}>
                {/* Calendar Toolbar */}
                <View style={styles.calendarToolbar}>
                  <View>
                    <Text style={styles.monthTitle}>
                      {visibleMonth.toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                    <Text style={styles.monthHint}>
                      Tap a date to view pickups
                    </Text>
                  </View>

                  <View style={styles.calendarControls}>
                    <TouchableOpacity
                      style={styles.todayButton}
                      onPress={selectToday}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.todayButtonText}>Today</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.arrowButton}
                      onPress={() => changeMonth(-1)}
                      accessibilityLabel="Previous month"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.arrowButton}
                      onPress={() => changeMonth(1)}
                      accessibilityLabel="Next month"
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Weekday Row */}
                <View style={styles.weekRow}>
                  {WEEK_DAYS.map((day) => (
                    <View key={day} style={styles.weekCell}>
                      <Text style={styles.weekText}>{day}</Text>
                    </View>
                  ))}
                </View>

                {/* 42-Day Grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((date) => {
                    const isCurrentMonth =
                      date.getMonth() === visibleMonth.getMonth();
                    const isCurrentToday = isSameDate(date, today);
                    const isSelected = isSameDate(date, selectedDate);
                    const dateKey = formatDateKey(date);
                    const dayOps = operations.filter(
                      (op) =>
                        Array.isArray(op.scheduledDateKeys) &&
                        op.scheduledDateKeys.includes(dateKey),
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
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedDate(date);
                          setVisibleSelectedDateCount(3);
                        }}
                      >
                        <View
                          style={[
                            styles.dayNumberCircle,
                            isMobile && styles.dayNumberCircleMobile,
                            isCurrentToday && styles.todayCircle,
                            isSelected && styles.selectedDayCircle,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumber,
                              !isCurrentMonth && styles.outsideMonthText,
                              isCurrentToday && styles.todayText,
                              isSelected && styles.selectedDayText,
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                        </View>

                        {/* Markers for operations */}
                        {dayOps.length > 0 && dayOps.length <= 2 && (
                          <View style={styles.operationLabels}>
                            {dayOps.map((op, index) => (
                              <View
                                key={op.id || index}
                                style={styles.operationMarkerRow}
                              >
                                <View
                                  style={[
                                    styles.operationDot,
                                    {
                                      backgroundColor:
                                        EVENT_COLORS[
                                          index % EVENT_COLORS.length
                                        ],
                                    },
                                  ]}
                                />
                                {!isMobile && (
                                  <Text
                                    style={styles.operationMarkerText}
                                    numberOfLines={1}
                                  >
                                    {op.barangay || op.title}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                        {dayOps.length > 2 && (
                          <View style={styles.compactDotRow}>
                            {dayOps.slice(0, 3).map((op, index) => (
                              <View
                                key={op.id || index}
                                style={[
                                  styles.compactOperationDot,
                                  {
                                    backgroundColor:
                                      EVENT_COLORS[index % EVENT_COLORS.length],
                                  },
                                ]}
                              />
                            ))}
                            {dayOps.length > 3 && (
                              <Text style={styles.operationCount}>
                                +{dayOps.length - 3}
                              </Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selected Date Details */}
              {selectedDate && (
                <View style={styles.selectedSection}>
                  <View style={styles.selectedDateCard}>
                    <View style={styles.selectedDateIcon}>
                      <Text style={styles.selectedDateDay}>
                        {selectedDate.getDate()}
                      </Text>
                    </View>
                    <View style={styles.selectedDateDetails}>
                      <Text style={styles.selectedDateLabel}>
                        Selected Date
                      </Text>
                      <Text style={styles.selectedDateValue}>
                        {selectedDate.toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                      <Text style={styles.selectedDateHint}>
                        {selectedDateOperations.length > 0
                          ? `${selectedDateOperations.length} scheduled operation${selectedDateOperations.length === 1 ? "" : "s"}`
                          : "No scheduled collection for this date."}
                      </Text>
                    </View>
                  </View>

                  {/* Scheduled Operations List */}
                  {selectedDateOperations.length > 0 ? (
                    selectedDateOperations
                      .slice(0, visibleSelectedDateCount)
                      .map((operation) => (
                      <View key={operation.id} style={styles.savedScheduleCard}>
                        <View style={styles.savedScheduleDetails}>
                          <View style={styles.savedScheduleHeader}>
                            <Text style={styles.savedScheduleTitle}>
                              {operation.title || "Waste Collection"}
                            </Text>
                            <Text style={styles.recurrenceBadge}>
                              {operation.recurrence === "monthly"
                                ? "Monthly repeat"
                                : "One-time"}
                            </Text>
                          </View>

                          <View style={styles.scheduleInfoRow}>
                            <Ionicons
                              name="location-outline"
                              size={15}
                              color="#52675A"
                            />
                            <Text style={styles.savedScheduleArea}>
                              {operation.area ||
                                `${operation.barangay || "Unspecified Barangay"}${
                                  operation.purok
                                    ? `, Pk. ${operation.purok}`
                                    : ""
                                }`}
                            </Text>
                          </View>

                          {(Boolean(operation.time) ||
                            Boolean(operation.schedule)) && (
                            <View style={styles.scheduleInfoRow}>
                              <Ionicons
                                name="time-outline"
                                size={15}
                                color="#64748B"
                              />
                              <Text style={styles.savedScheduleTime}>
                                {operation.time || operation.schedule}
                              </Text>
                            </View>
                          )}

                          {Boolean(operation.message) && (
                            <View style={styles.messageBox}>
                              <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={14}
                                color="#599A74"
                              />
                              <Text style={styles.savedScheduleMessage}>
                                {operation.message}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyDateCard}>
                      <Ionicons
                        name="calendar-outline"
                        size={28}
                        color="#94A3B8"
                      />
                      <Text style={styles.emptyDateTitle}>
                        No schedule for this day
                      </Text>
                      <Text style={styles.emptyDateText}>
                        LGU Pinamungajan has no pickup scheduled on this date.
                      </Text>
                    </View>
                  )}
                  {visibleSelectedDateCount < selectedDateOperations.length && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() =>
                        setVisibleSelectedDateCount((count) =>
                          Math.min(count + 3, selectedDateOperations.length),
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.loadMoreText}>
                        Show{" "}
                        {Math.min(
                          3,
                          selectedDateOperations.length -
                            visibleSelectedDateCount,
                        )}{" "}
                        more
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* All Announcements Panel */}
              <View style={styles.allAnnouncementsSection}>
                <View style={styles.allAnnouncementsHeader}>
                  <View>
                    <Text style={styles.allAnnouncementsTitle}>
                      All Announcements
                    </Text>
                    <Text style={styles.allAnnouncementsSubtitle}>
                      {filteredAnnouncements.length} upcoming announcement
                      {filteredAnnouncements.length !== 1 ? "s" : ""}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.toggleAllButton}
                    onPress={() => setShowAllAnnouncements((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toggleAllButtonText}>
                      {showAllAnnouncements ? "Hide" : "View All"}
                    </Text>
                    <Ionicons
                      name={
                        showAllAnnouncements ? "chevron-up" : "chevron-down"
                      }
                      size={14}
                      color="#234B33"
                    />
                  </TouchableOpacity>
                </View>

                {showAllAnnouncements && (
                  <View style={styles.allAnnouncementsList}>
                    <View style={styles.announcementFilterSection}>
                      <Text style={styles.announcementFilterLabel}>
                        Filter by Barangay
                      </Text>
                      <View style={styles.barangayFilterList}>
                        {["", ...BARANGAYS].map((name) => {
                          const isSelected =
                            announcementBarangayFilter === name;
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
                                setVisibleAllCount(3);
                              }}
                              activeOpacity={0.75}
                            >
                              <Text
                                style={[
                                  styles.barangayFilterChipText,
                                  isSelected &&
                                    styles.barangayFilterChipTextSelected,
                                ]}
                              >
                                {name || "All Barangays"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.purokSortRow}>
                        <Text style={styles.announcementFilterLabel}>
                          Sort by Purok
                        </Text>
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
                                setVisibleAllCount(3);
                              }}
                              activeOpacity={0.75}
                            >
                              <Ionicons
                                name={
                                  order === "asc"
                                    ? "arrow-up"
                                    : "arrow-down"
                                }
                                size={13}
                                color={isSelected ? "#FFFFFF" : "#397A51"}
                              />
                              <Text
                                style={[
                                  styles.sortOrderButtonText,
                                  isSelected &&
                                    styles.sortOrderButtonTextSelected,
                                ]}
                              >
                                {order === "asc" ? "Ascending" : "Descending"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {filteredAnnouncements.length === 0 ? (
                      <Text style={styles.noAnnouncementsText}>
                        {operations.length === 0
                          ? "No announcements found."
                          : upcomingAnnouncementCount === 0
                            ? "No upcoming announcements found."
                            : "No upcoming announcements found for this barangay."}
                      </Text>
                    ) : (
                      filteredAnnouncements
                        .slice(0, visibleAllCount)
                        .map((op) => {
                        const recurrenceLabel = getPickupRecurrenceLabel(op);
                        return (
                          <View
                            key={op.id}
                            style={styles.allAnnouncementCard}
                          >
                            <View style={styles.allAnnouncementTopRow}>
                              <Text style={styles.allAnnouncementItemTitle}>
                                {op.title || "Waste Collection"}
                              </Text>
                              <View style={styles.announcementBadges}>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    styles.statusBadgeActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      styles.statusBadgeTextActive,
                                    ]}
                                  >
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

                            <Text style={styles.allAnnouncementLocation}>
                              📍 {op.barangay || "Barangay"}
                              {op.purok ? ` · Pk. ${op.purok}` : ""}
                              {op.time ? ` · ${op.time}` : ""}
                            </Text>

                            {Boolean(op.message) && (
                              <Text style={styles.allAnnouncementMessage}>
                                {op.message}
                              </Text>
                            )}

                            <Text style={styles.allAnnouncementDates}>
                              Pickup: {formatPickupScheduleDate(op)}
                            </Text>
                          </View>
                        );
                      })
                    )}

                    {visibleAllCount < filteredAnnouncements.length && (
                      <TouchableOpacity
                        style={styles.loadMoreButton}
                        onPress={() =>
                          setVisibleAllCount((prev) =>
                            Math.min(prev + 3, filteredAnnouncements.length),
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={styles.loadMoreText}>
                          Show{" "}
                          {Math.min(
                            3,
                            filteredAnnouncements.length - visibleAllCount,
                          )}{" "}
                          more
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    maxHeight: "92%",
    backgroundColor: "#F8FAF8",
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
      },
      default: {
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EFEA",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#2E5F3E",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    color: "#1E3B29",
    fontSize: 17,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  readOnlyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#D6ECDB",
  },
  readOnlyNoticeText: {
    color: "#1E5030",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  loadingContainer: {
    padding: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#52675A",
    fontSize: 14,
    fontWeight: "600",
  },
  modalScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 26,
    gap: 16,
  },

  // Calendar Card
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  calendarToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthTitle: {
    color: "#234B33",
    fontSize: 18,
    fontWeight: "800",
  },
  monthHint: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  calendarControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EDF5F0",
    borderWidth: 1,
    borderColor: "#D3E4D8",
  },
  todayButtonText: {
    color: "#2E5F3E",
    fontSize: 12,
    fontWeight: "700",
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#599A74",
    alignItems: "center",
    justifyContent: "center",
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
    paddingVertical: 8,
  },
  weekText: {
    color: "#2E5F3E",
    fontSize: 11,
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
    minHeight: 70,
    padding: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5ECE8",
    backgroundColor: "#FFFFFF",
  },
  dayCellMobile: {
    minHeight: 56,
    padding: 3,
  },
  outsideMonthCell: {
    backgroundColor: "#FAFCFB",
  },
  selectedDayCell: {
    backgroundColor: "#EDF7F0",
  },
  dayNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  dayNumberCircleMobile: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  todayCircle: {
    borderWidth: 1.5,
    borderColor: "#599A74",
  },
  selectedDayCircle: {
    backgroundColor: "#599A74",
  },
  dayNumber: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  outsideMonthText: {
    color: "#B0BBB4",
  },
  todayText: {
    color: "#2E5F3E",
    fontWeight: "800",
  },
  selectedDayText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  operationLabels: {
    marginTop: 4,
    gap: 2,
  },
  operationMarkerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  operationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  operationMarkerText: {
    flex: 1,
    color: "#2E5F3E",
    fontSize: 9,
    fontWeight: "700",
  },
  compactDotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 4,
  },
  compactOperationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  operationCount: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "800",
  },

  // Selected Date Card
  selectedSection: {
    gap: 10,
  },
  selectedDateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  selectedDateIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#599A74",
    marginRight: 12,
  },
  selectedDateDay: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  selectedDateDetails: {
    flex: 1,
  },
  selectedDateLabel: {
    color: "#599A74",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectedDateValue: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 1,
  },
  selectedDateHint: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },

  // Saved Schedule Card
  savedScheduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  savedScheduleDetails: {
    flex: 1,
  },
  savedScheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  savedScheduleTitle: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
  },
  recurrenceDayBadge: {
    color: "#2E5F3E",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "#EDF7F0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scheduleInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  savedScheduleArea: {
    color: "#52675A",
    fontSize: 13,
    fontWeight: "600",
  },
  savedScheduleTime: {
    color: "#64748B",
    fontSize: 12,
  },
  messageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: "#F7FAF8",
    borderRadius: 6,
  },
  savedScheduleMessage: {
    color: "#52675A",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  emptyDateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3EBE6",
    gap: 4,
  },
  emptyDateTitle: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyDateText: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
  },

  // All Announcements Section
  allAnnouncementsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E3EBE6",
  },
  allAnnouncementsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  allAnnouncementsTitle: {
    color: "#234B33",
    fontSize: 15,
    fontWeight: "800",
  },
  allAnnouncementsSubtitle: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 1,
  },
  toggleAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EDF5F0",
  },
  toggleAllButtonText: {
    color: "#234B33",
    fontSize: 12,
    fontWeight: "700",
  },
  allAnnouncementsList: {
    marginTop: 14,
    gap: 10,
  },
  announcementFilterSection: {
    gap: 8,
    marginBottom: 2,
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
  allAnnouncementCard: {
    backgroundColor: "#FAFCFB",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5EDE8",
  },
  allAnnouncementCardPast: {
    opacity: 0.65,
    backgroundColor: "#F8FAFC",
  },
  allAnnouncementTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  announcementBadges: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 5,
  },
  allAnnouncementItemTitle: {
    color: "#234B33",
    fontSize: 14,
    fontWeight: "700",
  },
  allAnnouncementItemTitlePast: {
    color: "#64748B",
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeActive: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgePast: {
    backgroundColor: "#F1F5F9",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusBadgeTextActive: {
    color: "#166534",
  },
  statusBadgeTextPast: {
    color: "#64748B",
  },
  recurrenceBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#EAF0FF",
  },
  recurrenceDayBadgeText: {
    color: "#385A9A",
    fontSize: 10,
    fontWeight: "800",
  },
  allAnnouncementLocation: {
    color: "#52675A",
    fontSize: 12,
    marginTop: 4,
  },
  allAnnouncementMessage: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  allAnnouncementDates: {
    color: "#2E5F3E",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },
  noAnnouncementsText: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  loadMoreButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  loadMoreText: {
    color: "#599A74",
    fontSize: 13,
    fontWeight: "700",
  },
});
