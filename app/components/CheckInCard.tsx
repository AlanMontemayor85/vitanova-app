import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
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
  const [horas, setHoras] = useState<string[]>(
    Array.isArray(initialConfig?.horas) && initialConfig.horas.length > 0
      ? initialConfig.horas
      : ['09:00', '20:00']
  );

  // Selector de hora en tambor / ruleta vertical
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // Cerrojo de concurrencia para evitar que useFocusEffect pise guardados en curso
  const isUpdatingRef = useRef(false);

  // Animaciones estilo Supervisión Visual PERS
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (activo) {
      pulseAnim.setValue(0);
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
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }

    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [activo]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.7],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.25, 0],
  });

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

  // Carga reactiva de base de datos cada vez que la pantalla toma foco
  const recargarConfiguracion = useCallback(async () => {
    if (isUpdatingRef.current) return;
    try {
      const token = await loadStoredToken();
      if (!token) return;

      const data = await obtenerConfigCheckin(patientId, token);
      if (data && !isUpdatingRef.current) {
        setActivo(Boolean(data.activo));
        if (Array.isArray(data.horas) && data.horas.length > 0) {
          setHoras(data.horas);
        }
      }
    } catch (err) {
      console.warn('Error recargando checkin-config:', err);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      recargarConfiguracion();
    }, [recargarConfiguracion])
  );

  // Persistencia en Supabase
  const persistirCambios = async (nuevoActivo: boolean, nuevasHoras: string[]) => {
    isUpdatingRef.current = true;
    try {
      setSavingHoras(true);
      const token = await loadStoredToken();
      if (!token) {
        Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente.');
        return false;
      }

      const payloadHoras = nuevasHoras && nuevasHoras.length > 0 ? nuevasHoras : ['09:00', '20:00'];

      await actualizarConfigCheckin(
        patientId,
        {
          activo: nuevoActivo,
          horas: payloadHoras,
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
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 400);
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
    if ((horas || []).length <= 1) {
      Alert.alert('Aviso', 'Debes mantener al menos un horario configurado.');
      return;
    }
    const actualizadas = horas.filter((h) => h !== horaEliminar);
    setHoras(actualizadas);
    persistirCambios(activo, actualizadas);
  };

  const handleHoraConfirmada = (date: Date) => {
    setShowPicker(false);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const nuevaHora = `${hh}:${mm}`;

    if ((horas || []).includes(nuevaHora)) {
      Alert.alert('Horario existente', 'Ese horario ya se encuentra configurado.');
      return;
    }

    const actualizadas = [...(horas || []), nuevaHora].sort();
    setHoras(actualizadas);
    persistirCambios(activo, actualizadas);
  };

  const handleAndroidPicker = (event: any, date?: Date) => {
    setShowPicker(false);
    if (event.type === 'dismissed' || !date) return;
    handleHoraConfirmada(date);
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
      if (data?.success) {
        Alert.alert(
          '🔔 Solicitud enviada',
          'El reloj comenzó a sonar. Esperando confirmación del paciente.'
        );
      } else {
        Alert.alert('Aviso', data?.detail || 'No se pudo solicitar el check-in.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, activo && styles.cardActive]}>
      <View style={[styles.statusStripe, { backgroundColor: activo ? '#10B981' : '#CBD5E1' }]} />

      <View style={styles.cardContent}>
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
                  { backgroundColor: activo ? '#ECFDF5' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name={activo ? 'shield-checkmark' : 'shield-outline'}
                  size={20}
                  color={activo ? '#059669' : '#94A3B8'}
                />
              </View>
            </View>

            <View>
              <Text style={styles.cardTitle}>Verificación de Estado</Text>
              <View style={styles.subStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: activo ? '#10B981' : '#94A3B8' },
                  ]}
                />
                <Text style={styles.subStatusText}>
                  {activo ? 'Monitoreo telemático activo' : 'Supervisión en pausa'}
                </Text>
              </View>
            </View>
          </View>

          <Switch
            value={activo}
            onValueChange={handleToggle}
            trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
            thumbColor={activo ? '#059669' : '#94A3B8'}
          />
        </View>

        <Text style={styles.description}>
          Solicita confirmación sonora al reloj para asegurar el bienestar del familiar sin detonar
          alarmas de pánico.
        </Text>

        {activo ? (
          <View style={styles.scheduleContainer}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleHeaderLeft}>
                <Ionicons name="time-outline" size={15} color="#059669" />
                <Text style={styles.scheduleTitle}>Horarios de Toque Programados</Text>
              </View>
              {savingHoras && <ActivityIndicator size="small" color="#059669" />}
            </View>

            <View style={styles.chipsContainer}>
              {(horas || []).map((h) => (
                <View key={h} style={styles.chip}>
                  <Text style={styles.chipText}>{h}</Text>
                  <TouchableOpacity
                    onPress={() => handleEliminarHora(h)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color="#94A3B8" />
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
        ) : (
          <View style={styles.pausedBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
            <Text style={styles.pausedText}>
              Activa la supervisión para programar toques automáticos diarios.
            </Text>
          </View>
        )}

        {/* Modal Spinner en iOS */}
        {showPicker && Platform.OS === 'ios' && (
          <Modal transparent={true} animationType="fade" visible={showPicker}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Seleccionar Horario</Text>
                
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  textColor="#0F172A"
                  onChange={(_, date) => {
                    if (date) setTempDate(date);
                  }}
                />

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity 
                    style={styles.modalBtnCancel} 
                    onPress={() => setShowPicker(false)}
                  >
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.modalBtnConfirm} 
                    onPress={() => handleHoraConfirmada(tempDate)}
                  >
                    <Text style={styles.modalBtnConfirmText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Tambor Nativo Vertical en Android */}
        {showPicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempDate}
            mode="time"
            is24Hour={true}
            display="spinner"
            onChange={handleAndroidPicker}
          />
        )}

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
    minHeight: 180,
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
    marginBottom: 8,
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
    borderColor: '#E2E8F0',
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
    marginBottom: 12,
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
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 6,
  },
  pausedText: {
    fontSize: 12,
    color: '#94A3B8',
    flexShrink: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    gap: 12,
    marginTop: 14,
  },
  modalBtnCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalBtnCancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  modalBtnConfirm: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalBtnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});