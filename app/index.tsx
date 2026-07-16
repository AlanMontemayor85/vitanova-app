import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { calibrarAcelerometroReloj, clearToken, forzarMedicionSignos, getAlertaPeso, getNotasTurno, getPacientes, getSignosRecientes, getTurnoActivoResumen, getUltimoCierre, getUserNombre, loadStoredToken } from '../services/api';
import { registrarNotificaciones } from '../services/notifications';
import CuidadorScreen from './cuidador';
  
const COLORS = {
  gold: '#BF9A40',
  goldLight: '#D4B060',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cacaoDark: '#2C2820',
  cream: '#FAFAF7',
  sage: '#E8F0E4',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textMid: '#4A4540',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

export default function HomeScreen() {
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ultimoCierre, setUltimoCierre] = useState<any>(null);
  const [notas, setNotas] = useState<any[]>([]);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteIndex, setPacienteIndex] = useState(0);
  const params = useLocalSearchParams();
  const [turnoResumen, setTurnoResumen] = useState<any>(null);
  const [peso, setPeso] = useState<string>('—');
  const [alertaPeso, setAlertaPeso] = useState<any>(null);
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [solicitudItems, setSolicitudItems] = useState<string[]>([]);
  const [solicitudNota, setSolicitudNota] = useState('');
  const [signosDispositivo, setSignosDispositivo] = useState<any>(null);
  const [midiendo, setMidiendo] = useState<boolean>(false);
  const [nombreUsuario, setNombreUsuario] = useState<string>('Familiar');
  const [vistaModo, setVistaModo] = useState<'familiar' | 'cuidador'>('familiar');
  const pacienteId = paciente?.id;

// 📡 1. Función para jalar la telemetría más reciente del reloj
const cargarSignosDispositivo = async (idToLoad?: string) => {
  const targetId = idToLoad || pacienteId;
  if (!targetId) return;
  
  try {
    const res = await getSignosRecientes(targetId);
    if (res && res.success) {
      console.log(`📥 [INDEX] Telemetría fresca guardada para el paciente: ${targetId}`);
      setSignosDispositivo(res);
      
      // 💾 Guardamos respaldo local persistente
      await AsyncStorage.setItem(`@vitals_${targetId}`, JSON.stringify(res));
    }
  } catch (error) {
    console.log("⚠️ Error cargando signos vitales:", error);
  }
};

