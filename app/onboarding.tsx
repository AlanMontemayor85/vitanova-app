import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  // ── 1. CONTENEDOR PRINCIPAL Y PADDING SEGURO ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cacao, // 👈 Fondo oscuro institucional de bienvenida
    alignItems: 'center', 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 40) : 56 
  },

  // ── 2. BOTÓN OMITIR (SKIP) ──
  skipBtn: { 
    position: 'absolute', 
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52, 
    right: 24,
    zIndex: 10
  },
  skipText: { 
    color: COLORS.gold, 
    fontSize: 13, 
    fontWeight: '800',
    letterSpacing: 0.5 
  },

  // ── 3. LOGOTIPO Y CONTENIDO CENTRAL ──
  logoWrap: { 
    marginBottom: 16 
  },
  logo: { 
    width: 180, 
    height: 120,
    resizeMode: 'contain'
  },
  content: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 32 
  },
  icon: { 
    fontSize: 72, 
    marginBottom: 20 
  },
  titulo: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.white, 
    textAlign: 'center', 
    marginBottom: 14, 
    letterSpacing: 0.5 
  },
  subtitulo: { 
    fontSize: 15, 
    color: COLORS.cream, 
    textAlign: 'center', 
    lineHeight: 22,
    opacity: 0.85
  },

  // ── 4. INDICADORES DE PAGINACIÓN (DOTS) ──
  dots: { 
    flexDirection: 'row', 
    gap: 8, 
    marginBottom: 32 
  },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: 'rgba(255,255,255,0.25)' 
  },
  dotActive: { 
    backgroundColor: COLORS.gold, 
    width: 24,
    borderRadius: 4 
  },

  // ── 5. BOTÓN DE ACCIÓN PRINCIPAL ──
  btn: {
    backgroundColor: COLORS.gold, 
    borderRadius: 14,
    paddingVertical: 16, 
    paddingHorizontal: 32,
    marginHorizontal: 24, 
    width: width - 48, 
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 28 : 36,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnText: { 
    color: COLORS.cacao, 
    fontSize: 15, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
});