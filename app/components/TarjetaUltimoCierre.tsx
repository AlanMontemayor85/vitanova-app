import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getHistorialCierres, getUltimoCierre } from '../../services/api';

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#FBF7EE',
  goldBorder: '#E8DCC4',
  cacao: '#3E3832',
  cream: '#FDFCFB',
  white: '#FFFFFF',
  textDark: '#1E1B18',
  textMuted: '#6D645B',
  textLight: '#998E84',
  border: '#ECE7DF',
  green: '#10B981',
  greenPale: '#ECFDF5',
  amber: '#F59E0B',
  amberPale: '#FFFBEB',
  red: '#EF4444',
  redPale: '#FEF2F2',
  blue: '#0284C7',
  bluePale: '#F0F9FF',
  trackBg: '#EAE5DC',
};

const EMOJIS_ANIMO: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  bien: { label: 'Bien / Estable', icon: 'happy-outline', color: '#10B981', bg: '#ECFDF5' },
  tranquilo: { label: 'Tranquilo', icon: 'leaf-outline', color: '#10B981', bg: '#ECFDF5' },
  alegre: { label: 'Alegre y Comunicativo', icon: 'sunny-outline', color: '#BF9A40', bg: '#FBF7EE' },
  ansioso: { label: 'Ansioso / Intranquilo', icon: 'pulse-outline', color: '#F59E0B', bg: '#FFFBEB' },
  triste: { label: 'Bajo de Ánimo', icon: 'cloud-outline', color: '#6D645B', bg: '#F5F2EC' },
  agitado: { label: 'Agitado / Reactivo', icon: 'warning-outline', color: '#EF4444', bg: '#FEF2F2' },
  confundido: { label: 'Confuso / Desorientado', icon: 'help-circle-outline', color: '#8B5CF6', bg: '#F5F3FF' },
  somnoliento: { label: 'Somnoliento', icon: 'moon-outline', color: '#6366F1', bg: '#EEF2FF' },
  regular: { label: 'Regular / Neutro', icon: 'remove-circle-outline', color: '#6D645B', bg: '#F5F2EC' },
  malo: { label: 'Con Malestar', icon: 'bandage-outline', color: '#EF4444', bg: '#FEF2F2' },
};

interface Props {
  pacienteId: string;
}

