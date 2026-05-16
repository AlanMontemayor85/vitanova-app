import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { completarTarea, getPacientes, getToken, getTurnoActivo } from '../services/api';


const BASE_URL = 'https://vitanova-backend-production.up.railway.app';
const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
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

function getBarthelLabel(total: number) {
  if (total === 100) return '🟢 Independiente total';
  if (total >= 60) return '🟡 Dependencia leve';
  if (total >= 40) return '🟠 Dependencia moderada';
  if (total >= 20) return '🔴 Dependencia severa';
  return '🔴 Dependencia total';
}
const MORSE_ITEMS = [
  { label: 'Historial de caídas', opciones: [{ val: 0, txt: 'No' }, { val: 25, txt: 'Sí' }] },
  { label: 'Diagnóstico secundario', opciones: [{ val: 0, txt: 'No' }, { val: 15, txt: 'Sí' }] },
  { label: 'Ayuda para caminar', opciones: [{ val: 0, txt: 'Ninguna / reposo' }, { val: 15, txt: 'Muletas / bastón' }, { val: 30, txt: 'Se apoya en muebles' }] },
  { label: 'Acceso IV o heparina', opciones: [{ val: 0, txt: 'No' }, { val: 20, txt: 'Sí' }] },
  { label: 'Marcha', opciones: [{ val: 0, txt: 'Normal / reposo' }, { val: 10, txt: 'Débil' }, { val: 20, txt: 'Deteriorada' }] },
  { label: 'Estado mental', opciones: [{ val: 0, txt: 'Orientado' }, { val: 15, txt: 'Sobreestima su capacidad' }] },
];

function getMorseLabel(total: number) {
  if (total < 25) return '🟢 Sin riesgo';
  if (total < 45) return '🟡 Riesgo bajo';
  return '🔴 Riesgo alto';
}
const MNA_ITEMS = [
  { label: 'Ingesta de alimentos', opciones: [{ val: 0, txt: 'Reducción severa' }, { val: 1, txt: 'Reducción moderada' }, { val: 2, txt: 'Sin reducción' }] },
  { label: 'Pérdida de peso reciente', opciones: [{ val: 0, txt: 'Más de 3kg' }, { val: 1, txt: 'No sabe' }, { val: 2, txt: 'Entre 1-3kg' }, { val: 3, txt: 'Sin pérdida' }] },
  { label: 'Movilidad', opciones: [{ val: 0, txt: 'En cama / silla' }, { val: 1, txt: 'Se levanta pero no sale' }, { val: 2, txt: 'Sale a la calle' }] },
  { label: 'Enfermedad aguda últimas 3 semanas', opciones: [{ val: 0, txt: 'Sí' }, { val: 2, txt: 'No' }] },
  { label: 'Problemas neuropsicológicos', opciones: [{ val: 0, txt: 'Demencia severa' }, { val: 1, txt: 'Demencia leve' }, { val: 2, txt: 'Sin problemas' }] },
  { label: 'Índice de masa corporal (IMC)', opciones: [{ val: 0, txt: 'Menos de 19' }, { val: 1, txt: 'Entre 19-21' }, { val: 2, txt: 'Entre 21-23' }, { val: 3, txt: 'Mayor de 23' }] },
];

function getMNALabel(total: number) {
  if (total >= 12) return '🟢 Estado nutricional normal';
  if (total >= 8) return '🟡 Riesgo de malnutrición';
  return '🔴 Malnutrición';
}

type Vista = 'lista' | 'turno' | 'cierre';

