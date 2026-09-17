import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { forzarMedicionSignos } from '../../services/api';

const FONT_TITLE = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';
const FONT_BODY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

interface Props {
  signosDispositivo: any;
  ubicacion: any;
  pacienteActivo: any;
  pasosHoy?: number | null;
  ultimoCierre?: any;
  onRefreshData?: (pacienteId: string) => Promise<void> | void;
}

export const SupervisionCuidadorCard: React.FC<Props> = ({
  signosDispositivo,
  ubicacion,
  pacienteActivo,
  pasosHoy = null,
  ultimoCierre,
  onRefreshData,
}) => {
  const [midiendoLocal, setMidiendoLocal] = useState(false);
  const latidoAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inicioMedicionRef = useRef<number | null>(null);

  // ── 1. BATERÍA MULTI-FUENTE ──
  const batVal =
    ubicacion?.bateria_pct ??
    ubicacion?.bateria ??
    signosDispositivo?.bateria_pct ??
    signosDispositivo?.bateria ??
    signosDispositivo?.data?.bateria_pct ??
    pacienteActivo?.bateria_pct ??
    null;

  const numBat =
    typeof batVal === 'number'
      ? batVal
      : batVal !== null
      ? parseInt(String(batVal).replace('%', ''), 10)
      : null;

  // ── 2. CÁLCULO DE TIEMPO DESCONECTADO ──
  const ultimaConexionStr =
    ubicacion?.ultima_conexion ??
    ubicacion?.updated_at ??
    signosDispositivo?.ultima_conexion ??
    signosDispositivo?.created_at ??
    pacienteActivo?.updated_at ??
    null;

  let diffMinutos = 0;
  if (ultimaConexionStr) {
    try {
      const fechaNorm =
        String(ultimaConexionStr).includes('Z') || String(ultimaConexionStr).includes('+')
          ? String(ultimaConexionStr)
          : `${String(ultimaConexionStr).replace(' ', 'T')}Z`;
      diffMinutos = Math.floor((Date.now() - new Date(fechaNorm).getTime()) / (1000 * 60));
    } catch {
      diffMinutos = 0;
    }
  }

  const estaFueraDeLinea = !ultimaConexionStr || diffMinutos > 10;
  const enBase = Boolean(signosDispositivo?.cargando);
  const puesto = Boolean(signosDispositivo?.reloj_puesto);

  const esAgotada =
    (numBat !== null && numBat <= 3) ||
    (numBat !== null && numBat <= 5 && estaFueraDeLinea);
  const esBaja = numBat !== null && numBat > 3 && numBat < 20;

  // ── 3. COLORES Y ETIQUETAS DE LA PILL ──
  let bgPill = '#F0FDF4';
  let borderPill = '#BBF7D0';
  let textPill = '#166534';
  let dotPillColor = '#16A34A';
  let labelPill = numBat !== null ? `ON ${numBat}%` : 'ON';

  if (enBase) {
    bgPill = '#EFF6FF';
    borderPill = '#BFDBFE';
    textPill = '#1E40AF';
    dotPillColor = '#3B82F6';
    labelPill = numBat !== null ? `DOCK ${numBat}%` : 'DOCK';
  } else if (esAgotada) {
    bgPill = '#FEF2F2';
    borderPill = '#FECACA';
    textPill = '#991B1B';
    dotPillColor = '#DC2626';
    labelPill = 'APAGADO';
  } else if (estaFueraDeLinea) {
    bgPill = '#FFFBEB';
    borderPill = '#FDE68A';
    textPill = '#92400E';
    dotPillColor = '#D97706';
    labelPill = numBat !== null ? `OFF ${numBat}%` : 'OFF';
  } else if (esBaja) {
    bgPill = '#FEF2F2';
    borderPill = '#FCA5A5';
    textPill = '#B91C1C';
    dotPillColor = '#EF4444';
    labelPill = numBat !== null ? `${numBat}%` : 'BAJA';
  }

  const stripeColor = enBase
    ? '#3B82F6'
    : estaFueraDeLinea || esAgotada
    ? '#EF4444'
    : puesto
    ? '#10B981'
    : '#94A3B8';

  // ── 4. RADAR BEACON PERS ──
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (!estaFueraDeLinea && !esAgotada) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2200,
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
    } else {
      pulseAnim.setValue(0);
    }

    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [estaFueraDeLinea, esAgotada]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.8],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.25, 0],
  });

  // ── 5. LATIDO CARDÍACO REACTIVO ──
  const corazonActivo =
    !midiendoLocal &&
    !estaFueraDeLinea &&
    puesto &&
    Boolean(signosDispositivo?.fc && signosDispositivo.fc !== '—');

  useEffect(() => {
    let heartLoop: Animated.CompositeAnimation | null = null;
    if (corazonActivo) {
      heartLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(latidoAnim, { toValue: 1.25, duration: 250, useNativeDriver: true }),
          Animated.timing(latidoAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
          Animated.timing(latidoAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
          Animated.timing(latidoAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        ])
      );
      heartLoop.start();
    } else {
      latidoAnim.setValue(1);
    }
    return () => {
      if (heartLoop) heartLoop.stop();
    };
  }, [corazonActivo]);

  // ── 6. DISPARO DE MEDICIÓN REMOTA ──
  const handleEjecutarMedicion = async () => {
    const pacienteId = pacienteActivo?.id || pacienteActivo?.paciente_id;
    if (!pacienteId) {
      Alert.alert('Aviso', 'No se encontró identificador de paciente.');
      return;
    }

    if (enBase) {
      Alert.alert(
        'Reloj en Base de Carga',
        'El dispositivo está en el dock magnético. Los sensores ópticos están desactivados durante la recarga.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    if (estaFueraDeLinea) {
      Alert.alert(
        'Reloj Fuera de Línea',
        'El reloj no tiene enlace TCP activo en este momento. Verifique cobertura o carga.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    try {
      setMidiendoLocal(true);
      inicioMedicionRef.current = Date.now();

      await forzarMedicionSignos(pacienteId);

      setTimeout(async () => {
        if (onRefreshData) await onRefreshData(pacienteId);
      }, 22000);

      setTimeout(async () => {
        if (onRefreshData) await onRefreshData(pacienteId);
        setMidiendoLocal(false);
        inicioMedicionRef.current = null;
      }, 35000);
    } catch (error) {
      console.log('⚠️ Error al solicitar medición remota:', error);
      setMidiendoLocal(false);
      inicioMedicionRef.current = null;
      Alert.alert('Error', 'No se pudo contactar al servidor de teleasistencia.');
    }
  };

  // ── 7. CÁLCULO DE PASOS ──
  const pasosRaw =
    pasosHoy ??
    signosDispositivo?.pasos ??
    signosDispositivo?.pasos_hoy ??
    signosDispositivo?.steps ??
    signosDispositivo?.data?.pasos ??
    ubicacion?.pasos ??
    ubicacion?.steps ??
    ubicacion?.pasos_hoy ??
    pacienteActivo?.pasos ??
    pacienteActivo?.pasos_hoy ??
    null;

  let pasosNum: number | null = null;
  if (pasosRaw !== null && pasosRaw !== undefined && pasosRaw !== '—') {
    const num = Number(String(pasosRaw).replace(/,/g, '').trim());
    if (!isNaN(num)) {
      pasosNum = num;
    }
  }

  const handlePillPress = () => {
    if (esAgotada) {
      Alert.alert(
        'Reloj Apagado por Batería',
        'El dispositivo se apagó al descargarse por completo.\n\n' +
          '1. Conéctelo al cargador magnético.\n' +
          '2. Espere 5 minutos.\n' +
          '3. Presione el botón lateral 4 segundos.',
        [{ text: 'Entendido', style: 'default' }]
      );
    } else if (enBase) {
      Alert.alert(
        'Reloj en Dock',
        `Dispositivo en base de carga.\n\n` +
          `• Nivel: ${numBat !== null ? `${numBat}%` : 'Cargando'}\n` +
          '• Sensores en espera.',
        [{ text: 'Entendido', style: 'default' }]
      );
    } else if (estaFueraDeLinea) {
      const tiempoTexto =
        diffMinutos > 60
          ? `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m`
          : `${diffMinutos} min`;
      Alert.alert(
        'Sin Comunicación',
        `Último reporte hace ${tiempoTexto}.\n\n` +
          `• Batería: ${numBat !== null ? `${numBat}%` : 'Desconocida'}`,
        [{ text: 'Entendido', style: 'default' }]
      );
    } else {
      Alert.alert(
        'Enlace Activo',
        `Comunicación en vivo confirmada.\n\n` +
          `• Batería: ${numBat !== null ? `${numBat}%` : 'Normal'}\n` +
          `• Estado: ${puesto ? 'En muñeca' : 'En reposo'}`,
        [{ text: 'Aceptar', style: 'default' }]
      );
    }
  };

  let portacionIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = 'watch';
  let portacionColor = '#94A3B8';
  let portacionLabel = 'Sin colocar';

  if (esAgotada) {
    portacionIcon = 'power-off';
    portacionColor = '#991B1B';
    portacionLabel = 'Apagado';
  } else if (estaFueraDeLinea) {
    portacionIcon = 'cloud-off-outline';
    portacionColor = '#B45309';
    portacionLabel = 'Sin señal';
  } else if (enBase) {
    portacionIcon = 'power-plug';
    portacionColor = '#1E40AF';
    portacionLabel = 'En dock';
  } else if (puesto) {
    portacionIcon = 'arm-flex';
    portacionColor = '#10B981';
    portacionLabel = 'En muñeca';
  }

  const pesoRaw =
    signosDispositivo?.peso?.replace(' kg', '') ||
    ultimoCierre?.peso_kg ||
    pacienteActivo?.peso ||
    0;
  const pesoNum = Number(pesoRaw);
  const estaturaMetros =
    Number(pacienteActivo?.estatura_cm || pacienteActivo?.altura || 165) / 100;

  let complexColor = '#94A3B8';
  let complexLabel = 'Expediente';

  if (pesoNum > 20 && estaturaMetros > 0.5) {
    const imc = pesoNum / (estaturaMetros * estaturaMetros);
    if (imc < 18.5) {
      complexColor = '#3B82F6';
      complexLabel = 'Delgada';
    } else if (imc < 25) {
      complexColor = '#10B981';
      complexLabel = 'Normal';
    } else if (imc < 30) {
      complexColor = '#F59E0B';
      complexLabel = 'Robusta';
    } else {
      complexColor = '#EF4444';
      complexLabel = 'Elevada';
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.statusStripe, { backgroundColor: stripeColor }]} />

      <View style={styles.cardContent}>
        {/* Cabecera balanceada */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.beaconContainer}>
              {!estaFueraDeLinea && !esAgotada && (
                <Animated.View
                  style={[
                    styles.radarPulseRing,
                    {
                      backgroundColor: stripeColor,
                      transform: [{ scale: pulseScale }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
              )}
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: puesto ? '#ECFDF5' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name={estaFueraDeLinea ? 'cloud-offline-outline' : 'radio-outline'}
                  size={15}
                  color={stripeColor}
                />
              </View>
            </View>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                SUPERVISIÓN EN VIVO
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                {estaFueraDeLinea
                  ? `Sin señal (${diffMinutos}m)`
                  : enBase
                  ? 'En base de carga'
                  : ''}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handlePillPress}
              activeOpacity={0.7}
              style={[styles.pillBateria, { backgroundColor: bgPill, borderColor: borderPill }]}
            >
              <View style={[styles.dotPill, { backgroundColor: dotPillColor }]} />
              <Text style={[styles.pillText, { color: textPill }]}>{labelPill}</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPress={handleEjecutarMedicion}
                onPressIn={() =>
                  Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start()
                }
                onPressOut={() =>
                  Animated.spring(buttonScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                  }).start()
                }
                disabled={midiendoLocal}
                activeOpacity={0.85}
                style={[
                  styles.refreshBtn,
                  midiendoLocal
                    ? { backgroundColor: '#C2410C' }
                    : enBase
                    ? { backgroundColor: '#475569' }
                    : { backgroundColor: '#3E3832' },
                ]}
              >
                {midiendoLocal ? (
                  <View style={styles.refreshLoadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                      style={{ transform: [{ scale: 0.65 }] }}
                    />
                    <Text style={styles.refreshBtnText}>MIDIENDO...</Text>
                  </View>
                ) : (
                  <Text style={styles.refreshBtnText}>
                    {enBase ? 'EN BASE' : 'ACTUALIZAR'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        <View style={styles.headerDivider} />

        {/* Retícula de 4 Columnas */}
        <View style={styles.metricsRow}>
          {/* 1. Portación */}
          <View style={styles.col}>
            <MaterialCommunityIcons name={portacionIcon} size={22} color={portacionColor} />
            <Text style={[styles.valText, { color: portacionColor }]} numberOfLines={1}>
              {portacionLabel}
            </Text>
            <Text style={styles.labelText}>Portación</Text>
          </View>

          <View style={styles.divider} />

          {/* 2. Pulso con animación de latido */}
          <View style={styles.col}>
            <Animated.View style={{ transform: [{ scale: latidoAnim }] }}>
              <FontAwesome5
                name="heartbeat"
                size={19}
                color={corazonActivo ? '#EF4444' : '#94A3B8'}
              />
            </Animated.View>
            <Text
              style={[styles.valText, { color: corazonActivo ? '#EF4444' : '#94A3B8' }]}
              numberOfLines={1}
            >
              {midiendoLocal ? '...' : corazonActivo ? `${signosDispositivo.fc} bpm` : '—'}
            </Text>
            <Text style={styles.labelText}>Pulso</Text>
          </View>

          <View style={styles.divider} />

          {/* 3. Pasos */}
          <View style={styles.col}>
            <MaterialCommunityIcons
              name="shoe-print"
              size={19}
              color={pasosNum !== null && pasosNum > 0 ? '#854D0E' : '#94A3B8'}
              style={{ transform: [{ rotate: '-45deg' }] }}
            />
            <Text style={[styles.valText, { color: '#1E1B18' }]} numberOfLines={1}>
              {pasosNum !== null ? pasosNum.toLocaleString('es-MX') : '—'}
            </Text>
            <Text style={styles.labelText}>Pasos Hoy</Text>
          </View>

          <View style={styles.divider} />

          {/* 4. Complexión / Peso */}
          <View style={styles.col}>
            <MaterialCommunityIcons name="human" size={22} color={complexColor} />
            <Text style={[styles.valText, { color: complexColor }]} numberOfLines={1}>
              {pesoNum > 0 ? `${pesoNum} kg` : '—'}
            </Text>
            <Text style={styles.labelText}>{complexLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECE7DF',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    overflow: 'hidden',
    position: 'relative',
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
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 12,
    paddingLeft: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    gap: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0, // Permite truncar sin desplazar a la derecha
  },
  beaconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarPulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  iconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 11.5, // Tamaño calibrado para no empujar la pastilla en pantallas estándar
    fontWeight: '800',
    color: '#1E1B18',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontFamily: FONT_TITLE,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#78716C',
    fontWeight: '500',
    marginTop: 1,
    fontFamily: FONT_BODY,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0, // Asegura que nunca se desborde fuera de la pantalla
  },
  pillBateria: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  dotPill: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: FONT_BODY,
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontFamily: FONT_BODY,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#F1F5F9',
  },
  valText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E1B18',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: FONT_TITLE,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#78716C',
    textAlign: 'center',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: FONT_BODY,
  },
});