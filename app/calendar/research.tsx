import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// --- Types ---
interface CombatPower {
  min: number;
  max: number;
}

interface Reward {
  name: string;
  image: string;
  canBeShiny: boolean;
  combatPower: CombatPower;
}

interface ResearchTask {
  text: string;
  type?: string;
  rewards: Reward[];
}

const API_URL =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/research.min.json";

const getCategoryLabel = (type: string | undefined) => {
  if (!type) return "General";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

// Color Helper
const getCategoryColor = (type: string | undefined) => {
  switch (type) {
    case "catch":
      return "#10B981"; // Emerald
    case "throw":
      return "#F59E0B"; // Amber
    case "battle":
      return "#EF4444"; // Red
    case "explore":
      return "#3B82F6"; // Blue
    case "rocket":
      return "#1F2937"; // Black
    case "buddy":
      return "#EC4899"; // Pink
    default:
      return "#6366F1"; // Indigo
  }
};

export default function ResearchScreen() {
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        const data = await response.json();
        setTasks(data);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const allTypes = tasks.map((t) => t.type || "general");
    const uniqueTypes = Array.from(new Set(allTypes));
    uniqueTypes.sort();
    return ["All", ...uniqueTypes];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (selectedFilter === "All") return tasks;
    return tasks.filter((t) => (t.type || "general") === selectedFilter);
  }, [selectedFilter, tasks]);

  // --- Render Items ---

  const renderRewardItem = (reward: Reward, index: number) => (
    <View key={index} style={styles.rewardCard}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: reward.image }}
          style={styles.pokemonImage}
          resizeMode="contain"
        />
        {reward.canBeShiny && (
          <View style={styles.shinyBadge}>
            <Ionicons name="sparkles" size={10} color="#F59E0B" />
          </View>
        )}
      </View>

      <Text style={styles.pokemonName} numberOfLines={1}>
        {reward.name}
      </Text>

      <View style={styles.cpBadge}>
        <Text style={styles.cpLabel}>CP</Text>
        <Text style={styles.cpValue}>
          {reward.combatPower.min}-{reward.combatPower.max}
        </Text>
      </View>
    </View>
  );

  const renderTaskItem = ({ item }: { item: ResearchTask }) => {
    const color = getCategoryColor(item.type);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.taskText}>{item.text}</Text>
            <Text style={[styles.categoryLabel, { color: color }]}>
              {getCategoryLabel(item.type)}
            </Text>
          </View>
        </View>

        <View style={styles.rewardsContainer}>
          {item.rewards.map((reward, index) => renderRewardItem(reward, index))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {categories.map((cat) => {
            const isActive = selectedFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setSelectedFilter(cat)}
              >
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {cat === "All"
                    ? "All"
                    : getCategoryLabel(cat === "general" ? undefined : cat)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          renderItem={renderTaskItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerLoading}>
              <Text style={styles.emptyText}>No tasks found</Text>
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
    backgroundColor: "#F9FAFB",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // --- Filter ---
  filterContainer: {
    marginTop: 10,
    marginBottom: 10,
    height: 50,
  },
  filterContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterPillActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  filterText: {
    fontSize: 14,
    fontFamily: "KanitMedium", // <--- Font
    color: "#4B5563",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  // --- Card ---
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    marginBottom: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTextContainer: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#1F2937",
    marginBottom: 2,
    lineHeight: 22,
  },
  categoryLabel: {
    fontSize: 11,
    fontFamily: "KanitSemiBold", // <--- Font
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // --- Rewards ---
  rewardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  rewardCard: {
    width: "30%",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 8,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  imageWrapper: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  pokemonImage: {
    width: "100%",
    height: "100%",
  },
  shinyBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderRadius: 12,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  pokemonName: {
    fontSize: 12,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#374151",
    marginBottom: 6,
    textAlign: "center",
  },
  cpBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  cpLabel: {
    fontSize: 9,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#64748B",
    marginRight: 4,
  },
  cpValue: {
    fontSize: 10,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#0F172A",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 20,
    fontFamily: "KanitSemiBold", // <--- Font
  },
});