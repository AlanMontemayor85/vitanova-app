import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { clearToken, forzarMedicionSignos, getAlertaPeso, getNotasTurno, getPacientes, getSignosRecientes, getTurnoActivoResumen, getUltimoCierre, getUserNombre, loadStoredToken } from '../services/api';
import { registrarNotificaciones } from '../services/notifications';

  
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
  const [alertaPeso, setAlertaPeso] = useState<any>(null);
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [solicitudItems, setSolicitudItems] = useState<string[]>([]);
  const [solicitudNota, setSolicitudNota] = useState('');
  const [signosDispositivo, setSignosDispositivo] = useState<any>(null);
  const [midiendo, setMidiendo] = useState<boolean>(false);
  const pacienteId = paciente?.id;

// 📡 1. Función para jalar la telemetría más reciente del reloj
const cargarSignosDispositivo = async () => {
  if (!pacienteId) return;
  const res = await getSignosRecientes(pacienteId);
  if (res && res.success) {
    setSignosDispositivo(res);
  }
};

// ⚡ 2. Función para disparar la ráfaga 'hrtstart' por Redis
const ejecutarMedicionRemota = async () => {
  if (!pacienteId || midiendo) return;
  setMidiendo(true);
  try {
    await forzarMedicionSignos(pacienteId);
    alert("📡 Solicitud enviada. El reloj comenzará la lectura en unos segundos...");
    
    // Polling táctico: Esperamos 15 segundos a que el reloj mida y mande los datos a Supabase, luego refrescamos
    setTimeout(async () => {
      await cargarSignosDispositivo();
      setMidiendo(false);
    }, 15000);
  } catch (error) {
    console.error(error);
    setMidiendo(false);
  }
};

