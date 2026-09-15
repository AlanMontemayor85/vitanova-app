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
};

const EMOJIS_ANIMO: Record<string, { label: string; icon: string }> = {
  bien: { label: 'Bien / Estable', icon: 'happy-outline' },
  tranquilo: { label: 'Tranquilo', icon: 'leaf-outline' },
  alegre: { label: 'Alegre y Comunicativo', icon: 'sunny-outline' },
  ansioso: { label: 'Ansioso / Intranquilo', icon: 'pulse-outline' },
  triste: { label: 'Bajo de Ánimo', icon: 'cloud-outline' },
  agitado: { label: 'Agitado / Reactivo', icon: 'warning-outline' },
  confundido: { label: 'Confuso / Desorientado', icon: 'help-circle-outline' },
  somnoliento: { label: 'Somnoliento / Aletargado', icon: 'moon-outline' },
  regular: { label: 'Regular / Neutro', icon: 'remove-circle-outline' },
  malo: { label: 'Con Malestar', icon: 'bandage-outline' },
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

  // Radar sutil para denotar sincronización clínica activa
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

  // Parseo de métricas clínicas
  const dolorVal = Number(cierre.dolor_eva ?? cierre.dolorEva ?? 0);
  const animoRaw = (cierre.estado_animo || cierre.estadoAnimo || cierre.estado_paciente || '').toString().toLowerCase().trim();
  const animoConfig = EMOJIS_ANIMO[animoRaw] || {
    label: animoRaw ? animoRaw.charAt(0).toUpperCase() + animoRaw.slice(1) : 'No especificado',
    icon: 'happy-outline',
  };

  const hidratacionVal = Number(cierre.hidratacion_vasos ?? cierre.hidratacionVasos ?? cierre.hidratacion ?? 0);
  const alimentacionRaw = (cierre.alimentacion || '').toString().toLowerCase().trim();

  let alimentacionTexto = 'No especificada';
  if (['completa', 'bien', 'buena'].includes(alimentacionRaw)) {
    alimentacionTexto = 'Completa (100%)';
  } else if (['parcial', 'regular'].includes(alimentacionRaw)) {
    alimentacionTexto = 'Parcial (25-75%)';
  } else if (['ninguna', 'mala', 'nula'].includes(alimentacionRaw)) {
    alimentacionTexto = 'Nula (<25%)';
  } else if (alimentacionRaw) {
    alimentacionTexto = alimentacionRaw;
  }

  // Semáforo EVA dinámico
  let dolorBg = COLORS.greenPale;
  let dolorColor = COLORS.green;
  let dolorLabel = 'Leve / Confortable';

  if (dolorVal >= 4 && dolorVal <= 6) {
    dolorBg = COLORS.amberPale;
    dolorColor = COLORS.amber;
    dolorLabel = 'Moderado';
  } else if (dolorVal >= 7) {
    dolorBg = COLORS.redPale;
    dolorColor = COLORS.red;
    dolorLabel = 'Severo / Requiere Atención';
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
      {/* Franja lateral telemática PERS en color Oro Clínico */}
      <View style={styles.statusStripe} />

      <View style={styles.cardContent}>
        {/* Cabecera con Radar Beacon y Metadatos */}
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
                <Ionicons name="shield-checkmark" size={19} color={COLORS.gold} />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Estado del Último Relevo</Text>
              <View style={styles.subStatusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.subStatusText} numberOfLines={1}>
                  {responsable ? `Por: ${responsable}` : 'Reporte de enfermería asentado'}
                </Text>
              </View>
            </View>
          </View>

          {/* Badges de Fecha y Hora sincronizados */}
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

        {/* Rejilla Modular de Signos y Cuidados (2x2) */}
        <View style={styles.grid}>
          {/* 1. Dolor EVA */}
          <View style={[styles.moduleCard, { borderColor: dolorColor, backgroundColor: dolorBg }]}>
            <View style={styles.moduleHeader}>
              <Ionicons name="fitness-outline" size={15} color={dolorColor} />
              <Text style={[styles.moduleLabel, { color: dolorColor }]}>Dolor (EVA)</Text>
            </View>
            <Text style={[styles.moduleValue, { color: dolorColor }]}>
              {`${dolorVal}/10`}
            </Text>
            <Text style={[styles.moduleSubtext, { color: dolorColor }]} numberOfLines={1}>
              {dolorLabel}
            </Text>
          </View>

          {/* 2. Ánimo / Conducta */}
          <View style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <Ionicons name={animoConfig.icon as any} size={15} color={COLORS.gold} />
              <Text style={styles.moduleLabel}>Ánimo / Conducta</Text>
            </View>
            <Text style={styles.moduleValue} numberOfLines={1}>
              {animoConfig.label}
            </Text>
            <Text style={styles.moduleSubtext}>Respuesta cognitiva</Text>
          </View>

          {/* 3. Hidratación */}
          <View style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <Ionicons name="water-outline" size={15} color="#0284C7" />
              <Text style={styles.moduleLabel}>Hidratación</Text>
            </View>
            <Text style={styles.moduleValue}>
              {`${hidratacionVal}/8`} <Text style={styles.unitText}>vasos</Text>
            </Text>
            <Text style={styles.moduleSubtext}>
              {hidratacionVal > 0 ? `Aprox. ${hidratacionVal * 250} ml` : 'Sin consumo registrado'}
            </Text>
          </View>

          {/* 4. Alimentación */}
          <View style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <Ionicons name="restaurant-outline" size={15} color="#059669" />
              <Text style={styles.moduleLabel}>Nutrición</Text>
            </View>
            <Text style={styles.moduleValue} numberOfLines={1}>
              {alimentacionTexto}
            </Text>
            <Text style={styles.moduleSubtext}>Ingesta calórica</Text>
          </View>
        </View>

        {/* Sección de Observaciones y Notas Clínicas */}
        {(cierre.observaciones || cierre.notas) && (
          <View style={styles.notasContainer}>
            <View style={styles.notasHeader}>
              <Ionicons name="document-text-outline" size={15} color={COLORS.cacao} />
              <Text style={styles.notasTitle}>Observaciones e Incidentes del Turno</Text>
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
    gap: 12,
    flex: 1,
  },
  beaconContainer: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarPulseRing: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.gold,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.goldPale,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  cardTitle: {
    fontSize: 14,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moduleCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  moduleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  moduleValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  unitText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  moduleSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  notasContainer: {
    marginTop: 14,
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
    marginBottom: 6,
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