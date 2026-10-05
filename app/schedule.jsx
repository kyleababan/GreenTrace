import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from "react-native";
import Navbar from "../components/navbar";
import { db } from "../firebaseConfig";

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

export default function ScheduleScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [visibleAllCount, setVisibleAllCount] = useState(6);

  useEffect(() => {
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
  }, []);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/home")}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#234B33" />
          </TouchableOpacity>
          <View style={styles.topHeaderTitleCol}>
            <Text style={styles.topHeaderTitle}>Scheduled Dates</Text>
            <Text style={styles.topHeaderSubtitle}>
              Official LGU Collection Calendar
            </Text>
          </View>
        </View>

        {/* Read-Only Notice Banner */}
        <View style={styles.readOnlyNotice}>
          <Ionicons name="information-circle" size={17} color="#2A6440" />
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
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
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
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => changeMonth(1)}
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
                      onPress={() => setSelectedDate(date)}
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
                                      EVENT_COLORS[index % EVENT_COLORS.length],
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
                    <Text style={styles.selectedDateLabel}>Selected Date</Text>
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

                {selectedDateOperations.length > 0 ? (
                  selectedDateOperations.map((operation) => (
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
                    {operations.length} announcement
                    {operations.length !== 1 ? "s" : ""} on record
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
                    name={showAllAnnouncements ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#234B33"
                  />
                </TouchableOpacity>
              </View>

              {showAllAnnouncements && (
                <View style={styles.allAnnouncementsList}>
                  {operations.length === 0 ? (
                    <Text style={styles.noAnnouncementsText}>
                      No announcements found.
                    </Text>
                  ) : (
                    operations.slice(0, visibleAllCount).map((op) => {
                      const todayKey = formatDateKey(new Date());
                      const hasPastOnly =
                        Array.isArray(op.scheduledDateKeys) &&
                        op.scheduledDateKeys.length > 0 &&
                        op.scheduledDateKeys.every((k) => k < todayKey);

                      return (
                        <View
                          key={op.id}
                          style={[
                            styles.allAnnouncementCard,
                            hasPastOnly && styles.allAnnouncementCardPast,
                          ]}
                        >
                          <View style={styles.allAnnouncementTopRow}>
                            <Text
                              style={[
                                styles.allAnnouncementItemTitle,
                                hasPastOnly &&
                                  styles.allAnnouncementItemTitlePast,
                              ]}
                            >
                              {op.title || "Waste Collection"}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                hasPastOnly
                                  ? styles.statusBadgePast
                                  : styles.statusBadgeActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  hasPastOnly
                                    ? styles.statusBadgeTextPast
                                    : styles.statusBadgeTextActive,
                                ]}
                              >
                                {hasPastOnly ? "Past" : "Active"}
                              </Text>
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

                          {Array.isArray(op.scheduledDateKeys) && (
                            <Text style={styles.allAnnouncementDates}>
                              Dates:{" "}
                              {op.scheduledDateKeys
                                .sort()
                                .slice(0, 4)
                                .join(", ")}
                              {op.scheduledDateKeys.length > 4
                                ? ` +${op.scheduledDateKeys.length - 4} more`
                                : ""}
                            </Text>
                          )}
                        </View>
                      );
                    })
                  )}

                  {visibleAllCount < operations.length && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() =>
                        setVisibleAllCount((prev) =>
                          Math.min(prev + 5, operations.length),
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.loadMoreText}>
                        Show {Math.min(5, operations.length - visibleAllCount)}{" "}
                        more
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        )}

        <View style={styles.navbar}>
          <Navbar />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#5F9C76",
  },
  container: {
    flex: 1,
    backgroundColor: "#F4F7F4",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBE6",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EDF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  topHeaderTitleCol: {
    flex: 1,
  },
  topHeaderTitle: {
    color: "#1E3B29",
    fontSize: 18,
    fontWeight: "800",
  },
  topHeaderSubtitle: {
    color: "#64748B",
    fontSize: 12,
  },
  readOnlyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 16,
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#52675A",
    fontSize: 14,
    fontWeight: "600",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 16,
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
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
  recurrenceBadge: {
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
  navbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
