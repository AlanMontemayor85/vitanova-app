import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  actualizarConfigCheckin,
  CheckinConfig,
  loadStoredToken,
  obtenerConfigCheckin,
  solicitarCheckinPaciente,
} from '../../services/api';

interface CheckinCardProps {
  patientId: string;
  initialConfig?: CheckinConfig;
}

export const CheckinControlCard = ({ patientId, initialConfig }: CheckinCardProps) => {
  const [loading, setLoading] = useState(false);
  const [savingHoras, setSavingHoras] = useState(false);
  const [activo, setActivo] = useState(initialConfig?.activo ?? false);
  const [horas, setHoras] = useState<string[]>(initialConfig?.horas ?? ['09:00', '20:00']);

  // Control del selector de fecha/hora
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // ── ANIMACIONES TIPO SUPERVISIÓN VISUAL PERS ──
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;


   useEffect(() => {
  const cargarConfiguracionInicial = async () => {
    try {
      const token = await loadStoredToken();
      if (!token) return;

      const res = await obtenerConfigCheckin(patientId, token);
      if (res) {
        if (typeof res.activo === 'boolean') setActivo(res.activo);
        if (Array.isArray(res.horas) && res.horas.length > 0) setHoras(res.horas);
      }
    } catch (e) {
      console.log("Error cargando configuración guardada de checkin:", e);
    }
  };

  cargarConfiguracionInicial();
}, [patientId]);
  // Bucle infinito de radar/pulso mientras el servicio esté activo
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (activo) {
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
  }, [activo]);

  // Interpolaciones para el anillo exterior de radar
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.7],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.25, 0],
  });

  // Efecto resorte para el botón de acción
  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // ── PERSISTENCIA Y HANDLERS ──
  const persistirCambios = async (nuevoActivo: boolean, nuevasHoras: string[]) => {
    try {
      setSavingHoras(true);
      const token = await loadStoredToken();
      if (!token) {
        Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
        return false;
      }

      await actualizarConfigCheckin(
        patientId,
        {
          activo: nuevoActivo,
          horas: nuevasHoras,
          dias: [1, 2, 3, 4, 5, 6, 7],
        },
        token
      );
      return true;
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la configuración.');
      return false;
    } finally {
      setSavingHoras(false);
    }
  };

  const handleToggle = async (valor: boolean) => {
    setActivo(valor);
    const ok = await persistirCambios(valor, horas);
    if (!ok) {
      setActivo(!valor);
    }
  };

  const handleEliminarHora = (horaEliminar: string) => {
    if (horas.length <= 1) {
      Alert.alert('Aviso', 'Debes mantener al menos un horario configurado.');
      return;
    }
    const actualizadas = horas.filter((h) => h !== horaEliminar);
    setHoras(actualizadas);
    persistirCambios(activo, actualizadas);
  };

  const handleHoraSeleccionada = (event: any, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !date) return;

    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const nuevaHora = `${hh}:${mm}`;

    if (horas.includes(nuevaHora)) {
      Alert.alert('Horario existente', 'Ese horario ya se encuentra configurado.');
      return;
    }

    const actualizadas = [...horas, nuevaHora].sort();
    setHoras(actualizadas);
    persistirCambios(activo, actualizadas);
  };

  const handleDispararCheckin = async () => {
    setLoading(true);
    try {
      const token = await loadStoredToken();
      if (!token) {
        Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
        return;
      }

      const data = await solicitarCheckinPaciente(patientId, token);
      if (data.success) {
        Alert.alert(
          '🔔 Solicitud enviada',
          'El reloj comenzó a sonar. Esperando confirmación por botón físico.'
        );
      } else {
        Alert.alert('Aviso', data.detail || 'No se pudo solicitar el check-in.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, activo && styles.cardActive]}>
      {/* Franja lateral de acento telemático */}
      <View style={[styles.statusStripe, { backgroundColor: activo ? '#10B981' : '#D1D5DB' }]} />

      <View style={styles.cardContent}>
        {/* Cabecera con Radar Beacon */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <View style={styles.beaconContainer}>
              {activo && (
                <Animated.View
                  style={[
                    styles.radarPulseRing,
                    {
                      transform: [{ scale: pulseScale }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
              )}
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: activo ? '#ECFDF5' : '#F3F4F6' },
                ]}
              >
                <Ionicons
                  name={activo ? 'shield-checkmark' : 'shield-outline'}
                  size={20}
                  color={activo ? '#059669' : '#9CA3AF'}
                />
              </View>
            </View>

            <View>
              <Text style={styles.cardTitle}>Verificación de Estado</Text>
              <View style={styles.subStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: activo ? '#10B981' : '#9CA3AF' },
                  ]}
                />
                <Text style={styles.subStatusText}>
                  {activo ? 'Monitoreo telemático PERS activo' : 'Supervisión en pausa'}
                </Text>
              </View>
            </View>
          </View>

          <Switch
            value={activo}
            onValueChange={handleToggle}
            trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
            thumbColor={activo ? '#059669' : '#FFFFFF'}
          />
        </View>

        <Text style={styles.description}>
          Solicita confirmación sonora al reloj para asegurar el bienestar del familiar sin detonar
          alarmas de pánico institucional.
        </Text>

        {/* Sección de Horarios */}
        {activo && (
          <View style={styles.scheduleContainer}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleHeaderLeft}>
                <Ionicons name="time-outline" size={15} color="#059669" />
                <Text style={styles.scheduleTitle}>Horarios de Toque Programados</Text>
              </View>
              {savingHoras && <ActivityIndicator size="small" color="#059669" />}
            </View>

            <View style={styles.chipsContainer}>
              {horas.map((h) => (
                <View key={h} style={styles.chip}>
                  <Text style={styles.chipText}>{h}</Text>
                  <TouchableOpacity
                    onPress={() => handleEliminarHora(h)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addChip}
                onPress={() => {
                  setTempDate(new Date());
                  setShowPicker(true);
                }}
              >
                <Ionicons name="add" size={15} color="#059669" />
                <Text style={styles.addChipText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showPicker && (
          <DateTimePicker
            value={tempDate}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleHoraSeleccionada}
          />
        )}

        {/* Botón de Acción Táctil PERS con Resorte */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[styles.actionButton, loading && styles.disabledButton]}
            onPress={handleDispararCheckin}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="radio-outline" size={19} color="#FFFFFF" style={styles.btnIcon} />
                <Text style={styles.btnText}>Solicitar "Contigo, a distancia"</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginVertical: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  cardActive: {
    borderColor: '#D1FAE5',
    borderWidth: 1,
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
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    backgroundColor: '#34D399',
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
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
    color: '#64748B',
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  scheduleContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scheduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderStyle: 'dashed',
    gap: 4,
  },
  addChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  actionButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  btnIcon: {
    marginRight: 6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});