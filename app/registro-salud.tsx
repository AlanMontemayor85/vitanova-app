import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  // 🛡️ Estados nulos por defecto para no falsear lecturas
  const [spo2, setSpo2] = useState<number | null>(null);
  const [sistolica, setSistolica] = useState<number | null>(null);
  const [diastolica, setDiastolica] = useState<number | null>(null);
  const [fc, setFc] = useState<number | null>(null);
  const [temperatura, setTemperatura] = useState<number | null>(null);
  
  // ⌚ Banderas de estado del hardware
  const [relojActivo, setRelojActivo] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);
  
  // 📡 Sincronización Automática con las últimas ráfagas del Reloj en Supabase
  // 📡 Sincronización Automática con Diagnóstico Profundo
useEffect(() => {
  const precargarSignosReloj = async () => {
    if (!paciente?.id) return;
    try {
      console.log('==========================================');
      console.log(`📡 [DIAGNÓSTICO RELOJ] Solicitando signos de paciente: ${paciente.id}`);
      
      const res = await getSignosRecientes(paciente.id);
      
      console.log('📦 [DIAGNÓSTICO RELOJ] Respuesta RAW de getSignosRecientes:', JSON.stringify(res, null, 2));

      if (res && res.success) {
        // ✅ 1. Criterio de contacto: Usar la resolución del backend o presencia de signos frescos
        const estaPuesto = res.dispositivoPuesto === true || 
                           res.estado_contacto === 'puesto' || 
                           Boolean(res.frescura?.bphrt || res.frescura?.spo2);

        const tieneFCValida = res.fc && res.fc !== '—' && Number(res.fc) > 30;
        const tieneSpO2Valida = res.spo2 && res.spo2 !== '—' && Number(res.spo2) > 50;

        if (estaPuesto && (tieneFCValida || tieneSpO2Valida)) {
          console.log('🟢 [DIAGNÓSTICO RELOJ] ACEPTADO -> Mostrando datos en pantalla');
          setRelojActivo(true);
          if (tieneSpO2Valida) setSpo2(Number(res.spo2));
          if (tieneFCValida) setFc(Number(res.fc));
          if (res.temperatura && res.temperatura !== '—') setTemperatura(Number(res.temperatura));
          if (res.presion && typeof res.presion === 'string' && res.presion.includes('/')) {
            const [sis, dia] = res.presion.split('/');
            setSistolica(Number(sis));
            setDiastolica(Number(dia));
          }
        } else {
          console.warn('🔴 [DIAGNÓSTICO RELOJ] RECHAZADO -> Reloj retirado, en carga o sin signos frescos.');
          setRelojActivo(false);
          setSpo2(null);
          setFc(null);
          setSistolica(null);
          setDiastolica(null);
          setTemperatura(null);
        }
      } else {
        console.warn('⚠️ [DIAGNÓSTICO RELOJ] Respuesta de la API fue no exitosa o vacía.');
        setRelojActivo(false);
      }
    } catch (e) {
      console.error('❌ Error en diagnóstico de telemetría:', e);
      setRelojActivo(false);
    } finally {
      console.log('==========================================');
      setLoading(false);
    }
  };

  precargarSignosReloj();
}, [paciente?.id]);

  const guardar = async () => {
    setGuardando(true);
    try {
      // 🔑 Determinamos el origen: si el reloj está activo y transmitiendo, es 'dispositivo'
      const origenCalculado = relojActivo ? 'dispositivo' : 'manual';

      const payload = {
        paciente_id: paciente.id,
        momento,
        estado_animo: 'bien',
        alimentacion: 'bien',
        dolor_eva: 0,
        spo2: spo2 ?? null,
        presion_sistolica: sistolica ?? null,
        presion_diastolica: diastolica ?? null,
        frecuencia_cardiaca: fc ?? null,
        temperatura: temperatura ?? null,
        origen: origenCalculado,
        metodo: relojActivo ? 'reloj_rf_v48' : 'manual_cuidador',
      };

      const token = await getToken();

      // Intentamos el envío normal por HTTP
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
      console.log('⚠️ Sin red al registrar inicio de turno. Guardando en cola local...', error);
      
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
          presion_sistolica: sistolica ?? null,
          presion_diastolica: diastolica ?? null,
          frecuencia_cardiaca: fc ?? null,
          temperatura: temperatura ?? null,
          origen: origenCalculado,
          metodo: relojActivo ? 'reloj_rf_v48' : 'manual_cuidador',
        },
        `Inicio de turno - ${paciente.nombre_completo}`
      );

      // El cuidador entra a la agenda de inmediato
      await avanzarAlTurno();
    } finally {
      setGuardando(false);
    }
  };

  // 💡 Asegúrate de incluir 'Alert' en tus imports de React Native:
// import { Alert, ActivityIndicator, ScrollView, ... } from 'react-native';

const avanzarAlTurno = async () => {
  try {
    if (momento === 'inicio_turno') {
      const resTurno = await iniciarTurno(paciente.id);

      // 🛑 CANTERA DE SEGURIDAD: Si el backend rechaza por estar fuera de horario
      if (resTurno?.sin_horario) {
        Alert.alert(
          "Turno No Permitido",
          resTurno.mensaje || "No tienes un turno programado en este horario.",
          [
            { 
              text: "Entendido", 
              onPress: () => router.back() // 👈 Lo saca y regresa a la pantalla anterior
            }
          ]
        );
        return; // ⛔ Frena aquí y NO ejecuta la navegación a /cuidador
      }
    }

    // ✅ Si el turno se inició correctamente o no es 'inicio_turno', entra al tablero
    if (params.modoSwitch === 'cuidador_familiar') {
      console.log("🔙 Regresando al embebido → Consola");
      router.replace({
        pathname: '/',
        params: {
          refresh: String(Date.now()),
          abrirModoCuidador: 'true',
          pacienteIdConsola: paciente.id
        }
      });
      return;
    }

    router.replace({
      pathname: '/cuidador' as any,
      params: {
        vistaInicial: 'turno',
        paciente: JSON.stringify(paciente),
        modoSwitch: 'ninguno'
      }
    });
  } catch (err) {
    console.error("❌ Error en avanzarAlTurno:", err);
    Alert.alert("Error de Conexión", "No se pudo validar tu estado de turno.");
  }
};

  const momentoLabel: Record<string, string> = {
    inicio_turno: 'Verificación de Entrada',
    cierre_turno: 'Cierre de turno',
    espontaneo: 'Registro espontáneo',
  };

 // 🎯 1. Identificar si el paciente tiene hardware contratado/vinculado
  const tieneHardware = Boolean(paciente?.reloj_imei || paciente?.dispositivo_id || paciente?.imei);

  // 🚨 UI: Interceptación de Alertas Críticas (Solo si el reloj reportó signos alterados)
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
          <Text style={[styles.sectionTitle, { color: COLORS.textDark, marginTop: 8 }]}>Reporte Clínico Fuera de Rango</Text>
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

  const esCritico = relojActivo && ((spo2 !== null && spo2 < 92) || (sistolica !== null && sistolica > 150) || (fc !== null && fc > 100) || (temperatura !== null && temperatura > 37.8));

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
        
        {/* ── CASO A: PACIENTE SIN HARDWARE CONTRATADO (Plan Cuidados / Sin Reloj) ── */}
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
          /* ── CASO B: PACIENTE CON TELEMETRÍA Y RELOJ ── */
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
                    No se detectan pulsaciones ópticas activas en este momento. La telemetría continuará registrándose automáticamente al colocarse el dispositivo.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Fila 1: SpO2 y Pulso */}
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

                  {/* Fila 2: Presión Arterial Combinada */}
                  <View style={[styles.monitorItem, { marginTop: 12 }]}>
                    <Text style={styles.monitorLabel}>Presión Arterial</Text>
                    <Text style={styles.monitorVal}>
                      {sistolica !== null && diastolica !== null ? `${sistolica} / ${diastolica}` : '—'} <Text style={{ fontSize: 12, fontWeight: '500' }}>mmHg</Text>
                    </Text>
                    <Text style={styles.monitorSubText}>Normal: 120 / 80 mmHg</Text>
                  </View>

                  {/* Fila 3: Temperatura Corporal */}
                  <View style={[styles.monitorItem, { marginTop: 12 }]}>
                    <Text style={styles.monitorLabel}>Temperatura Corporal (Muñeca)</Text>
                    <Text style={[styles.monitorVal, temperatura !== null && temperatura > 37.5 && { color: COLORS.red }]}>
                      {temperatura !== null ? `${temperatura} °C` : '—'}
                    </Text>
                    <Text style={styles.monitorSubText}>Normal: 36.0 °C - 37.3 °C</Text>
                  </View>
                </>
              )}
            </View>

            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginHorizontal: 16, marginTop: 4, marginBottom: 16, lineHeight: 18 }}>
              {relojActivo 
                ? 'Los signos fueron recolectados de forma continua por los sensores ópticos y térmicos del reloj.'
                : 'Puedes iniciar el turno con normalidad. El monitoreo biométrico se actualizará en cuanto el usuario se coloque el reloj.'}
            </Text>
          </>
        )}

        {/* 🔘 BOTÓN PRINCIPAL */}
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
  // ── 1. ESTRUCTURA Y CONTENEDORES BASE ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  body: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 14 
  },
  sectionTitle: { 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 1, 
    textTransform: 'uppercase', 
    color: COLORS.cacao, 
    marginBottom: 10, 
    marginTop: 8 
  },

  // ── 2. ENCABEZADO ESTANDARIZADO (CACAO + DORADOS) ──
  header: { 
    backgroundColor: COLORS.cacao, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    flexDirection: 'row', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  greeting: { 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1, 
    textTransform: 'uppercase', 
    color: COLORS.gold, 
    marginBottom: 2 
  },
  userName: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.white 
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  backIcon: { 
    fontSize: 18, 
    color: COLORS.white,
    fontWeight: 'bold' 
  },

  // ── 3. MONITOR CLÍNICO ADAPTATIVO ──
  monitorCard: { 
    backgroundColor: COLORS.cacao, 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#3A3530', 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 6,
    elevation: 3
  },
  headerMonitorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  monitorCardTitle: { 
    flex: 1,
    fontSize: 10, 
    fontWeight: '800', 
    color: COLORS.gold, 
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },

  // ── 4. BANDERAS DE ESTADO (BADGES) ──
  badgeInactivo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeInactivoText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  badgeCriticoContainer: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAlertaCritica: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  badgeActivo: {
    backgroundColor: COLORS.greenPale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.green + '40',
  },
  badgeActivoText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.green,
    letterSpacing: 0.5,
  },

  // ── 5. REJILLA DE MÉTRICAS ──
  monitorGrid: { 
    flexDirection: 'row', 
    gap: 10 
  },
  monitorItem: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.25)', 
    borderRadius: 12, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)', 
    alignItems: 'center' 
  },
  monitorLabel: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: 'rgba(255,255,255,0.6)', 
    marginBottom: 2, 
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  monitorVal: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.green, 
    textAlign: 'center', 
    marginVertical: 2 
  },
  monitorSubText: { 
    fontSize: 9, 
    color: 'rgba(255,255,255,0.4)', 
    fontWeight: '600', 
    marginTop: 2 
  },

  // ── 6. ALERTAS Y ACCIONES FINALES ──
  alertaCard: { 
    backgroundColor: COLORS.redPale, 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: COLORS.red + '30', 
    borderLeftWidth: 4, 
    borderLeftColor: COLORS.red 
  },
  alertaText: { 
    fontSize: 12, 
    color: COLORS.red, 
    fontWeight: '700', 
    lineHeight: 16 
  },
  confirmarBtn: { 
    backgroundColor: COLORS.cacao, 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    marginTop: 20, 
    shadowColor: COLORS.cacao, 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 5,
    elevation: 3 
  },
  confirmarBtnText: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.white, 
    letterSpacing: 0.5 
  },
});