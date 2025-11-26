import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Stack, router } from "expo-router";
import { getAllEvents, Events } from "../../lib/events";
import { Ionicons } from "@expo/vector-icons";

export default function EventsScreen() {
  const [events, setEvents] = useState<Events[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const data = await getAllEvents();
      setEvents(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const renderItem = ({ item }: { item: Events }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/events/${item.id}`)}
      >
        {/* รูปภาพกิจกรรม */}
        <Image
          source={{ uri: item.image || "https://via.placeholder.com/400x200" }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        <View style={styles.cardContent}>
          {/* หัวข้อ */}
          <Text style={styles.cardTitle}>{item.title}</Text>

          {/* วันที่สร้าง */}
          <Text style={styles.cardDate}>{item.created_at}</Text>

          {/* รายละเอียด */}
          <Text
            style={styles.cardDesc}
            numberOfLines={3} // ถ้าขยาย ไม่จำกัดบรรทัด
          >
            {item.description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "ข่าวสารและกิจกรรม",
          headerShown: true,
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontFamily: "KanitSemiBold" },
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>ไม่มีกิจกรรมในขณะนี้</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6", // สีพื้นหลังเทาอ่อนๆ สบายตา
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#E5E7EB",
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontFamily: "KanitSemiBold",
    fontSize: 18,
    color: "#1F2937",
    marginBottom: 8,
  },
  cardDate: {
    fontFamily: "KanitRegular",
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: "KanitRegular",
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
  },
  readMoreBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  readMoreText: {
    fontFamily: "KanitMedium",
    fontSize: 14,
    color: "#3B82F6", // สีฟ้า Link
    marginRight: 4,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    fontFamily: "KanitRegular",
    color: "#9CA3AF",
    marginTop: 16,
    fontSize: 16,
  },
});
