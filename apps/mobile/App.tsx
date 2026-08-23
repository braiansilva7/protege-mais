import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Protege Mais</Text>
        <Text style={styles.subtitle}>O jogo está em preparação.</Text>
      </View>
      <StatusBar barStyle="dark-content" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fffaf2',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#7f4f24',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5f4a32',
    fontSize: 16,
    marginTop: 12,
  },
});
