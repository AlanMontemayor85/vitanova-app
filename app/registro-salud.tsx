import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSignosRecientes, getToken, iniciarTurno } from '../services/api';
import { encolarPeticionOffline } from '../services/offlineQueue';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

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

export default function RegistroSaludScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paciente = params.paciente ? JSON.parse(params.paciente as string) : null;
  const momento = (params.momento as string) ?? 'inicio_turno';

  // ⌚ Estatus telemático pasivo del reloj (Solo conectividad e información)
  const [relojEnLinea, setRelojEnLinea] = useState<boolean>(false);
  const [relojPuesto, setRelojPuesto] = useState<boolean>(false);

  // 🩺 Signos 100% manuales tomados por el personal clínico
  const [sistolica, setSistolica] = useState<string>('');
  const [diastolica, setDiastolica] = useState<string>('');
  const [fcManual, setFcManual] = useState<string>('');
  const [spo2Manual, setSpo2Manual] = useState<string>('');
  const [tempManual, setTempManual] = useState<string>('');
  const [glucosaManual, setGlucosaManual] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);

  // Animación Radar Beacon PERS para denotar supervisión telemática viva
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (relojEnLinea) {
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
  }, [relojEnLinea]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.6],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.5, 0.2, 0],
  });

  // Consulta únicamente el estado del enlace y portación
  useEffect(() => {
    const verificarEnlaceReloj = async () => {
      if (!paciente?.id) {
        setLoading(false);
        return;
      }
      try {
        const res = await getSignosRecientes(paciente.id);
        if (res && res.success) {
          const enLinea = res.en_linea === true || Boolean(res.frescura?.bphrt || res.frescura?.spo2);
          const puesto = res.dispositivoPuesto === true || res.estado_contacto === 'puesto';

          setRelojEnLinea(enLinea);
          setRelojPuesto(puesto);
        } else {
          setRelojEnLinea(false);
          setRelojPuesto(false);
        }
      } catch (e) {
        console.warn('Estatus de reloj no disponible:', e);
        setRelojEnLinea(false);
        setRelojPuesto(false);
      } finally {
        setLoading(false);
      }
    };

    verificarEnlaceReloj();
  }, [paciente?.id]);

  const hayDatosManuales = Boolean(
    sistolica.trim() ||
    diastolica.trim() ||
    fcManual.trim() ||
    spo2Manual.trim() ||
    tempManual.trim() ||
    glucosaManual.trim()
  );

  const procesarInicioTurno = async () => {
    setGuardando(true);
    try {
      // Si el cuidador capturó algún signo manual, se envía el registro legítimo
      if (hayDatosManuales) {
        const payload: any = {
          paciente_id: paciente.id,
          momento,
          estado_animo: 'bien',
          alimentacion: 'bien',
          dolor_eva: 0,
          origen: 'manual',
          metodo: 'manual_cuidador',
          presion_sistolica: sistolica ? Number(sistolica) : null,
          presion_diastolica: diastolica ? Number(diastolica) : null,
          frecuencia_cardiaca: fcManual ? Number(fcManual) : null,
          spo2: spo2Manual ? Number(spo2Manual) : null,
          temperatura: tempManual ? Number(tempManual) : null,
          glucosa: glucosaManual ? Number(glucosaManual) : null,
        };

        try {
          const token = await getToken();
          const res = await fetch(`${BASE_URL}/registros/salud`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (data.alertas?.length > 0) {
            setAlertas(data.alertas);
            return;
          }
        } catch (errorOffline) {
          await encolarPeticionOffline(
            `${BASE_URL}/registros/salud`,
            'POST',
            payload,
            `Signos Manuales de Entrada - ${paciente.nombre_completo}`
          );
        }
      }

      // Si no capturó manuales, no se envían datos ficticios del reloj a la gráfica
      await avanzarAlTurno();
    } catch (err) {
      console.error('Error procesando entrada:', err);
      Alert.alert('Error', 'No se pudo registrar la entrada de turno.');
    } finally {
      setGuardando(false);
    }
  };

  const avanzarAlTurno = async () => {
    try {
      if (momento === 'inicio_turno') {
        const resTurno = await iniciarTurno(paciente.id);
        if (resTurno?.sin_horario) {
          Alert.alert(
            'Turno No Programado',
            resTurno.mensaje || 'No tienes un turno asignado en este horario.',
            [{ text: 'Entendido', onPress: () => router.back() }]
          );
          return;
        }
      }

      if (params.modoSwitch === 'cuidador_familiar') {
        router.replace({
          pathname: '/',
          params: {
            refresh: String(Date.now()),
            abrirModoCuidador: 'true',
            pacienteIdConsola: paciente.id,
          },
        });
        return;
      }

      router.replace({
        pathname: '/cuidador' as any,
        params: {
          vistaInicial: 'turno',
          paciente: JSON.stringify(paciente),
          modoSwitch: 'ninguno',
        },
      });
    } catch (err) {
      console.error('Error al avanzar al turno:', err);
      Alert.alert('Error de Conexión', 'No se pudo validar el inicio de turno.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Verificando canal telemático...</Text>
      </View>
    );
  }

  if (alertas.length > 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />
        <View style={[styles.header, { backgroundColor: COLORS.red }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSubtitle}>Valores Fuera de Rango</Text>
            <Text style={styles.headerTitle}>{paciente?.nombre_completo}</Text>
          </View>
        </View>

        <ScrollView style={styles.body}>
          <Text style={styles.alertHeader}>Signos manuales fuera de rango clínico:</Text>
          {alertas.map((a, i) => (
            <View key={i} style={styles.alertaCard}>
              <Ionicons name="warning-outline" size={18} color={COLORS.red} />
              <Text style={styles.alertaText}>{a}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.confirmarCriticoBtn} onPress={avanzarAlTurno}>
            <Text style={styles.confirmarCriticoBtnText}>Entendido — Abrir Agenda del Turno →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>Check-in Clínico de Entrada</Text>
          <Text style={styles.headerTitle}>{paciente?.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* 1. TARJETA PERS: INFORME DE SUPERVISIÓN TELEMÁTICA CONTINUA */}
        <View style={styles.telemetriaCard}>
          <View
            style={[
              styles.telemetriaStripe,
              { backgroundColor: relojEnLinea ? COLORS.green : '#94A3B8' },
            ]}
          />
          <View style={styles.telemetriaContent}>
            <View style={styles.telemetriaRow}>
              <View style={styles.beaconContainer}>
                {relojEnLinea && (
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
                    { backgroundColor: relojEnLinea ? COLORS.greenPale : '#F1F5F9' },
                  ]}
                >
                  <Ionicons
                    name={relojEnLinea ? 'radio-outline' : 'cloud-offline-outline'}
                    size={20}
                    color={relojEnLinea ? COLORS.green : COLORS.textLight}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.telemetriaTitle}>Supervisión Continua Vitanova</Text>
                  <View
                    style={[
                      styles.pillStatus,
                      { backgroundColor: relojEnLinea ? COLORS.greenPale : '#F1F5F9' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillStatusText,
                        { color: relojEnLinea ? COLORS.green : COLORS.textLight },
                      ]}
                    >
                      {relojEnLinea ? 'EN LÍNEA' : 'OFFLINE'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.telemetriaDesc}>
                  {relojEnLinea
                    ? relojPuesto
                      ? 'El reloj se encuentra activo y colocado en muñeca.'
                      : 'El reloj está sincronizado pero en reposo/dock. El monitoreo de signos se reanudará en cuanto el paciente lo porte.'
                    : 'Dispositivo telemático sin conexión reciente. La supervisión por sensores continuará en segundo plano al restablecerse el enlace.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. CAPTURA CLÍNICA 100% MANUAL (BAUMANÓMETRO / INSTRUMENTAL) */}
        <View style={styles.manualCard}>
          <View style={styles.manualHeader}>
            <Ionicons name="fitness" size={18} color={COLORS.gold} />
            <Text style={styles.manualTitle}>Toma Manual de Signos Vitales</Text>
          </View>
          <Text style={styles.manualSubtitle}>
            Ingresa únicamente las lecturas que tomes de forma presencial con instrumental clínico. Solo estos datos se plasmarán en la gráfica del expediente:
          </Text>

          {/* Presión Arterial (mmHg) */}
          <Text style={styles.inputGroupLabel}>Presión Arterial (mmHg) - Baumanómetro</Text>
          <View style={styles.presionRow}>
            <View style={styles.inputFlex}>
              <TextInput
                style={styles.textInput}
                placeholder="Sistólica (120)"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={sistolica}
                onChangeText={setSistolica}
                maxLength={3}
              />
            </View>
            <Text style={styles.slashText}>/</Text>
            <View style={styles.inputFlex}>
              <TextInput
                style={styles.textInput}
                placeholder="Diastólica (80)"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={diastolica}
                onChangeText={setDiastolica}
                maxLength={3}
              />
            </View>
          </View>

          {/* Frecuencia Cardíaca y Oxígeno */}
          <View style={styles.inputsRow}>
            <View style={styles.inputFlex}>
              <Text style={styles.inputGroupLabel}>Frec. Cardíaca (bpm)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. 72"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={fcManual}
                onChangeText={setFcManual}
                maxLength={3}
              />
            </View>

            <View style={styles.inputFlex}>
              <Text style={styles.inputGroupLabel}>Saturación SpO2 (%)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. 98"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={spo2Manual}
                onChangeText={setSpo2Manual}
                maxLength={3}
              />
            </View>
          </View>

          {/* Temperatura axilar / Glucosa capilar */}
          <View style={[styles.inputsRow, { marginTop: 12 }]}>
            <View style={styles.inputFlex}>
              <Text style={styles.inputGroupLabel}>Temp. Axilar/Bucal (°C)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. 36.5"
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
                value={tempManual}
                onChangeText={setTempManual}
                maxLength={4}
              />
            </View>

            <View style={styles.inputFlex}>
              <Text style={styles.inputGroupLabel}>Glucosa Capilar (mg/dL)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. 110"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={glucosaManual}
                onChangeText={setGlucosaManual}
                maxLength={3}
              />
            </View>
          </View>
        </View>

        {/* 3. BOTÓN DE ACCIÓN */}
        <TouchableOpacity
          style={[styles.iniciarBtn, guardando && styles.disabledBtn]}
          onPress={procesarInicioTurno}
          disabled={guardando}
          activeOpacity={0.88}
        >
          {guardando ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="play-circle-outline" size={20} color={COLORS.white} />
              <Text style={styles.iniciarBtnText}>
                {hayDatosManuales
                  ? 'Asentar Signos e Iniciar Turno'
                  : 'Iniciar Turno sin Captura Manual →'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          {hayDatosManuales
            ? 'Los signos manuales se archivarán en el expediente y se reflejarán en la gráfica con firma del turno.'
            : 'Puedes comenzar el turno directamente. El reloj continuará su sensado periódico independiente en segundo plano.'}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerBox: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 14,
    padding: 4,
  },
  headerSubtitle: {
    color: COLORS.goldPale,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  telemetriaCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  telemetriaStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    zIndex: 2,
  },
  telemetriaContent: {
    padding: 14,
    paddingLeft: 18,
  },
  telemetriaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  beaconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 2,
  },
  radarPulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#34D399',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  telemetriaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.cacao,
  },
  pillStatus: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  telemetriaDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  manualCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  manualTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.cacao,
  },
  manualSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginBottom: 14,
  },
  inputGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  presionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputFlex: {
    flex: 1,
  },
  slashText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  iniciarBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iniciarBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footnote: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 15,
    paddingHorizontal: 10,
  },
  alertHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.red,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  alertaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.redPale,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.red + '40',
    marginBottom: 10,
  },
  alertaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.red,
    lineHeight: 16,
  },
  confirmarCriticoBtn: {
    backgroundColor: COLORS.cacao,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  confirmarCriticoBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});