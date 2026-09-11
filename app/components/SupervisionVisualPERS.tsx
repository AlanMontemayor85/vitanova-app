import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { forzarMedicionSignos } from '../../services/api';

interface Props {
  signosDispositivo: any;
  ubicacion: any;
  pacienteActivo: any;
  pasosHoy: number | null;
  ultimoCierre?: any;
  onRefreshData?: (pacienteId: string) => Promise<void> | void;
}

export default function SupervisionVisualPERS({
  signosDispositivo,
  ubicacion,
  pacienteActivo,
  pasosHoy,
  ultimoCierre,
  onRefreshData,
}: Props) {
  const [midiendoLocal, setMidiendoLocal] = useState(false);
  const latidoAnim = useRef(new Animated.Value(1)).current;

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
      diffMinutos = Math.floor(
        (new Date().getTime() - new Date(fechaNorm).getTime()) / (1000 * 60)
      );
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

  // ── 3. COLORES Y ETIQUETA COMPACTA DE LA PILL ──
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

 
  const inicioMedicionRef = useRef<number | null>(null);

  // ── 4. DISPARO INTERNO DE MEDICIÓN PERS (HRTSTART) ──
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

      // ⏱️ 1ª Consulta (22s): Da tiempo al sensor óptico de terminar la lectura inicial
      setTimeout(async () => {
        if (onRefreshData) await onRefreshData(pacienteId);
      }, 22000);

      // ⏱️ 2ª Consulta y Cierre (35s): Garantiza que entró la trama TCP y libera el botón
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

  // ── 5. ALERTAS DIAGNÓSTICAS DE LA PILL ──
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

  // Latido y pulso solo si no está midiendo activamente en este instante
const corazonActivo =
  !midiendoLocal &&
  !estaFueraDeLinea &&
  puesto &&
  Boolean(signosDispositivo?.fc && signosDispositivo.fc !== '—');

  useEffect(() => {
    if (corazonActivo) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(latidoAnim, { toValue: 1.25, duration: 250, useNativeDriver: true }),
          Animated.timing(latidoAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
          Animated.timing(latidoAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
          Animated.timing(latidoAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        ])
      ).start();
    } else {
      latidoAnim.setValue(1);
    }
  }, [corazonActivo]);

  // ── 7. ESTADO DE PORTACIÓN ──
  let portacionIcon = 'watch-variant';
  let portacionColor = '#94A3B8';
  let portacionLabel = 'Sin colocar';

  if (esAgotada) {
    portacionIcon = 'power-off';
    portacionColor = '#991B1B';
    portacionLabel = 'Apagado';
  } else if (estaFueraDeLinea) {
    portacionIcon = 'watch-variant-off';
    portacionColor = '#B45309';
    portacionLabel = 'Sin señal';
  } else if (enBase) {
    portacionIcon = 'power-plug';
    portacionColor = '#1E40AF';
    portacionLabel = 'En dock';
  } else if (puesto) {
    portacionIcon = 'arm-flex';
    portacionColor = '#22C55E';
    portacionLabel = 'En muñeca';
  }

  // ── 8. COMPLEXIÓN IMC ──
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
      complexColor = '#22C55E';
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
      {/* CABECERA COMPACTA */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.dotStatus,
              { backgroundColor: estaFueraDeLinea ? '#F59E0B' : '#22C55E' },
            ]}
          />
          <Text style={styles.headerTitle}>SUPERVISIÓN EN VIVO</Text>
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

          <TouchableOpacity
            onPress={handleEjecutarMedicion}
            disabled={midiendoLocal}
            activeOpacity={0.8}
            style={[
              styles.refreshBtn,
              midiendoLocal
                ? { backgroundColor: '#C2410C' }
                : enBase
                ? { backgroundColor: '#475569' }
                : { backgroundColor: '#433830' },
            ]}
          >
            {midiendoLocal ? (
              <View style={styles.refreshLoadingContainer}>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={{ transform: [{ scale: 0.65 }] }}
                />
                <Text style={styles.refreshBtnText}>VERIFICANDO...</Text>
              </View>
            ) : (
              <Text style={styles.refreshBtnText}>
                {enBase ? 'EN BASE' : 'ACTUALIZAR'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerDivider} />

      {/* 4 COLUMNAS ICONOGRÁFICAS */}
      <View style={styles.metricsRow}>
        {/* 1. PORTACIÓN */}
        <View style={styles.col}>
          <MaterialCommunityIcons name={portacionIcon as any} size={23} color={portacionColor} />
          <Text style={[styles.valText, { color: portacionColor }]} numberOfLines={1}>
            {portacionLabel}
          </Text>
          <Text style={styles.labelText}>Portación</Text>
        </View>

        <View style={styles.divider} />

        {/* 2. PULSO */}
        <View style={styles.col}>
        <Animated.View style={{ transform: [{ scale: latidoAnim }] }}>
            <FontAwesome5
            name="heartbeat"
            size={20}
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

        {/* 3. PASOS */}
        <View style={styles.col}>
          <MaterialCommunityIcons
            name="shoe-print"
            size={20}
            color={!estaFueraDeLinea ? '#854D0E' : '#94A3B8'}
            style={{ transform: [{ rotate: '-45deg' }] }}
          />
          <Text style={[styles.valText, { color: '#3D3732' }]} numberOfLines={1}>
            {!estaFueraDeLinea && typeof pasosHoy === 'number'
              ? pasosHoy.toLocaleString('es-MX')
              : '—'}
          </Text>
          <Text style={styles.labelText}>Pasos Hoy</Text>
        </View>

        <View style={styles.divider} />

        {/* 4. PESO / COMPLEXIÓN */}
        <View style={styles.col}>
          <MaterialCommunityIcons name="human" size={23} color={complexColor} />
          <Text style={[styles.valText, { color: complexColor }]}>
            {pesoNum > 0 ? `${pesoNum} kg` : '—'}
          </Text>
          <Text style={styles.labelText}>{complexLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingTop: 10,
    paddingBottom: 13,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotStatus: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  headerTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillBateria: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
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
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
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
    letterSpacing: 0.4,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 9,
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
    height: 26,
    backgroundColor: '#F1F5F9',
  },
  valText: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  labelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
  },
});