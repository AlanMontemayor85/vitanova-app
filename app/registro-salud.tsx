import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSignosRecientes, getToken, iniciarTurno } from '../services/api';

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
        // Intentamos obtener la fecha de la ráfaga desde cualquier propiedad donde el backend la mande
        const rawFecha = res.created_at || res.fecha || res.timestamp || res.updated_at;
        const fechaRegistro = rawFecha ? new Date(rawFecha).getTime() : 0;
        const ahora = new Date().getTime();
        const minutosDiferencia = rawFecha ? Math.round((ahora - fechaRegistro) / (1000 * 60)) : 'N/A';

        console.log(`⏱️ [DIAGNÓSTICO RELOJ] Fecha registro: ${rawFecha} | Minutos transcurridos: ${minutosDiferencia} min`);

        // Si la ráfaga tiene más de 10 minutos (o no trae timestamp), consideramos que el reloj está inactivo/retirado
        const diezMinutosEnMs = 10 * 60 * 1000;
        const esDatoFresco = rawFecha ? (ahora - fechaRegistro) < diezMinutosEnMs : false;

        console.log(`🧪 [DIAGNÓSTICO RELOJ] ¿Es dato fresco (<10 min)? -> ${esDatoFresco ? '✅ SÍ' : '❌ NO'}`);

        const tieneFCValida = res.fc && res.fc !== '—' && Number(res.fc) > 30;
        const tieneSpO2Valida = res.spo2 && res.spo2 !== '—' && Number(res.spo2) > 50;

        if (esDatoFresco && (tieneFCValida || tieneSpO2Valida)) {
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
          console.warn('🔴 [DIAGNÓSTICO RELOJ] RECHAZADO -> Datos obsoletos o reloj no colocado. Limpiando interfaz.');
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
      console.error('❌ Error en diagnóctico de telemetría:', e);
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
      // 🛑 SI EL RELOJ NO ESTÁ PUESTO/ACTIVO: No enviamos ceros ni enviamos ráfaga al backend para evitar falsas alertas
      if (!relojActivo) {
        console.log("⌚ Reloj inactivo o quitado. Omitiendo evaluación de alertas biométricas...");
        await avanzarAlTurno();
        return;
      }

      const token = getToken();
      const res = await fetch(`${BASE_URL}/registros/salud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paciente_id: paciente.id,
          momento,
          spo2, 
          presion_sistolica: sistolica, 
          presion_diastolica: diastolica,
          frecuencia_cardiaca: fc, 
          temperatura,
          estado_animo: 'bien',
          alimentacion: 'bien',
          dolor_eva: 0,
        }),
      });
      
      const data = await res.json();
      if (data.alertas?.length > 0) {
        setAlertas(data.alertas);
      } else {
        await avanzarAlTurno();
      }
    } catch (e) {
      console.error(e);
      // Ante un fallo de red o servidor, dejamos avanzar el turno sin congelar al cuidador
      await avanzarAlTurno();
    } finally {
      setGuardando(false);
    }
  };

  const avanzarAlTurno = async () => {
    try {
      if (momento === 'inicio_turno') {
        await iniciarTurno(paciente.id);
      }

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
      console.error(err);
    }
  };

  const momentoLabel: Record<string, string> = {
    inicio_turno: 'Verificación de Entrada',
    cierre_turno: 'Cierre de turno',
    espontaneo: 'Registro espontáneo',
  };

  // 🚨 UI: Interceptación y Pantalla de Alertas Críticas (Solo si el reloj estaba activo)
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
        <Text style={{ marginTop: 12, fontSize: 12, color: COLORS.textLight, fontWeight: '600' }}>Sincronizando con Reloj Vitanova...</Text>
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
          <Text style={styles.greeting}>{momentoLabel[momento] || 'Telemetría Automática'}</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Estatus Actual del Dispositivo</Text>
        
        {/* 🏥 MONITOR EN TIEMPO REAL AUTOMÁTICO */}
        <View style={[styles.monitorCard, esCritico && { borderColor: COLORS.red, backgroundColor: '#FFF5F5' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.monitorCardTitle}>📡 DATOS DE HARDWARE TRANSMITIDOS POR TCP</Text>
            {!relojActivo ? (
              <Text style={[styles.badgeAlertaCritica, { backgroundColor: COLORS.border, color: COLORS.cacao }]}>⚠️ DESCONECTADO / RETIRADO</Text>
            ) : esCritico ? (
              <Text style={styles.badgeAlertaCritica}>🚨 DESCOMPENSADO</Text>
            ) : null}
          </View>

          {!relojActivo ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.cacao, marginBottom: 4 }}>Reloj Sin Colocar o Inactivo</Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
                No se detectan pulsaciones ópticas activas. Los signos vitales permanecerán en pausa hasta colocar el dispositivo.
              </Text>
            </View>
          ) : (
            <>
              {/* Fila 1: SpO2 y Pulso */}
              <View style={styles.monitorGrid}>
                <View style={styles.monitorItem}>
                  <Text style={styles.monitorLabel}>Saturación Oxígeno</Text>
                  <Text style={[styles.monitorVal, spo2 !== null && spo2 < 92 && { color: COLORS.red }]}>{spo2 !== null ? `${spo2}%` : '—'}</Text>
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

              {/* Fila 3: Temperatura Corporal (Sensor Real) */}
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

        <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginHorizontal: 16, marginTop: 4, lineHeight: 18 }}>
          {relojActivo 
            ? 'Los datos superiores fueron recolectados de forma pasiva por los sensores ópticos y térmicos del reloj.'
            : 'Puedes iniciar el turno con normalidad. El sistema comenzará a registrar signos en cuanto el usuario se coloque el reloj.'}
        </Text>

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
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 8 },
  
  // 🏥 Diseño del Monitor Clínico Adaptativo
  monitorCard: { 
    backgroundColor: COLORS.cacao, 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 2, 
    borderColor: '#33302D', 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8 
  },
  
  // 📐 Cabecera del Monitor y Badges Alineados
  headerMonitorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  monitorCardTitle: { 
    flex: 1,
    fontSize: 9, 
    fontWeight: '700', 
    color: 'rgba(255,255,255,0.4)', 
    letterSpacing: 1 
  },

  // 🏷️ Estilos para Banderas de Estado (Badges)
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
    backgroundColor: 'rgba(61, 170, 106, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeActivoText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3DAA6A',
    letterSpacing: 0.5,
  },

  // 📊 Rejilla de Métricas
  monitorGrid: { flexDirection: 'row', gap: 12 },
  monitorItem: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  monitorLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 4, textAlign: 'center' },
  monitorVal: { fontSize: 22, fontWeight: '800', color: '#3DAA6A', textAlign: 'center', marginVertical: 4 },
  monitorSubText: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '500', marginTop: 2 },

  // 🚨 Tarjetas de Alerta y Botón de Acción
  alertaCard: { backgroundColor: COLORS.redPale, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)', borderLeftWidth: 4, borderLeftColor: COLORS.red },
  alertaText: { fontSize: 13, color: COLORS.red, fontWeight: '600', lineHeight: 18 },
  confirmarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
});