// ⚡ 2. Función para disparar la ráfaga 'hrtstart' por Redis (Alineada para Index)
const ejecutarMedicionRemota = async () => {
  // 🎯 CONCILIACIÓN DE LLAVES: Usamos el ID real de tu pantalla index
  const idReal = paciente?.id || paciente?.paciente_id || pacienteId;

  if (!idReal || midiendo) {
    console.warn("⚠️ Abortando medición: El ID del paciente llegó vacío:", idReal);
    return;
  }
  
  setMidiendo(true);
  try {
    // Mandamos el ID real validado
    await forzarMedicionSignos(idReal);
    alert("📡 Solicitud enviada. El reloj comenzará la lectura en unos segundos...");
    
    // Polling táctico: Esperamos 15 segundos a que el reloj mida y mande los datos a Supabase, luego refrescamos
    setTimeout(async () => {
      await cargarSignosDispositivo();
      setMidiendo(false);
    }, 15000);
  } catch (error) {
    console.error("❌ Error al inyectar comando desde la app familiar:", error);
    setMidiendo(false);
  }
};
const handleCalibrarReloj = async () => {
  const idReal = paciente?.id || paciente?.paciente_id || pacienteId;
  if (!idReal) {
    alert("⚠️ No se pudo determinar el ID del paciente.");
    return;
  }

  try {
    // Mandamos el ID y por defecto se va con "2" (Sensibilidad Estándar)
    const res = await calibrarAcelerometroReloj(idReal, "2");
    
    // 🎯 VALIDACIÓN CORREGIDA: Cambiamos res.success por res.status === 'ok'
    if (res && (res.status === 'ok' || res.success)) {
      alert("⚙️ ¡Comando enviado! El acelerómetro se calibró a nivel estándar (Nivel 2).");
    } else {
      alert(`⚠️ API respondió con error: ${res.detail || res.detail || 'No se pudo aplicar'}`);
    }
  } catch (error) {
    console.error("❌ Error al calibrar desde index:", error);
    alert("Error de red al conectar con el servidor.");
  }
};
// Borramos el router.push y lo dejamos como un log pasivo de estado
useEffect(() => {
  console.log("🔄 [INDEX] Modo de visualización cambiado a:", vistaModo, "| Paciente:", paciente?.id);
}, [vistaModo, paciente?.id]);
// 🔄 Carga inicial y Enrutador Inteligente Relacional
useEffect(() => {
  const init = async () => {
    try {
      setLoading(true);
      
      // 1. Validar Onboarding local
      const onboardingCompletado = await AsyncStorage.getItem('onboarding_completado');
      if (!onboardingCompletado) {
        router.replace('/onboarding');
        return;
      }

      
      
      // 2. Verificar si hay un token de sesión guardado en el dispositivo
      const token = await loadStoredToken();
      if (!token) {
        router.replace('/login');
        return;
      }
       
      // 3. 🚨 ADUANA BIOMÉDICA: Preguntamos a Railway/Supabase quién es este usuario
      const data = await getPacientes();
      
      // Mapeo del nombre completo (Alan Montemayor). 
      // Usamos un typeof para evitar que truene en rojo si aún no has declarado el useState arriba.
      if (data && data.usuario_nombre && typeof setNombreUsuario === 'function') {
        setNombreUsuario(data.usuario_nombre); 
      }
      // Inicializar canal de notificaciones push de Expo
      await registrarNotificaciones().catch(err => console.log("Push omitido en simulación:", err));
      
      // 🛡️ CONTROL A: Token inválido/expirado o usuario borrado → limpiar y a login
      if (!data || data.no_autenticado || data.error || data.detail === 'Token inválido o expirado') {
        console.log("🛑 Sesión inválida o expirada. Expulsando al Login.");
        await clearToken();
        router.replace('/login');
        return;
      }

      // 🛡️ CONTROL B: Registro trunco o cuenta reseteada con el botón dorado
      if (data.status === 'pending_profile' || data.requiere_perfil || !data.usuario_tipo) {
        console.log("🚀 Perfil limpio detectado en Supabase. Redirigiendo a completar-perfil.");
        router.replace('/completar-perfil');
        return;
      }
      // 🎛️ SEGMENTACIÓN DE RUTAS BASADA EN ROLES DE PRODUCCIÓN
      console.log("🔍 [DIAGNÓSTICO INIT] Estado en el frame actual:");
      console.log("👉 vistaModo actual en closure:", vistaModo);
      console.log("👉 data.patients devueltos por API:", data?.patients?.length);
      console.log("👉 pacienteIndex actual:", typeof pacienteIndex !== 'undefined' ? pacienteIndex : 'undefined');
      // 🎛️ SEGMENTACIÓN DE RUTAS BASADA EN ROLES DE PRODUCCIÓN
      if (data.usuario_tipo === 'cuidador' || data.usuario_tipo === 'cuidador_contratado') {
        console.log("🧑‍⚕️ Acceso detectado como Cuidador operativo.");
        
        // 🎯 EL CANDADO MAESTRO: Si Alan activó el Switch embebido, bloqueamos la expulsión por Router
        if (typeof vistaModo !== 'undefined' && vistaModo === 'cuidador') {
          console.log("🛡️ [INIT] Modo switch familiar activo. Cancelando redirección forzada a /cuidador.");
          // Permitimos que continúe la ejecución sin saltar de pantalla para refrescar la telemetría
        } else {
          // Si es un inicio limpio desde el login, redirige de forma normal
          console.log("Redirigiendo a pantalla independiente de cuidador...");
          router.replace('/cuidador');
          return; // Metemos el return necesario para frenar el flujo aquí
        }
      } else if (data.usuario_tipo === 'autonomo') {
        console.log("🧓 Acceso concedido como Autocuidador. Redirigiendo...");
        router.replace({
          pathname: '/autocuidador' as any,
          params: { pacienteId: data.patients?.[0]?.id }
        });
        return;
      } else {
        console.log("👨‍👩‍👧 Acceso familiar confirmado. Cargando panel principal...");
      }
      
      if (data.usuario_tipo === 'medico') {
        console.log("🩺 Acceso concedido como Supervisor Médico. Redirigiendo...");
        router.replace('/medico');
        return;
      }

      // 👑 CONTROL C: Si eres un Familiar/Admin válido, te damos luz verde para continuar abajo
      if (data.usuario_tipo === 'familiar' || data.usuario_tipo === 'admin') {
        console.log("👑 Acceso concedido como Administrador. Inicializando entorno de telemetría...");
      }

      // 📡 4. Flujo Normal de Familiar (Carga de telemetría y estado clínico)
      if (data.patients && data.patients.length > 0) {
        setPacientes(data.patients);
        const p = data.patients[pacienteIndex || 0]; // Usa el índice seleccionado o el primero
        setPaciente(p);
        
        // Jalar asíncronamente el último cierre de turno del cuidador
        const cierreData = await getUltimoCierre(p.id).catch(() => ({ cierre: null }));
        if (cierreData?.cierre) setUltimoCierre(cierreData.cierre);
        
        // Jalar bitácora de notas de cuidado recientes
        const notasData = await getNotasTurno(p.id).catch(() => ({ notas: [] }));
        if (notasData?.notas) setNotas(notasData.notas);
        
        // Verificar si hay un cuidador en turno activo transmitiendo
        const turnoRes = await getTurnoActivoResumen(p.id).catch(() => ({ turno: null }));
        if (turnoRes?.turno) setTurnoResumen(turnoRes.turno);
        else setTurnoResumen(null);
        
        // Verificar alertas críticas de peso/hidratación
        const alertaPesoData = await getAlertaPeso(p.id).catch(() => ({ alerta: null }));
        if (alertaPesoData?.alerta) setAlertaPeso(alertaPesoData);
        
      } else {
        // 🔥 LA CORRECCIÓN CLAVE: Si ya tienes rol de admin, pero no hay pacientes en Supabase,
        // la app te transfiere directo a vincular el hardware, no a completar perfil.
        console.log("⌚ Familiar sin paciente asignado actualmente. Redirigiendo a perfil-paciente.");
        router.replace('/perfil-paciente');
        return;
      }

    } catch (e) {
      console.error('❌ Error crítico en el init de la Home:', e);
      // En caso de un fallo generalizado de red o parseo, el sistema se protege regresando al login
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  init();
}, [params.refresh]);
useEffect(() => {
  if (pacientes.length === 0) return;
  const p = pacientes[pacienteIndex];
  setPaciente(p);
  setUltimoCierre(null);
  setNotas([]);
  const cargarDatos = async () => {
  const cierreData = await getUltimoCierre(p.id);
  if (cierreData.cierre) setUltimoCierre(cierreData.cierre);
  const notasData = await getNotasTurno(p.id);
  if (notasData.notas) setNotas(notasData.notas.slice(0, 5));
  if (notasData.notas) setNotas(notasData.notas);
  const turnoRes = await getTurnoActivoResumen(p.id);
  if (turnoRes.turno) setTurnoResumen(turnoRes.turno);
  else setTurnoResumen(null);
  const alertaPesoData = await getAlertaPeso(p.id);
  if (alertaPesoData.alerta) setAlertaPeso(alertaPesoData);
  else setAlertaPeso(null);
};
  cargarDatos();
}, [pacienteIndex]);

// 3️⃣ TERCER EFFECT: Polling asíncrono y autónomo para los signos vitales
useEffect(() => {
  if (pacientes.length === 0) return;
  const p = pacientes[pacienteIndex];
  if (!p?.id) return;

  // ⚡ Carga inmediata de red al cambiar de paciente
  cargarSignosDispositivo(p.id);

  // ⏱️ Cronómetro silencioso en segundo plano cada 30 segundos
  const intervalo = setInterval(() => {
    console.log(`🔄 [POLLING] Solicitando signos frescos para: ${p.id}`);
    cargarSignosDispositivo(p.id);
  }, 30000);

  // 🧼 Limpieza obligatoria al cambiar de pestaña o paciente
  return () => clearInterval(intervalo);
}, [pacienteIndex, pacientes]);
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF7' }}>
        <ActivityIndicator size="large" color="#BF9A40" />
        <Text style={{ marginTop: 12, color: '#8A8078', fontSize: 12 }}>Cargando...</Text>
      </View>
    );
  }

  const nombre = paciente?.nombre_completo?.split(' ')[0] ?? 'Paciente';
  const condiciones = paciente?.condiciones_medicas?.join(' · ') ?? '—';
  const iniciales = paciente?.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') ?? 'VN';

 return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'}
          </Text>
          <Text style={styles.userName}>{getUserNombre() ?? 'Familiar'}</Text>
        </View>

        {/* SWITCH MODO */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 4 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
            {vistaModo === 'familiar' ? '👨‍👩‍👧' : '🩺'}
          </Text>
          <Switch
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: COLORS.gold }}
            thumbColor={COLORS.white}
            value={vistaModo === 'cuidador'}
            onValueChange={(val) => setVistaModo(val ? 'cuidador' : 'familiar')}
          />
        </View>

        <TouchableOpacity 
          style={[styles.notifBtn, { marginRight: 8 }]}
          onPress={() => router.push('/nuevo-paciente' as any)}
        >
          <Text style={{ color: COLORS.gold, fontSize: 22, fontWeight: '800' }}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.notifBtn}
          onPress={async () => {
            await clearToken();
            router.replace('/login');
          }}
        >
          <Text style={styles.notifIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* ── INTERRUPTOR DINÁMICO DE CONSOLA ── */}
      {vistaModo === 'cuidador' && paciente?.id ? (
        /* 🩺 MODO OPERATIVO (Cargamos tu pantalla de cuidador directamente) */
        <CuidadorScreen 
          key={paciente.id} // 👑 🎯 EL TRUCO MAESTRO: Forza a React a destruir la memoria vieja y abrir un turno limpio
          pacienteProp={paciente} 
          onRegresar={() => setVistaModo('familiar')}
        />
      ) : (
        /* 👨‍👩‍👧 MODO FAMILIAR (Tu interfaz normal con tarjeta de paciente, scroll, bottomNav y modal) */
        <>
          {/* PATIENT CARD */}
          <View style={styles.patientCard}>
            {pacientes.length > 1 && (
              <TouchableOpacity onPress={() => {
                const newIndex = (pacienteIndex - 1 + pacientes.length) % pacientes.length;
                setPacienteIndex(newIndex);
                setPaciente(pacientes[newIndex]);
              }}>
                <Text style={{ color: COLORS.gold, fontSize: 20, marginRight: 4 }}>‹</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/perfil-paciente' as any,
                params: { paciente: JSON.stringify(paciente) }
              })}
              style={styles.patientAvatar}
            >
              <Text style={styles.patientAvatarText}>{iniciales}</Text>
            </TouchableOpacity>
            <View style={styles.patientInfo}>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                Persona a tu cuidado
              </Text>
              <Text style={styles.patientName}>{nombre}</Text>
              <Text style={styles.patientAge}>{condiciones}</Text>
              {pacientes.length > 1 && (
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{pacienteIndex + 1} de {pacientes.length}</Text>
              )}
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Bien</Text>
            </View>
            {pacientes.length > 1 && (
              <TouchableOpacity onPress={() => {
                const newIndex = (pacienteIndex + 1) % pacientes.length;
                setPacienteIndex(newIndex);
                setPaciente(pacientes[newIndex]);
              }}>
                <Text style={{ color: COLORS.gold, fontSize: 20, marginLeft: 4 }}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

            {/* VITALS CON TELEMETRÍA EN VIVO */}
            <View style={styles.vitalsContainer}>
              <View style={styles.vitalsHeaderRow}>
                <Text style={styles.sectionTitle}>Estatus y Parámetros</Text>
                <TouchableOpacity 
                  style={[styles.btnMedir, midiendo && styles.btnMedirDesactivado]} 
                  onPress={ejecutarMedicionRemota}
                  disabled={midiendo}
                >
                  <Text style={styles.btnMedirText}>
                    {midiendo ? "Leyendo... ⏳" : "🔄 Sensa Reloj"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* FILA 1: ESTADO GENERAL DE BIENESTAR, TEMPERATURA Y PESO */}
              <View style={[styles.vitalsRow, { marginBottom: 8 }]}>
                <View style={styles.vitalCard}>
                  <Text style={[styles.vitalVal, { fontSize: 22, lineHeight: 26,
                    color: signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'critica' ? COLORS.red 
                      : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'regular' ? COLORS.amber 
                      : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'buena' ? COLORS.green
                      : '#8E8E93'
                  }]}>
                    {signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'critica' ? '😟' 
                      : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'regular' ? '😐' 
                      : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'buena' ? '😊' 
                      : '—'} 
                  </Text>
                  <Text style={styles.vitalLabel}>Condición</Text>
                </View>

                <View style={styles.vitalCard}>
                  <Text style={[styles.vitalVal, { color: signosDispositivo?.frescura?.bphrt ? COLORS.green : COLORS.textLight }]}>
                    {signosDispositivo?.frescura?.bphrt && signosDispositivo?.temperatura && signosDispositivo?.temperatura !== "—" 
                      ? `${signosDispositivo.temperatura}°` : '—'}
                  </Text>
                  <Text style={styles.vitalLabel}>Temp. Corp.</Text>
                </View>

                <View style={styles.vitalCard}>
                  <Text style={[styles.vitalVal, { color: COLORS.cacao }]}>
                    {signosDispositivo?.peso && signosDispositivo?.peso !== "—"
                      ? signosDispositivo.peso.replace(" kg", "") 
                      : (ultimoCierre?.peso_kg ? `${ultimoCierre.peso_kg}` : '—')}
                  </Text>
                  <Text style={styles.vitalLabel}>Peso</Text>
                </View>
              </View>

              {/* FILA 2: TELEMETRÍA PURA DEL HARDWARE */}
              <View style={styles.vitalsRow}>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalVal}>
                    {signosDispositivo?.frescura?.spo2 && signosDispositivo?.spo2 !== "—" 
                      ? signosDispositivo?.spo2 : '—'}
                  </Text>
                  <Text style={styles.vitalUnit}>%</Text>
                  <Text style={styles.vitalLabel}>SpO₂</Text>
                </View>

                <View style={styles.vitalCard}>
                  <Text style={styles.vitalVal}>
                    {signosDispositivo?.frescura?.bphrt && signosDispositivo?.presion !== "—" 
                      ? signosDispositivo?.presion.split('/')[0] : '—'}
                    <Text style={styles.vitalValSmall}>
                      {signosDispositivo?.frescura?.bphrt && signosDispositivo?.presion !== "—" 
                        ? `/${signosDispositivo?.presion.split('/')[1]}` : ''}
                    </Text>
                  </Text>
                  <Text style={styles.vitalLabel}>Presión</Text>
                </View>

                <View style={styles.vitalCard}>
                  <Text style={[styles.vitalVal, { color: signosDispositivo?.frescura?.bphrt ? COLORS.red : COLORS.textLight }]}>
                    {signosDispositivo?.frescura?.bphrt && signosDispositivo?.fc !== "—" 
                      ? signosDispositivo?.fc : '—'}
                  </Text>
                  <Text style={styles.vitalUnit}>bpm</Text>
                  <Text style={styles.vitalLabel}>F. Card.</Text>
                </View>
              </View>
            </View>

            {/* TARJETA CONFIG RELOJ */}
            {signosDispositivo?.reloj_config && (
              <View style={{
                backgroundColor: COLORS.white,
                borderRadius: 12,
                padding: 14,
                marginTop: 8,
                marginBottom: 4,
                borderWidth: 1,
                borderColor: COLORS.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12
              }}>
                <Text style={{ fontSize: 24 }}>{'⚙️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textDark }}>
                    {'Configuración del reloj'}
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>
                    {(() => {
                      const config = signosDispositivo.reloj_config;
                      if (!config.caida_activa) return 'Detector de caídas: ⭕ Desactivado';
                      if (config.sensibilidad === 1) return 'Detector de caídas: 🔴 Alta';
                      if (config.sensibilidad === 2) return 'Detector de caídas: 🟠 Media';
                      if (config.sensibilidad === 3) return 'Detector de caídas: 🟡 Estándar';
                      return 'Detector de caídas: 🟢 Baja (recomendada)';
                    })()}
                  </Text>
                  <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 2 }}>
                    {(() => {
                      const uc = signosDispositivo.reloj_config.ultima_configuracion;
                      if (!uc) return 'Última sincronización: Sin registro aún';
                      return `Última sincronización: ${new Date(uc).toLocaleDateString('es-MX', { 
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}`;
                    })()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/perfil-paciente' as any,
                    params: { paciente: JSON.stringify(paciente) }
                  })}
                  style={{
                    backgroundColor: COLORS.goldPale,
                    borderRadius: 8,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: COLORS.gold
                  }}
                >
                  <Text style={{ fontSize: 10, color: COLORS.gold, fontWeight: '700' }}>{'Ajustar'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ======================================================== */}
            {/* ⚡ SECCIÓN 1: TURNO ACTIVO DE CUIDADO                    */}
            {/* ======================================================== */}
            <View style={[styles.sectionHeader, { marginTop: 12, marginBottom: 8 }]}>
              <Text style={styles.sectionTitle}>Turno activo</Text>
            </View>

            {turnoResumen ? (
              <View style={[styles.turnoCard, { marginTop: 8 }]}>
                <View style={styles.turnoLeft}>
                  <View style={styles.turnoAvatar}>
                    <Text style={styles.turnoAvatarText}>
                      {turnoResumen.cuidador_nombre?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.turnoName}>{turnoResumen.cuidador_nombre}</Text>
                    <Text style={styles.turnoHora}>{turnoResumen.horario}</Text>
                  </View>
                </View>
                <View style={styles.turnoProgress}>
                  <Text style={styles.turnoProgressText}>{`${turnoResumen.completadas}/${turnoResumen.total}`}</Text>
                  <Text style={styles.turnoProgressLabel}>tareas</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.turnoCard, { justifyContent: 'center', marginTop: 8 }]}>
                <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
                  Sin turno activo en este momento
                </Text>
              </View>
            )}

           {/* ======================================================== */}
            {/* 🎛️ SECCIÓN 2: ACCESOS RÁPIDOS OPERATIVOS                */}
            {/* ======================================================== */}
            <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>Accesos rápidos</Text>
            
            <View style={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              gap: 8, 
              marginBottom: 20 
            }}>
              {[
                
                { icon: '💊', label: 'Medicam.', ruta: '/medicamentos' },                
                { icon: '💬', label: 'Cuidadores', ruta: '/red-cuidadores' },
                { icon: '📊', label: 'Gráficas', ruta: '/grafica-signos' },
                { icon: '📜', label: 'Historial', ruta: '/historial' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.qaBtn, 
                    { 
                      // 🎯 Calcula el ancho para que quepan exactamente 3 columnas restando el gap
                      width: '31.8%', 
                      marginBottom: 4,
                      paddingVertical: 12
                    }
                  ]}
                  onPress={() => {
                    if (item.label === 'Cuidadores') {
                      router.push({
                        pathname: '/red-cuidadores' as any,
                        params: {
                          pacienteId: paciente?.id,
                          pacienteNombre: paciente?.nombre_completo,
                        }
                      });
                    } else if (item.label === 'Medicam.') {
                      router.push({
                        pathname: '/medicamentos' as any,
                        params: {
                          pacienteId: paciente?.id,
                          pacienteNombre: paciente?.nombre_completo,
                        }
                      });
                    } else if (item.label === 'Alertas') {
                      router.push({
                        pathname: '/alertas' as any,
                        params: {
                          pacienteId: paciente?.id,
                        }
                      });
                    } else if (item.label === 'Ubicación') {
                      router.push({
                        pathname: '/mapa' as any,
                        params: {
                          pacienteId: paciente?.id,
                        }
                      });
                    } else if (item.label === 'Gráficas') {
                      router.push({
                        pathname: '/grafica-signos' as any,
                        params: {
                          pacienteId: paciente?.id,
                          pacienteNombre: paciente?.nombre_completo
                        }
                      });
                    } else if (item.label === 'Historial') {
                      router.push({
                        pathname: '/historial' as any,
                        params: {
                          pacienteId: paciente?.id,
                          pacienteNombre: paciente?.nombre_completo
                        }
                      });
                    }
                  }}
                >
                  <Text style={styles.qaIcon}>{item.icon}</Text>
                  <Text style={styles.qaLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ======================================================== */}
            {/* 👑 SECCIÓN 3: SERVICIOS VITANOVA INTEGRALIS              */}
            {/* ======================================================== */}
            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 12 }]}>Servicios Vitanova Integralis</Text>
            <View style={[styles.quickActions, { justifyContent: 'flex-start', gap: 12 }]}>
              {[
                { icon: '🏠', label: 'Evaluación de Entorno', ruta: '/evaluacion-hogar' },
                { icon: '🛏️', label: 'Solicitar Equipamiento', ruta: null },       
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.qaBtn, { width: '48%', maxWidth: '48%' }]}
                  onPress={() => {
                    if (item.label === 'Solicitar Equipamiento') {
                      setSolicitudOpen(true);
                    } else if (item.ruta) {
                      router.push({
                        pathname: item.ruta as any,
                        params: { pacienteId: paciente?.id, ts: Date.now().toString() }
                      });
                    }
                  }}
                >
                  <Text style={styles.qaIcon}>{item.icon}</Text>
                  <Text style={styles.qaLabel} numberOfLines={2}>{item.label}</Text> 
                </TouchableOpacity>
              ))}
            </View>

            {/* ======================================================== */}
            {/* 📜 SECCIÓN 4: BITÁCORA DE RESUMEN (ÚLTIMO TURNO CERRADO) */}
            {/* ======================================================== */}
            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 12 }]}>Último turno</Text>

            {ultimoCierre ? (
              <>
                <View style={[styles.alertCard, { backgroundColor: COLORS.greenPale, borderColor: '#C5E8D4', flexDirection: 'row', alignItems: 'center' }]}>
                  <Text style={styles.alertIcon}>👤</Text>
                  <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                    <Text style={styles.alertTitle}>
                      {ultimoCierre.usuarios?.nombre_completo ?? 'Cuidador'}
                    </Text>
                    <Text style={styles.alertSub}>
                      {`Estado: ${ultimoCierre.estado_paciente} · ${new Date(ultimoCierre.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </Text>
                  </View>
                </View>

                {ultimoCierre.barthel_total !== null && (
                  <View style={[styles.alertCard, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold, marginTop: 8, flexDirection: 'row', alignItems: 'center' }]}>
                    <Text style={styles.alertIcon}>📋</Text>
                    <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                      <Text style={styles.alertTitle}>Índice de Barthel: {ultimoCierre.barthel_total}/100</Text>
                      <Text style={styles.alertSub}>{ultimoCierre.barthel_label}</Text>
                    </View>
                  </View>
                )}

                {ultimoCierre.morse_total !== null && ultimoCierre.morse_total >= 25 && (
                  <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', marginTop: 8, flexDirection: 'row', alignItems: 'center' }]}>
                    <Text style={styles.alertIcon}>⚠️</Text>
                    <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                      <Text style={styles.alertTitle}>Riesgo de caída: {ultimoCierre.morse_total} pts</Text>
                      <Text style={styles.alertSub}>{ultimoCierre.morse_label}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.alertCard, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={styles.alertIcon}>ℹ️</Text>
                <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                  <Text style={styles.alertTitle}>Sin registros aún</Text>
                  <Text style={styles.alertSub}>El cuidador no ha cerrado ningún turno todavía</Text>
                </View>
              </View>
            )}

            {alertaPeso && (
              <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', marginTop: 8, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={styles.alertIcon}>⚖️</Text>
                <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                  <Text style={styles.alertTitle}>Recordatorio de peso</Text>
                  <Text style={styles.alertSub}>{alertaPeso.mensaje}</Text>
                </View>
              </View>
            )}

            {/* NOTAS RECIENTES DEL CUIDADOR */}
            {notas && notas.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
                  Notas del cuidador
                </Text>
                {notas.slice(0, 3).map((n, i) => (
                  <View key={n?.id || i} style={[styles.alertCard, { 
                    backgroundColor: COLORS.amberPale, 
                    borderColor: '#F5DBA0', 
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }]}>
                    <Text style={styles.alertIcon}>📝</Text>
                    <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                      <Text style={styles.alertTitle}>
                        {String(n?.descripcion || n?.texto || "Nota de relevo").replace('📝 ', '')}
                      </Text>
                      <Text style={styles.alertSub}>
                        {`${n?.usuarios?.nombre_completo ?? 'Personal Vitanova'} · ${
                        n?.created_at 
                          ? new Date(n.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : ''
                      }`}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Espaciador final correcto al fondo del ScrollView */}
            <View style={{ height: 60 }} />
          </ScrollView>
          
          {/* BOTTOM NAV */}
          <View style={[
            styles.bottomNav, 
            { 
              paddingBottom: Platform.OS === 'android' ? 48 : 20, 
              height: Platform.OS === 'android' ? 98 : 72,
              alignItems: 'center', 
            }
          ]}>
            {[
              { icon: '📍', label: 'Mapa', ruta: '/mapa', active: false },
              { icon: '💊', label: 'Medicam.', ruta: '/medicamentos', active: false },                          
              { icon: '🔔', label: 'Alertas', ruta: '/alertas', active: false },
              { icon: '📋', label: 'Inicio', ruta: '/', active: true },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                onPress={() => {
                  if (item.ruta === '/') {
                    router.push('/');
                  } else {
                    router.push({
                      pathname: item.ruta as any,
                      params: {
                        pacienteId: paciente?.id,
                        pacienteNombre: paciente?.nombre_completo,
                      }
                    });
                  }
                }}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={[styles.navLabel, item.active && { color: COLORS.gold }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* MODAL DE SOLICITUD */}
          <Modal visible={solicitudOpen} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 }}>
                  🛏️ Solicitar equipo médico
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 16 }}>
                  Selecciona el equipo para {paciente?.nombre_completo?.split(' ')[0] ?? 'el paciente'}
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {[
                    { icon: '🛏️', label: 'Cama hospitalaria' },
                    { icon: '🪑', label: 'Silla de ruedas' },
                    { icon: '🚶', label: 'Andadera' },
                    { icon: '💨', label: 'Concentrador de oxígeno' },
                    { icon: '🫁', label: 'Oxígeno medicinal' },
                    { icon: '📡', label: 'Monitor de signos vitales' },
                    { icon: '🚿', label: 'Banco de baño' },
                    { icon: '🔒', label: 'Barras de seguridad' },
                    { icon: '🩺', label: 'Oxímetro' },
                    { icon: '🛌', label: 'Colchón antiescaras' },
                    { icon: '💊', label: 'Nebulizador' },
                    { icon: '🧴', label: 'Pañales' },
                  ].map((eq) => {
                    const seleccionado = solicitudItems.includes(eq.label);
                    return (
                      <TouchableOpacity
                        key={eq.label}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          padding: 12, borderRadius: 10, marginBottom: 6,
                          backgroundColor: seleccionado ? COLORS.goldPale : COLORS.cream,
                          borderWidth: 1, borderColor: seleccionado ? COLORS.gold : COLORS.border,
                        }}
                        onPress={() => {
                          setSolicitudItems(prev =>
                            prev.includes(eq.label)
                              ? prev.filter(i => i !== eq.label)
                              : [...prev, eq.label]
                          );
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{eq.icon}</Text>
                        <Text style={{ fontSize: 13, fontWeight: seleccionado ? '700' : '500', color: seleccionado ? COLORS.gold : COLORS.textDark, flex: 1 }}>
                          {eq.label}
                        </Text>
                        {seleccionado && <Text style={{ fontSize: 14, color: COLORS.gold, fontWeight: '800' }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                  <TextInput
                    style={{
                      backgroundColor: COLORS.cream, borderRadius: 10, padding: 12,
                      borderWidth: 1, borderColor: COLORS.border, fontSize: 13,
                      color: COLORS.textDark, minHeight: 60, textAlignVertical: 'top',
                      marginTop: 8, marginBottom: 16,
                    }}
                    placeholder="Notas adicionales (urgencia, talla, detalles...)"
                    placeholderTextColor={COLORS.textLight}
                    multiline
                    value={solicitudNota}
                    onChangeText={setSolicitudNota}
                  />
                  <TouchableOpacity
                    style={{
                      backgroundColor: solicitudItems.length > 0 ? '#25D366' : COLORS.border,
                      borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8,
                    }}
                    disabled={solicitudItems.length === 0}
                    onPress={() => {
                      const nombrePaciente = paciente?.nombre_completo ?? 'el paciente';
                      const listaEquipo = solicitudItems.map(i => `• ${i}`).join('\n');
                      const mensaje = encodeURIComponent(
                        `Hola Vitanova 👋\n\nSoy *${getUserNombre() ?? 'un familiar'}* y necesito equipo médico para *${nombrePaciente}*.\n\n*Equipo solicitado:*\n${listaEquipo}${solicitudNota ? `\n\n*Notas:* ${solicitudNota}` : ''}\n\n_Enviado desde la app Vitanova Integralis_`
                      );
                      Linking.openURL(`https://wa.me/528140078129?text=${mensaje}`);
                      setSolicitudOpen(false);
                      setSolicitudItems([]);
                      setSolicitudNota('');
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.white }}>
                      {solicitudItems.length > 0 ? `📲 Enviar solicitud (${solicitudItems.length})` : 'Selecciona al menos un equipo'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
                    onPress={() => { setSolicitudOpen(false); setSolicitudItems([]); setSolicitudNota(''); }}
                  >
                    <Text style={{ fontSize: 13, color: COLORS.textLight, fontWeight: '600' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <View style={{ height: 20 }} />
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      )}
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
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  notifBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifIcon: { fontSize: 18 },
  patientCard: {
    backgroundColor: COLORS.cacao,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  patientAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold,
  },
  patientAvatarText: {
    fontSize: 14, fontWeight: '800', color: COLORS.gold,
  },
  patientInfo: { flex: 1 },
  patientName: {
    fontSize: 13, fontWeight: '700', color: COLORS.white,
  },
  patientAge: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(61,170,106,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)',
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green,
  },
  statusText: {
    fontSize: 9, fontWeight: '700', color: COLORS.green, letterSpacing: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vitalVal: {
    fontSize: 16, fontWeight: '800', color: COLORS.gold, lineHeight: 20,
  },
  vitalValSmall: {
    fontSize: 10,
  },
  vitalUnit: {
    fontSize: 8, color: COLORS.textLight, marginTop: 1,
  },
  vitalLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textMid, marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.textLight,
  },
  sectionLink: {
    fontSize: 10, fontWeight: '700', color: COLORS.gold,
  },
  alertCard: {
    borderRadius: 12, padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
  },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textDark,
  },
  alertSub: {
    fontSize: 10, color: COLORS.textLight, marginTop: 2, lineHeight: 14,
  },
  alertTime: {
    fontSize: 9, color: COLORS.textLight,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  qaBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qaIcon: { fontSize: 20, marginBottom: 4 },
  qaLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center',
  },
  turnoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14, padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 8,
  },
  turnoLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  turnoAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', justifyContent: 'center',
  },
  turnoAvatarText: {
    fontSize: 12, fontWeight: '800', color: COLORS.gold,
  },
  turnoName: {
    fontSize: 13, fontWeight: '700', color: COLORS.textDark,
  },
  turnoHora: {
    fontSize: 10, color: COLORS.textLight, marginTop: 1,
  },
  turnoProgress: {
    alignItems: 'center',
    backgroundColor: COLORS.goldPale,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  turnoProgressText: {
    fontSize: 16, fontWeight: '800', color: COLORS.gold,
  },
  turnoProgressLabel: {
    fontSize: 9, color: COLORS.gold, fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    
    // 🎯 Aplicamos la elevación aquí que es el estilo activo
    paddingBottom: Platform.OS === 'android' ? 32 : 24, 
    paddingTop: 10,
    height: Platform.OS === 'android' ? 80 : 68,
  },
  navItem: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  navIcon: { fontSize: 20 },
  navLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textLight,
  },
  vitalsContainer: {
  marginHorizontal: 16,
  marginVertical: 12,
},
vitalsHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},
btnMedir: {
  backgroundColor: '#BF9A40', // Oro Vitanova
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 20,
},
btnMedirDesactivado: {
  backgroundColor: '#A49E99',
},
btnMedirText: {
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: '700',
},

});