export default function CuidadorScreen() {
  const router = useRouter();
  const nombre = 'Rosa López';
  const [vista, setVista] = useState<Vista>('lista');
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteActivo, setPacienteActivo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [tareas, setTareas] = useState<any[]>([]);
  const params = useLocalSearchParams();
  const [notaOpen, setNotaOpen] = useState(false);
  const [notaTexto, setNotaTexto] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);


  useEffect(() => {
      if (params.vistaInicial === 'turno' && params.paciente) {
        const p = JSON.parse(params.paciente as string);
        console.log('CARGANDO TURNO PARA:', p.id);
        setPacienteActivo(p);
        getTurnoActivo(p.id).then(data => {
          console.log('TURNO DATA:', data);
          if (data.tareas) setTareas(data.tareas);
          if (data.turno) setTurnoActivo(data.turno);
        });
        setVista('turno');
      }
    }, [params.vistaInicial, params.paciente]);
  // Signos vitales
  const [spo2, setSpo2] = useState(98);
  const [sistolica, setSistolica] = useState(120);
  const [diastolica, setDiastolica] = useState(80);
  const [fc, setFc] = useState(72);
  const [estadoPaciente, setEstadoPaciente] = useState('bien');
  const [peso, setPeso] = useState(70.0);

  // Barthel
  const [barthelOpen, setBarthelOpen] = useState(false);
  const [barthelScores, setBarthelScores] = useState<number[]>(new Array(10).fill(0));
  const barthelTotal = barthelScores.reduce((a, b) => a + b, 0);
  //Morse 
  const [barthelTocado, setBarthelTocado] = useState(false);
  const [morseTocado, setMorseTocado] = useState(false);
  const [mnaTocado, setMnaTocado] = useState(false);
  const [morseOpen, setMorseOpen] = useState(false);
  const [morseScores, setMorseScores] = useState<number[]>(new Array(6).fill(0));
  const morseTotal = morseScores.reduce((a, b) => a + b, 0);
  //mna
  const [mnaOpen, setMnaOpen] = useState(false);
  const [mnaScores, setMnaScores] = useState<number[]>(new Array(6).fill(0));
  const mnaTotal = mnaScores.reduce((a, b) => a + b, 0);
  useEffect(() => {
    const cargar = async () => {
      try {
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

  const iniciarTurno = async (paciente: any) => {
    setPacienteActivo(paciente);
    try {
      const data = await getTurnoActivo(paciente.id);
      if (data.tareas) setTareas(data.tareas);
      if (data.turno) setTurnoActivo(data.turno);
    } catch (e) {
      console.error(e);
    }
    router.push({
      pathname: '/registro-salud' as any,
      params: { paciente: JSON.stringify(paciente), momento: 'inicio_turno' },
    });
  };
  const guardarNota = async () => {
    console.log('TURNO ACTIVO:', turnoActivo);
    console.log('PACIENTE ACTIVO:', pacienteActivo?.id);
    if (!notaTexto.trim()) return;
    setGuardandoNota(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/notas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paciente_id: pacienteActivo.id,
          turno_id: turnoActivo?.id,
          texto: notaTexto,
        }),
      });
      // Agregar la nota a la lista de tareas local
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
  const confirmarCierre = async () => {
    try {
      const token = getToken();
      console.log('TOKEN:', getToken());
      console.log('BARTHEL TOCADO:', barthelTocado);
      console.log('MORSE TOCADO:', morseTocado);
      console.log('MNA TOCADO:', mnaTocado);
      await fetch(`${BASE_URL}/turnos/cerrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paciente_id: pacienteActivo.id,
          estado_paciente: estadoPaciente,
          spo2,
          presion_sistolica: sistolica,
          presion_diastolica: diastolica,
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
          imc: pacienteActivo.talla_cm ? parseFloat((peso / Math.pow(pacienteActivo.talla_cm / 100, 2)).toFixed(1)) : null,
        }),
      });
    } catch (e) {
      console.error('Error cerrando turno:', e);
    } finally {
      setPacienteActivo(null);
      setBarthelScores(new Array(10).fill(0));
      setMorseScores(new Array(6).fill(0));
      setMnaScores(new Array(6).fill(0));
      setBarthelOpen(false);
      setMorseOpen(false);
      setMnaOpen(false);
      setVista('lista');
      setBarthelTocado(false);
      setMorseTocado(false);
      setMnaTocado(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // ── VISTA LISTA ──────────────────────────────────────────
  if (vista === 'lista') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bienvenido</Text>
            <Text style={styles.userName}>{nombre}</Text>
          </View>
          <View style={styles.notifBtn}>
            <Text style={styles.notifIcon}>🔔</Text>
          </View>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Tus pacientes hoy</Text>

          {pacientes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Sin pacientes asignados</Text>
              <Text style={styles.emptyText}>Pide al familiar que te invite al equipo de cuidado</Text>
            </View>
          ) : (
            pacientes.map((p) => {
              const iniciales = p.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') ?? 'P';
              return (
                <TouchableOpacity key={p.id} style={styles.pacienteCard} onPress={() => iniciarTurno(p)}>
                  <View style={styles.pacienteAvatar}>
                    <Text style={styles.pacienteAvatarText}>{iniciales}</Text>
                  </View>
                  <View style={styles.pacienteInfo}>
                    <Text style={styles.pacienteNombre}>{p.nombre_completo}</Text>
                    <Text style={styles.pacienteCondiciones}>
                      {p.condiciones_medicas?.join(' · ') ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.iniciarBtn}>
                    <Text style={styles.iniciarBtnText}>Iniciar turno →</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  }

  // ── VISTA TURNO ──────────────────────────────────────────
  if (vista === 'turno' && pacienteActivo) {
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

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Signos vitales</Text>

          <View style={styles.signoCard}>
            <Text style={styles.signoLabel}>SpO₂</Text>
            <View style={styles.signoControles}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.max(80, v - 1))}>
                <Text style={styles.signoBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.signoVal}>{spo2}%</Text>
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
                  <Text style={styles.signoVal}>{sistolica}</Text>
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

          <Text style={styles.sectionTitle}>Tareas del turno</Text>
          {tareas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Sin tareas registradas</Text>
            </View>
          ) : (
            tareas.map((t) => {
              const iconos: Record<string, string> = {
                medicamento: '💊', alimentacion: '🍽️', ejercicio: '🚶',
                higiene: '🛁', cita: '📅', otro: '📝',
              };
              return (
                <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.tareaCard, 
                      t.completada && t.tipo !== 'otro' && styles.tareaCardDone,
                      t.tipo === 'otro' && styles.tareaCardNota,
                    ]}
                    onPress={async () => {
                      if (!t.completada && t.tipo !== 'otro') {
                        await completarTarea(t.id);
                        setTareas(prev => prev.map(tarea =>
                          tarea.id === t.id ? { ...tarea, completada: true } : tarea
                        ));
                      }
                    }}
                  >
                  <Text style={styles.tareaIcon}>{iconos[t.tipo] ?? '📝'}</Text>
                  <View style={styles.tareaInfo}>
                    <Text style={[styles.tareaTexto, t.completada && t.tipo !== 'otro' && { textDecorationLine: 'line-through' }]}>
                    {t.descripcion}
                  </Text>
                    <Text style={styles.tareaHora}>{t.hora_programada ?? '—'}</Text>
                  </View>
                  <View style={[styles.tareaCheck, t.completada && styles.tareaCheckDone]}>
                    <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '800' }}>
                      {t.completada ? '✓' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

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
              params: { paciente: JSON.stringify(pacienteActivo), momento: 'espontaneo' }
            })}
          >
            <Text style={styles.accionBtnIcon}>🩺</Text>
            <Text style={[styles.accionBtnText, { color: COLORS.gold }]}>Signos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cerrarBtn} onPress={() => setVista('cierre')}>
            <Text style={styles.cerrarBtnText}>Cerrar turno</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        {notaOpen && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nota del turno</Text>
              <TextInput
                style={styles.notaInput}
                placeholder="Escribe una observación..."
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={4}
                value={notaTexto}
                onChangeText={setNotaTexto}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: COLORS.cream }]}
                  onPress={() => { setNotaOpen(false); setNotaTexto(''); }}
                >
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]}
                  onPress={guardarNota}
                  disabled={guardandoNota}
                >
                  <Text style={styles.modalBtnText}>{guardandoNota ? 'Guardando...' : 'Guardar'}</Text>
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

          {/* ESTADO */}
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

          {/* RESUMEN SIGNOS */}
          <Text style={styles.sectionTitle}>Resumen de signos</Text>
          <View style={styles.resumenSignos}>
            <View style={styles.resumenSignoItem}>
              <Text style={styles.resumenSignoVal}>{spo2}%</Text>
              <Text style={styles.resumenSignoLabel}>SpO₂</Text>
            </View>
            <View style={styles.resumenSignoItem}>
              <Text style={styles.resumenSignoVal}>{sistolica}/{diastolica}</Text>
              <Text style={styles.resumenSignoLabel}>Presión</Text>
            </View>
            <View style={styles.resumenSignoItem}>
              <Text style={styles.resumenSignoVal}>{fc}</Text>
              <Text style={styles.resumenSignoLabel}>FC bpm</Text>
            </View>
          </View>
          {/* PESO */}
          <Text style={styles.sectionTitle}>Peso</Text>
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

          {/* EVALUACIONES OPCIONALES */}
          <Text style={styles.sectionTitle}>Evaluaciones opcionales</Text>

          {/* BARTHEL */}
          <View style={styles.evaluacionCard}>
            <TouchableOpacity
              style={styles.evaluacionHeader}
              onPress={() => { setBarthelOpen(!barthelOpen); setBarthelTocado(true); }}
            >
              <View style={styles.evaluacionIconWrap}>
                <Text style={{ fontSize: 16 }}>📋</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.evaluacionTitle}>Índice de Barthel</Text>
                <Text style={styles.evaluacionSub}>Independencia funcional</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {barthelTotal > 0 && (
                  <Text style={styles.evaluacionScore}>{barthelTotal}/100</Text>
                )}
                <Text style={{ fontSize: 16, color: COLORS.textLight }}>{barthelOpen ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {barthelOpen && (
              <View style={styles.evaluacionContent}>
                <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 12 }}>
                  Selecciona el nivel de independencia en cada actividad
                </Text>
                {BARTHEL_ITEMS.map((item, i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <Text style={styles.barthelItemLabel}>{item.label}</Text>
                    <View style={styles.barthelOpciones}>
                      {item.opciones.map((op) => (
                        <TouchableOpacity
                          key={op.val}
                          style={[
                            styles.barthelOpcion,
                            barthelScores[i] === op.val && styles.barthelOpcionActive,
                          ]}
                          onPress={() => {
                            const nuevos = [...barthelScores];
                            nuevos[i] = op.val;
                            setBarthelScores(nuevos);
                          }}
                        >
                          <Text style={[
                            styles.barthelOpcionText,
                            barthelScores[i] === op.val && styles.barthelOpcionTextActive,
                          ]}>
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

          {/* MORSE — placeholder */}
          <View style={styles.evaluacionCard}>
            <TouchableOpacity
              style={styles.evaluacionHeader}
              onPress={() => { setMorseOpen(!morseOpen); setMorseTocado(true); }}
            >
              <View style={styles.evaluacionIconWrap}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.evaluacionTitle}>Escala de Morse</Text>
                <Text style={styles.evaluacionSub}>Riesgo de caídas</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {morseTotal > 0 && (
                  <Text style={styles.evaluacionScore}>{morseTotal} pts</Text>
                )}
                <Text style={{ fontSize: 16, color: COLORS.textLight }}>{morseOpen ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {morseOpen && (
              <View style={styles.evaluacionContent}>
                <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 12 }}>
                  Evalúa el riesgo de caída del paciente
                </Text>
                {MORSE_ITEMS.map((item, i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <Text style={styles.barthelItemLabel}>{item.label}</Text>
                    <View style={styles.barthelOpciones}>
                      {item.opciones.map((op) => (
                        <TouchableOpacity
                          key={op.val}
                          style={[
                            styles.barthelOpcion,
                            morseScores[i] === op.val && morseScores[i] !== 0 && styles.barthelOpcionActive,
                          ]}
                          onPress={() => {
                            const nuevos = [...morseScores];
                            nuevos[i] = op.val;
                            setMorseScores(nuevos);
                          }}
                        >
                          <Text style={[
                            styles.barthelOpcionText,
                            morseScores[i] === op.val && morseScores[i] !== 0 && styles.barthelOpcionTextActive,
                          ]}>
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

          {/* MNA — placeholder */}
          <View style={styles.evaluacionCard}>
          <TouchableOpacity
            style={styles.evaluacionHeader}
            onPress={() => { setMnaOpen(!mnaOpen); setMnaTocado(true); }}
          >
            <View style={styles.evaluacionIconWrap}>
              <Text style={{ fontSize: 16 }}>🍽️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.evaluacionTitle}>Nutrición MNA</Text>
              <Text style={styles.evaluacionSub}>Mini nutritional assessment</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              {mnaTotal > 0 && (
                <Text style={styles.evaluacionScore}>{mnaTotal} pts</Text>
              )}
              <Text style={{ fontSize: 16, color: COLORS.textLight }}>{mnaOpen ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {mnaOpen && (
            <View style={styles.evaluacionContent}>
              <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 12 }}>
                Evalúa el estado nutricional del paciente
              </Text>
              {MNA_ITEMS.map((item, i) => (
                <View key={i} style={{ marginBottom: 14 }}>
                  <Text style={styles.barthelItemLabel}>{item.label}</Text>
                  <View style={styles.barthelOpciones}>
                    {item.opciones.map((op) => (
                      <TouchableOpacity
                        key={op.val}
                        style={[
                          styles.barthelOpcion,
                          mnaScores[i] === op.val && mnaScores[i] !== 0 && styles.barthelOpcionActive,
                        ]}
                        onPress={() => {
                          const nuevos = [...mnaScores];
                          nuevos[i] = op.val;
                          setMnaScores(nuevos);
                        }}
                      >
                        <Text style={[
                          styles.barthelOpcionText,
                          mnaScores[i] === op.val && mnaScores[i] !== 0 && styles.barthelOpcionTextActive,
                        ]}>
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

const styles = StyleSheet.create({
  modalOverlay: {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24,
},
modalCard: {
  backgroundColor: COLORS.white, borderRadius: 16, padding: 20,
},
modalTitle: {
  fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 12,
},
notaInput: {
  backgroundColor: COLORS.cream, borderRadius: 10, padding: 12,
  borderWidth: 1, borderColor: COLORS.border, fontSize: 14,
  color: COLORS.textDark, minHeight: 100, textAlignVertical: 'top',
},
modalBtn: {
  borderRadius: 10, padding: 12, alignItems: 'center',
  borderWidth: 1, borderColor: COLORS.border,
},
tareaCardNota: { 
  backgroundColor: COLORS.amberPale, 
  borderColor: '#F5DBA0' 
},
modalBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2,
  },
  userName: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifIcon: { fontSize: 18 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  backIcon: { fontSize: 18, color: COLORS.white },
  turnoActivoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(61,170,106,0.2)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)',
  },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  activoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 4,
  },
  emptyCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  emptyText: { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },
  pacienteCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
  },
  pacienteAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold,
  },
  pacienteAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.gold },
  pacienteInfo: { flex: 1 },
  pacienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  pacienteCondiciones: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  iniciarBtn: {
    backgroundColor: COLORS.goldPale, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.gold,
  },
  iniciarBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.gold },
  signoCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  signoControles: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signoBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  signoBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  signoVal: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, minWidth: 60, textAlign: 'center' },
  tareaCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  tareaCardDone: { backgroundColor: COLORS.greenPale, borderColor: 'rgba(61,170,106,0.2)' },
  tareaIcon: { fontSize: 20 },
  tareaInfo: { flex: 1 },
  tareaTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  tareaHora: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  tareaCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  tareaCheckDone: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  accionesRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  accionBtn: {
    flex: 1, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, flexDirection: 'row',
    justifyContent: 'center', gap: 8,
  },
  accionBtnIcon: { fontSize: 18 },
  accionBtnText: { fontSize: 12, fontWeight: '700' },
  cerrarBtn: {
    backgroundColor: COLORS.cacao, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  cerrarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  estadoRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  estadoCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginTop: 6 },
  resumenSignos: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  resumenSignoItem: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  resumenSignoVal: { fontSize: 18, fontWeight: '800', color: COLORS.gold },
  resumenSignoLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 4 },
  evaluacionCard: {
    backgroundColor: COLORS.white, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, overflow: 'hidden',
  },
  evaluacionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  evaluacionIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
  },
  evaluacionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  evaluacionSub: { fontSize: 10, color: COLORS.textLight, marginTop: 1 },
  evaluacionScore: { fontSize: 12, fontWeight: '700', color: COLORS.gold },
  evaluacionContent: {
    borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14,
  },
  barthelItemLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textDark, marginBottom: 6,
  },
  barthelOpciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  barthelOpcion: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.cream,
  },
  barthelOpcionActive: {
    backgroundColor: COLORS.goldPale, borderColor: COLORS.gold,
  },
  barthelOpcionText: { fontSize: 11, color: COLORS.textLight },
  barthelOpcionTextActive: { color: COLORS.gold, fontWeight: '700' },
  barthelTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.cream, borderRadius: 8, padding: 12, marginTop: 8,
  },
  barthelTotalLabel: { fontSize: 12, color: COLORS.textLight },
  barthelTotalVal: { fontSize: 20, fontWeight: '800', color: COLORS.gold },
  barthelTotalDesc: {
    fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 6,
  },
  confirmarBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
});