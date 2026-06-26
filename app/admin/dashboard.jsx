import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function Dashboard() {
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;

  // keep your calculations
  const sidebarWidth =
    width >= 1024 ? 300 : Math.max(200, width * 0.25);

  const contentWidth = width - sidebarWidth;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      <View
        style={[
          styles.cards,
          { flexWrap: isDesktop ? 'nowrap' : 'wrap' },
        ]}
      >
        <View
          style={[
            styles.cardContainer,
            {
              width: isDesktop
                ? contentWidth * 0.22
                : contentWidth * 0.45,
            },
          ]}
        >
          <View style={[styles.card, styles.card1]}>
            <Text style={cardTextStyle(isDesktop)}>44</Text>
          </View>

          <Text style={styles.cardLabel}>Critical Situation</Text>
        </View>

        <View
          style={[
            styles.cardContainer,
            {
              width: isDesktop
                ? contentWidth * 0.22
                : contentWidth * 0.45,
            },
          ]}
        >
          <View style={[styles.card, styles.card2]}>
            <Text style={cardTextStyle(isDesktop)}>44</Text>
          </View>

          <Text style={styles.cardLabel}>Moderate Situation</Text>
        </View>

        <View
          style={[
            styles.cardContainer,
            {
              width: isDesktop
                ? contentWidth * 0.22
                : contentWidth * 0.45,
            },
          ]}
        >
          <View style={[styles.card, styles.card3]}>
            <Text style={cardTextStyle(isDesktop)}>44</Text>
          </View>

          <Text style={styles.cardLabel}>Cleaned</Text>
        </View>

        <View
          style={[
            styles.cardContainer,
            {
              width: isDesktop
                ? contentWidth * 0.22
                : contentWidth * 0.45,
            },
          ]}
        >
          <View style={[styles.card, styles.card4]}>
            <Text style={cardTextStyle(isDesktop)}>44</Text>
          </View>

          <Text style={styles.cardLabel}>On-going</Text>
        </View>
      </View>
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

  cards: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },

  cardContainer: {
    alignItems: 'center',
  },

  card: {
    width: '100%',
    aspectRatio: 3 / 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },

  cardLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#599A74',
    textAlign: 'center',
  },

  card1: {
    backgroundColor: '#FF6666',
  },

  card2: {
    backgroundColor: '#FFCF30',
  },

  card3: {
    backgroundColor: '#2DCC6F',
  },

  card4: {
    backgroundColor: '#A5A5A5',
  },
});

const cardTextStyle = (isDesktop) => ({
  fontSize: isDesktop ? 32 : 24,
  fontWeight: 'bold',
  color: '#fff',
});