export const TarjetaUltimoCierre: React.FC<Props> = ({ pacienteId }) => {
  const [cierre, setCierre] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ── ANIMACIONES PERS / SUPERVISIÓN CLÍNICA ──
  const fadeSlideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (!loading && cierre) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    }

    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [loading, cierre]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.6],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.5, 0.2, 0],
  });

  const animarEntrada = () => {
    fadeSlideAnim.setValue(0);
    Animated.spring(fadeSlideAnim, {
      toValue: 1,
      friction: 8,
      tension: 45,
      useNativeDriver: true,
    }).start();
  };

  useFocusEffect(
    useCallback(() => {
      if (pacienteId) {
        cargarCierre();
      }
    }, [pacienteId])
  );

  const cargarCierre = async () => {
    try {
      setLoading(true);
      let res = await getUltimoCierre(pacienteId);
      let registro = desempaquetarRegistro(res);

      if (!registro || (registro.dolor_eva === undefined && !registro.created_at && !registro.id)) {
        const resHistorial = await getHistorialCierres(pacienteId);
        const listaHistorial = Array.isArray(resHistorial)
          ? resHistorial
          : (resHistorial?.cierres || resHistorial?.data || []);

        if (listaHistorial.length > 0) {
          registro = listaHistorial[0];
        }
      }

      setCierre(registro);
      animarEntrada();
    } catch (e) {
      console.error('Error cargando el último cierre:', e);
      setCierre(null);
    } finally {
      setLoading(false);
    }
  };

  const desempaquetarRegistro = (res: any) => {
    if (!res || res.error) return null;
    if (Array.isArray(res)) return res[0] || null;
    if (Array.isArray(res.cierres) && res.cierres.length > 0) return res.cierres[0];
    if (Array.isArray(res.data) && res.data.length > 0) return res.data[0];
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data;
    if (res.cierre && typeof res.cierre === 'object') return res.cierre;
    if (res.dolor_eva !== undefined || res.estado_animo !== undefined || res.created_at || res.id) {
      return res;
    }
    return null;
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.centerBox]}>
        <ActivityIndicator size="small" color={COLORS.gold} />
        <Text style={styles.loadingText}>Sincronizando reporte de relevo...</Text>
      </View>
    );
  }

  if (!cierre) {
    return (
      <View style={styles.card}>
        <View style={styles.statusStripe} />
        <View style={styles.cardContent}>
          <View style={styles.emptyHeader}>
            <Ionicons name="clipboard-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.cardTitle}>Estado del Último Relevo</Text>
          </View>
          <Text style={styles.emptyText}>Sin registros clínicos de cierre de turno recientes.</Text>
        </View>
      </View>
    );
  }

  // ── PARSEO DE MÉTRICAS ──
  const dolorVal = Math.min(10, Math.max(0, Number(cierre.dolor_eva ?? cierre.dolorEva ?? 0)));
  const animoRaw = (cierre.estado_animo || cierre.estadoAnimo || cierre.estado_paciente || '').toString().toLowerCase().trim();
  const animoConfig = EMOJIS_ANIMO[animoRaw] || {
    label: animoRaw ? animoRaw.charAt(0).toUpperCase() + animoRaw.slice(1) : 'Estable',
    icon: 'happy-outline',
    color: COLORS.gold,
    bg: COLORS.goldPale,
  };

  const hidratacionVal = Math.min(8, Math.max(0, Number(cierre.hidratacion_vasos ?? cierre.hidratacionVasos ?? cierre.hidratacion ?? 0)));
  const alimentacionRaw = (cierre.alimentacion || '').toString().toLowerCase().trim();

  let nutricionPorcentaje = 0;
  let nutricionLabel = 'No especificada';
  if (['completa', 'bien', 'buena', '100%'].includes(alimentacionRaw)) {
    nutricionPorcentaje = 100;
    nutricionLabel = 'Completa (100%)';
  } else if (['parcial', 'regular', '50%'].includes(alimentacionRaw)) {
    nutricionPorcentaje = 60;
    nutricionLabel = 'Parcial (60%)';
  } else if (['ninguna', 'mala', 'nula', '0%'].includes(alimentacionRaw)) {
    nutricionPorcentaje = 15;
    nutricionLabel = 'Baja (<25%)';
  } else if (alimentacionRaw) {
    nutricionPorcentaje = 75;
    nutricionLabel = alimentacionRaw;
  }

  // Escala EVA color
  let dolorColor = COLORS.green;
  let dolorLabel = 'Confortable';
  if (dolorVal >= 4 && dolorVal <= 6) {
    dolorColor = COLORS.amber;
    dolorLabel = 'Moderado';
  } else if (dolorVal >= 7) {
    dolorColor = COLORS.red;
    dolorLabel = 'Severo';
  }

  const responsable = cierre.cuidador_nombre || cierre.usuario_nombre || cierre.cuidador;
  const fechaIso = cierre.created_at || cierre.fecha;

  const translateY = fadeSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeSlideAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.statusStripe} />

      <View style={styles.cardContent}>
        {/* Cabecera */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <View style={styles.beaconContainer}>
              <Animated.View
                style={[
                  styles.radarPulseRing,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <View style={styles.iconBubble}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.gold} />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Estado del Último Relevo</Text>
              <View style={styles.subStatusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.subStatusText} numberOfLines={1}>
                  {responsable ? `Por: ${responsable}` : 'Reporte clínico de enfermería'}
                </Text>
              </View>
            </View>
          </View>

          {fechaIso && (
            <View style={styles.timestampBadgeGroup}>
              <View style={styles.fechaBadge}>
                <Ionicons name="calendar-outline" size={11} color={COLORS.gold} />
                <Text style={styles.fechaText}>
                  {new Date(fechaIso).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
              </View>
              <Text style={styles.horaText}>
                {new Date(fechaIso).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </View>
          )}
        </View>

        {/* ── HILERAS CON NIVELES VISUALES (REEMPLAZO DE LA REJILLA 2X2) ── */}
        <View style={styles.hilerasContainer}>

          {/* 1. HILERA DOLOR (EVA) - BARRAS SEGMENTADAS */}
          <View style={styles.hileraRow}>
            <View style={styles.hileraHeader}>
              <View style={styles.hileraLabelGroup}>
                <Ionicons name="fitness-outline" size={14} color={dolorColor} />
                <Text style={styles.hileraLabel}>Dolor (EVA)</Text>
              </View>
              <Text style={[styles.hileraValor, { color: dolorColor }]}>
                {dolorVal}/10 <Text style={styles.hileraSubvalor}>· {dolorLabel}</Text>
              </Text>
            </View>

            {/* Raya segmentada de 10 niveles */}
            <View style={styles.segmentosTrack}>
              {[...Array(10)].map((_, i) => {
                const activo = i < dolorVal;
                let segColor = COLORS.green;
                if (i >= 3 && i < 6) segColor = COLORS.amber;
                if (i >= 6) segColor = COLORS.red;

                return (
                  <View
                    key={i}
                    style={[
                      styles.segmentoBar,
                      {
                        backgroundColor: activo ? segColor : COLORS.trackBg,
                        opacity: activo ? 1 : 0.4,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* 2. HILERA HIDRATACIÓN - 8 CÁPSULAS DE AGUA */}
          <View style={styles.hileraRow}>
            <View style={styles.hileraHeader}>
              <View style={styles.hileraLabelGroup}>
                <Ionicons name="water-outline" size={14} color={COLORS.blue} />
                <Text style={styles.hileraLabel}>Hidratación</Text>
              </View>
              <Text style={[styles.hileraValor, { color: COLORS.blue }]}>
                {hidratacionVal}/8 <Text style={styles.hileraSubvalor}>vasos ({hidratacionVal * 250} ml)</Text>
              </Text>
            </View>

            {/* 8 Vasos/Cápsulas */}
            <View style={styles.segmentosTrack}>
              {[...Array(8)].map((_, i) => {
                const lleno = i < hidratacionVal;
                return (
                  <View
                    key={i}
                    style={[
                      styles.vasoPill,
                      {
                        backgroundColor: lleno ? COLORS.blue : COLORS.trackBg,
                        opacity: lleno ? 1 : 0.35,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* 3. HILERA NUTRICIÓN - BARRA CONTINUA DE PROGRESO */}
          <View style={styles.hileraRow}>
            <View style={styles.hileraHeader}>
              <View style={styles.hileraLabelGroup}>
                <Ionicons name="restaurant-outline" size={14} color="#059669" />
                <Text style={styles.hileraLabel}>Nutrición</Text>
              </View>
              <Text style={[styles.hileraValor, { color: '#059669' }]}>
                {nutricionLabel}
              </Text>
            </View>

            {/* Barra continua con medidor */}
            <View style={styles.barraTrack}>
              <View
                style={[
                  styles.barraFill,
                  {
                    width: `${nutricionPorcentaje}%`,
                    backgroundColor: nutricionPorcentaje >= 75 ? '#059669' : nutricionPorcentaje >= 40 ? COLORS.amber : COLORS.red,
                  },
                ]}
              />
            </View>
          </View>

          {/* 4. HILERA ÁNIMO / CONDUCTA - BADGE EXPRESIVO */}
          <View style={[styles.hileraRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.hileraHeader}>
              <View style={styles.hileraLabelGroup}>
                <Ionicons name={animoConfig.icon as any} size={14} color={animoConfig.color} />
                <Text style={styles.hileraLabel}>Ánimo / Conducta</Text>
              </View>
              <View style={[styles.animoChip, { backgroundColor: animoConfig.bg }]}>
                <Text style={[styles.animoChipText, { color: animoConfig.color }]}>
                  {animoConfig.label}
                </Text>
              </View>
            </View>
          </View>

        </View>

        {/* Observaciones e Incidentes del Turno */}
        {(cierre.observaciones || cierre.notas) && (
          <View style={styles.notasContainer}>
            <View style={styles.notasHeader}>
              <Ionicons name="document-text-outline" size={14} color={COLORS.cacao} />
              <Text style={styles.notasTitle}>Observaciones del Turno</Text>
            </View>

            {cierre.observaciones ? (
              <Text style={styles.notasText}>{cierre.observaciones}</Text>
            ) : null}

            {cierre.notas &&
            cierre.notas !== 'Sin notas incidentales en el turno.' &&
            cierre.notas !== cierre.observaciones ? (
              <Text
                style={[
                  styles.notasText,
                  cierre.observaciones && styles.notasSecundarias,
                ]}
              >
                {cierre.notas}
              </Text>
            ) : null}

            {!cierre.observaciones && cierre.notas === 'Sin notas incidentales en el turno.' && (
              <Text style={styles.notasVaciasText}>
                Sin incidencias ni desviaciones clínicas reportadas durante la jornada.
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  centerBox: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statusStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: COLORS.gold,
    zIndex: 2,
  },
  cardContent: {
    padding: 16,
    paddingLeft: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  beaconContainer: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarPulseRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.gold,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.goldPale,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.cacao,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },
  subStatusText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  timestampBadgeGroup: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fechaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.goldPale,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  fechaText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.gold,
  },
  horaText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
  },

  // ── ESTILOS DE HILERAS CLÍNICAS ──
  hilerasContainer: {
    backgroundColor: '#FAFAF8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  hileraRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  hileraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hileraLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hileraLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.cacao,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  hileraValor: {
    fontSize: 12,
    fontWeight: '800',
  },
  hileraSubvalor: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  segmentosTrack: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  segmentoBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  vasoPill: {
    flex: 1,
    height: 7,
    borderRadius: 4,
  },
  barraTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.trackBg,
    overflow: 'hidden',
  },
  barraFill: {
    height: '100%',
    borderRadius: 4,
  },
  animoChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  animoChipText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Notas
  notasContainer: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  notasTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.cacao,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  notasText: {
    fontSize: 12,
    color: COLORS.textDark,
    lineHeight: 18,
    fontWeight: '600',
  },
  notasSecundarias: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  notasVaciasText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginTop: 2,
  },
});