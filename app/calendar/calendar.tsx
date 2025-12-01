import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  StatusBar,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";

// --- 1. ตั้งค่าภาษาไทย ---
LocaleConfig.locales["th"] = {
  monthNames: [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ],
  monthNamesShort: [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ],
  dayNames: [
    "อาทิตย์",
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
  ],
  dayNamesShort: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."],
  today: "วันนี้",
};
LocaleConfig.defaultLocale = "th";

// --- Types ---
type Event = {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  start: string;
  end: string;
  extraData?: any;
};

// --- Config ---
const API_URL =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json";
const { height } = Dimensions.get("window");

// --- Helpers ---
const getEventColor = (heading: string): string => {
  const h = heading.toLowerCase();
  if (h.includes("raid") || h.includes("battle")) return "#8B5CF6";
  if (h.includes("community")) return "#F59E0B";
  if (h.includes("spotlight")) return "#10B981";
  if (h.includes("season")) return "#EC4899";
  return "#3B82F6";
};

const formatThaiDate = (dateString: string, showTime: boolean = true) => {
  const date = new Date(dateString);
  const year = date.getFullYear() + 543;
  const month = date.toLocaleDateString("th-TH", { month: "long" });
  const day = date.getDate();
  const time = date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (showTime) {
    return `${day} ${month} ${year} เวลา ${time} น.`;
  }
  return `${day} ${month} ${year}`;
};

export default function CleanCalendarScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const eventsOnSelectedDate = useMemo(() => {
    if (!events.length) return [];
    const selStart = new Date(selectedDate + "T00:00:00").getTime();
    const selEnd = new Date(selectedDate + "T23:59:59").getTime();

    return events.filter((item) => {
      const itemStart = new Date(item.start).getTime();
      const itemEnd = new Date(item.end).getTime();
      return itemStart <= selEnd && itemEnd >= selStart;
    });
  }, [selectedDate, events]);

  const handleEventPress = (item: Event) => {
    setSelectedEvent(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedEvent(null);
  };

  const renderEventCard = ({ item }: { item: Event }) => {
    const color = getEventColor(item.heading);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.cardRow}>
          <Image source={{ uri: item.image }} style={styles.cardImage} />
          <View style={styles.cardContent}>
            <View style={[styles.badge, { backgroundColor: color + "15" }]}>
              <Text style={[styles.badgeText, { color: color }]}>
                {item.heading}
              </Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardTime}>
              {new Date(item.start).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
              })}{" "}
              -{" "}
              {new Date(item.end).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <>
          <View style={styles.calendarWrapper}>
            <Calendar
              current={selectedDate}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  disableTouchEvent: true,
                  selectedColor: "#111827",
                  selectedTextColor: "#ffffff",
                },
              }}
              theme={{
                backgroundColor: "#ffffff",
                calendarBackground: "#ffffff",
                textSectionTitleColor: "#b6c1cd",
                selectedDayBackgroundColor: "#111827",
                selectedDayTextColor: "#ffffff",
                todayTextColor: "#6366F1",
                dayTextColor: "#2d4150",
                textDisabledColor: "#d9e1e8",
                arrowColor: "#111827",
                monthTextColor: "#111827",

                // --- FONT CONFIG (KanitSemiBold) ---
                textDayFontFamily: "KanitMedium",
                textMonthFontFamily: "KanitSemiBold",
                textDayHeaderFontFamily: "KanitSemiBold",

                textDayFontSize: 16,
                textMonthFontSize: 20,
                textDayHeaderFontSize: 13,
              }}
            />
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.dateTitle}>
              {new Date(selectedDate).toLocaleDateString("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
            {eventsOnSelectedDate.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {eventsOnSelectedDate.length}
                </Text>
              </View>
            )}
          </View>

          <FlatList
            data={eventsOnSelectedDate}
            renderItem={renderEventCard}
            keyExtractor={(item) => item.eventID}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>ไม่มีกิจกรรมในวันนี้</Text>
              </View>
            }
          />
        </>
      )}

      {/* --- EVENT DETAIL MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedEvent && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image
                  source={{ uri: selectedEvent.image }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />

                <TouchableOpacity
                  style={styles.closeButtonIcon}
                  onPress={closeModal}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>

                <View style={styles.modalContent}>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor:
                          getEventColor(selectedEvent.heading) + "15",
                        alignSelf: "flex-start",
                        marginBottom: 12,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: getEventColor(selectedEvent.heading),
                          fontSize: 12,
                        },
                      ]}
                    >
                      {selectedEvent.heading}
                    </Text>
                  </View>

                  <Text style={styles.modalTitle}>{selectedEvent.name}</Text>

                  <View style={styles.dateSection}>
                    <View style={styles.dateRow}>
                      <Text style={styles.dateLabel}>เริ่ม:</Text>
                      <Text style={styles.dateValue}>
                        {formatThaiDate(selectedEvent.start)}
                      </Text>
                    </View>
                    <View style={styles.dateRow}>
                      <Text style={styles.dateLabel}>สิ้นสุด:</Text>
                      <Text style={styles.dateValue}>
                        {formatThaiDate(selectedEvent.end)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.sectionHeader}>รายละเอียด</Text>
                  <Text style={styles.descriptionText}>
                    กิจกรรมนี้กำลังดำเนินการอยู่!
                    ตรวจสอบโบนัสและโปเกม่อนที่จะปรากฏตัวได้ในลิงก์ด้านล่าง
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: getEventColor(selectedEvent.heading) },
                    ]}
                    onPress={() => Linking.openURL(selectedEvent.link)}
                  >
                    <Text style={styles.actionButtonText}>
                      อ่านรายละเอียดเพิ่มเติม (Web)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={closeModal}
                  >
                    <Text style={styles.secondaryButtonText}>ปิดหน้านี้</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarWrapper: {
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 10,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  dateTitle: {
    fontSize: 16,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#111827",
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#4B5563",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#1F2937",
    marginBottom: 4,
    lineHeight: 22,
  },
  cardTime: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "KanitSemiBold", // <--- Font (Optional, or use Regular)
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "KanitSemiBold", // <--- Font
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    marginTop: 60,
    opacity: 0.5,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "KanitSemiBold", // <--- Font
  },

  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: height * 0.85,
    overflow: "hidden",
  },
  modalImage: {
    width: "100%",
    height: 200,
  },
  closeButtonIcon: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "KanitSemiBold", // <--- Font
    lineHeight: 20,
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#111827",
    marginBottom: 20,
    lineHeight: 32,
  },
  dateSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#6B7280",
  },
  dateValue: {
    fontSize: 14,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#111827",
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 24,
    marginBottom: 30,
    fontFamily: "KanitSemiBold", // <--- Font (or Regular if you prefer body text lighter)
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "KanitSemiBold", // <--- Font
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  secondaryButtonText: {
    color: "#374151",
    fontSize: 16,
    fontFamily: "KanitSemiBold", // <--- Font
  },
});
