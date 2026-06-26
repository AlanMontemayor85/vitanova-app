import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking,
  Modal,
  ScrollView,
  StatusBar, StyleSheet, Text,
  TextInput,
  TouchableOpacity, View
} from 'react-native';
import {
  agregarTareaManual, clearToken, completarActividad, completarMedicamento,
  detectarCambiosTurno,
  getAlertaPeso,
  getNotasTurno,
  getPacientes,
  getSignosRecientes,
  getTareasDia,
  getTareasHoy, getToken,
  getTurnoActivo,
  getUltimoCierre,
  getUserNombre, loadStoredToken,
  verificarEscalas
} from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textMid: '#4A4540', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', greenPale: '#EAF5E8', amber: '#D4860A',
  amberPale: '#FFF4E0', red: '#D94F4F', redPale: '#FDEAEA',
  blue: '#3A91FF', bluePale: '#EBF3FF',
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

const ICONOS_TIPO: Record<string, string> = {
  medicamento: '💊', alimentacion: '🍽️', ejercicio: '🚶', higiene: '🛁', cita: '📅', otro: '📝',
};

type Vista = 'lista' | 'turno' | 'espontaneo' | 'cierre';

export default function CuidadorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [vista, setVista] = useState<Vista>('lista');
  const [loading, setLoading] = useState(true);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteActivo, setPacienteActivo] = useState<any>(null);
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [tareas, setTareas] = useState<any[]>([]);
  const turnoActivoRef = useRef<any>(null);
  
  // Modales rutinarios
  const [incidenteOpen, setIncidenteOpen] = useState(false);
  const [notaOpen, setNotaOpen] = useState(false);
  const [notaTexto, setNotaTexto] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [tareaOpen, setTareaOpen] = useState(false);
  const [tareaDesc, setTareaDesc] = useState('');
  const [tareaTipo, setTareaTipo] = useState('otro');
  const [tareaHora, setTareaHora] = useState('');
  const [guardandoTarea, setGuardandoTarea] = useState(false);

  // 📡 Estados de Telemetría Real del Reloj
  const [signosDispositivo, setSignosDispositivo] = useState<any>(null);
  const [cargandoSignos, setCargandoSignos] = useState<boolean>(false);
  const [cambiosModal, setCambiosModal] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState<any[]>([]);

  // 🎭 Estados del Módulo de Registro Espontáneo / Confort Humano
  const [dolorEva, setDolorEva] = useState(0);
  const [hidratacion, setHidratacion] = useState(0);
  const [estadoAnimo, setEstadoAnimo] = useState('bien');
  const [alimentacion, setAlimentacion] = useState('bien');
  const [guardandoEspontaneo, setGuardandoEspontaneo] = useState(false);

  // 📋 Estados de Escalas Clínicas (Cierre) e Historiales del Familiar
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

  // 🟢 CLONACIÓN DE ESTADOS DEL FAMILIAR
  const [notas, setNotas] = useState<any[]>([]);
  const [ultimoCierre, setUltimoCierre] = useState<any>(null);
  const [alertaPeso, setAlertaPeso] = useState<any>(null);

  const [estadoPaciente, setEstadoPaciente] = useState('bien');
  const [peso, setPeso] = useState(70.0);
  const [iniciando, setIniciando] = useState(false);

  const sincronizarSignosReloj = async (pacienteId: string, forzarComando: boolean = false) => {
    if (!pacienteId) return;
    setCargandoSignos(true);
    try {
      if (forzarComando) {
        const token = getToken();
        await fetch(`${BASE_URL}/pacientes/${pacienteId}/forzar-medicion`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          }
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      const res = await getSignosRecientes(pacienteId);
      
      if (res && res.success) {
        // 🛡️ REGLA DE NEGOCIO INTEGRAL: El cuidador solo ve signos si el hardware reporta datos FRESCOS
        if (res.frescura && res.frescura.bphrt === true) {
          setSignosDispositivo(res);
        } else {
          // 🧼 Si bphrt es false (reloj quitado o inactivo), forzamos de inmediato los guiones en la consola del cuidador
          setSignosDispositivo({
            success: true,
            spo2: "—",
            presion: "—",
            fc: "—",
            // Conservamos la temperatura únicamente si su umbral extendido de 4 horas sigue fresco
            temperatura: res.frescura?.temperatura ? res.temperatura : "—"
          });
          console.log("⌚ [FRONTEND CUIDADOR] Datos caducados o dispositivo removido. Limpiando tablero visual.");
        }
      }
    } catch (error) {
      console.error("❌ Error sincronizando telemetría:", error);
      // Fallback seguro ante caídas de red
      setSignosDispositivo({ spo2: "—", presion: "—", fc: "—", temperatura: "—" });
    } finally {
      setCargandoSignos(false);
    }
  };

  useEffect(() => {
    if (vista === 'turno' && pacienteActivo?.id) {
      sincronizarSignosReloj(pacienteActivo.id);
      const interval = setInterval(() => {
        sincronizarSignosReloj(pacienteActivo.id);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [vista, pacienteActivo?.id]);

  // ── CARGA INICIAL ──
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

  // ── NAVEGACIÓN DESDE OTRAS PANTALLAS ──
  useEffect(() => {
    if (params.vistaInicial === 'turno' && params.paciente) {
      try {
        const p = JSON.parse(params.paciente as string);
        getTurnoActivo(p.id).then((turnoData) => {
          if (turnoData && turnoData.turno) {
            setPacienteActivo(p);
            cargarTurno(p.id);
            setVista('turno');
          } else {
            resetEstados();
            setVista('lista');
            router.setParams({ vistaInicial: undefined, paciente: undefined });
          }
        });

        getPacientes().then(data => {
          if (data.patients) setPacientes(data.patients);
        });
      } catch (e) {
        console.error('Error parseando paciente o validando turno:', e);
        setVista('lista');
      }
    }
  }, [params.vistaInicial, params.paciente]);

  const cargarTurno = async (pacienteId: string) => {
    const [turnoData, tareasData, notasData, cierreData, alertaPesoData] = await Promise.all([
      getTurnoActivo(pacienteId),
      getTareasDia(pacienteId),
      getNotasTurno(pacienteId),
      getUltimoCierre(pacienteId),
      getAlertaPeso(pacienteId)
    ]);

    if (tareasData.sin_horario) {
      Alert.alert('Sin horario asignado', 'Pídele al familiar que configure tu horario.', [{ text: 'Entendido', onPress: () => setVista('lista') }]);
      return;
    }
    if (turnoData.turno) {
      setTurnoActivo(turnoData.turno);
      turnoActivoRef.current = turnoData.turno;
    }
    if (tareasData.tareas) setTareas(tareasData.tareas);
    
    if (notasData && notasData.notas) {
      setNotas(notasData.notas.slice(0, 5));
    } else {
      setNotas([]);
    }

    if (cierreData.cierre) setUltimoCierre(cierreData.cierre);
    if (alertaPesoData.alerta) setAlertaPeso(alertaPesoData);
  };

  const resetEstados = () => {
    setPacienteActivo(null);
    setTurnoActivo(null);
    turnoActivoRef.current = null;
    setTareas([]);
    setNotas([]);
    setUltimoCierre(null);
    setAlertaPeso(null);
    setEstadoPaciente('bien');
    setPeso(70.0);
    setDolorEva(0); setHidratacion(0); setEstadoAnimo('bien'); setAlimentacion('bien');
    setBarthelScores(new Array(10).fill(0));
    setMorseScores(new Array(6).fill(0));
    setMnaScores(new Array(6).fill(0));
    setBarthelOpen(false); setMorseOpen(false); setMnaOpen(false);
    setBarthelTocado(false); setMorseTocado(false); setMnaTocado(false);
    setEscalaRequerida(false); setEscalasLista([]);
  };

  // ⚡ FIX OPERATIVO: Aseguramos la mutación simultánea del paciente activo y la apertura del modal
  const manejarInicioTurno = async (p: any) => {
    if (iniciando) return;
    setIniciando(true);
    try {
      const tareasCheck = await getTareasHoy(p.id);
      if (tareasCheck.sin_horario) {
        Alert.alert('Sin horario', 'El familiar no ha configurado tu horario de entrada.');
        setIniciando(false);
        return;
      }
      
      const cambiosData = await detectarCambiosTurno(p.id);
      if (cambiosData.cambios && cambiosData.cambios.length > 0) {
        setPacienteActivo(p);
        setCambiosPendientes(cambiosData.cambios);
        setCambiosModal(true); // Se despliega de manera atómica
      } else {
        irARegistroSalud(p);
      }
    } catch (e) {
      irARegistroSalud(p);
    } finally {
      setIniciando(false);
    }
  };

  const irARegistroSalud = (p: any) => {
    router.push({
      pathname: '/registro-salud' as any,
      params: { paciente: JSON.stringify(p), momento: 'inicio_turno' },
    });
  };

  const guardarRegistroEspontaneo = async () => {
    setGuardandoEspontaneo(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/registros/salud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paciente_id: pacienteActivo.id,
          momento: 'espontaneo',
          dolor_eva: dolorEva,
          hidratacion_vasos: hidratacion,
          estado_animo: estadoAnimo,
          alimentacion: alimentacion,
          spo2: signosDispositivo?.spo2 !== '—' ? Number(signosDispositivo?.spo2) : 98,
          frecuencia_cardiaca: signosDispositivo?.fc !== '—' ? Number(signosDispositivo?.fc) : 72,
        })
      });
      setVista('turno');
      Alert.alert('✅ Registro guardado', 'Los datos de confort y telemetría fueron actualizados.');
    } catch (e) {
      console.error(e);
    } finally {
      setGuardandoEspontaneo(false);
    }
  };

  const guardarNota = async () => {
    if (!notaTexto.trim()) return;
    setGuardandoNota(true);
    const idTurnoActivo = turnoActivoRef.current?.id || turnoActivo?.id || null;
    const textoCapturado = notaTexto.trim();

    try {
      const response = await fetch(`${BASE_URL}/notas`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${getToken()}` 
        },
        body: JSON.stringify({ 
          paciente_id: pacienteActivo.id, 
          turno_id: idTurnoActivo, 
          texto: textoCapturado
        })
      });

      if (!response.ok) throw new Error('Error en el servidor al guardar nota');

      const nuevaNotaSimulada = {
        descripcion: `📝 ${textoCapturado}`,
        hora_completada: new Date().toISOString(),
        usuarios: { nombre_completo: 'Personal Vitanova' }
      };

      setNotaTexto(''); 
      setNotaOpen(false);
      
      setNotas((prevNotas) => {
        const notasPrevias = Array.isArray(prevNotas) ? prevNotas : [];
        return [nuevaNotaSimulada, ...notasPrevias].slice(0, 5);
      });

      try {
        const notasData = await getNotasTurno(pacienteActivo.id);
        if (notasData && Array.isArray(notasData.notas) && notasData.notas.length > 0) {
          setNotas(notasData.notas.slice(0, 5));
        }
      } catch (fetchErr) {
        console.log("Refresco de fondo ignorado:", fetchErr);
      }
    } catch (e) { 
      console.error("❌ Error en guardarNota:", e); 
      alert("⚠️ No se pudo guardar la nota. Verifica la conexión.");
    } finally { 
      setGuardandoNota(false); 
    }
  };

  const guardarTareaManual = async () => {
    if (!tareaDesc.trim()) return;
    setGuardandoTarea(true);
    const idTemporal = `incidental-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const descripcionLimpia = tareaDesc.trim();
    const tipoActual = tareaTipo;
    const horaActual = tareaHora || null;

    try {
      const res = await agregarTareaManual({ 
        turno_id: turnoActivoRef.current?.id || null, 
        paciente_id: pacienteActivo.id, 
        tipo: tipoActual, 
        descripcion: descripcionLimpia, 
        hora_programada: horaActual, 
        es_incidental: true 
      });
      
      const idFinal = res?.tarea_id || res?.id || idTemporal;
      setTareas(prev => [
        ...prev, 
        { id: idFinal, tipo: tipoActual, descripcion: descripcionLimpia, hora_programada: horaActual, completada: false, es_incidental: true }
      ]);
      setTareaDesc(''); setTareaTipo('otro'); setTareaHora(''); setTareaOpen(false);
    } catch (e) { 
      console.error("❌ Error en guardarTareaManual:", e); 
      alert("⚠️ El servidor de Railway rechazó la tarea incidental.");
    } finally { 
      setGuardandoTarea(false); 
    }
  };

  const registrarIncidente = async (descripcion: string, tipo: string = 'otro') => {
    try {
      const response = await fetch(`${BASE_URL}/alertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ 
          paciente_id: pacienteActivo.id, 
          tipo: tipo, 
          severidad: tipo === 'SOS' ? 'alta' : 'media', 
          descripcion: descripcion 
        })
      });
      if (!response.ok) throw new Error('Error al registrar incidente en API');
      alert("🚨 Incidente reportado de inmediato a la plataforma.");
    } catch (e) {
      console.error("❌ Error en registrarIncidente:", e);
    }
  };

  const compartirWhatsApp = () => {
    const emoji = estadoPaciente === 'bien' ? '😊' : estadoPaciente === 'preocupante' ? '😟' : '😐';
    const estado = estadoPaciente === 'bien' ? 'Bien' : estadoPaciente === 'preocupante' ? 'Preocupante' : 'Regular';
    const mensaje = `🏠 *Vitanova Integralis — Resumen de Turno*\n\n👤 Paciente: *${pacienteActivo?.nombre_completo}*\n${emoji} Estado Confort: *${estado}*\n- Peso Cierre: ${peso} kg\n\n✅ Turno finalizado de forma segura por el personal asignado.\n_Vitanova Integralis — Confort y Cuidado Profesional_`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(mensaje)}`).catch(() => Alert.alert('Error', 'WhatsApp no disponible.'));
  };

  const ejecutarCierre = async () => {
    try {
      const notasRes = await fetch(`${BASE_URL}/notas?paciente_id=${pacienteActivo.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const datasetNotas = await notasRes.json();
      const notasActualizadas = datasetNotas?.notas || datasetNotas?.registros || [];
      setNotas(Array.isArray(notasActualizadas) ? notasActualizadas.slice(0, 3) : []);
      
      let notasConsolidadas = "Sin notas incidentales en el turno.";
      const arrayParaFiltrar = Array.isArray(datasetNotas?.notas) 
        ? datasetNotas.notas 
        : (Array.isArray(datasetNotas?.registros) ? datasetNotas.registros : null);

      if (arrayParaFiltrar) {
        const idTurnoActual = turnoActivoRef.current?.id || turnoActivo?.id || params.turnoId;
        const notasDelTurno = arrayParaFiltrar.filter((n: any) => n.turno_id === idTurnoActual || n.turno_id === null);

        if (notasDelTurno.length > 0) {
          notasConsolidadas = notasDelTurno
            .reverse() 
            .map((n: any) => {
              const textoNota = n.texto || n.descripcion || "Nota sin texto";
              const hora = n.created_at ? new Date(n.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "";
              return hora ? `[${hora}] ${textoNota}` : `- ${textoNota}`;
            })
            .join('\n');
        }
      }

      let sistolica = null;
      let diastolica = null;
      if (signosDispositivo?.presion && String(signosDispositivo.presion).includes('/')) {
        const partes = String(signosDispositivo.presion).split('/');
        sistolica = parseInt(partes[0], 10) || null;
        diastolica = parseInt(partes[1], 10) || null;
      }

      const res = await fetch(`${BASE_URL}/turnos/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          turno_id: turnoActivoRef.current?.id || turnoActivo?.id || params.turnoId, 
          paciente_id: pacienteActivo.id, 
          estado_paciente: estadoPaciente, 
          peso_kg: peso,
          notes: notasConsolidadas, 
          spo2: signosDispositivo?.spo2 ? parseInt(signosDispositivo.spo2, 10) : null,
          frecuencia_cardiaca: signosDispositivo?.fc ? parseInt(signosDispositivo.fc, 10) : null,
          presion_sistolica: sistolica,
          presion_diastolica: diastolica,
          temperatura: signosDispositivo?.temperatura ? parseFloat(String(signosDispositivo.temperatura)) : null,
          barthel_scores: barthelTocado ? barthelScores : null, 
          barthel_total: barthelTocado ? barthelTotal : null, 
          barthel_label: barthelTocado ? getBarthelLabel(barthelTotal) : null,
        }),
      });

      const data = await res.json();
      if (data.status === 'ok') {
        const pData = await getPacientes();
        if (pData.patients) setPacientes(pData.patients);
        resetEstados(); 
        setVista('lista');
        Alert.alert('✅ Turno Cerrado', 'La bitácora del día se ha consolidado con éxito.');
      }
    } catch (e) { 
      console.error("❌ Error en ejecutarCierre:", e); 
      Alert.alert('⚠️ Error', 'Ocurrió un problema al procesar el cierre del turno.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // ── 1. VISTA LISTA DE PACIENTES ──
  if (vista === 'lista') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Bienvenido</Text>
            <Text style={styles.userName}>{getUserNombre() ?? 'Personal Vitanova'}</Text>
          </View>
          <TouchableOpacity style={[styles.notifBtn, { marginRight: 8 }]} onPress={() => router.push('/aceptar-invitacion' as any)}>
            <Text style={styles.notifIcon}>🔗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notifBtn} onPress={async () => { await clearToken(); router.replace('/login'); }}>
            <Text style={styles.notifIcon}>🚪</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Tus pacientes hoy</Text>
          {pacientes.map((p) => {
            const estadoTurno = p.estado_turno ?? 'no_iniciado';
            return (
              <View key={p.id} style={styles.pacienteCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.pacienteAvatar}><Text style={styles.pacienteAvatarText}>{p.nombre_completo?.[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pacienteNombre}>{p.nombre_completo}</Text>
                    <Text style={styles.pacienteCondiciones}>{p.condiciones_medicas?.join(' · ') ?? 'Sin condiciones crónicas'}</Text>
                  </View>
                  {estadoTurno === 'activo' && <View style={styles.badgeActivo}><View style={styles.activoDot} /><Text style={styles.badgeActivoText}>En Turno</Text></View>}
                </View>
                {estadoTurno !== 'activo' && (
                  <TouchableOpacity 
                    style={[styles.iniciarBtn, { marginTop: 10 }]} 
                    onPress={() => manejarInicioTurno(p)} 
                    disabled={iniciando}
                  >
                    <Text style={styles.iniciarBtnText}>
                      {iniciando ? 'Sincronizando...' : 'Proceder a Verificación →'}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {estadoTurno === 'activo' && (
                  <TouchableOpacity 
                    style={[styles.iniciarBtn, { backgroundColor: COLORS.greenPale, borderColor: COLORS.green, marginTop: 10 }]} 
                    onPress={() => { setPacienteActivo(p); cargarTurno(p.id); setVista('turno'); }}
                  >
                    <Text style={[styles.iniciarBtnText, { color: COLORS.green }]}>Abrir Consola de Control →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* ── MODAL DE CAMBIOS PENDIENTES (UBICADO CORRECTAMENTE AL FINAL DEL VIEW PADRE) ── */}
        <Modal visible={cambiosModal} transparent={true} animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 }}>
                Cambios desde tu último turno
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 16 }}>
                Revisa antes de iniciar
              </Text>
              
              {cambiosPendientes.map((c: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>{c.severidad === 'alta' ? '🚨' : '📋'}</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: COLORS.textDark }}>{c.mensaje}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.iniciarBtn, { marginTop: 16, paddingVertical: 12 }]}
                onPress={() => { setCambiosModal(false); irARegistroSalud(pacienteActivo!); }}
              >
                <Text style={styles.iniciarBtnText}>Entendido, continuar →</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{ marginTop: 12, alignItems: 'center', padding: 8 }}
                onPress={() => setCambiosModal(false)}
              >
                <Text style={{ fontSize: 13, color: COLORS.textLight }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── 2. VISTA CONSOLA DE TURNO ACTIVA ──
  if (vista === 'turno' && pacienteActivo) {
    const tareasPendientes = tareas.filter(t => !t.completada);

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('lista')} style={styles.backBtn}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Consola operativa</Text>
            <Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text>
          </View>
          <View style={styles.turnoActivoPill}><View style={styles.activoDot} /><Text style={styles.activoText}>Monitoreo</Text></View>
        </View>

        {/* 📡 TELEMETRÍA AUTOMÁTICA */}
        <View style={[styles.monitorCard, { marginHorizontal: 16, marginTop: 16, backgroundColor: COLORS.white, borderColor: COLORS.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.textLight }}>📡 TELEMETRÍA DE HARDWARE EN VIVO</Text>
            <TouchableOpacity 
              onPress={() => sincronizarSignosReloj(pacienteActivo.id, true)} 
              disabled={cargandoSignos}
              style={[styles.iniciarBtn, { paddingHorizontal: 10, paddingVertical: 4 }, cargandoSignos && { backgroundColor: COLORS.border }]}
            >
              <Text style={styles.iniciarBtnText}>{cargandoSignos ? "Inyectando Comando..." : "⚡ Sensa Ahora (TCP)"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 }}>
            <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.cacao }}>{signosDispositivo?.spo2 ?? "—"}%</Text><Text style={styles.monitorSubTextLabel}>SpO₂</Text></View>
            <View style={{ width: 1, height: 24, backgroundColor: COLORS.border }} />
            <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.cacao }}>{signosDispositivo?.presion ?? "—"}</Text><Text style={styles.monitorSubTextLabel}>Presión</Text></View>
            <View style={{ width: 1, height: 24, backgroundColor: COLORS.border }} />
            <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.red }}>{signosDispositivo?.fc ?? "—"}</Text><Text style={styles.monitorSubTextLabel}>Pulso (bpm)</Text></View>
            <View style={{ width: 1, height: 24, backgroundColor: COLORS.border }} />
            <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.green }}>{signosDispositivo?.temperatura ?? "—"}°</Text><Text style={styles.monitorSubTextLabel}>T. Corporal</Text></View>
          </View>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Accesos rápidos de control</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
              onPress={() => {
                router.push({
                  pathname: '/red-cuidadores' as any,
                  params: { pacienteId: pacienteActivo.id, pacienteNombre: pacienteActivo.nombre_completo, isCuidador: 'true' }
                });
              }}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>💬</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Cuidadores</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }} onPress={() => router.push('/alertas' as any)}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>⚠️</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Alertas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }} onPress={() => router.push('/mapa' as any)}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>📍</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Ubicación</Text>
            </TouchableOpacity>
          </View>

          {/* NOTAS RECIENTES */}
          <Text style={styles.sectionTitle}>Notas del Cuidador (Últimos Relevos)</Text>
          {notas && notas.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 4 }}>
              {notas.map((n, i) => {
                const contenidoNota = n?.descripcion || n?.texto || "Nota de relevo registrada";
                return (
                  <View key={n?.id || i} style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', marginHorizontal: 0, marginBottom: 0 }]}>
                    <Text style={styles.alertIcon}>📝</Text>
                    <View style={styles.alertContent}>
                      <Text style={styles.alertTitle}>{String(contenidoNota).replace('📝 ', '')}</Text>
                      <Text style={styles.alertSub}>{n?.usuarios?.nombre_completo || 'Personal Vitanova'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.alertCard, { backgroundColor: '#F9F9F9', borderColor: COLORS.border, marginHorizontal: 0 }]}>
              <Text style={styles.alertIcon}>🔍</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Sin notas en el bloque actual</Text>
                <Text style={styles.alertSub}>Usa el botón de abajo para registrar incidencias.</Text>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 10 }}>
            <Text style={styles.sectionTitle}>Plan de cuidados del día ({tareasPendientes.length})</Text>
            <TouchableOpacity style={[styles.iniciarBtn, { paddingHorizontal: 12, paddingVertical: 4 }]} onPress={() => setTareaOpen(true)}>
              <Text style={[styles.iniciarBtnText, { fontSize: 11 }]}>+ Incidental</Text>
            </TouchableOpacity>
          </View>

          {tareasPendientes.map((t) => (
            <TouchableOpacity key={t.id} style={styles.tareaCard} onPress={() => {
              Alert.alert('Confirmar actividad', `¿Confirmas la ejecución de: ${t.descripcion}?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: '✓ Ejecutada', onPress: async () => {
                  if (t.med_id) await completarMedicamento(t.med_id, pacienteActivo.id, t.descripcion, t.hora);
                  else if (t.actividad_id) await completarActividad(t.actividad_id, pacienteActivo.id);
                  else if (t.es_incidental && t.id) {
                    await fetch(`${BASE_URL}/tareas/${t.id}/completar`, {
                      method: 'PATCH',
                      headers: { Authorization: `Bearer ${getToken()}` }
                    });
                  }
                  setTareas(prev => prev.map(item => item.id === t.id ? { ...item, completada: true } : item));
                }}
              ]);
            }}>
              <Text style={styles.tareaIcon}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>
              <View style={styles.tareaInfo}><Text style={styles.tareaTexto}>{t.descripcion}</Text><Text style={styles.tareaHora}>{t.hora ?? 'Incidental'}</Text></View>
              <View style={styles.tareaCheck} />
            </TouchableOpacity>
          ))}

          {/* ACCIONES DE BITÁCORA */}
          <Text style={styles.sectionTitle}>Acciones de bitácora</Text>
          <View style={styles.accionesRow}>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.redPale, borderColor: COLORS.red }]} onPress={() => setIncidenteOpen(true)}>
              <Text style={styles.accionBtnIcon}>🚨</Text><Text style={[styles.accionBtnText, { color: COLORS.red }]}>Reportar Incidente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.bluePale, borderColor: COLORS.blue }]} onPress={() => setVista('espontaneo')}>
              <Text style={styles.accionBtnIcon}>🩺</Text><Text style={[styles.accionBtnText, { color: COLORS.blue }]}>Registro Confort</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cerrarBtn} onPress={async () => {
            const verif = await verificarEscalas(pacienteActivo.id);
            setEscalaRequerida(verif.requiere_escalas); setEscalasLista(verif.escalas ?? []);
            setVista('cierre');
          }}><Text style={styles.cerrarBtnText}>Proceder a Cierre de Turno →</Text></TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* MODAL TAREAS INCIDENTALES */}
        <Modal visible={tareaOpen} animationType="slide" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.white, padding: 20, borderRadius: 12, gap: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.cacao }}>+ Agregar Tarea Incidental</Text>
              <TextInput 
                placeholder="Ej. Apoyo en traslado a sala" 
                value={tareaDesc}
                onChangeText={setTareaDesc}
                placeholderTextColor={COLORS.textLight}
                style={{ borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 6, color: COLORS.cacao }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setTareaOpen(false)} style={{ padding: 10 }}><Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={guardarTareaManual} disabled={guardandoTarea} style={{ backgroundColor: COLORS.cacao, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 }}>
                  <Text style={{ color: COLORS.white, fontWeight: '700' }}>{guardandoTarea ? "Guardando..." : "Confirmar"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL EMERGENCIA */}
        <Modal visible={incidenteOpen} animationType="slide" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 16 }}>
            <View style={{ backgroundColor: COLORS.white, padding: 24, borderRadius: 16, gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.red, textAlign: 'center' }}>Protocolo de Emergencia</Text>
              <TouchableOpacity style={{ backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: COLORS.red, padding: 14, borderRadius: 10 }} onPress={() => { registrarIncidente("Ambulancia 911", "SOS"); setIncidenteOpen(false); Linking.openURL('tel:911'); }}>
                <Text style={{ fontWeight: '700', color: COLORS.red, textAlign: 'center' }}>🚑 Llamar a Ambulancia (911)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIncidenteOpen(false)} style={{ paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: COLORS.textLight }}>Cerrar</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL ADICIONAR NOTA */}
        <Modal visible={notaOpen} animationType="slide" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.white, padding: 24, borderRadius: 16, gap: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.amber }}>📝 Agregar Nota</Text>
              <TextInput 
                placeholder="Escribe observaciones..." 
                value={notaTexto}
                onChangeText={setNotaTexto}
                multiline
                style={{ borderBottomWidth: 1, borderColor: COLORS.border, minHeight: 60, color: COLORS.cacao }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity onPress={() => setNotaOpen(false)} style={{ padding: 10 }}><Text style={{ color: COLORS.textLight }}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={guardarNota} disabled={guardandoNota} style={{ backgroundColor: COLORS.amber, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                  <Text style={{ color: COLORS.white }}>{guardandoNota ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── 3. VISTA MONITOREO ESPONTÁNEO ──
  if (vista === 'espontaneo' && pacienteActivo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('turno')} style={styles.backBtn}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.greeting}>Evaluación de Bienestar</Text><Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text></View>
        </View>
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.moduloCard}>
            <Text style={styles.signoLabel}>Intensidad del Dolor (EVA): {dolorEva}/10</Text>
            <View style={styles.evaContainer}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                <TouchableOpacity key={n} style={[styles.evaBtn, dolorEva === n && styles.evaBtnActive]} onPress={() => setDolorEva(n)}>
                  <Text style={[styles.evaBtnText, dolorEva === n && styles.evaBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.confirmarBtn} onPress={guardarRegistroEspontaneo} disabled={guardandoEspontaneo}>
            <Text style={styles.confirmarBtnText}>Guardar Parámetros →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── 4. VISTA CIERRE DE TURNO ──
  if (vista === 'cierre' && pacienteActivo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('turno')} style={styles.backBtn}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.greeting}>Cierre de operaciones</Text><Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text></View>
        </View>
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Condición de Entrega del Paciente</Text>
          <View style={styles.estadoRow}>
            {[{ val: 'bien', icon: '😊', label: 'Estable' }, { val: 'regular', icon: '😐', label: 'Regular' }].map((e) => (
              <TouchableOpacity key={e.val} style={[styles.estadoCard, estadoPaciente === e.val && styles.estadoCardActive]} onPress={() => setEstadoPaciente(e.val)}>
                <Text style={{ fontSize: 26 }}>{e.icon}</Text>
                <Text style={[styles.estadoLabel, estadoPaciente === e.val && { color: COLORS.gold }]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.confirmarBtn, { backgroundColor: '#25D366' }]} onPress={compartirWhatsApp}>
            <Text style={styles.confirmarBtnText}>📲 Resumen por WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmarBtn} onPress={ejecutarCierre}><Text style={styles.confirmarBtnText}>Confirmar y Concluir Turno</Text></TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  turnoActivoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(61,170,106,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)' },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  activoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 8 },
  pacienteCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, flexDirection: 'column', borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  pacienteAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.gold },
  pacienteAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.gold },
  pacienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  iniciarBtn: { backgroundColor: COLORS.goldPale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.gold, alignItems: 'center' },
  iniciarBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.gold },
  badgeActivo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(61,170,106,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)' },
  badgeActivoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  monitorCard: { backgroundColor: COLORS.cacao, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  monitorSubTextLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },
  tareaCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  tareaIcon: { fontSize: 20 },
  tareaInfo: { flex: 1 },
  tareaTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  tareaHora: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  tareaCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border },
  accionesRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  accionBtn: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  accionBtnIcon: { fontSize: 16 },
  accionBtnText: { fontSize: 12, fontWeight: '700' },
  cerrarBtn: { backgroundColor: COLORS.cacao, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  cerrarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  moduloCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  evaContainer: { flexDirection: 'row', gap: 3, marginTop: 6 },
  evaBtn: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 6, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  evaBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  evaBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  evaBtnTextActive: { color: COLORS.gold },
  estadoRow: { flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 4 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginTop: 4 },
  confirmarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  pacienteCondiciones: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  alertCard: { borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: COLORS.border },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textDark },
  alertSub: { fontSize: 10, color: COLORS.textLight, marginTop: 2, lineHeight: 14 },
});