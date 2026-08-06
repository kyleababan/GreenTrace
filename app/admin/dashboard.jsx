import { collection, getDocs } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

function AnalyticsBar({ label, value, color, highestValue, chartHeight, index }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);
  const barHeight =
    value === 0
      ? chartHeight * 0.14
      : Math.max(chartHeight * 0.25, (value / highestValue) * chartHeight);

  useEffect(() => {
    progress.setValue(0);
    setDisplayValue(0);

    const animationDelay = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, index * 110);

    const startTime = Date.now() + index * 110;
    let frameId;

    const countUp = () => {
      const elapsed = Date.now() - startTime;
      const nextValue = Math.min(value, Math.round((Math.max(0, elapsed) / 700) * value));
      setDisplayValue(nextValue);

      if (nextValue < value) frameId = requestAnimationFrame(countUp);
    };

    frameId = requestAnimationFrame(countUp);

    return () => {
      clearTimeout(animationDelay);
      cancelAnimationFrame(frameId);
    };
  }, [index, progress, value]);

  return (
    <View style={styles.statColumn}>
      <View style={[styles.barTrack, { height: chartHeight }]}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, barHeight],
              }),
            },
          ]}
        >
          <Text style={styles.barValue}>{displayValue}</Text>
        </Animated.View>
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function Dashboard() {
  const { width } = useWindowDimensions();

  const [stats, setStats] = useState(null);

const loadDashboard = async () => {

    try {

        const snapshot = await getDocs(
            collection(db, "posts")
        );

        let critical = 0;
        let pending = 0;
        let moderate = 0;
        let cleaned = 0;
        let ongoing = 0;

        snapshot.forEach((doc) => {

            const post = doc.data();

            switch (post.status) {

                case "pending":
                    pending++;
                    break;

                case "critical":
                    critical++;
                    break;

                case "moderate":
                    moderate++;
                    break;

                case "cleaned":
                    cleaned++;
                    break;

                case "ongoing":
                    ongoing++;
                    break;

            }

        });

        setStats({

            critical,

            pending,

            moderate,

            cleaned,

            ongoing,

        });

    } catch (error) {

        console.log(error);
        setStats({
            critical: 0,
            pending: 0,
            moderate: 0,
            cleaned: 0,
            ongoing: 0,
        });

    }

};

useEffect(() => {

    loadDashboard();

}, []);

  const isDesktop = width >= 1024;

  const chartHeight = isDesktop ? 360 : 250;
  const highestValue = stats
    ? Math.max(...Object.values(stats), 1)
    : 1;
  const chartStats = [
    { key: "pending", label: "Not Yet Assessed", color: "#A5A5A5" },
    { key: "critical", label: "Critical Situation", color: "#FF6666" },
    { key: "moderate", label: "Moderate Situation", color: "#FFCF30" },
    { key: "cleaned", label: "Cleaned", color: "#2DCC6F" },
    { key: "ongoing", label: "On-going", color: "#7DD3FC" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      {stats ? (
        <View style={styles.cards}>
          {chartStats.map((stat, index) => (
            <View key={stat.key} style={styles.cardContainer}>
              <AnalyticsBar
                label={stat.label}
                value={stats[stat.key]}
                color={stat.color}
                highestValue={highestValue}
                chartHeight={chartHeight}
                index={index}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#599A74" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 50,
    color: '#599A74',
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },

  cardContainer: {
    flexGrow: 1,
    flexBasis: 140,
    alignItems: 'center',
  },

  statColumn: {
    width: '100%',
    alignItems: 'center',
  },

  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#E7ECE9',
  },

  bar: {
    width: '100%',
    minHeight: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  barValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },

  cardLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#599A74',
    textAlign: 'center',
  },

});
