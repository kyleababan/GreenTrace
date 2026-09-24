import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { db } from "../../../../firebaseConfig";
import { hideBadWords } from "../../../../utils/hideBadWords";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour24 = Math.floor(index / 2);
  const hour = hour24 % 12 || 12;
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute} ${hour24 >= 12 ? "PM" : "AM"}`;
});

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseDateKey = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const getCalendarDays = (month) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const calendarStart = new Date(
    month.getFullYear(),
    month.getMonth(),
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

export default function VolunteerPostCreate({
  setSelectedVolunteerPost,
  post: suppliedPost,
  setSelectedPost,
}) {
  const { volunteerId } = useLocalSearchParams();
  const router = useRouter();
  const isEditing = Boolean(volunteerId);
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [volunteerPost, setVolunteerPost] = useState(
    isEditing ? null : suppliedPost || null,
  );
  const [title, setTitle] = useState(suppliedPost?.title || "Need Volunteers");
  const [desc, setDesc] = useState(suppliedPost?.description || "");
  const [requirements, setRequirements] = useState(
    suppliedPost?.requirements?.length ? suppliedPost.requirements : [""],
  );
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDate, setMeetingDate] = useState(null);
  const [meetingTime, setMeetingTime] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLocationChoice, setShowLocationChoice] = useState(false);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [showGpsPlaceholder, setShowGpsPlaceholder] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [maxVolunteers, setMaxVolunteers] = useState(
    suppliedPost?.maxVolunteers ? String(suppliedPost.maxVolunteers) : "",
  );
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!isEditing) return;

    const loadVolunteerPost = async () => {
      try {
        const snapshot = await getDoc(doc(db, "volunteer_posts", volunteerId));

        if (!snapshot.exists()) {
          Alert.alert("This volunteer activity is no longer available.");
          router.back();
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() };
        setVolunteerPost(data);
        setTitle(data.title || "Need Volunteers");
        setDesc(data.description || "");
        setRequirements(data.requirements?.length ? data.requirements : [""]);
        const savedMeetingDate = parseDateKey(data.meetingDate);
        setMeetingLocation(data.meetingLocation || data.locationName || "");
        setMeetingDate(savedMeetingDate);
        setMeetingTime(data.meetingTime || "");
        if (savedMeetingDate) setVisibleMonth(savedMeetingDate);
        setMaxVolunteers(data.maxVolunteers ? String(data.maxVolunteers) : "");
      } catch (error) {
        console.error("Unable to load volunteer activity:", error);
        Alert.alert("Unable to load this volunteer activity.");
      } finally {
        setLoading(false);
      }
    };

    loadVolunteerPost();
  }, [isEditing, router, volunteerId]);

  const goBack = () => {
    if (isEditing) {
      router.back();
      return;
    }

    setSelectedVolunteerPost?.(null);
    setSelectedPost?.(suppliedPost);
  };

  const saveVolunteerPost = async () => {
    if (saving) return;

    const cleanedRequirements = requirements
      .map((item) => item.trim())
      .filter(Boolean);

    const nextErrors = {
      ...(!title.trim() ? { title: "Title is required." } : {}),
      ...(!desc.trim() ? { desc: "Description is required." } : {}),
      ...(!cleanedRequirements.length
        ? { requirements: "Add at least one requirement." }
        : {}),
      ...(!meetingLocation.trim()
        ? { meetingLocation: "Meeting location is required." }
        : {}),
      ...(!meetingDate ? { meetingDate: "Select a meeting date." } : {}),
      ...(!meetingTime.trim()
        ? { meetingTime: "Meeting time is required." }
        : {}),
      ...(!maxVolunteers || Number(maxVolunteers) < 1
        ? { maxVolunteers: "Enter at least 1 volunteer." }
        : {}),
    };

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);

    try {
      if (isEditing) {
        await updateDoc(doc(db, "volunteer_posts", volunteerPost.id), {
          title: hideBadWords(title.trim()),
          description: hideBadWords(desc.trim()),
          requirements: cleanedRequirements.map((item) => hideBadWords(item)),
          meetingLocation: meetingLocation.trim(),
          locationName: meetingLocation.trim(),
          meetingDate: formatDateKey(meetingDate),
          meetingTime: meetingTime.trim(),
          maxVolunteers: Number(maxVolunteers),
        });

        Alert.alert("Volunteer activity updated!");
        router.replace("/admin/VolunteerList");
        return;
      }

      const existingSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", suppliedPost.id),
          where("status", "==", "open"),
        ),
      );

      if (!existingSnapshot.empty) {
        Alert.alert("This report already has an active volunteer activity.");
        return;
      }

      await addDoc(collection(db, "volunteer_posts"), {
        postId: suppliedPost.id,
        title: hideBadWords(title.trim()),
        description: hideBadWords(desc.trim()),
        requirements: cleanedRequirements.map((item) => hideBadWords(item)),
        imageUrl: suppliedPost.imageUrl || "",
        firstName: suppliedPost.firstName || "",
        lastName: suppliedPost.lastName || "",
        meetingLocation: meetingLocation.trim(),
        locationName: meetingLocation.trim(),
        postLocationName: suppliedPost.locationName || "",
        meetingDate: formatDateKey(meetingDate),
        meetingTime: meetingTime.trim(),
        maxVolunteers: Number(maxVolunteers),
        joinedCount: 0,
        volunteers: [],
        status: "open",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", suppliedPost.id), { status: "ongoing" });

      Alert.alert("Volunteer activity created!");
      router.replace("/admin/VolunteerList");
    } catch (error) {
      console.error("Unable to save volunteer activity:", error);
      Alert.alert("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addRequirement = () => setRequirements((current) => [...current, ""]);

  const removeRequirement = (index) => {
    setRequirements((current) =>
      current.filter((_, requirementIndex) => requirementIndex !== index),
    );
  };

  const updateRequirement = (text, index) => {
    setRequirements((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? text : item)),
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#5F9C76" />
      </View>
    );
  }

  const imageUrl = volunteerPost?.imageUrl || suppliedPost?.imageUrl;

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBack}
          accessibilityLabel="Go back"
        >
          <Image
            source={require("../../../../assets/images/backG.png")}
            style={styles.backIcon}
          />
        </TouchableOpacity>

        <View
          style={[styles.row, { flexDirection: isMobile ? "column" : "row" }]}
        >
          <View style={[styles.card, { flex: isMobile ? 0 : 1 }]}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.cardImage, { height: isMobile ? 200 : 300 }]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  { height: isMobile ? 200 : 300 },
                ]}
              >
                <Ionicons name="image-outline" size={42} color="#71907d" />
                <Text style={styles.placeholderText}>No image available</Text>
              </View>
            )}

            <View style={styles.imageMeetingDetails}>
              <Text style={styles.fieldLabel}>Meeting date and time</Text>
              <View style={styles.meetingDateRow}>
                <TouchableOpacity
                  style={[
                    styles.inputBox,
                    { flex: 1 },
                    errors.meetingDate && styles.inputError,
                  ]}
                  onPress={() => {
                    clearError("meetingDate");
                    setShowCalendar(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#276344" />
                  <Text
                    style={[
                      styles.dateValue,
                      !meetingDate && styles.placeholderValue,
                    ]}
                  >
                    {meetingDate
                      ? meetingDate.toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Meeting date"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.inputBox,
                    styles.pickerInput,
                    { flex: 1 },
                    errors.meetingTime && styles.inputError,
                  ]}
                  onPress={() => {
                    clearError("meetingTime");
                    setShowTimePicker(true);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color="#276344" />
                  <Text
                    style={[
                      styles.dateValue,
                      !meetingTime && styles.placeholderValue,
                    ]}
                  >
                    {meetingTime || "Meeting time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.meetingDate && (
                <Text style={styles.fieldError}>{errors.meetingDate}</Text>
              )}
              {errors.meetingTime && (
                <Text style={styles.fieldError}>{errors.meetingTime}</Text>
              )}
            </View>
          </View>

          <View style={[styles.editSection, { flex: isMobile ? 0 : 1 }]}>
            <Text style={styles.heading}>
              {isEditing
                ? "Edit volunteer activity"
                : "Create volunteer activity"}
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                placeholder="Title"
                value={title}
                style={[styles.input, errors.title && styles.inputError]}
                onChangeText={(value) => {
                  setTitle(value);
                  clearError("title");
                }}
              />
            </View>
            {errors.title && (
              <Text style={styles.fieldError}>{errors.title}</Text>
            )}
            <View style={[styles.inputBox, { minHeight: 100 }]}>
              <TextInput
                placeholder="Write something"
                value={desc}
                onChangeText={(value) => {
                  setDesc(value);
                  clearError("desc");
                }}
                multiline
                style={[
                  styles.input,
                  { minHeight: 100 },
                  errors.desc && styles.inputError,
                ]}
                textAlignVertical="top"
              />
            </View>
            {errors.desc && (
              <Text style={styles.fieldError}>{errors.desc}</Text>
            )}

            <View style={styles.requirementBox}>
              <Text style={styles.fieldLabel}>Requirements</Text>
              {requirements.map((item, index) => (
                <View
                  key={`requirement-${index}`}
                  style={styles.requirementRow}
                >
                  <TextInput
                    placeholder="Requirement"
                    value={item}
                    onChangeText={(text) => {
                      updateRequirement(text, index);
                      clearError("requirements");
                    }}
                    style={[
                      styles.requirementInput,
                      errors.requirements && styles.inputError,
                    ]}
                  />
                  {requirements.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeRequirement(index)}
                      accessibilityLabel="Remove requirement"
                    >
                      <Ionicons name="close-circle" size={22} color="#b94b4b" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  clearError("requirements");
                  addRequirement();
                }}
              >
                <Ionicons name="add-circle-outline" size={22} color="#276344" />
                <Text style={styles.addButtonText}>Add requirement</Text>
              </TouchableOpacity>
              {errors.requirements && (
                <Text style={styles.fieldError}>{errors.requirements}</Text>
              )}
            </View>

            <View style={styles.meetingBox}>
              <Text style={styles.fieldLabel}>Meet up area</Text>
              <TouchableOpacity
                style={[
                  styles.inputBox,
                  styles.meetupLocationBox,
                  errors.meetingLocation && styles.inputError,
                ]}
                onPress={() => {
                  setLocationDraft(meetingLocation);
                  setShowLocationChoice(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Set meetup area"
              >
                <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                <Text style={styles.meetupLocationText}>
                  {meetingLocation || "Add meetup area"}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.meetingLocation && (
              <Text style={styles.fieldError}>{errors.meetingLocation}</Text>
            )}

            <View style={styles.bottomRow}>
              <View style={[styles.inputBox, { flex: 1 }]}>
                <Ionicons name="people-outline" size={20} color="#276344" />
                <TextInput
                  placeholder="Max volunteers"
                  keyboardType="numeric"
                  value={maxVolunteers}
                  onChangeText={(text) => {
                    setMaxVolunteers(text.replace(/[^0-9]/g, ""));
                    clearError("maxVolunteers");
                  }}
                  maxLength={3}
                  style={[
                    styles.maxVolunteerInput,
                    errors.maxVolunteers && styles.inputError,
                  ]}
                />
              </View>
            </View>
            {errors.maxVolunteers && (
              <Text style={styles.fieldError}>{errors.maxVolunteers}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          disabled={saving}
          style={[styles.saveBtn, saving && styles.disabledButton]}
          onPress={saveVolunteerPost}
        >
          <Text style={styles.saveText}>
            {saving
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : "Create activity"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <View>
                <Text style={styles.calendarTitle}>Select meeting date</Text>
                <Text style={styles.calendarMonth}>
                  {visibleMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={25} color="#526158" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarControls}>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() - 1,
                        1,
                      ),
                  )
                }
              >
                <Ionicons name="chevron-back" size={21} color="#397A51" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => setVisibleMonth(new Date())}
              >
                <Text style={styles.todayText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() + 1,
                        1,
                      ),
                  )
                }
              >
                <Ionicons name="chevron-forward" size={21} color="#397A51" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {getCalendarDays(visibleMonth).map((date) => {
                const key = formatDateKey(date);
                const selected =
                  meetingDate && key === formatDateKey(meetingDate);
                const outsideMonth =
                  date.getMonth() !== visibleMonth.getMonth();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = date < today;

                return (
                  <TouchableOpacity
                    key={key}
                    disabled={isPast}
                    style={[styles.dayButton, selected && styles.selectedDay]}
                    onPress={() => {
                      setMeetingDate(date);
                      setShowCalendar(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        outsideMonth && styles.outsideDayText,
                        isPast && styles.pastDayText,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select meeting time</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Ionicons name="close" size={25} color="#526158" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timeList}>
              {TIME_OPTIONS.map((timeOption) => (
                <TouchableOpacity
                  key={timeOption}
                  style={[
                    styles.timeOption,
                    meetingTime === timeOption && styles.selectedTime,
                  ]}
                  onPress={() => {
                    setMeetingTime(timeOption);
                    setShowTimePicker(false);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="#276344" />
                  <Text style={styles.timeOptionText}>{timeOption}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLocationChoice}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationChoice(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Choose meetup area</Text>
              <TouchableOpacity onPress={() => setShowLocationChoice(false)}>
                <Ionicons name="close" size={25} color="#526158" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={() => {
                setShowLocationChoice(false);
                setShowLocationEditor(true);
              }}
            >
              <Text style={styles.modalActionText}>Add manually</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={() => {
                setShowLocationChoice(false);
                setShowGpsPlaceholder(true);
              }}
            >
              <Text style={styles.modalActionText}>Use GPS tracking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLocationEditor}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationEditor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Meet up area</Text>
              <TouchableOpacity onPress={() => setShowLocationEditor(false)}>
                <Ionicons name="close" size={25} color="#526158" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={locationDraft}
              onChangeText={setLocationDraft}
              placeholder="Barangay, Purok, or street"
              placeholderTextColor="#91A198"
              style={styles.locationModalInput}
            />
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={() => {
                setMeetingLocation(locationDraft.trim());
                clearError("meetingLocation");
                setShowLocationEditor(false);
              }}
            >
              <Text style={styles.modalActionText}>Save meetup area</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGpsPlaceholder}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGpsPlaceholder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>GPS tracking</Text>
              <TouchableOpacity onPress={() => setShowGpsPlaceholder(false)}>
                <Ionicons name="close" size={25} color="#526158" />
              </TouchableOpacity>
            </View>
            <View style={styles.gpsPlaceholder} />
            <Text style={styles.gpsHint}>
              GPS location will be available soon.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 20 },
  backBtn: { alignSelf: "flex-start" },
  backIcon: { width: 45, height: 45 },
  row: { gap: 20 },
  card: { borderRadius: 10, overflow: "hidden" },
  cardImage: { width: "100%", borderRadius: 10, backgroundColor: "#dfe8e2" },
  imagePlaceholder: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#dfe8e2",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderText: { color: "#577061" },
  editSection: { gap: 12 },
  heading: { fontSize: 20, fontWeight: "700", color: "#1d2b21" },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "transparent",
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    borderWidth: 0,
    outlineStyle: "none",
  },
  requirementBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  fieldLabel: { fontWeight: "700", color: "#1d2b21" },
  inputError: {
    borderWidth: 1.5,
    borderColor: "#D93025",
  },
  fieldError: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -7,
    marginBottom: 2,
  },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  requirementInput: {
    flex: 1,
    backgroundColor: "#f1f4f2",
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 42,
    borderWidth: 0,
    outlineStyle: "none",
  },
  addButton: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 5,
    paddingTop: 2,
  },
  addButtonText: { color: "#276344", fontWeight: "600" },
  bottomRow: { flexDirection: "row", gap: 12 },
  meetingBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  meetupLocationBox: {
    backgroundColor: "#5F9C76",
    borderColor: "transparent",
  },
  meetupLocationInput: {
    marginLeft: 8,
    color: "#FFFFFF",
  },
  meetupLocationText: {
    flex: 1,
    marginLeft: 8,
    color: "#FFFFFF",
    fontSize: 15,
  },
  modalActionButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
  },
  modalActionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  locationModalInput: {
    minHeight: 48,
    marginTop: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
    backgroundColor: "#FAFCFB",
    color: "#24352A",
    fontSize: 14,
    outlineStyle: "none",
  },
  gpsPlaceholder: {
    height: 180,
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    backgroundColor: "#FAFCFB",
  },
  gpsHint: { color: "#718078", textAlign: "center", marginTop: 10 },
  imageMeetingDetails: {
    marginTop: 12,
    padding: 12,
    gap: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  meetingDateRow: { flexDirection: "row", gap: 10 },
  pickerInput: { borderColor: "#D8E3DC", backgroundColor: "#FAFCFB" },
  dateValue: { flex: 1, marginLeft: 8, color: "#1D2B21", fontSize: 14 },
  placeholderValue: { color: "#777" },
  maxVolunteerInput: {
    flex: 1,
    textAlign: "left",
    fontWeight: "700",
    paddingVertical: 10,
    borderWidth: 0,
    outlineStyle: "none",
  },
  saveBtn: {
    backgroundColor: "#5F9C76",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  disabledButton: { opacity: 0.6 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(20, 34, 25, 0.45)",
  },
  calendarModal: {
    width: "100%",
    maxWidth: 430,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  timeModal: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "80%",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  timeList: { maxHeight: 360, marginTop: 12 },
  timeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
  },
  selectedTime: { backgroundColor: "#EDF7F0" },
  timeOptionText: { color: "#24352A", fontSize: 14 },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  calendarTitle: { color: "#234B33", fontSize: 19, fontWeight: "800" },
  calendarMonth: { color: "#718078", fontSize: 13, marginTop: 3 },
  calendarControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 16,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF5F0",
  },
  todayButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EEF5F0",
  },
  todayText: { color: "#397A51", fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: 5 },
  weekday: {
    width: "14.2857%",
    textAlign: "center",
    color: "#718078",
    fontSize: 11,
    fontWeight: "700",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayButton: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  selectedDay: { backgroundColor: "#5F9C76" },
  dayText: { color: "#26362C", fontSize: 13, fontWeight: "600" },
  outsideDayText: { color: "#ABB5AF" },
  pastDayText: { color: "#D2D8D4" },
  selectedDayText: { color: "#FFFFFF", fontWeight: "800" },
});
