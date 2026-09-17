import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#2B2621',
  cacaoLight: '#3E3730',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textLight: '#A3998E',
  borderDark: 'rgba(255, 255, 255, 0.08)',
};

const FONT_TITLE = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const FONT_BODY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

interface SlideItem {
  id: string;
  tag: string;
  icon: keyof typeof Ionicons.glyphMap;
  titulo: string;
  subtitulo: string;
}

const SLIDES: SlideItem[] = [
  {
    id: '1',
    tag: 'Ecosistema Integral',
    icon: 'shield-checkmark-outline',
    titulo: 'Cuidado y Seguridad en el Hogar',
    subtitulo:
      'Supervisión continua y coordinación de asistencia especializada para adultos mayores, centralizada en tiempo real.',
  },
  {
    id: '2',
    tag: 'Historial Clínico',
    icon: 'pulse-outline',
    titulo: 'Registro y Relevo Profesional',
    subtitulo:
      'Consignación rigurosa de constantes vitales, esquemas farmacológicos y bitácoras de actividades al término de cada jornada.',
  },
  {
    id: '3',
    tag: 'Detección Temprana',
    icon: 'notifications-outline',
    titulo: 'Notificaciones y Alertas Médicas',
    subtitulo:
      'Protocolos automáticos de aviso ante fluctuaciones críticas de salud o eventos no programados que demandan intervención.',
  },
  {
    id: '4',
    tag: 'Telemetría GPS',
    icon: 'navigate-outline',
    titulo: 'Geolocalización Asistida',
    subtitulo:
      'Ubicación perimetral y navegación inmediata de respuesta enlazada directamente con los dispositivos de seguimiento.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Animación de entrada de texto
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const triggerContentAnimation = () => {
    fadeAnim.setValue(0);
    translateYAnim.setValue(12);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
      triggerContentAnimation();
    }
  };

  const finalizar = async () => {
    await AsyncStorage.setItem('onboarding_completado', 'true');
    router.replace('/login');
  };

  const avanzar = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIdx = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      setCurrentIndex(nextIdx);
      triggerContentAnimation();
    } else {
      finalizar();
    }
  };

  const renderItem = ({ item }: { item: SlideItem }) => {
    return (
      <View style={styles.slideWrap}>
        {/* Orbe del icono animado con aro concéntrico */}
        <View style={styles.iconBackdrop}>
          <View style={styles.iconOuterRing}>
            <View style={styles.iconInnerCircle}>
              <Ionicons name={item.icon} size={42} color={COLORS.gold} />
            </View>
          </View>
        </View>

        {/* Bloque de Textos */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>

          <Text style={styles.titulo}>{item.titulo}</Text>
          <Text style={styles.subtitulo}>{item.subtitulo}</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      {/* Barra Superior: Logotipo y Botón Omitir */}
      <View style={styles.topBar}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {currentIndex < SLIDES.length - 1 ? (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={finalizar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>OMITIR</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Carrusel Deslizable */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      />

      {/* Panel Inferior: Paginador Interactivo y Botón */}
      <View style={styles.bottomArea}>
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });

            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.25, 1, 0.25],
              extrapolate: 'clamp',
            });

            const dotColor = scrollX.interpolate({
              inputRange,
              outputRange: ['rgba(255, 255, 255, 0.3)', COLORS.gold, 'rgba(255, 255, 255, 0.3)'],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: dotColor,
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.btnPrincipal}
          onPress={avanzar}
        >
          <Text style={styles.btnPrincipalText}>
            {currentIndex < SLIDES.length - 1 ? 'CONTINUAR' : 'INGRESAR A LA PLATAFORMA'}
          </Text>
          <Ionicons
            name={currentIndex < SLIDES.length - 1 ? 'arrow-forward' : 'checkmark-sharp'}
            size={16}
            color={COLORS.cacao}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cacao,
  },
  topBar: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 40) : 52,
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 130,
    height: 38,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skipText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: FONT_TITLE,
  },

  // ── SLIDES ──
  slideWrap: {
    width: width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconBackdrop: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOuterRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(191, 154, 64, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(191, 154, 64, 0.03)',
  },
  iconInnerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.cacaoLight,
    borderWidth: 1,
    borderColor: 'rgba(191, 154, 64, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },

  // ── TEXTOS ──
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(191, 154, 64, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(191, 154, 64, 0.3)',
    marginBottom: 14,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: FONT_TITLE,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.4,
    lineHeight: 28,
    fontFamily: FONT_TITLE,
  },
  subtitulo: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    fontFamily: FONT_BODY,
  },

  // ── ÁREA INFERIOR ──
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 24 : 40,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    height: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  btnPrincipal: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnPrincipalText: {
    color: COLORS.cacao,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: FONT_TITLE,
  },
});