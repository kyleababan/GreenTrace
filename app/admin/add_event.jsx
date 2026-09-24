import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { uploadToCloudinary } from "../../cloudinary";
import { auth, db } from "../../firebaseConfig";
import { hideBadWords } from "../../utils/hideBadWords";

const INITIAL_REQUIREMENTS = [""];
const BARANGAYS = [
  "Anislag",
  "Anopog",
  "Binabag",
  "Buhingtubig",
  "Busay",
  "Butong",
  "Cabiangon",
  "Camugao",
  "Duangan",
  "Guimbawian",
  "Lamac",
  "Lut-od",
  "Mangoto",
  "Opao",
  "Poblacion",
  "Punod",
  "Rizal",
  "Sacsac",
  "Sambagon",
  "Sibago",
  "Tajao",
  "Tangub",
  "Tanibag",
  "Tupas",
  "Tutay",
].sort((first, second) => first.localeCompare(second));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour24 = Math.floor(index / 2);
  const hour = hour24 % 12 || 12;
  const minute = index % 2 === 0 ? "00" : "30";
  const period = hour24 >= 12 ? "PM" : "AM";
  return `${hour}:${minute} ${period}`;
});

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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

export default function AddEvent() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 600;
  const [title, setTitle] = useState("Community Cleanup Event");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState(INITIAL_REQUIREMENTS);
  const [location, setLocation] = useState("");
  const [manualBarangay, setManualBarangay] = useState("");
  const [manualPurok, setManualPurok] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxVolunteers, setMaxVolunteers] = useState("");
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [locationChoiceVisible, setLocationChoiceVisible] = useState(false);
  const [manualLocationVisible, setManualLocationVisible] = useState(false);
  const [gpsVisible, setGpsVisible] = useState(false);
  const [barangayDropdownOpen, setBarangayDropdownOpen] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timeVisible, setTimeVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  const updateRequirement = (value, index) => {
    setRequirements((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const addRequirement = () => setRequirements((current) => [...current, ""]);

  const removeRequirement = (index) => {
    setRequirements((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const selectLocation = () => {
    if (!manualBarangay || !manualPurok) return;
    setLocation(`${manualBarangay}, Pk. ${manualPurok}`);
    setErrors((current) => ({ ...current, location: "" }));
    setManualLocationVisible(false);
  };

  const isPastDate = (calendarDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return calendarDate < today;
  };

  const changeMonth = (amount) => {
    setVisibleMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + amount,
          1,
        ),
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.type === "video") {
      setErrors((current) => ({
        ...current,
        image: "Videos are not supported.",
      }));
      return;
    }

    if (asset.fileSize && asset.fileSize > 2.5 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        image: "Image must be smaller than 2.5 MB.",
      }));
      return;
    }

    setImage(asset);
    setErrors((current) => ({ ...current, image: "" }));
  };

  const saveEvent = async () => {
    if (saving) return;

    const selectedDate = date ? new Date(`${date}T00:00:00`) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasValidFutureDate =
      selectedDate &&
      !Number.isNaN(selectedDate.getTime()) &&
      selectedDate >= today;

    const cleanedRequirements = requirements
      .map((item) => item.trim())
      .filter(Boolean);
    const nextErrors = {
      ...(!title.trim() ? { title: "Event title is required." } : {}),
      ...(!description.trim()
        ? { description: "Description is required." }
        : {}),
      ...(!cleanedRequirements.length
        ? { requirements: "Add at least one requirement." }
        : {}),
      ...(!location.trim() ? { location: "Event location is required." } : {}),
      ...(!/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) || !hasValidFutureDate
        ? { date: "Choose today or a future date." }
        : {}),
      ...(!time.trim() ? { time: "Event time is required." } : {}),
      ...(!maxVolunteers || Number(maxVolunteers) < 1
        ? { maxVolunteers: "Enter at least 1 volunteer." }
        : {}),
      ...(!image ? { image: "Choose an event image." } : {}),
    };

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrors({ form: "You must be signed in as an admin." });
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadToCloudinary(image);

      await addDoc(collection(db, "volunteer_posts"), {
        title: hideBadWords(title.trim()),
        description: hideBadWords(description.trim()),
        requirements: cleanedRequirements.map((item) => hideBadWords(item)),
        imageUrl,
        meetingLocation: location.trim(),
        locationName: location.trim(),
        meetingDate: date.trim(),
        meetingTime: time.trim(),
        maxVolunteers: Number(maxVolunteers),
        joinedCount: 0,
        volunteers: [],
        status: "open",
        eventType: "nature_cleanup",
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      router.replace("/admin/VolunteerList");
    } catch (error) {
      console.error("Unable to create event:", error);
      setErrors({ form: "Could not create the event. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.fixedHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Back to Volunteer List"
        >
          <Image
            source={require("../../assets/images/backG.png")}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>NATURE AND WASTE RESPONSE</Text>
          <Text style={styles.heading}>Add Event</Text>
          <Text style={styles.subheading}>
            Create a cleanup or environmental activity for volunteers.
          </Text>
        </View>
      </View>
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>
          <Text style={styles.label}>Event title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Community Cleanup Event"
            placeholderTextColor="#91A198"
            style={styles.input}
          />
          {errors.title && <Text style={styles.error}>{errors.title}</Text>}

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the environmental activity"
            placeholderTextColor="#91A198"
            multiline
            style={[styles.input, styles.multilineInput]}
          />
          {errors.description && (
            <Text style={styles.error}>{errors.description}</Text>
          )}

          <Text style={styles.label}>Event image</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <>
                <Text style={styles.imagePickerTitle}>Choose image</Text>
                <Text style={styles.imagePickerHint}>
                  Add a clear photo of the nature or waste activity
                </Text>
              </>
            )}
          </TouchableOpacity>
          {errors.image && <Text style={styles.error}>{errors.image}</Text>}

          <Text style={styles.label}>Volunteer requirements</Text>
          {requirements.map((requirement, index) => (
            <View style={styles.requirementRow} key={`requirement-${index}`}>
              <TextInput
                value={requirement}
                onChangeText={(value) => updateRequirement(value, index)}
                placeholder="Example: Bring gloves"
                placeholderTextColor="#91A198"
                style={[styles.input, styles.requirementInput]}
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeRequirement(index)}
                accessibilityLabel="Remove requirement"
              >
                <Text style={styles.removeText}>-</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addRequirement}
            onPress={addRequirement}
          >
            <Text style={styles.addRequirementText}>+ Add requirement</Text>
          </TouchableOpacity>
          {errors.requirements && (
            <Text style={styles.error}>{errors.requirements}</Text>
          )}

          <Text style={styles.label}>Location</Text>
          <TouchableOpacity
            style={[styles.locationRow, errors.location && styles.inputError]}
            onPress={() => setLocationChoiceVisible(true)}
          >
            <Ionicons name="location-outline" size={20} color="#FFFFFF" />
            <Text style={styles.locationText}>
              {location || "Set Location..."}
            </Text>
          </TouchableOpacity>
          {errors.location && (
            <Text style={styles.error}>{errors.location}</Text>
          )}

          <View
            style={[
              styles.twoColumnRow,
              isNarrow && styles.twoColumnRowStacked,
            ]}
          >
            <View style={styles.column}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={[styles.pickerInput, errors.date && styles.inputError]}
                onPress={() => setCalendarVisible(true)}
              >
                <Ionicons name="calendar-outline" size={19} color="#397A51" />
                <Text
                  style={date ? styles.pickerText : styles.pickerPlaceholder}
                >
                  {date || "Choose date"}
                </Text>
              </TouchableOpacity>
              {errors.date && <Text style={styles.error}>{errors.date}</Text>}
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Time</Text>
              <TouchableOpacity
                style={[styles.pickerInput, errors.time && styles.inputError]}
                onPress={() => setTimeVisible(true)}
              >
                <Ionicons name="time-outline" size={19} color="#397A51" />
                <Text
                  style={time ? styles.pickerText : styles.pickerPlaceholder}
                >
                  {time || "Choose time"}
                </Text>
              </TouchableOpacity>
              {errors.time && <Text style={styles.error}>{errors.time}</Text>}
            </View>
          </View>

          <Text style={styles.label}>Volunteer capacity</Text>
          <TextInput
            value={maxVolunteers}
            onChangeText={(value) => setMaxVolunteers(value.replace(/\D/g, ""))}
            placeholder="Number of volunteers"
            placeholderTextColor="#91A198"
            keyboardType="number-pad"
            style={styles.input}
          />
          {errors.maxVolunteers && (
            <Text style={styles.error}>{errors.maxVolunteers}</Text>
          )}
          {errors.form && <Text style={styles.error}>{errors.form}</Text>}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={saveEvent}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Create Event</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={locationChoiceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationChoiceVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Location</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setLocationChoiceVisible(false);
                setManualLocationVisible(true);
              }}
            >
              <Text style={styles.modalButtonText}>Add Manually</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setLocationChoiceVisible(false);
                setGpsVisible(true);
              }}
            >
              <Text style={styles.modalButtonText}>Use GPS Tracking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setLocationChoiceVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={manualLocationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualLocationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Location</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setBarangayDropdownOpen((current) => !current)}
            >
              <Text
                style={
                  manualBarangay
                    ? styles.dropdownText
                    : styles.pickerPlaceholder
                }
              >
                {manualBarangay || "Select Barangay"}
              </Text>
              <Text style={styles.dropdownArrow}>
                {barangayDropdownOpen ? "^" : "v"}
              </Text>
            </TouchableOpacity>
            {barangayDropdownOpen && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                {BARANGAYS.map((barangay) => (
                  <TouchableOpacity
                    key={barangay}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setManualBarangay(barangay);
                      setBarangayDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>{barangay}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.purokRow}>
              <Text style={styles.purokPrefix}>Pk.</Text>
              <TextInput
                value={manualPurok}
                onChangeText={(value) =>
                  setManualPurok(value.replace(/\D/g, ""))
                }
                placeholder="Purok number"
                placeholderTextColor="#91A198"
                keyboardType="number-pad"
                style={styles.purokInput}
              />
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={selectLocation}
            >
              <Text style={styles.modalButtonText}>Save Location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setManualLocationVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={gpsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGpsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>GPS Tracking</Text>
            <View style={styles.gpsPlaceholder} />
            <Text style={styles.gpsHint}>
              GPS location will be available soon.
            </Text>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setGpsVisible(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose Date</Text>
                <Text style={styles.calendarMonth}>
                  {visibleMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={24} color="#52675A" />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarControls}>
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                disabled={
                  visibleMonth.getFullYear() === new Date().getFullYear() &&
                  visibleMonth.getMonth() === new Date().getMonth()
                }
              >
                <Ionicons name="chevron-back" size={20} color="#397A51" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" size={20} color="#397A51" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((weekday) => (
                <Text key={weekday} style={styles.weekdayText}>
                  {weekday}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {getCalendarDays(visibleMonth).map((calendarDate) => {
                const dateKey = formatDateKey(calendarDate);
                const isCurrentMonth =
                  calendarDate.getMonth() === visibleMonth.getMonth();
                const disabled = !isCurrentMonth || isPastDate(calendarDate);
                const selected = date === dateKey;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    disabled={disabled}
                    style={[styles.dayCell, selected && styles.selectedDay]}
                    onPress={() => {
                      setDate(dateKey);
                      setErrors((current) => ({ ...current, date: "" }));
                      setCalendarVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !isCurrentMonth && styles.mutedDay,
                        disabled && isCurrentMonth && styles.disabledDay,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {calendarDate.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={timeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.modalTitle}>Choose Time</Text>
              <TouchableOpacity onPress={() => setTimeVisible(false)}>
                <Ionicons name="close" size={24} color="#52675A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timeList}>
              {TIME_OPTIONS.map((timeOption) => (
                <TouchableOpacity
                  key={timeOption}
                  style={[
                    styles.timeOption,
                    time === timeOption && styles.selectedTime,
                  ]}
                  onPress={() => {
                    setTime(timeOption);
                    setErrors((current) => ({ ...current, time: "" }));
                    setTimeVisible(false);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="#397A51" />
                  <Text style={styles.timeOptionText}>{timeOption}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F6FA" },
  fixedHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#F5F6FA",
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBE6",
  },
  formScroll: { flex: 1 },
  content: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  backIcon: { width: 32, height: 32 },
  header: { marginBottom: 12 },
  eyebrow: {
    color: "#5F9C76",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heading: { color: "#234B33", fontSize: 24, fontWeight: "800", marginTop: 3 },
  subheading: { color: "#63756A", fontSize: 13, marginTop: 4 },
  formCard: {
    maxWidth: 900,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  label: {
    color: "#284E36",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#24352A",
    backgroundColor: "#FAFCFB",
    fontSize: 14,
    outlineStyle: "none",
  },
  multilineInput: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
  locationRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
  },
  locationText: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  pickerInput: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
    backgroundColor: "#FAFCFB",
  },
  pickerText: { color: "#24352A", fontSize: 14 },
  pickerPlaceholder: { color: "#91A198", fontSize: 14 },
  imagePicker: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    backgroundColor: "#F4F8F5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EAF1EC",
  },
  imagePickerTitle: { color: "#397A51", fontSize: 15, fontWeight: "800" },
  imagePickerHint: {
    color: "#718078",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  error: { color: "#B42318", fontSize: 12, marginTop: 4 },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  requirementInput: { flex: 1 },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDECEC",
  },
  removeText: { color: "#B42318", fontSize: 22, lineHeight: 22 },
  addRequirement: { alignSelf: "flex-start", marginTop: 2 },
  addRequirementText: { color: "#397A51", fontSize: 13, fontWeight: "700" },
  twoColumnRow: { flexDirection: "row", gap: 10 },
  twoColumnRowStacked: { flexDirection: "column", gap: 0 },
  column: { flex: 1, minWidth: 0 },
  saveButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  disabledButton: { opacity: 0.65 },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  modalTitle: { color: "#234B33", fontSize: 19, fontWeight: "800" },
  modalButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#5F9C76",
  },
  modalButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  modalCancel: { alignItems: "center", padding: 12, marginTop: 6 },
  modalCancelText: { color: "#405047", fontSize: 14, fontWeight: "700" },
  dropdown: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
  },
  dropdownText: { color: "#24352A", fontSize: 14 },
  dropdownArrow: { color: "#52675A", fontWeight: "700" },
  dropdownList: {
    maxHeight: 150,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
  },
  dropdownOption: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F0",
  },
  purokRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    borderRadius: 8,
  },
  purokPrefix: { paddingLeft: 12, color: "#52675A", fontWeight: "700" },
  purokInput: { flex: 1, padding: 11, color: "#24352A", fontSize: 14 },
  gpsPlaceholder: {
    height: 180,
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8E3DC",
    backgroundColor: "#FAFCFB",
  },
  gpsHint: { color: "#718078", textAlign: "center", marginTop: 10 },
  calendarCard: {
    width: "100%",
    maxWidth: 460,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  calendarMonth: { color: "#718078", fontSize: 13, marginTop: 3 },
  calendarControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  weekdayRow: { flexDirection: "row", marginTop: 10 },
  weekdayText: { flex: 1, color: "#718078", fontSize: 11, textAlign: "center" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  dayCell: {
    width: "14.2857%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  dayText: { color: "#24352A", fontSize: 13 },
  mutedDay: { color: "#C5CEC8" },
  disabledDay: { color: "#B8C1BB" },
  selectedDay: { backgroundColor: "#5F9C76" },
  selectedDayText: { color: "#FFFFFF", fontWeight: "800" },
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
});
