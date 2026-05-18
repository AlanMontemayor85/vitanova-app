import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
};

const SLIDES = [
  {
    icon: '🏠',
    titulo: 'Cuidado en el hogar',
    subtitulo: 'Monitorea a tu familiar desde donde estés, en tiempo real.',
    color: '#4A4540',
  },
  {
    icon: '🩺',
    titulo: 'Registro clínico real',
    subtitulo: 'El cuidador registra signos vitales, medicamentos y actividades en cada turno.',
    color: '#2C2820',
  },
  {
    icon: '🔔',
    titulo: 'Alertas inteligentes',
    subtitulo: 'Recibe notificaciones cuando algo requiere tu atención. Siempre informado.',
    color: '#4A4540',
  },
  {
    icon: '📍',
    titulo: 'Ubicación en tiempo real',
    subtitulo: 'Sabe dónde está tu familiar en todo momento con GPS integrado.',
    color: '#2C2820',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const siguiente = async () => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      await AsyncStorage.setItem('onboarding_completado', 'true');
      router.replace('/login');
    }
  };

  const saltar = async () => {
    await AsyncStorage.setItem('onboarding_completado', 'true');
    router.replace('/login');
  };

  const slide = SLIDES[index];

  return (
    <View style={[styles.container, { backgroundColor: slide.color }]}>
      <StatusBar barStyle="light-content" backgroundColor={slide.color} />

      {/* Skip */}
      {index < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={saltar}>
          <Text style={styles.skipText}>Omitir</Text>
        </TouchableOpacity>
      )}

      {/* Logo */}
      <View style={styles.logoWrap}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.titulo}>{slide.titulo}</Text>
        <Text style={styles.subtitulo}>{slide.subtitulo}</Text>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Botón */}
      <TouchableOpacity style={styles.btn} onPress={siguiente}>
        <Text style={styles.btnText}>
          {index < SLIDES.length - 1 ? 'Siguiente →' : 'Comenzar'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 60 },
  skipBtn: { position: 'absolute', top: 56, right: 24 },
  skipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  logoWrap: { marginBottom: 20 },
  logo: { width: 180, height: 120 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 72, marginBottom: 24 },
  titulo: { fontSize: 26, fontWeight: '900', color: COLORS.white, textAlign: 'center', marginBottom: 16, letterSpacing: 0.5 },
  subtitulo: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: COLORS.gold, width: 24 },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48,
    marginHorizontal: 24, width: width - 48, alignItems: 'center',
  },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});