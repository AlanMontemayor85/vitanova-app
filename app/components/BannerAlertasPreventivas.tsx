import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getHistorialCierres } from '../../services/api';

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

interface AlertaTamizaje {
  id: string;
  nivel: 'RED' | 'AMBER';
  titulo: string;
  mensaje: string;
  escala: string;
  icono: string;
}

interface Props {
  pacienteId: string;
}

export const BannerAlertasPreventivas: React.FC<Props> = ({ pacienteId }) => {
  const [alertas, setAlertas] = useState<AlertaTamizaje[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ── ANIMACIONES PERS / SUPERVISIÓN CLÍNICA ──
  const fadeSlideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (!loading) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2400,
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
  }, [loading, alertas.length]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.65],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.45, 0.2, 0],
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

  useEffect(() => {
    if (pacienteId) {
      analizarHistorial();
    }
  }, [pacienteId]);

  const analizarHistorial = async () => {
    try {
      setLoading(true);
      const res = await getHistorialCierres(pacienteId);
      const historial = res?.turnos_tamizaje || (Array.isArray(res) ? res : res?.cierres || []);

      if (historial.length > 0) {
        const resultadoAlertas = evaluarPatronesPreventivos(historial);
        setAlertas(resultadoAlertas);
      } else {
        setAlertas([]);
      }
      animarEntrada();
    } catch (error) {
      console.error('Error al analizar historial de cierres:', error);
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 MOTOR DE REGLAS DE TAMIZAJE CLÍNICO
  const evaluarPatronesPreventivos = (historial: any[]): AlertaTamizaje[] => {
    const hallazgos: AlertaTamizaje[] = [];
    const ultimosTurnos = historial.slice(0, 7);

    // 1. 🔴 DOLOR PERSISTENTE (Escala EVA)
    const turnosConDolorModeradoOAlto = ultimosTurnos.filter(
      t => t.dolor_eva !== null && t.dolor_eva >= 4
    );

    if (turnosConDolorModeradoOAlto.length >= 2) {
      const hayDolorSevero = turnosConDolorModeradoOAlto.some(t => t.dolor_eva >= 7);
      hallazgos.push({
        id: 'alerta_dolor',
        nivel: hayDolorSevero ? 'RED' : 'AMBER',
        titulo: hayDolorSevero ? 'Dolor Severo Recurrente' : 'Molestia / Dolor Persistente',
        mensaje: `Se han registrado ${turnosConDolorModeradoOAlto.length} turnos recientes con intensidad de dolor EVA ≥ 4. Se sugiere evaluar la efectividad del esquema analgésico actual.`,
        escala: 'Escala Visual Analógica (EVA)',
        icono: 'fitness-outline',
      });
    }

    // 2. 🧠 FLUCTUACIÓN CONDUCTUAL / DELIRIUM (Criterios CAM / NPI-Q)
    const turnosAgitadoOConfuso = ultimosTurnos.filter(
      t => t.estado_animo?.toLowerCase() === 'confundido' || t.estado_animo?.toLowerCase() === 'agitado'
    );

    if (turnosAgitadoOConfuso.length >= 2) {
      hallazgos.push({
        id: 'alerta_conducta',
        nivel: 'RED',
        titulo: 'Fluctuación Psicoconductual Detectada',
        mensaje: `Inestabilidad o confusión recurrente en los últimos cierres. Estos cambios suelen asociarse a estados confusionales agudos o malestar físico no expresado.`,
        escala: 'Criterios CAM / Cuestionario NPI-Q',
        icono: 'pulse-outline',
      });
    }

    // 3. 💧 RIESGO DE DESHIDRATACIÓN (Guías ESPEN Geriatría)
    const turnosBajaHidratacion = ultimosTurnos.filter(
      t => t.hidratacion_vasos !== null && t.hidratacion_vasos < 4
    );

    if (turnosBajaHidratacion.length >= 2) {
      hallazgos.push({
        id: 'alerta_hidratacion',
        nivel: 'AMBER',
        titulo: 'Bajo Aporte Hídrico Recurrente',
        mensaje: `Consumo inferior a 4 vasos (1.0 L) en múltiples turnos. Se recomienda promover la ingesta constante de líquidos para prevenir estreñimiento, hipotensión u oligosintomatología renal.`,
        escala: 'Guías de Nutrición e Hidratación ESPEN',
        icono: 'water-outline',
      });
    }

    // 4. 🥗 RIESGO NUTRICIONAL (Mini Nutritional Assessment - MNA)
    if (ultimosTurnos.length > 0) {
      const ultimoCierre = ultimosTurnos[0];
      const valUltimo = ultimoCierre.alimentacion ? String(ultimoCierre.alimentacion).toLowerCase().trim() : '';
      const esUltimaIngestaNula = valUltimo === 'ninguna' || valUltimo === 'nula';

      const turnosIncompletos = ultimosTurnos.filter(t => {
        if (!t.alimentacion) return false;
        const val = String(t.alimentacion).toLowerCase().trim();
        return val === 'parcial' || val === 'ninguna' || val === 'nula';
      });

      if (esUltimaIngestaNula) {
        hallazgos.push({
          id: 'alerta_alimentacion',
          nivel: 'RED',
          titulo: 'Ingesta Nutricional Nula Registrada',
          mensaje: 'Se ha registrado reporte de ingesta nula de alimentos en el cierre más reciente. Conviene verificar causas como disfagia, náuseas o inapetencia.',
          escala: 'Mini Nutritional Assessment (MNA)',
          icono: 'restaurant-outline',
        });
      } else if (turnosIncompletos.length >= 3) {
        hallazgos.push({
          id: 'alerta_alimentacion',
          nivel: 'AMBER',
          titulo: 'Ingesta Incompleta Persistente',
          mensaje: `Se reportan ${turnosIncompletos.length} turnos recientes con ingesta parcial o insuficiente. Se sugiere monitorear la aceptación de la dieta.`,
          escala: 'Mini Nutritional Assessment (MNA)',
          icono: 'restaurant-outline',
        });
      }
    }

    return hallazgos;
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.centerBox]}>
        <ActivityIndicator size="small" color={COLORS.gold} />
        <Text style={styles.loadingText}>Calculando tamizaje preventivo continuo...</Text>
      </View>
    );
  }

  const tieneAlertas = alertas.length > 0;
  const tieneCriticas = alertas.some(a => a.nivel === 'RED');

  // Color de acento de la tarjeta madre según severidad clínica
  const colorAcento = tieneCriticas ? COLORS.red : tieneAlertas ? COLORS.amber : COLORS.green;
  const colorAcentoPale = tieneCriticas ? COLORS.redPale : tieneAlertas ? COLORS.amberPale : COLORS.greenPale;

  const translateY = fadeSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        tieneCriticas && styles.cardDanger,
        {
          opacity: fadeSlideAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Franja vertical reactiva al semáforo global */}
      <View style={[styles.statusStripe, { backgroundColor: colorAcento }]} />

      <View style={styles.cardContent}>
        {/* Cabecera con Radar Beacon PERS */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <View style={styles.beaconContainer}>
              <Animated.View
                style={[
                  styles.radarPulseRing,
                  {
                    backgroundColor: colorAcento,
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: colorAcentoPale, borderColor: colorAcento + '40' },
                ]}
              >
                <Ionicons
                  name={tieneCriticas ? 'alert-circle' : tieneAlertas ? 'warning' : 'shield-checkmark'}
                  size={19}
                  color={colorAcento}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tamizaje de Tendencias Preventivas</Text>
              <View style={styles.subStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: colorAcento }]} />
                <Text style={styles.subStatusText} numberOfLines={1}>
                  {tieneCriticas
                    ? 'Requiere revisión o ajuste clínico'
                    : tieneAlertas
                    ? 'Atención preventiva recomendada'
                    : 'Márgenes de estabilidad clínica normal'}
                </Text>
              </View>
            </View>
          </View>

          {/* Badge contador */}
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colorAcentoPale, borderColor: colorAcento + '40' },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: colorAcento }]}>
              {tieneAlertas ? `${alertas.length} ${alertas.length === 1 ? 'Alerta' : 'Alertas'}` : 'Estable'}
            </Text>
          </View>
        </View>

        {/* CONTENIDO: LISTA DE ALERTAS O ESTADO VERDE */}
        {tieneAlertas ? (
          <View style={styles.alertasList}>
            {alertas.map(item => {
              const esRojo = item.nivel === 'RED';
              const alertColor = esRojo ? COLORS.red : COLORS.amber;
              const alertBg = esRojo ? COLORS.redPale : COLORS.amberPale;
              const alertBorder = esRojo ? COLORS.red + '40' : COLORS.amber + '40';

              return (
                <View
                  key={item.id}
                  style={[styles.alertaCard, { backgroundColor: alertBg, borderColor: alertBorder }]}
                >
                  <View style={styles.alertaTopRow}>
                    <View style={styles.alertaTitleWrapper}>
                      <Ionicons name={item.icono as any} size={15} color={alertColor} />
                      <Text style={[styles.alertaTitulo, { color: alertColor }]}>
                        {item.titulo}
                      </Text>
                    </View>
                    <View style={[styles.pillSeveridad, { backgroundColor: alertColor }]}>
                      <Text style={styles.pillSeveridadText}>
                        {esRojo ? 'Crítica' : 'Preventiva'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.alertaMensaje}>{item.mensaje}</Text>

                  <View style={styles.escalaRow}>
                    <Ionicons name="medical-outline" size={11} color={COLORS.textLight} />
                    <Text style={styles.alertaEscala}>Base de tamizaje: {item.escala}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.cardNormal}>
            <View style={styles.normalTopRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.green} />
              <Text style={styles.normalTitulo}>Sin Desviaciones Detectadas</Text>
            </View>
            <Text style={styles.normalText}>
              Las tendencias de dolor, conducta, hidratación y nutrición se mantienen estables dentro de los rangos fisiológicos esperados en los turnos evaluados.
            </Text>
          </View>
        )}

        {/* DISCLAIMER CDS */}
        <View style={styles.disclaimerBox}>
          <View style={styles.disclaimerHeader}>
            <Ionicons name="information-circle-outline" size={12} color={COLORS.textLight} />
            <Text style={styles.disclaimerTitle}>Aviso de Soporte a la Decisión Clínica (CDS)</Text>
          </View>
          <Text style={styles.disclaimerText}>
            Módulo de observación continua basado en escalas gerontológicas (EVA, CAM, ESPEN y MNA). Herramienta de apoyo que no sustituye el diagnóstico ni la prescripción médica facultativa.
          </Text>
        </View>
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
  cardDanger: {
    borderColor: COLORS.red + '35',
  },
  centerBox: {
    height: 110,
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
    marginBottom: 12,
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
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
  },
  subStatusText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  alertasList: {
    gap: 8,
    marginBottom: 10,
  },
  alertaCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  alertaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  alertaTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  alertaTitulo: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pillSeveridad: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillSeveridadText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  alertaMensaje: {
    fontSize: 12,
    color: COLORS.textDark,
    lineHeight: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  escalaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertaEscala: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  cardNormal: {
    backgroundColor: COLORS.greenPale,
    borderColor: COLORS.green + '35',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  normalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  normalTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.green,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  normalText: {
    fontSize: 11,
    color: COLORS.textDark,
    lineHeight: 16,
    fontWeight: '600',
  },
  disclaimerBox: {
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  disclaimerTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  disclaimerText: {
    fontSize: 10,
    color: COLORS.textLight,
    lineHeight: 14,
    fontWeight: '500',
  },
});