// 🔄 3. Polling automático o carga inicial
useEffect(() => {
    const init = async () => {
      try {
        // 1. Validar Onboarding
        const onboardingCompletado = await AsyncStorage.getItem('onboarding_completado');
        if (!onboardingCompletado) {
          router.replace('/onboarding');
          return;
        }

        await registrarNotificaciones();
        
        // 2. Verificar si hay un token guardado
        const token = await loadStoredToken();
        if (!token) {
          router.replace('/login');
          return;
        }

        // 3. 🚨 ENRUTADOR RELACIONAL INTELIGENTE: Preguntamos al backend quién es este usuario
        const data = await getPacientes();
        
        // 🛡️ CONTROL DE ERRORES DE AUTENTICACIÓN
        if (!data || data.error || data.detail === 'Not authenticated') {
          await clearToken();
          router.replace('/login');
          return;
        }

        // 🛡️ ADUANA A: Cuenta nueva o reseteada desde Supabase
        if (data.status === 'pending_profile' || data.requiere_perfil || !data.usuario_tipo) {
          console.log("🚀 Cuenta limpia detectada. Redirigiendo a completar-perfil.");
          router.replace('/completar-perfil');
          return;
        }

        // 🎛️ REDIRECCIÓN BASADA EN ROLES DE PRODUCCIÓN
        if (data.usuario_tipo === 'cuidador' || data.usuario_tipo === 'cuidador_contratado') {
          console.log("🧑‍⚕️ Entrando a Panel Cuidador Operativo.");
          router.replace('/cuidador');
          return;
        } 
        
        if (data.usuario_tipo === 'medico') {
          console.log("🩺 Entrando a Panel Médico.");
          router.replace('/medico');
          return;
        }

        // 🛡️ ADUANA B: Si eres un rol 'familiar' (Admin) pero el backend te reporta SIN pacientes
        // significa que eres un Administrador nuevo que acaba de salir de completar-perfil
        if (data.usuario_tipo === 'familiar' && (!data.patients || data.patients.length === 0)) {
          console.log("👑 Perfil Administrador detectado sin paciente activo. Enviando a configuración de hardware...");
          router.replace('/perfil-paciente');
          return;
        }

        // 4. Flujo Normal de Familiar (Si llegó hasta acá, es un Familiar válido)
        if (data.patients && data.patients.length > 0) {
          setPacientes(data.patients);
          const p = data.patients[0];
          setPaciente(p);
          const cierreData = await getUltimoCierre(p.id);
          if (cierreData.cierre) setUltimoCierre(cierreData.cierre);
          const notasData = await getNotasTurno(p.id);
          if (notasData.notas) setNotas(notasData.notas);
          const turnoRes = await getTurnoActivoResumen(p.id);
          if (turnoRes.turno) setTurnoResumen(turnoRes.turno);
          else setTurnoResumen(null);
          const alertaPesoData = await getAlertaPeso(p.id);
          if (alertaPesoData.alerta) setAlertaPeso(alertaPesoData);
        }
      } catch (e) {
        console.error('Error init:', e);
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

       
{/* VITALS CON TELEMETRÍA EN VIVO (MÓDULO SIMÉTRICO PARA EL FAMILIAR) */}
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
            {/* Tarjeta de Estado Clínico Emocional */}
            <View style={styles.vitalCard}>
              <Text style={[styles.vitalVal, { fontSize: 22, lineHeight: 26, color: ultimoCierre?.estado_paciente === 'bien' ? COLORS.green : ultimoCierre?.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber }]}>
                {ultimoCierre?.estado_paciente === 'bien' ? '😊' : ultimoCierre?.estado_paciente === 'preocupante' ? '😟' : ultimoCierre ? '😐' : '—'}
              </Text>
              <Text style={styles.vitalLabel}>Condición</Text>
            </View>

            {/* Tarjeta Temperatura Corporal (Inyectada desde el Reloj o Cierre) */}
            <View style={styles.vitalCard}>
              <Text style={[styles.vitalVal, { color: COLORS.green }]}>
                {signosDispositivo?.temperatura && signosDispositivo?.temperatura !== "—" 
                  ? `${signosDispositivo.temperatura}°` 
                  : (ultimoCierre?.temperatura_corporal ? `${ultimoCierre.temperatura_corporal}°` : '—')}
              </Text>
              <Text style={styles.vitalLabel}>Temp. Corp.</Text>
            </View>

            {/* Tarjeta de Peso de Control Métrico */}
            <View style={styles.vitalCard}>
              <Text style={[styles.vitalVal, { color: COLORS.cacao }]}>
                {ultimoCierre?.peso_kg ? `${ultimoCierre.peso_kg}` : '—'}
              </Text>
              <Text style={styles.vitalUnit}>kg</Text>
              <Text style={styles.vitalLabel}> Peso</Text>
            </View>
          </View>

          {/* FILA 2: TELEMETRÍA PURA DEL HARDWARE RECHFAR RF-V48 */}
          <View style={styles.vitalsRow}>
            {/* Tarjeta SpO2 */}
            <View style={styles.vitalCard}>
              <Text style={styles.vitalVal}>
                {signosDispositivo?.spo2 !== "—" ? signosDispositivo?.spo2 : (ultimoCierre?.spo2 ?? '—')}
              </Text>
              <Text style={styles.vitalUnit}>%</Text>
              <Text style={styles.vitalLabel}>SpO₂</Text>
            </View>

            {/* Tarjeta Presión Arterial */}
            <View style={styles.vitalCard}>
              <Text style={styles.vitalVal}>
                {signosDispositivo?.presion !== "—" 
                  ? signosDispositivo?.presion.split('/')[0] 
                  : (ultimoCierre ? `${ultimoCierre.presion_sistolica}` : '—')}
                <Text style={styles.vitalValSmall}>
                  {signosDispositivo?.presion !== "—" 
                    ? `/${signosDispositivo?.presion.split('/')[1]}` 
                    : (ultimoCierre ? `/${ultimoCierre.presion_diastolica}` : '')}
                </Text>
              </Text>
              <Text style={styles.vitalLabel}>Presión</Text>
            </View>

            {/* Tarjeta Frecuencia Cardíaca */}
            <View style={styles.vitalCard}>
              <Text style={[styles.vitalVal, { color: COLORS.red }]}>
                {signosDispositivo?.fc !== "—" ? signosDispositivo?.fc : (ultimoCierre?.frecuencia_cardiaca ?? '—')}
              </Text>
              <Text style={styles.vitalUnit}>bpm</Text>
              <Text style={styles.vitalLabel}>F. Card.</Text>
            </View>
          </View>
        </View>
        {/* ACTIVIDAD RECIENTE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Último turno</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push({
              pathname: '/grafica-signos' as any,
              params: { pacienteId: paciente?.id, pacienteNombre: paciente?.nombre_completo }
            })}>
              <Text style={styles.sectionLink}>Ver gráficas</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({
              pathname: '/historial' as any,
              params: { pacienteId: paciente?.id, pacienteNombre: paciente?.nombre_completo }
            })}>
              <Text style={styles.sectionLink}>Ver historial</Text>
            </TouchableOpacity>
          </View>
        </View>

        {ultimoCierre ? (
          <>
            <View style={[styles.alertCard, { backgroundColor: COLORS.greenPale, borderColor: '#C5E8D4' }]}>
              <Text style={styles.alertIcon}>👤</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>
                  {ultimoCierre.usuarios?.nombre_completo ?? 'Cuidador'}
                </Text>
                <Text style={styles.alertSub}>
                  Estado: {ultimoCierre.estado_paciente} · {new Date(ultimoCierre.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {ultimoCierre.barthel_total !== null && (
              <View style={[styles.alertCard, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold }]}>
                <Text style={styles.alertIcon}>📋</Text>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Índice de Barthel: {ultimoCierre.barthel_total}/100</Text>
                  <Text style={styles.alertSub}>{ultimoCierre.barthel_label}</Text>
                </View>
              </View>
            )}

            {ultimoCierre.morse_total !== null && ultimoCierre.morse_total >= 25 && (
              <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0' }]}>
                <Text style={styles.alertIcon}>⚠️</Text>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Riesgo de caída: {ultimoCierre.morse_total} pts</Text>
                  <Text style={styles.alertSub}>{ultimoCierre.morse_label}</Text>
                </View>
              </View>
            )}
            
          </>
        ) : (
          <View style={[styles.alertCard, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold }]}>
            <Text style={styles.alertIcon}>ℹ️</Text>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Sin registros aún</Text>
              <Text style={styles.alertSub}>El cuidador no ha cerrado ningún turno todavía</Text>
            </View>
          </View>
        )}
        {alertaPeso && (
          <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0' }]}>
            <Text style={styles.alertIcon}>⚖️</Text>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Recordatorio de peso</Text>
              <Text style={styles.alertSub}>{alertaPeso.mensaje}</Text>
            </View>
          </View>
        )}

       
        {/* ACCESOS RÁPIDOS */}
        <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 12 }]}>Accesos rápidos</Text>
        <View style={styles.quickActions}>
          {[
            { icon: '📍', label: 'Ubicación', ruta: '/mapa' },
            { icon: '💊', label: 'Medicam.', ruta: '/medicamentos' },
            { icon: '🔔', label: 'Alertas', ruta: '/alertas' },
            { icon: '💬', label: 'Cuidadores', ruta: null },
            { icon: '🏠', label: 'Evaluación', ruta: '/evaluacion-hogar' },
            { icon: '🛏️', label: 'Solicitar', ruta: null },       
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.qaBtn}
              onPress={() => {
                if (item.label === 'Cuidadores') {
                  router.push({
                    pathname: '/red-cuidadores' as any,
                    params: {
                      pacienteId: paciente?.id,
                      pacienteNombre: paciente?.nombre_completo,
                    }
                  });
                } else if (item.label === 'Solicitar') {
                  setSolicitudOpen(true);
                  }else {
                  item.ruta && router.push(item.ruta as any);
                }
              }}
            >
              <Text style={styles.qaIcon}>{item.icon}</Text>
              <Text style={styles.qaLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          
        </View>

        {notas.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notas del cuidador</Text>
            </View>
            {notas.slice(0, 5).map((n, i) => (
              <View key={i} style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0' }]}>
                <Text style={styles.alertIcon}>📝</Text>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{n.descripcion?.replace('📝 ', '')}</Text>
                  <Text style={styles.alertSub}>
                    {n.usuarios?.nombre_completo ?? 'Cuidador'} · {n.hora_completada ? new Date(n.hora_completada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* TURNO ACTIVO */}
      <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 12 }]}>Turno activo</Text>
      {turnoResumen ? (
        <View style={styles.turnoCard}>
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
            <Text style={styles.turnoProgressText}>{turnoResumen.completadas}/{turnoResumen.total}</Text>
            <Text style={styles.turnoProgressLabel}>tareas</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.turnoCard, { justifyContent: 'center' }]}>
          <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
            Sin turno activo en este momento
          </Text>
        </View>
          )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        {[
          { icon: '🏠', label: 'Inicio', ruta: '/', active: true },
          { icon: '📍', label: 'Mapa', ruta: '/mapa', active: false },
          { icon: '🔔', label: 'Alertas', ruta: '/alertas' },
          { icon: '📋', label: 'Medicam.', ruta: '/medicamentos', active: false },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={() => item.ruta && router.push(item.ruta as any)}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={[styles.navLabel, item.active && { color: COLORS.gold }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
    paddingBottom: 24,
    paddingTop: 10,
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
