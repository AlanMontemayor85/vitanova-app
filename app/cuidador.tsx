import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import {
  agregarTareaManual, clearToken, completarActividad, completarTarea,
  detectarCambiosTurno, getPacientes, getTareasHoy, getToken,
  getTurnoActivo, getUserNombre, loadStoredToken, verificarEscalas
} from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textMid: '#4A4540', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', greenPale: '#EAF5E8', amber: '#D4860A',
  amberPale: '#FFF4E0', red: '#D94F4F', redPale: '#FDEAEA',
};

// ── ESCALAS CLÍNICAS ──────────────────────────────────────────

const BARTHEL_ITEMS = [
  { label: 'Comer', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Necesita ayuda' }, { val: 10, txt: 'Independiente' }] },
  { label: 'Bañarse', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Independiente' }] },
  { label: 'Vestirse', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Necesita ayuda' }, { val: 10, txt: 'Independiente' }] },
  { label: 'Arreglarse', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Independiente' }] },
  { label: 'Deposición', opciones: [{ val: 0, txt: 'Incontinente' }, { val: 5, txt: 'Accidente ocasional' }, { val: 10, txt: 'Continente' }] },
  { label: 'Micción', opciones: [{ val: 0, txt: 'Incontinente' }, { val: 5, txt: 'Accidente ocasional' }, { val: 10, txt: 'Continente' }] },
  { label: 'Usar el baño', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Necesita ayuda' }, { val: 10, txt: 'Independiente' }] },
  { label: 'Traslados', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Gran ayuda' }, { val: 10, txt: 'Mínima ayuda' }, { val: 15, txt: 'Independiente' }] },
  { label: 'Deambulación', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Silla de ruedas' }, { val: 10, txt: 'Con ayuda' }, { val: 15, txt: 'Independiente' }] },
  { label: 'Escaleras', opciones: [{ val: 0, txt: 'Dependiente' }, { val: 5, txt: 'Necesita ayuda' }, { val: 10, txt: 'Independiente' }] },
];

const MORSE_ITEMS = [
  { label: 'Historial de caídas', opciones: [{ val: 0, txt: 'No' }, { val: 25, txt: 'Sí' }] },
  { label: 'Diagnóstico secundario', opciones: [{ val: 0, txt: 'No' }, { val: 15, txt: 'Sí' }] },
  { label: 'Ayuda para caminar', opciones: [{ val: 0, txt: 'Ninguna / reposo' }, { val: 15, txt: 'Muletas / bastón' }, { val: 30, txt: 'Se apoya en muebles' }] },
  { label: 'Acceso IV o heparina', opciones: [{ val: 0, txt: 'No' }, { val: 20, txt: 'Sí' }] },
  { label: 'Marcha', opciones: [{ val: 0, txt: 'Normal / reposo' }, { val: 10, txt: 'Débil' }, { val: 20, txt: 'Deteriorada' }] },
  { label: 'Estado mental', opciones: [{ val: 0, txt: 'Orientado' }, { val: 15, txt: 'Sobreestima su capacidad' }] },
];

const MNA_ITEMS = [
  { label: 'Ingesta de alimentos', opciones: [{ val: 0, txt: 'Reducción severa' }, { val: 1, txt: 'Reducción moderada' }, { val: 2, txt: 'Sin reducción' }] },
  { label: 'Pérdida de peso reciente', opciones: [{ val: 0, txt: 'Más de 3kg' }, { val: 1, txt: 'No sabe' }, { val: 2, txt: 'Entre 1-3kg' }, { val: 3, txt: 'Sin pérdida' }] },
  { label: 'Movilidad', opciones: [{ val: 0, txt: 'En cama / silla' }, { val: 1, txt: 'Se levanta pero no sale' }, { val: 2, txt: 'Sale a la calle' }] },
  { label: 'Enfermedad aguda últimas 3 semanas', opciones: [{ val: 0, txt: 'Sí' }, { val: 2, txt: 'No' }] },
  { label: 'Problemas neuropsicológicos', opciones: [{ val: 0, txt: 'Demencia severa' }, { val: 1, txt: 'Demencia leve' }, { val: 2, txt: 'Sin problemas' }] },
  { label: 'Índice de masa corporal (IMC)', opciones: [{ val: 0, txt: 'Menos de 19' }, { val: 1, txt: 'Entre 19-21' }, { val: 2, txt: 'Entre 21-23' }, { val: 3, txt: 'Mayor de 23' }] },
];

function getBarthelLabel(total: number) {
  if (total === 100) return '🟢 Independiente total';
  if (total >= 60) return '🟡 Dependencia leve';
  if (total >= 40) return '🟠 Dependencia moderada';
  if (total >= 20) return '🔴 Dependencia severa';
  return '🔴 Dependencia total';
}

function getMorseLabel(total: number) {
  if (total < 25) return '🟢 Sin riesgo';
  if (total < 45) return '🟡 Riesgo bajo';
  return '🔴 Riesgo alto';
}

function getMNALabel(total: number) {
  if (total >= 12) return '🟢 Estado nutricional normal';
  if (total >= 8) return '🟡 Riesgo de malnutrición';
  return '🔴 Malnutrición';
}

const TIPOS_TAREA = ['medicamento', 'alimentacion', 'higiene', 'ejercicio', 'cita', 'otro'];
const ICONOS_TIPO: Record<string, string> = {
  medicamento: '💊', alimentacion: '🍽️', ejercicio: '🚶', higiene: '🛁', cita: '📅', otro: '📝',
};

type Vista = 'lista' | 'turno' | 'cierre';

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────

export default function CuidadorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ── ESTADO DE NAVEGACIÓN ──
  const [vista, setVista] = useState<Vista>('lista');
  const [loading, setLoading] = useState(true);

  // ── PACIENTES Y TURNO ──
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteActivo, setPacienteActivo] = useState<any>(null);
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [tareas, setTareas] = useState<any[]>([]);
  const turnoActivoRef = useRef<any>(null);

  // ── MODALES ──
  const [notaOpen, setNotaOpen] = useState(false);
  const [notaTexto, setNotaTexto] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [tareaOpen, setTareaOpen] = useState(false);
  const [tareaDesc, setTareaDesc] = useState('');
  const [tareaTipo, setTareaTipo] = useState('otro');
  const [tareaHora, setTareaHora] = useState('');
  const [guardandoTarea, setGuardandoTarea] = useState(false);

  // ── CAMBIOS DE TURNO ──
  const [cambiosModal, setCambiosModal] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState<any[]>([]);

  // ── ESCALAS CLÍNICAS ──
  const [escalaRequerida, setEscalaRequerida] = useState(false);
  const [escalasLista, setEscalasLista] = useState<string[]>([]);
  const [escalaMotivo, setEscalaMotivo] = useState('');
  const [escalasMensaje, setEscalasMensaje] = useState('');
  const [barthelOpen, setBarthelOpen] = useState(false);
  const [barthelScores, setBarthelScores] = useState<number[]>(new Array(10).fill(0));
  const [barthelTocado, setBarthelTocado] = useState(false);
  const barthelTotal = barthelScores.reduce((a, b) => a + b, 0);
  const [morseOpen, setMorseOpen] = useState(false);
  const [morseScores, setMorseScores] = useState<number[]>(new Array(6).fill(0));
  const [morseTocado, setMorseTocado] = useState(false);
  const morseTotal = morseScores.reduce((a, b) => a + b, 0);
  const [mnaOpen, setMnaOpen] = useState(false);
  const [mnaScores, setMnaScores] = useState<number[]>(new Array(6).fill(0));
  const [mnaTocado, setMnaTocado] = useState(false);
  const mnaTotal = mnaScores.reduce((a, b) => a + b, 0);

  // ── SIGNOS VITALES CIERRE ──
  const [spo2, setSpo2] = useState(98);
  const [sistolica, setSistolica] = useState(120);
  const [diastolica, setDiastolica] = useState(80);
  const [fc, setFc] = useState(72);
  const [estadoPaciente, setEstadoPaciente] = useState('bien');
  const [peso, setPeso] = useState(70.0);

  // ── CARGA INICIAL ──────────────────────────────────────────

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getPacientes();
        if (data.patients) setPacientes(data.patients);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  // Navegación directa al turno desde registro-salud
  useEffect(() => {
    if (params.vistaInicial === 'turno' && params.paciente) {
      try {
        const p = JSON.parse(params.paciente as string);
        setPacienteActivo(p);
        cargarTurno(p.id);
        setVista('turno');
      } catch (e) {
        console.error('Error parseando paciente:', e, params.paciente);
      }
    }
  }, [params.vistaInicial, params.paciente]);

  // ── HELPERS ───────────────────────────────────────────────

  const cargarTurno = async (pacienteId: string) => {
    const [turnoData, tareasData] = await Promise.all([
      getTurnoActivo(pacienteId),
      getTareasHoy(pacienteId),
    ]);
    if (turnoData.turno) {
      setTurnoActivo(turnoData.turno);
      turnoActivoRef.current = turnoData.turno;
    }
    if (tareasData.tareas) setTareas(tareasData.tareas);
  };

  const resetEstados = () => {
    setPacienteActivo(null);
    setTurnoActivo(null);
    turnoActivoRef.current = null;
    setTareas([]);
    setEstadoPaciente('bien');
    setPeso(70.0);
    setSpo2(98); setSistolica(120); setDiastolica(80); setFc(72);
    setBarthelScores(new Array(10).fill(0));
    setMorseScores(new Array(6).fill(0));
    setMnaScores(new Array(6).fill(0));
    setBarthelOpen(false); setMorseOpen(false); setMnaOpen(false);
    setBarthelTocado(false); setMorseTocado(false); setMnaTocado(false);
    setEscalaRequerida(false); setEscalasLista([]);
  };

  const irARegistroSalud = (p: any) => {
    router.push({
      pathname: '/registro-salud' as any,
      params: { paciente: JSON.stringify(p), momento: 'inicio_turno' },
    });
  };

  // ── INICIO DE TURNO ───────────────────────────────────────

  const [iniciando, setIniciando] = useState(false);

const manejarInicioTurno = async (p: any) => {
  if (iniciando) return;
  setIniciando(true);
  try {
    const cambiosData = await detectarCambiosTurno(p.id);
    if (cambiosData.cambios && cambiosData.cambios.length > 0) {
      setCambiosPendientes(cambiosData.cambios);
      setPacienteActivo(p);
      setCambiosModal(true);
    } else {
      irARegistroSalud(p);
    }
  } catch (e) {
    irARegistroSalud(p);
  } finally {
    setIniciando(false);
  }
};
  // ── NOTAS ─────────────────────────────────────────────────

  const guardarNota = async () => {
    if (!notaTexto.trim()) return;
    setGuardandoNota(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paciente_id: pacienteActivo.id,
          turno_id: turnoActivoRef.current?.id,
          texto: notaTexto,
        }),
      });
      setTareas(prev => [...prev, {
        id: Date.now().toString(),
        tipo: 'otro',
        descripcion: `📝 ${notaTexto}`,
        hora_programada: null,
        completada: true,
      }]);
      setNotaTexto('');
      setNotaOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setGuardandoNota(false);
    }
  };

  // ── TAREAS MANUALES (INCIDENTALES) ────────────────────────

  const guardarTareaManual = async () => {
    if (!tareaDesc.trim()) return;
    setGuardandoTarea(true);
    try {
      const res = await agregarTareaManual({
        turno_id: turnoActivoRef.current?.id,
        paciente_id: pacienteActivo.id,
        tipo: tareaTipo,
        descripcion: tareaDesc.trim(),
        hora_programada: tareaHora || null,
        es_incidental: true,
      });
      setTareas(prev => [...prev, {
        id: res.tarea_id ?? Date.now().toString(),
        tipo: tareaTipo,
        descripcion: tareaDesc.trim(),
        hora_programada: tareaHora || null,
        completada: false,
        es_incidental: true,
      }]);
      setTareaDesc('');
      setTareaTipo('otro');
      setTareaHora('');
      setTareaOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setGuardandoTarea(false);
    }
  };

  // ── CIERRE DE TURNO ───────────────────────────────────────

  const compartirWhatsApp = () => {
    const emoji = estadoPaciente === 'bien' ? '😊' : estadoPaciente === 'preocupante' ? '😟' : '😐';
    const estado = estadoPaciente === 'bien' ? 'Bien' : estadoPaciente === 'preocupante' ? 'Preocupante' : 'Regular';
    const mensaje = `🏠 *Vitanova Integralis — Resumen de turno*\n\n👤 Paciente: *${pacienteActivo?.nombre_completo}*\n${emoji} Estado: *${estado}*\n\n📊 *Signos vitales:*\n- SpO₂: ${spo2}%\n- Presión: ${sistolica}/${diastolica} mmHg\n- FC: ${fc} bpm\n- Peso: ${peso} kg\n\n✅ Turno cerrado por ${getUserNombre() ?? 'Cuidador'}\n🕐 ${new Date().toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n\n_Vitanova Integralis — Cuidado profesional en el hogar_`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(mensaje)}`).catch(() => {
      Alert.alert('WhatsApp no disponible', 'Instala WhatsApp para compartir el resumen');
    });
  };

  const confirmarCierre = async () => {
    const tareasPendientes = tareas.filter(t => !t.completada && t.tipo !== 'otro' && !t.es_incidental);
    if (tareasPendientes.length > 0) {
      Alert.alert(
        '⚠️ Tareas pendientes',
        `Tienes ${tareasPendientes.length} tarea${tareasPendientes.length > 1 ? 's' : ''} sin completar:\n${tareasPendientes.map(t => `• ${t.descripcion}`).join('\n')}\n\n¿Deseas cerrar de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar turno', style: 'destructive', onPress: ejecutarCierre },
        ]
      );
    } else {
      await ejecutarCierre();
    }
  };

  const ejecutarCierre = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/turnos/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paciente_id: pacienteActivo.id,
          estado_paciente: estadoPaciente,
          spo2, presion_sistolica: sistolica, presion_diastolica: diastolica,
          frecuencia_cardiaca: fc,
          barthel_scores: barthelTocado ? barthelScores : null,
          barthel_total: barthelTocado ? barthelTotal : null,
          barthel_label: barthelTocado ? getBarthelLabel(barthelTotal) : null,
          morse_scores: morseTocado ? morseScores : null,
          morse_total: morseTocado ? morseTotal : null,
          morse_label: morseTocado ? getMorseLabel(morseTotal) : null,
          mna_scores: mnaTocado ? mnaScores : null,
          mna_total: mnaTocado ? mnaTotal : null,
          mna_label: mnaTocado ? getMNALabel(mnaTotal) : null,
          peso_kg: peso,
          imc: pacienteActivo.talla_cm
            ? parseFloat((peso / Math.pow(pacienteActivo.talla_cm / 100, 2)).toFixed(1))
            : null,
        }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        resetEstados();
        const pData = await getPacientes();
        if (pData.patients) setPacientes(pData.patients);
        setVista('lista');
        Alert.alert('✅ Turno cerrado', 'El resumen fue enviado al familiar.');
      } else {
        Alert.alert('Error', data.detail ?? 'No se pudo cerrar el turno.');
      }
    } catch (e) {
      console.error('Error cerrando turno:', e);
      Alert.alert('Error', 'No se pudo cerrar el turno. Intenta de nuevo.');
    }
  };

  // ── LOADING ───────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // ── VISTA LISTA ───────────────────────────────────────────

  if (vista === 'lista') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Bienvenido</Text>
            <Text style={styles.userName}>{getUserNombre() ?? 'Cuidador'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={async () => { await clearToken(); router.replace('/login'); }}>
            <Text style={styles.notifIcon}>🚪</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Tus pacientes hoy</Text>

          {pacientes.map((p) => {
            const estadoTurno = p.estado_turno ?? 'no_iniciado';
            const condiciones = p.condiciones_medicas?.join(' · ') ?? '—';
            const iniciales = p.nombre_completo?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

            return (
              <View key={p.id} style={styles.pacienteCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.pacienteAvatar}>
                    <Text style={styles.pacienteAvatarText}>{iniciales}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pacienteNombre}>{p.nombre_completo}</Text>
                    <Text style={styles.pacienteCondiciones}>{condiciones}</Text>
                  </View>
                  {estadoTurno === 'activo' && (
                    <View style={styles.badgeActivo}>
                      <View style={styles.activoDot} />
                      <Text style={styles.badgeActivoText}>Activo</Text>
                    </View>
                  )}
                  {estadoTurno === 'finalizado' && (
                    <View style={styles.badgeFinalizado}>
                      <Text style={styles.badgeFinalizadoText}>✓ Listo</Text>
                    </View>
                  )}
                </View>

                {estadoTurno === 'no_iniciado' && (
                  <TouchableOpacity
                    style={[styles.iniciarBtn, { marginTop: 10, alignSelf: 'stretch' }]}
                    onPress={() => manejarInicioTurno(p)}
                  >
                    <Text style={[styles.iniciarBtnText, { textAlign: 'center' }]}>Iniciar turno →</Text>
                  </TouchableOpacity>
                )}

                {estadoTurno === 'activo' && (
                  <TouchableOpacity
                    style={[styles.iniciarBtn, { backgroundColor: COLORS.greenPale, borderColor: COLORS.green, marginTop: 10, alignSelf: 'stretch' }]}
                    onPress={() => {
                      setPacienteActivo(p);
                      cargarTurno(p.id);
                      setVista('turno');
                    }}
                  >
                    <Text style={[styles.iniciarBtnText, { color: COLORS.green, textAlign: 'center' }]}>Continuar turno →</Text>
                  </TouchableOpacity>
                )}

                {estadoTurno === 'finalizado' && (
                  <View style={styles.badgeFinalizado}>
                    <Text style={styles.badgeFinalizadoText}>
                      ✓ {p.turno_hora_fin 
                        ? new Date(p.turno_hora_fin).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })
                        : 'Completado hoy'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* MODAL CAMBIOS DETECTADOS */}
        <Modal visible={cambiosModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>⚠️ Cambios desde tu último turno</Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>
                Por favor revisa y confirma los siguientes cambios:
              </Text>
              {cambiosPendientes.map((c, i) => (
                <View key={i} style={[styles.cambioItem, { borderLeftColor: c.severidad === 'alta' ? COLORS.red : COLORS.amber }]}>
                  <Text style={{ fontSize: 13, color: COLORS.textDark }}>{c.mensaje}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.gold, marginTop: 16 }]}
                onPress={() => { setCambiosModal(false); irARegistroSalud(pacienteActivo); }}
              >
                <Text style={styles.modalBtnText}>Entendido — Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── VISTA TURNO ───────────────────────────────────────────

  if (vista === 'turno' && pacienteActivo) {
    const tareasNormales = tareas.filter(t => t.tipo !== 'otro');
    const tareasNotas = tareas.filter(t => t.tipo === 'otro');
    const tareasAtrasadas = tareasNormales.filter(t => t.atrasada && !t.completada);
    const tareasBloque = tareasNormales.filter(t => !t.atrasada);

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('lista')} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Turno activo</Text>
            <Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text>
          </View>
          <View style={styles.turnoActivoPill}>
            <View style={styles.activoDot} />
            <Text style={styles.activoText}>Activo</Text>
          </View>
        </View>

        {/* BARRA DE PROGRESO */}
        {tareasNormales.length > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${(tareasNormales.filter(t => t.completada).length / tareasNormales.length * 100)}%` as any
            }]} />
            <Text style={styles.progressText}>
              {tareasNormales.filter(t => t.completada).length}/{tareasNormales.length} tareas
            </Text>
          </View>
        )}

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

          {/* TAREAS ATRASADAS */}
          {tareasAtrasadas.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: COLORS.amber }]}>⚠️ Tareas atrasadas</Text>
              {tareasAtrasadas.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tareaCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0' }]}
                  onPress={async () => {
                  if (!t.completada) {
                    await completarActividad(t.id, pacienteActivo.id);
                    setTareas(prev => prev.map(tarea =>
                      tarea.id === t.id ? { ...tarea, completada: true } : tarea
                    ));
                  }
                }}
                >
                  <Text style={styles.tareaIcon}>{ICONOS_TIPO[t.tipo] ?? '📝'}</Text>
                  <View style={styles.tareaInfo}>
                    <Text style={styles.tareaTexto}>{t.descripcion}</Text>
                    <Text style={[styles.tareaHora, { color: COLORS.amber }]}>Atrasada · {t.hora ?? '—'}</Text>
                  </View>
                  <View style={[styles.tareaCheck, { borderColor: COLORS.amber }]}>
                    <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '800' }}>{t.completada ? '✓' : ''}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* TAREAS DEL BLOQUE */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 }}>
            <Text style={styles.sectionTitle}>Tareas del turno</Text>
            <TouchableOpacity
              style={[styles.iniciarBtn, { paddingHorizontal: 12, paddingVertical: 4 }]}
              onPress={() => setTareaOpen(true)}
            >
              <Text style={[styles.iniciarBtnText, { fontSize: 11 }]}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          {tareasBloque.length === 0 && tareasAtrasadas.length === 0 && (
            <View style={[styles.emptyCard, { marginBottom: 16, backgroundColor: COLORS.goldPale, borderColor: COLORS.gold }]}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>📋</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao, textAlign: 'center', marginBottom: 4 }}>
                No hay tareas para este bloque
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
                Agrega tareas incidentales con el botón + Agregar
              </Text>
            </View>
          )}

          {tareasBloque.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tareaCard, t.completada && styles.tareaCardDone]}
              onPress={async () => {
              if (!t.completada) {
                if (t.actividad_id || !t.registro_id) {
                  await completarActividad(t.id, pacienteActivo.id);
                } else {
                  await completarTarea(t.registro_id ?? t.id);
                }
                setTareas(prev => prev.map(tarea =>
                  tarea.id === t.id ? { ...tarea, completada: true } : tarea
                ));
              }
            }}
            >
              <Text style={styles.tareaIcon}>{ICONOS_TIPO[t.tipo] ?? '📝'}</Text>
              <View style={styles.tareaInfo}>
                <Text style={[styles.tareaTexto, t.completada && { textDecorationLine: 'line-through' }]}>
                  {t.descripcion}
                </Text>
                <Text style={styles.tareaHora}>
                  {t.hora ?? t.hora_programada ?? '—'}
                  {t.es_incidental ? ' · Incidental' : ''}
                </Text>
              </View>
              <View style={[styles.tareaCheck, t.completada && styles.tareaCheckDone]}>
                <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '800' }}>{t.completada ? '✓' : ''}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* NOTAS */}
          {tareasNotas.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Notas del turno</Text>
              {tareasNotas.map((t) => (
                <View key={t.id} style={[styles.tareaCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0' }]}>
                  <Text style={styles.tareaIcon}>📝</Text>
                  <View style={styles.tareaInfo}>
                    <Text style={styles.tareaTexto}>{t.descripcion?.replace('📝 ', '')}</Text>
                    <Text style={styles.tareaHora}>
                      {t.hora_completada
                        ? new Date(t.hora_completada).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ACCIONES */}
          <View style={styles.accionesRow}>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.redPale, borderColor: 'rgba(217,79,79,0.3)' }]}>
              <Text style={styles.accionBtnIcon}>🚨</Text>
              <Text style={[styles.accionBtnText, { color: COLORS.red }]}>Incidente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accionBtn, { backgroundColor: COLORS.amberPale, borderColor: 'rgba(212,134,10,0.2)' }]}
              onPress={() => setNotaOpen(true)}
            >
              <Text style={styles.accionBtnIcon}>📝</Text>
              <Text style={[styles.accionBtnText, { color: COLORS.amber }]}>Nota</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.accionBtn, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold, marginBottom: 12 }]}
            onPress={() => router.push({
              pathname: '/registro-salud' as any,
              params: { paciente: JSON.stringify(pacienteActivo), momento: 'espontaneo' },
            })}
          >
            <Text style={styles.accionBtnIcon}>🩺</Text>
            <Text style={[styles.accionBtnText, { color: COLORS.gold }]}>Signos espontáneos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cerrarBtn}
            onPress={async () => {
              const verificacion = await verificarEscalas(pacienteActivo.id);
              setEscalaRequerida(verificacion.requiere_escalas);
              setEscalasLista(verificacion.escalas ?? []);
              setEscalaMotivo(verificacion.motivo);
              setEscalasMensaje(verificacion.mensaje);
              setVista('cierre');
            }}
          >
            <Text style={styles.cerrarBtnText}>Cerrar turno</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* MODAL NOTA */}
        {notaOpen && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nota del turno</Text>
              <TextInput
                style={styles.notaInput}
                placeholder="Escribe una observación..."
                placeholderTextColor={COLORS.textLight}
                multiline numberOfLines={4}
                value={notaTexto}
                onChangeText={setNotaTexto}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setNotaOpen(false); setNotaTexto(''); }}>
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]} onPress={guardarNota} disabled={guardandoNota}>
                  <Text style={styles.modalBtnText}>{guardandoNota ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* MODAL TAREA INCIDENTAL */}
        {tareaOpen && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nueva tarea incidental</Text>
              <TextInput
                style={styles.notaInput}
                placeholder="Descripción de la tarea..."
                placeholderTextColor={COLORS.textLight}
                value={tareaDesc}
                onChangeText={setTareaDesc}
                autoFocus
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
                {TIPOS_TAREA.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chipBtn, tareaTipo === t && styles.chipBtnActive]}
                    onPress={() => setTareaTipo(t)}
                  >
                    <Text style={[styles.chipBtnText, tareaTipo === t && styles.chipBtnTextActive]}>
                      {ICONOS_TIPO[t]} {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.notaInput, { minHeight: 40 }]}
                placeholder="Hora (opcional, ej: 15:00)"
                placeholderTextColor={COLORS.textLight}
                value={tareaHora}
                onChangeText={setTareaHora}
                keyboardType="numbers-and-punctuation"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => setTareaOpen(false)}>
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]} onPress={guardarTareaManual} disabled={guardandoTarea}>
                  <Text style={styles.modalBtnText}>{guardandoTarea ? 'Guardando...' : 'Agregar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── VISTA CIERRE ──────────────────────────────────────────

  if (vista === 'cierre' && pacienteActivo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('turno')} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Cerrar turno</Text>
            <Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text>
          </View>
        </View>

        <ScrollView style={styles.body}>

          {/* ESTADO DEL PACIENTE */}
          <Text style={styles.sectionTitle}>¿Cómo queda el paciente?</Text>
          <View style={styles.estadoRow}>
            {[
              { val: 'bien', icon: '😊', label: 'Bien' },
              { val: 'regular', icon: '😐', label: 'Regular' },
              { val: 'preocupante', icon: '😟', label: 'Preocupante' },
            ].map((e) => (
              <TouchableOpacity
                key={e.val}
                style={[styles.estadoCard, estadoPaciente === e.val && styles.estadoCardActive]}
                onPress={() => setEstadoPaciente(e.val)}
              >
                <Text style={{ fontSize: 28 }}>{e.icon}</Text>
                <Text style={[styles.estadoLabel, estadoPaciente === e.val && { color: COLORS.gold }]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SIGNOS VITALES */}
          <Text style={styles.sectionTitle}>Signos vitales</Text>
          <View style={styles.signoCard}>
            <Text style={styles.signoLabel}>SpO₂</Text>
            <View style={styles.signoControles}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.max(80, v - 1))}>
                <Text style={styles.signoBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.signoVal, spo2 < 92 && { color: COLORS.red }]}>{spo2}%</Text>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.min(100, v + 1))}>
                <Text style={styles.signoBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.signoCard, { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
            <Text style={styles.signoLabel}>Presión arterial</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: COLORS.textLight, marginBottom: 4 }}>SIS</Text>
                <View style={styles.signoControles}>
                  <TouchableOpacity style={styles.signoBtn} onPress={() => setSistolica(v => Math.max(80, v - 1))}>
                    <Text style={styles.signoBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.signoVal, sistolica > 180 && { color: COLORS.red }]}>{sistolica}</Text>
                  <TouchableOpacity style={styles.signoBtn} onPress={() => setSistolica(v => Math.min(200, v + 1))}>
                    <Text style={styles.signoBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={{ fontSize: 20, color: COLORS.textLight }}>/</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 9, color: COLORS.textLight, marginBottom: 4 }}>DIA</Text>
                <View style={styles.signoControles}>
                  <TouchableOpacity style={styles.signoBtn} onPress={() => setDiastolica(v => Math.max(40, v - 1))}>
                    <Text style={styles.signoBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.signoVal}>{diastolica}</Text>
                  <TouchableOpacity style={styles.signoBtn} onPress={() => setDiastolica(v => Math.min(130, v + 1))}>
                    <Text style={styles.signoBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.signoCard}>
            <Text style={styles.signoLabel}>Frec. cardíaca</Text>
            <View style={styles.signoControles}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setFc(v => Math.max(40, v - 1))}>
                <Text style={styles.signoBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.signoVal}>{fc} bpm</Text>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setFc(v => Math.min(180, v + 1))}>
                <Text style={styles.signoBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.signoCard}>
            <Text style={styles.signoLabel}>Peso (kg)</Text>
            <View style={styles.signoControles}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setPeso(v => Math.max(30, parseFloat((v - 0.5).toFixed(1))))}>
                <Text style={styles.signoBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.signoVal}>{peso} kg</Text>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setPeso(v => Math.min(200, parseFloat((v + 0.5).toFixed(1))))}>
                <Text style={styles.signoBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ESCALAS CLÍNICAS */}
          {escalaRequerida && (
            <>
              <View style={[styles.evaluacionCard, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold, marginBottom: 12 }]}>
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>📋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.cacao }}>
                      {escalaMotivo === 'inicial' ? 'Evaluación inicial requerida' : 'Re-evaluación sugerida'}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>{escalasMensaje}</Text>
                  </View>
                </View>
              </View>

              {escalasLista.includes('barthel') && (
                <View style={styles.evaluacionCard}>
                  <TouchableOpacity style={styles.evaluacionHeader} onPress={() => setBarthelOpen(!barthelOpen)}>
                    <View style={styles.evaluacionIconWrap}><Text style={{ fontSize: 16 }}>📋</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evaluacionTitle}>Índice de Barthel</Text>
                      <Text style={styles.evaluacionSub}>Independencia funcional</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {barthelTotal > 0 && <Text style={styles.evaluacionScore}>{barthelTotal}/100</Text>}
                      <Text style={{ fontSize: 16, color: COLORS.textLight }}>{barthelOpen ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>
                  {barthelOpen && (
                    <View style={styles.evaluacionContent}>
                      {BARTHEL_ITEMS.map((item, i) => (
                        <View key={i} style={{ marginBottom: 14 }}>
                          <Text style={styles.barthelItemLabel}>{item.label}</Text>
                          <View style={styles.barthelOpciones}>
                            {item.opciones.map((op) => (
                              <TouchableOpacity
                                key={op.val}
                                style={[styles.barthelOpcion, barthelScores[i] === op.val && styles.barthelOpcionActive]}
                                onPress={() => { setBarthelTocado(true); const n = [...barthelScores]; n[i] = op.val; setBarthelScores(n); }}
                              >
                                <Text style={[styles.barthelOpcionText, barthelScores[i] === op.val && styles.barthelOpcionTextActive]}>
                                  {op.val} — {op.txt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                      <View style={styles.barthelTotal}>
                        <Text style={styles.barthelTotalLabel}>Puntaje total</Text>
                        <Text style={styles.barthelTotalVal}>{barthelTotal} / 100</Text>
                      </View>
                      <Text style={styles.barthelTotalDesc}>{getBarthelLabel(barthelTotal)}</Text>
                    </View>
                  )}
                </View>
              )}

              {escalasLista.includes('morse') && (
                <View style={styles.evaluacionCard}>
                  <TouchableOpacity style={styles.evaluacionHeader} onPress={() => setMorseOpen(!morseOpen)}>
                    <View style={styles.evaluacionIconWrap}><Text style={{ fontSize: 16 }}>⚠️</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evaluacionTitle}>Escala de Morse</Text>
                      <Text style={styles.evaluacionSub}>Riesgo de caídas</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {morseTotal > 0 && <Text style={styles.evaluacionScore}>{morseTotal} pts</Text>}
                      <Text style={{ fontSize: 16, color: COLORS.textLight }}>{morseOpen ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>
                  {morseOpen && (
                    <View style={styles.evaluacionContent}>
                      {MORSE_ITEMS.map((item, i) => (
                        <View key={i} style={{ marginBottom: 14 }}>
                          <Text style={styles.barthelItemLabel}>{item.label}</Text>
                          <View style={styles.barthelOpciones}>
                            {item.opciones.map((op) => (
                              <TouchableOpacity
                                key={op.val}
                                style={[styles.barthelOpcion, morseScores[i] === op.val && morseScores[i] !== 0 && styles.barthelOpcionActive]}
                                onPress={() => { setMorseTocado(true); const n = [...morseScores]; n[i] = op.val; setMorseScores(n); }}
                              >
                                <Text style={[styles.barthelOpcionText, morseScores[i] === op.val && morseScores[i] !== 0 && styles.barthelOpcionTextActive]}>
                                  {op.val} — {op.txt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                      <View style={styles.barthelTotal}>
                        <Text style={styles.barthelTotalLabel}>Puntaje total</Text>
                        <Text style={styles.barthelTotalVal}>{morseTotal} pts</Text>
                      </View>
                      <Text style={styles.barthelTotalDesc}>{getMorseLabel(morseTotal)}</Text>
                    </View>
                  )}
                </View>
              )}

              {escalasLista.includes('mna') && (
                <View style={styles.evaluacionCard}>
                  <TouchableOpacity style={styles.evaluacionHeader} onPress={() => setMnaOpen(!mnaOpen)}>
                    <View style={styles.evaluacionIconWrap}><Text style={{ fontSize: 16 }}>🍽️</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evaluacionTitle}>Nutrición MNA</Text>
                      <Text style={styles.evaluacionSub}>Mini nutritional assessment</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {mnaTotal > 0 && <Text style={styles.evaluacionScore}>{mnaTotal} pts</Text>}
                      <Text style={{ fontSize: 16, color: COLORS.textLight }}>{mnaOpen ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>
                  {mnaOpen && (
                    <View style={styles.evaluacionContent}>
                      {MNA_ITEMS.map((item, i) => (
                        <View key={i} style={{ marginBottom: 14 }}>
                          <Text style={styles.barthelItemLabel}>{item.label}</Text>
                          <View style={styles.barthelOpciones}>
                            {item.opciones.map((op) => (
                              <TouchableOpacity
                                key={op.val}
                                style={[styles.barthelOpcion, mnaScores[i] === op.val && mnaScores[i] !== 0 && styles.barthelOpcionActive]}
                                onPress={() => { setMnaTocado(true); const n = [...mnaScores]; n[i] = op.val; setMnaScores(n); }}
                              >
                                <Text style={[styles.barthelOpcionText, mnaScores[i] === op.val && mnaScores[i] !== 0 && styles.barthelOpcionTextActive]}>
                                  {op.val} — {op.txt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                      <View style={styles.barthelTotal}>
                        <Text style={styles.barthelTotalLabel}>Puntaje total</Text>
                        <Text style={styles.barthelTotalVal}>{mnaTotal} pts</Text>
                      </View>
                      <Text style={styles.barthelTotalDesc}>{getMNALabel(mnaTotal)}</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.confirmarBtn, { backgroundColor: '#25D366', marginBottom: 8 }]}
            onPress={compartirWhatsApp}
          >
            <Text style={styles.confirmarBtnText}>📲 Compartir por WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.confirmarBtn} onPress={confirmarCierre}>
            <Text style={styles.confirmarBtnText}>Confirmar y cerrar turno</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  return null;
}

// ── ESTILOS ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  turnoActivoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(61,170,106,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)' },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  activoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  progressBar: { height: 32, backgroundColor: COLORS.cacao, paddingHorizontal: 16, justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.gold, opacity: 0.3 },
  progressText: { fontSize: 11, color: COLORS.white, fontWeight: '600', zIndex: 1 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 4 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  pacienteCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, flexDirection: 'column', borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  pacienteAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.gold },
  pacienteAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.gold },
  pacienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  pacienteCondiciones: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  iniciarBtn: { backgroundColor: COLORS.goldPale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.gold, alignItems: 'center' },
  iniciarBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.gold },
  badgeActivo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(61,170,106,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)' },
  badgeActivoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  badgeFinalizado: { backgroundColor: COLORS.cream, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  badgeFinalizadoText: { fontSize: 9, fontWeight: '700', color: COLORS.textLight },
  signoCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  signoControles: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  signoBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  signoVal: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, minWidth: 60, textAlign: 'center' },
  tareaCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  tareaCardDone: { backgroundColor: COLORS.greenPale, borderColor: 'rgba(61,170,106,0.2)' },
  tareaIcon: { fontSize: 20 },
  tareaInfo: { flex: 1 },
  tareaTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  tareaHora: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  tareaCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  tareaCheckDone: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  accionesRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  accionBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  accionBtnIcon: { fontSize: 18 },
  accionBtnText: { fontSize: 12, fontWeight: '700' },
  cerrarBtn: { backgroundColor: COLORS.cacao, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cerrarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  estadoRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginTop: 6 },
  evaluacionCard: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, overflow: 'hidden' },
  evaluacionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  evaluacionIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center' },
  evaluacionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  evaluacionSub: { fontSize: 10, color: COLORS.textLight, marginTop: 1 },
  evaluacionScore: { fontSize: 12, fontWeight: '700', color: COLORS.gold },
  evaluacionContent: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14 },
  barthelItemLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  barthelOpciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  barthelOpcion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  barthelOpcionActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  barthelOpcionText: { fontSize: 11, color: COLORS.textLight },
  barthelOpcionTextActive: { color: COLORS.gold, fontWeight: '700' },
  barthelTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: 8, padding: 12, marginTop: 8 },
  barthelTotalLabel: { fontSize: 12, color: COLORS.textLight },
  barthelTotalVal: { fontSize: 20, fontWeight: '800', color: COLORS.gold },
  barthelTotalDesc: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 6 },
  confirmarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },
  notaInput: { backgroundColor: COLORS.cream, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textDark, minHeight: 80, textAlignVertical: 'top', marginBottom: 4 },
  modalBtn: { borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  cambioItem: { backgroundColor: COLORS.goldPale, borderRadius: 8, padding: 10, marginBottom: 8, borderLeftWidth: 3 },
  chipBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  chipBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  chipBtnText: { fontSize: 11, color: COLORS.textLight },
  chipBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
});
