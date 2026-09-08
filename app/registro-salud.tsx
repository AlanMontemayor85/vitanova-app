import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSignosRecientes, getToken, iniciarTurno } from '../services/api';
import { encolarPeticionOffline } from '../services/offlineQueue';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

export default function RegistroSaludScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paciente = params.paciente ? JSON.parse(params.paciente as string) : null;
  const momento = (params.momento as string) ?? 'inicio_turno';

  // 🛡️ Signos vitales reales (Presión queda estrictamente en null para evitar telemetría sintética)
  const [spo2, setSpo2] = useState<number | null>(null);
  const [fc, setFc] = useState<number | null>(null);
  const [temperatura, setTemperatura] = useState<number | null>(null);

  // ⌚ Estado del hardware
  const [relojActivo, setRelojActivo] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);

  // 📡 Sincronización con signos legítimos del reloj
  useEffect(() => {
    const precargarSignosReloj = async () => {
      if (!paciente?.id) return;
      try {
        console.log(`📡 [VERIFICACIÓN TURNO] Solicitando telemetría de paciente: ${paciente.id}`);
        const res = await getSignosRecientes(paciente.id);

        if (res && res.success) {
          const estaPuesto =
            res.dispositivoPuesto === true ||
            res.estado_contacto === 'puesto' ||
            Boolean(res.frescura?.bphrt || res.frescura?.spo2);

          const tieneFCValida = res.fc && res.fc !== '—' && Number(res.fc) > 30;
          const tieneSpO2Valida = res.spo2 && res.spo2 !== '—' && Number(res.spo2) > 50;

          if (estaPuesto && (tieneFCValida || tieneSpO2Valida)) {
            setRelojActivo(true);
            if (tieneSpO2Valida) setSpo2(Number(res.spo2));
            if (tieneFCValida) setFc(Number(res.fc));
            if (res.temperatura && res.temperatura !== '—') setTemperatura(Number(res.temperatura));
          } else {
            setRelojActivo(false);
            setSpo2(null);
            setFc(null);
            setTemperatura(null);
          }
        } else {
          setRelojActivo(false);
        }
      } catch (e) {
        console.error('❌ Error en sincronización de telemetría previa:', e);
        setRelojActivo(false);
      } finally {
        setLoading(false);
      }
    };

    precargarSignosReloj();
  }, [paciente?.id]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const origenCalculado = relojActivo ? 'dispositivo' : 'manual';

      // 🛑 Presión arterial va explícitamente en null: no proviene de baumanómetro clínico
      const payload = {
        paciente_id: paciente.id,
        momento,
        estado_animo: 'bien',
        alimentacion: 'bien',
        dolor_eva: 0,
        spo2: spo2 ?? null,
        presion_sistolica: null,
        presion_diastolica: null,
        frecuencia_cardiaca: fc ?? null,
        temperatura: temperatura ?? null,
        origen: origenCalculado,
        metodo: relojActivo ? 'reloj_rf_v48' : 'manual_cuidador',
      };

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
      } else {
        await avanzarAlTurno();
      }
    } catch (error) {
      console.log('⚠️ Sin red al registrar verificación de turno. Guardando en cola local...', error);

      const origenCalculado = relojActivo ? 'dispositivo' : 'manual';

      await encolarPeticionOffline(
        `${BASE_URL}/registros/salud`,
        'POST',
        {
          paciente_id: paciente.id,
          momento,
          estado_animo: 'bien',
          alimentacion: 'bien',
          dolor_eva: 0,
          spo2: spo2 ?? null,
          presion_sistolica: null,
          presion_diastolica: null,
          frecuencia_cardiaca: fc ?? null,
          temperatura: temperatura ?? null,
          origen: origenCalculado,
          metodo: relojActivo ? 'reloj_rf_v48' : 'manual_cuidador',
        },
        `Inicio de turno - ${paciente.nombre_completo}`
      );

      await avanzarAlTurno();
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
            'Turno No Permitido',
            resTurno.mensaje || 'No tienes un turno programado en este horario.',
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
      console.error('❌ Error en avanzarAlTurno:', err);
      Alert.alert('Error de Conexión', 'No se pudo validar tu estado de turno.');
    }
  };

  const momentoLabel: Record<string, string> = {
    inicio_turno: 'Verificación de Entrada',
    cierre_turno: 'Cierre de turno',
    espontaneo: 'Registro espontáneo',
  };

  const tieneHardware = Boolean(paciente?.reloj_imei || paciente?.dispositivo_id || paciente?.imei);

  if (alertas.length > 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />
        <View style={[styles.header, { backgroundColor: COLORS.red }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>⚠️ Alertas Críticas Detectadas</Text>
            <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
          </View>
        </View>
        <ScrollView style={styles.body}>
          <Text style={[styles.sectionTitle, { color: COLORS.textDark, marginTop: 8 }]}>
            Reporte Clínico Fuera de Rango
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 16, lineHeight: 18 }}>
            El hardware reportó signos descompensados. El familiar ya fue notificado en tiempo real. Confirma para proceder y abrir tu agenda de cuidados médicos:
          </Text>
          {alertas.map((a, i) => (
            <View key={i} style={styles.alertaCard}>
              <Text style={styles.alertaText}>{a}</Text>
            </View>
          ))}
          <TouchableOpacity style={[styles.confirmarBtn, { backgroundColor: COLORS.cacao }]} onPress={avanzarAlTurno}>
            <Text style={styles.confirmarBtnText}>Entendido — Abrir Agenda del Turno →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={{ marginTop: 12, fontSize: 12, color: COLORS.textLight, fontWeight: '600' }}>
          {tieneHardware ? 'Sincronizando con Reloj Vitanova...' : 'Preparando agenda de cuidados...'}
        </Text>
      </View>
    );
  }

  const esCritico =
    relojActivo &&
    ((spo2 !== null && spo2 < 92) ||
      (fc !== null && fc > 100) ||
      (temperatura !== null && temperatura > 37.8));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{momentoLabel[momento] || 'Verificación de Turno'}</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {!tieneHardware ? (
          <View style={{ marginTop: 12, marginBottom: 20 }}>
            <View style={[styles.monitorCard, { paddingVertical: 28, alignItems: 'center' }]}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.cacao, marginBottom: 6 }}>
                Plan de Acompañamiento Activo
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 16, lineHeight: 18 }}>
                Al confirmar el inicio del turno se activará la bitácora de actividades, control de medicamentos y registro de signos vitales manuales.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Estatus Actual del Dispositivo</Text>

            <View style={[styles.monitorCard, esCritico && { borderColor: COLORS.red, backgroundColor: '#FFF5F5' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.monitorCardTitle}>📡 DATOS TRANSMITIDOS POR HARDWARE</Text>
                {!relojActivo ? (
                  <Text style={[styles.badgeAlertaCritica, { backgroundColor: COLORS.border, color: COLORS.cacao }]}>
                    ⚪ EN ESPERA DE COLOCACIÓN
                  </Text>
                ) : esCritico ? (
                  <Text style={styles.badgeAlertaCritica}>🚨 DESCOMPENSADO</Text>
                ) : (
                  <Text style={[styles.badgeAlertaCritica, { backgroundColor: COLORS.greenPale, color: COLORS.green }]}>
                    🟢 EN LÍNEA
                  </Text>
                )}
              </View>

              {!relojActivo ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: COLORS.cacao, marginBottom: 4 }}>
                    Reloj en Reposo o Sin Colocar
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
                    No se detectan pulsaciones ópticas ni temperatura cutánea activa en este momento. La telemetría continuará registrándose automáticamente al colocarse el dispositivo.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.monitorGrid}>
                    <View style={styles.monitorItem}>
                      <Text style={styles.monitorLabel}>Saturación Oxígeno</Text>
                      <Text style={[styles.monitorVal, spo2 !== null && spo2 < 92 && { color: COLORS.red }]}>
                        {spo2 !== null ? `${spo2}%` : '—'}
                      </Text>
                      <Text style={styles.monitorSubText}>Normal: 95% - 100%</Text>
                    </View>

                    <View style={styles.monitorItem}>
                      <Text style={styles.monitorLabel}>Frec. Cardíaca</Text>
                      <Text style={[styles.monitorVal, fc !== null && (fc > 100 || fc < 60) && { color: COLORS.amber }]}>
                        {fc !== null ? fc : '—'} <Text style={{ fontSize: 11, fontWeight: '500' }}>bpm</Text>
                      </Text>
                      <Text style={styles.monitorSubText}>Normal: 60 - 100</Text>
                    </View>
                  </View>

                  <View style={[styles.monitorItem, { marginTop: 12 }]}>
                    <Text style={styles.monitorLabel}>Temperatura Corporal (Muñeca)</Text>
                    <Text style={[styles.monitorVal, temperatura !== null && temperatura > 37.5 && { color: COLORS.red }]}>
                      {temperatura !== null ? `${temperatura} °C` : '—'}
                    </Text>
                    <Text style={styles.monitorSubText}>Normal: 36.0 °C - 37.3 °C</Text>
                  </View>

                  <View style={[styles.monitorItem, { marginTop: 12, backgroundColor: '#F9F8F6', borderStyle: 'dashed' }]}>
                    <Text style={styles.monitorLabel}>Presión Arterial</Text>
                    <Text style={[styles.monitorVal, { fontSize: 14, color: COLORS.textLight }]}>
                      Toma Manual con Baumanómetro
                    </Text>
                    <Text style={styles.monitorSubText}>Se registra de manera presencial en la bitácora clínica</Text>
                  </View>
                </>
              )}
            </View>

            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginHorizontal: 16, marginTop: 4, marginBottom: 16, lineHeight: 18 }}>
              {relojActivo
                ? 'Los signos fueron recolectados de forma continua por los sensores de pulso y temperatura cutánea del reloj.'
                : 'Puedes iniciar el turno con normalidad. El monitoreo biométrico se actualizará en cuanto el usuario se coloque el reloj.'}
            </Text>
          </>
        )}

        <TouchableOpacity
          style={[styles.confirmarBtn, guardando && { opacity: 0.7 }]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.confirmarBtnText}>Confirmar e Iniciar Turno →</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  backIcon: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  greeting: {
    color: COLORS.goldPale,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.cacao,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monitorCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  monitorCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  badgeAlertaCritica: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: COLORS.redPale,
    color: COLORS.red,
  },
  monitorGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  monitorItem: {
    flex: 1,
    backgroundColor: COLORS.cream,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monitorLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 4,
  },
  monitorVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  monitorSubText: {
    fontSize: 9,
    color: COLORS.textLight,
    marginTop: 4,
  },
  confirmarBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmarBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  alertaCard: {
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertaText: {
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
    fontWeight: '600',
  },
});