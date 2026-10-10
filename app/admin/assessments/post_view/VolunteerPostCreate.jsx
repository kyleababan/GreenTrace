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
import { useEffect, useRef, useState } from "react";
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

import PostLocationModal from "../../../../components/PostLocationModal";
import { db } from "../../../../firebaseConfig";
import { hideBadWords } from "../../../../utils/hideBadWords";
import {
  notifyAllResidentsOnActivityCreated,
  notifyPostStatusUpdated,
} from "../../../../utils/notificationHelpers";

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

const getCoordinates = (post) => {
  if (post?.meetingCoordinates) return post.meetingCoordinates;
  if (post?.coordinates) return post.coordinates;
  if (post?.latitude != null && post?.longitude != null) {
    return {
      latitude: Number(post.latitude),
      longitude: Number(post.longitude),
    };
  }
  return null;
};

export default function VolunteerPostCreate({
  setSelectedVolunteerPost,
  post: suppliedPost,
  setSelectedPost,
}) {
  const { volunteerId, postId } = useLocalSearchParams();
  const router = useRouter();
  const isEditing = Boolean(volunteerId);
  const isFromPostId = Boolean(!isEditing && postId && !suppliedPost);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [volunteerPost, setVolunteerPost] = useState(
    isEditing ? null : suppliedPost || null,
  );
  const [title, setTitle] = useState(suppliedPost?.title || "Need Volunteers");
  const [desc, setDesc] = useState(
    suppliedPost?.description || suppliedPost?.caption || "",
  );
  const [requirements, setRequirements] = useState(
    suppliedPost?.requirements?.length ? suppliedPost.requirements : [""],
  );
  const requirementsScrollRef = useRef(null);
  const previousRequirementsLengthRef = useRef(requirements.length);
  const [meetingLocation, setMeetingLocation] = useState(
    suppliedPost?.meetingLocation || suppliedPost?.locationName || "",
  );
  const [meetingCoordinates, setMeetingCoordinates] = useState(() =>
    getCoordinates(suppliedPost),
  );
  const [meetingDate, setMeetingDate] = useState(null);
  const [meetingTime, setMeetingTime] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLocationChoice, setShowLocationChoice] = useState(false);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [maxVolunteers, setMaxVolunteers] = useState(
    suppliedPost?.maxVolunteers ? String(suppliedPost.maxVolunteers) : "",
  );
  const [loading, setLoading] = useState(isEditing || isFromPostId);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (requirements.length > previousRequirementsLengthRef.current) {
      requirementsScrollRef.current?.scrollToEnd({ animated: true });
    }
    previousRequirementsLengthRef.current = requirements.length;
  }, [requirements.length]);

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (isEditing) {
      const loadVolunteerPost = async () => {
        try {
          const snapshot = await getDoc(
            doc(db, "volunteer_posts", volunteerId),
          );

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
          setMeetingCoordinates(getCoordinates(data));
          setMeetingDate(savedMeetingDate);
          setMeetingTime(data.meetingTime || "");
          if (savedMeetingDate) setVisibleMonth(savedMeetingDate);
          setMaxVolunteers(
            data.maxVolunteers ? String(data.maxVolunteers) : "",
          );
        } catch (error) {
          console.error("Unable to load volunteer activity:", error);
          Alert.alert("Unable to load this volunteer activity.");
        } finally {
          setLoading(false);
        }
      };

      loadVolunteerPost();
    } else if (isFromPostId) {
      const loadSourcePost = async () => {
        try {
          const snapshot = await getDoc(doc(db, "posts", postId));
          if (!snapshot.exists()) {
            Alert.alert("Post not found", "This post is no longer available.");
            router.back();
            return;
          }
          const data = { id: snapshot.id, ...snapshot.data() };
          setVolunteerPost(data);
          setTitle(data.title || "Need Volunteers");
          setDesc(data.caption || data.description || "");
          setMeetingLocation(data.locationName || "");
          setMeetingCoordinates(getCoordinates(data));
        } catch (error) {
          console.error("Unable to load source post:", error);
          Alert.alert("Unable to load post details.");
        } finally {
          setLoading(false);
        }
      };

      loadSourcePost();
    }
  }, [isEditing, isFromPostId, router, volunteerId, postId]);

  const goBack = () => {
    if (isEditing || postId) {
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
          meetingCoordinates: meetingCoordinates || null,
          meetingDate: formatDateKey(meetingDate),
          meetingTime: meetingTime.trim(),
          maxVolunteers: Number(maxVolunteers),
        });

        Alert.alert("Volunteer activity updated!");
        router.replace("/admin/VolunteerList");
        return;
      }

      const targetPost = suppliedPost || volunteerPost;
      if (!targetPost) {
        Alert.alert("Error", "No post selected for this volunteer activity.");
        return;
      }

      const existingSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", targetPost.id),
          where("status", "==", "open"),
        ),
      );

      if (!existingSnapshot.empty) {
        Alert.alert("This report already has an active volunteer activity.");
        return;
      }

      const newVolDoc = await addDoc(collection(db, "volunteer_posts"), {
        postId: targetPost.id,
        title: hideBadWords(title.trim()),
        description: hideBadWords(desc.trim()),
        requirements: cleanedRequirements.map((item) => hideBadWords(item)),
        imageUrl: targetPost.imageUrl || "",
        firstName: targetPost.firstName || "",
        lastName: targetPost.lastName || "",
        meetingLocation: meetingLocation.trim(),
        locationName: meetingLocation.trim(),
        meetingCoordinates: meetingCoordinates || null,
        postLocationName: targetPost.locationName || "",
        coordinates:
          targetPost.coordinates ||
          (targetPost.latitude && targetPost.longitude
            ? {
                latitude: Number(targetPost.latitude),
                longitude: Number(targetPost.longitude),
              }
            : null),
        purok: targetPost.purok || "",
        wasteClassification: targetPost.wasteClassification || null,
        meetingDate: formatDateKey(meetingDate),
        meetingTime: meetingTime.trim(),
        maxVolunteers: Number(maxVolunteers),
        joinedCount: 0,
        volunteers: [],
        status: "open",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "posts", targetPost.id), { status: "ongoing" });

      await notifyAllResidentsOnActivityCreated({
        activityId: newVolDoc.id,
        title: hideBadWords(title.trim()),
        meetingDate: formatDateKey(meetingDate),
        meetingTime: meetingTime.trim(),
        imageUrl: targetPost.imageUrl || "",
      });

      await notifyPostStatusUpdated({
        post: targetPost,
        newStatus: "ongoing",
      });

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
  const saveButton = (
    <TouchableOpacity
      disabled={saving}
      style={[styles.saveBtn, saving && styles.disabledButton]}
      onPress={saveVolunteerPost}
      activeOpacity={0.85}
    >
      {saving ? (
        <View style={styles.savingContent}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.saveText}>Saving...</Text>
        </View>
      ) : (
        <Text style={styles.saveText}>
          {isEditing ? "Save changes" : "Create activity"}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.page}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        activeOpacity={0.8}
      >
        <Image
          source={require("../../../../assets/images/backG.png")}
          style={styles.backIcon}
        />
      </TouchableOpacity>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[
          styles.content,
          isMobile && styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.row,
            { flexDirection: isMobile ? "column" : "row" },
          ]}
        >
          {/* LEFT COLUMN: IMAGE & MEETING SCHEDULE */}
          <View style={[styles.card, !isMobile && styles.desktopColumn]}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.cardImage, { height: isMobile ? 280 : 360 }]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  { height: isMobile ? 260 : 360 },
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
                    styles.pickerInput,
                    { flex: 1 },
                    errors.meetingDate && styles.inputError,
                  ]}
                  onPress={() => {
                    clearError("meetingDate");
                    setShowCalendar(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={20} color="#276344" />
                  <Text
                    style={[
                      styles.dateValue,
                      !meetingDate && styles.placeholderValue,
                    ]}
                    numberOfLines={1}
                  >
                    {meetingDate
                      ? meetingDate.toLocaleDateString(undefined, {
                          month: "short",
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
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={20} color="#276344" />
                  <Text
                    style={[
                      styles.dateValue,
                      !meetingTime && styles.placeholderValue,
                    ]}
                    numberOfLines={1}
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

            {/* MEETUP AREA */}
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
                activeOpacity={0.85}
              >
                <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                <Text style={styles.meetupLocationText} numberOfLines={1}>
                  {meetingLocation || "Add meetup area"}
                </Text>
              </TouchableOpacity>
              {meetingCoordinates?.latitude != null &&
                meetingCoordinates?.longitude != null && (
                  <Text style={styles.gpsCoordinateHint}>
                    GPS: {Number(meetingCoordinates.latitude).toFixed(6)},{" "}
                    {Number(meetingCoordinates.longitude).toFixed(6)}
                  </Text>
                )}
              {errors.meetingLocation && (
                <Text style={styles.fieldError}>{errors.meetingLocation}</Text>
              )}
            </View>
          </View>

          {/* RIGHT COLUMN: EDIT SECTION */}
          <View style={[styles.editSection, !isMobile && styles.desktopColumn]}>
            <Text style={styles.heading}>
              {isEditing
                ? "Edit volunteer activity"
                : "Create volunteer activity"}
            </Text>

            <View style={styles.inputBox}>
              <TextInput
                placeholder="Title"
                placeholderTextColor="#8C9E93"
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

            <View style={[styles.inputBox, styles.descriptionBox]}>
              <TextInput
                placeholder="Write something"
                placeholderTextColor="#8C9E93"
                value={desc}
                onChangeText={(value) => {
                  setDesc(value);
                  clearError("desc");
                }}
                multiline
                style={[
                  styles.input,
                  styles.descriptionInput,
                  errors.desc && styles.inputError,
                ]}
                textAlignVertical="top"
              />
            </View>
            {errors.desc && (
              <Text style={styles.fieldError}>{errors.desc}</Text>
            )}

            {/* REQUIREMENTS */}
            <View style={styles.requirementBox}>
              <Text style={styles.fieldLabel}>Requirements</Text>
              <ScrollView
                ref={requirementsScrollRef}
                style={styles.requirementsList}
                contentContainerStyle={styles.requirementsListContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {requirements.map((item, index) => (
                  <View
                    key={`requirement-${index}`}
                    style={styles.requirementRow}
                  >
                    <TextInput
                      placeholder="Requirement"
                      placeholderTextColor="#8C9E93"
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
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color="#b94b4b"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  clearError("requirements");
                  addRequirement();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={22} color="#276344" />
                <Text style={styles.addButtonText}>Add requirement</Text>
              </TouchableOpacity>
              {errors.requirements && (
                <Text style={styles.fieldError}>{errors.requirements}</Text>
              )}
            </View>

            {/* MAX VOLUNTEERS */}
            <View style={styles.bottomRow}>
              <View style={[styles.inputBox, { flex: 1 }]}>
                <Ionicons name="people-outline" size={20} color="#276344" />
                <TextInput
                  placeholder="Max volunteers"
                  placeholderTextColor="#8C9E93"
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
            {isMobile && saveButton}
          </View>
        </View>

        {/* SAVE BUTTON */}
        {!isMobile && saveButton}
      </ScrollView>

      {/* CALENDAR MODAL */}
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

      {/* TIME PICKER MODAL */}
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

      {/* LOCATION CHOICE MODAL */}
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
                setShowGpsModal(true);
              }}
            >
              <Text style={styles.modalActionText}>Use GPS tracking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LOCATION EDITOR MODAL */}
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

      <PostLocationModal
        key={showGpsModal ? "gps-open" : "gps-closed"}
        visible={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        initialLocation={meetingLocation}
        initialCoords={meetingCoordinates}
        onSelectLocation={({ locationName, coordinates }) => {
          setMeetingLocation(locationName);
          setMeetingCoordinates(coordinates);
          clearError("meetingLocation");
          setShowGpsModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6f5" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  formScroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 20 },
  contentMobile: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 18, gap: 12 },
  backBtn: { alignSelf: "flex-start", marginTop: 20, marginLeft: 20 },
  backIcon: { width: 45, height: 45 },
  row: { gap: 20 },
  desktopColumn: { flex: 1 },
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
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1d2b21",
    marginBottom: 2,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D8E3DC",
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    borderWidth: 0,
    outlineStyle: "none",
    color: "#1d2b21",
  },
  requirementBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2ECE5",
  },
  requirementsList: {
    height: 150,
    flexGrow: 0,
  },
  requirementsListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  fieldLabel: { fontWeight: "700", color: "#1d2b21", marginBottom: 2 },
  inputError: {
    borderWidth: 1.5,
    borderColor: "#D93025",
  },
  fieldError: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -4,
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
    color: "#1d2b21",
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
    borderWidth: 1,
    borderColor: "#E2ECE5",
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
    fontWeight: "500",
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
  gpsCoordinateHint: {
    color: "#52675A",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -4,
  },
  imageMeetingDetails: {
    marginTop: 12,
    padding: 12,
    gap: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2ECE5",
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
    color: "#1d2b21",
    marginLeft: 8,
  },
  saveBtn: {
    backgroundColor: "#5F9C76",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  savingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
  descriptionBox: {
    minHeight: 120,
    alignItems: "flex-start",
  },
  descriptionInput: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: "top",
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
