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
  // 🟢 INYECCIÓN TÁCTICA: Importamos los servicios del index del familiar que hacían falta
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

  // 🟢 CLONACIÓN DE ESTADOS DEL FAMILIAR: Amortiguadores de datos
  const [notas, setNotas] = useState<any[]>([]);
  const [ultimoCierre, setUltimoCierre] = useState<any>(null);
  const [alertaPeso, setAlertaPeso] = useState<any>(null);

  const [estadoPaciente, setEstadoPaciente] = useState('bien');
  const [peso, setPeso] = useState(70.0);
  const [iniciando, setIniciando] = useState(false);

  // 📡 Sincronización pasiva y forzada con el endpoint real de tu FastAPI
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
        setSignosDispositivo(res);
      }
    } catch (error) {
      console.error("❌ Error sincronizando telemetría:", error);
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
        
        // 🛡️ Verificación Táctica: Antes de cambiar la vista, validamos si el turno sigue vivo en Supabase
        getTurnoActivo(p.id).then((turnoData) => {
          if (turnoData && turnoData.turno) {
            // Si el turno existe real en la base de datos, entramos con seguridad
            setPacienteActivo(p);
            cargarTurno(p.id);
            setVista('turno');
          } else {
            // 🟢 Si el turno ya fue finalizado en Supabase, reseteamos la vista a la lista limpia
            resetEstados();
            setVista('lista');
            // Limpiamos los parámetros de navegación para que no se quede en bucle al recargar
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

  // 🟢 4. CARGA CONSOLIDADA AL ACTIVAR PACIENTE (RESTAURADO E INDESTRUCTIBLE)
  const cargarTurno = async (pacienteId: string) => {
    // Lanzamos todas las promesas en paralelo directo a Supabase usando tus funciones nativas
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
    
    // 🟢 Regresamos a tu línea original y estable que nunca falla
    if (notasData && notasData.notas) {
      setNotas(notasData.notas.slice(0, 3)); // Muestra las 3 notas del display sin inventos
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

  const manejarInicioTurno = async (p: any) => {
    if (iniciando) return;
    setIniciando(true);
    try {
      const tareasCheck = await getTareasHoy(p.id);
      if (tareasCheck.sin_horario) {
        Alert.alert('Sin horario', 'El familiar no ha configurado tu horario de entrada.');
        return;
      }
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
    try {
      const response = await fetch(`${BASE_URL}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ 
          paciente_id: pacienteActivo.id, 
          turno_id: turnoActivoRef.current?.id || null, 
          observaciones: notaTexto.trim() // 🟢 CAMBIO CRÍTICO: Mandamos 'observaciones'
        })
      });

      if (!response.ok) throw new Error('Error en el servidor al guardar nota');

      setNotaTexto(''); 
      setNotaOpen(false);
      alert("✅ Nota guardada con éxito.");
      
      // Refrescamos localmente con tu función nativa original
      const notasData = await getNotasTurno(pacienteActivo.id);
      if (notasData && notasData.notas) {
        setNotas(notasData.notas.slice(0, 3));
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
      // 1. 🔍 Vamos por todas las notas incidentales del paciente registradas en el día
      const notasRes = await fetch(`${BASE_URL}/notas?paciente_id=${pacienteActivo.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const datasetNotas = await notasRes.json();
      
      // Jalamos el array elásticamente para actualizar el estado local por si acaso
      const notasActualizadas = datasetNotas?.notas || datasetNotas?.registros || [];
      setNotas(Array.isArray(notasActualizadas) ? notasActualizadas.slice(0, 3) : []);
      
      let notasConsolidadas = "Sin notas incidentales en el turno.";

      // Validamos usando la misma elasticidad de propiedades (.notas o .registros)
      const arrayParaFiltrar = Array.isArray(datasetNotas?.notas) 
        ? datasetNotas.notas 
        : (Array.isArray(datasetNotas?.registros) ? datasetNotas.registros : null);

      if (arrayParaFiltrar) {
        // 2. ⏳ Filtro híbrido táctico (Por ID de turno actual o notas huérfanas de hoy)
        const idTurnoActual = turnoActivoRef.current?.id || turnoActivo?.id || params.turnoId;
        
        const notasDelTurno = arrayParaFiltrar.filter(
          (n: any) => n.turno_id === idTurnoActual || n.turno_id === null
        );

        if (notasDelTurno.length > 0) {
          // 3. 🧵 Orden cronológico y formateo clínico
          notasConsolidadas = notasDelTurno
            .reverse() 
            .map((n: any) => {
              const textoNota = n.texto || n.descripcion || "Nota sin texto";
              const hora = n.created_at 
                ? new Date(n.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : "";
              return hora ? `[${hora}] ${textoNota}` : `- ${textoNota}`;
            })
            .join('\n');
        }
      }

      // 4. 🚀 Mandamos el payload consolidado completo a tu backend en Railway
      const res = await fetch(`${BASE_URL}/turnos/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          turno_id: turnoActivoRef.current?.id || turnoActivo?.id || params.turnoId, 
          paciente_id: pacienteActivo.id, 
          estado_paciente: estadoPaciente, 
          peso_kg: peso,
          notas: notasConsolidadas, // 🟢 La bitácora armada va aquí
          barthel_scores: barthelTocado ? barthelScores : null, 
          barthel_total: barthelTocado ? barthelTotal : null, 
          barthel_label: barthelTocado ? getBarthelLabel(barthelTotal) : null,
          morse_scores: morseTocado ? morseScores : null, 
          morse_total: morseTocado ? morseTotal : null, 
          morse_label: morseTocado ? getMorseLabel(morseTotal) : null,
          mna_scores: mnaTocado ? mnaScores : null, 
          mna_total: mnaTocado ? mnaTotal : null, 
          mna_label: mnaTocado ? getMNALabel(mnaTotal) : null,
        }),
      });

      const data = await res.json();
      if (data.status === 'ok') {
        const pData = await getPacientes();
        if (pData.patients) setPacientes(pData.patients);
        resetEstados(); 
        setVista('lista');
        Alert.alert('✅ Turno Cerrado', 'La bitácora del día se ha consolidado e indexado con éxito.');
      }
    } catch (e) { 
      console.error("❌ Error en ejecutarCierre consolidado:", e); 
      Alert.alert('⚠️ Error', 'Ocurrió un problema al procesar el cierre del turno.');
    }
  }; // 🟢 Función completamente cerrada

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

        {/* 📡 TELEMETRÍA AUTOMÁTICA DEL HARDWARE */}
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

          {/* 👥 ACCESOS RÁPIDOS ADAPTADOS DEL FAMILIAR */}
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

            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
              onPress={() => router.push('/alertas' as any)}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>⚠️</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Alertas</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
              onPress={() => router.push('/mapa' as any)}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>📍</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Ubicación</Text>
            </TouchableOpacity>
          </View>

          {/* 📝 SECCIÓN: NOTAS DEL CUIDADOR RECIENTES REPARADA Y BLINDADA */}
          {notas && notas.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Notas del Cuidador (Últimos Relevos)</Text>
              {notas.map((n, i) => {
                // 🟢 1. Extracción real desde la columna 'observaciones' de tu Supabase
                const rawTexto = n?.observaciones || n?.texto || n?.descripcion || "Nota incidental";
                const contenidoNota = String(rawTexto).replace('📝 ', '');
                
                // 🟢 2. Formateo de fecha (Mantiene la impresión de la hora exacta de la nota)
                const fechaBase = n?.created_at || n?.hora_completada;
                let horaNota = '—';
                
                if (fechaBase) {
                  try {
                    horaNota = new Date(fechaBase).toLocaleTimeString('es-MX', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                  } catch (err) {
                    console.error("Error parseando fecha de nota:", err);
                  }
                }

                // 🟢 3. Extracción segura del nombre del cuidador
                const nombreCuidador = n?.usuarios?.nombre_completo || 
                                       n?.cuidador?.nombre_completo || 
                                       'Personal Vitanova';

                return (
                  <View key={i} style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', marginHorizontal: 0 }]}>
                    <Text style={styles.alertIcon}>📝</Text>
                    <View style={styles.alertContent}>
                      <Text style={styles.alertTitle}>
                        {contenidoNota}
                      </Text>
                      <Text style={styles.alertSub}>
                        {nombreCuidador} · {horaNota} hrs
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* ⚖️ ALERTAS DE EXTRACCIÓN MÉDICA Y ESCALAS ANTERIORES */}
          {(ultimoCierre || alertaPeso) && <Text style={styles.sectionTitle}>Estatus Clínico de Entrega</Text>}
          
          {ultimoCierre ? (
            <>
              {ultimoCierre.barthel_total !== null && (
                <View style={[styles.alertCard, { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold, marginHorizontal: 0 }]}>
                  <Text style={styles.alertIcon}>📋</Text>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Último Índice de Barthel: {ultimoCierre.barthel_total}/100</Text>
                    <Text style={styles.alertSub}>{ultimoCierre.barthel_label} (Por: {ultimoCierre.usuarios?.nombre_completo ?? 'Personal Vitanova'})</Text>
                  </View>
                </View>
              )}
              {ultimoCierre.morse_total !== null && ultimoCierre.morse_total >= 25 && (
                <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', marginHorizontal: 0 }]}>
                  <Text style={styles.alertIcon}>⚠️</Text>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Riesgo de caída: {ultimoCierre.morse_total} pts</Text>
                    <Text style={styles.alertSub}>{ultimoCierre.morse_label}</Text>
                  </View>
                </View>
              )}
            </>
          ) : null}

          {alertaPeso && (
            <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', marginHorizontal: 0 }]}>
              <Text style={styles.alertIcon}>⚖️</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Recordatorio de peso</Text>
                <Text style={styles.alertSub}>{alertaPeso.mensaje}</Text>
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
                  
                  setTareas(prev => prev.map(item => item.id === t.id ? { ...item, completada: true } : item));
                  
                  const data = await getTareasDia(pacienteActivo.id); 
                  if (data.tareas) {
                    setTareas(prev => {
                      const incidentesLocales = prev.filter(item => item.es_incidental && !item.completada);
                      const tareasServidor = data.tareas.filter((st: any) => !incidentesLocales.some(il => il.id === st.id));
                      return [...tareasServidor, ...incidentesLocales];
                    });
                  }
                }}
              ]);
            }}>
              <Text style={styles.tareaIcon}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>
              <View style={styles.tareaInfo}><Text style={styles.tareaTexto}>{t.descripcion}</Text><Text style={styles.tareaHora}>{t.hora ?? 'Incidental'}</Text></View>
              <View style={styles.tareaCheck} />
            </TouchableOpacity>
          ))}

          {/* ACCIONES DE TABLERO */}
          <Text style={styles.sectionTitle}>Acciones de bitácora</Text>
          <View style={styles.accionesRow}>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.redPale, borderColor: COLORS.red }]} onPress={() => setIncidenteOpen(true)}>
              <Text style={styles.accionBtnIcon}>🚨</Text><Text style={[styles.accionBtnText, { color: COLORS.red }]}>Reportar Incidente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.bluePale, borderColor: COLORS.blue }]} onPress={() => setVista('espontaneo')}>
              <Text style={styles.accionBtnIcon}>🩺</Text><Text style={[styles.accionBtnText, { color: COLORS.blue }]}>Registro Confort</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.accionesRow}>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.greenPale, borderColor: COLORS.green }]} onPress={() => router.push({ pathname: '/grafica-signos' as any, params: { pacienteId: pacienteActivo.id, pacienteNombre: pacienteActivo.nombre_completo } })}>
              <Text style={styles.accionBtnIcon}>📊</Text><Text style={[styles.accionBtnText, { color: COLORS.green }]}>Ver Historial Clínico</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.amberPale, borderColor: COLORS.amber }]} onPress={() => setNotaOpen(true)}>
              <Text style={styles.accionBtnIcon}>📝</Text><Text style={[styles.accionBtnText, { color: COLORS.amber }]}>Agregar Nota</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cerrarBtn} onPress={async () => {
            const verif = await verificarEscalas(pacienteActivo.id);
            setEscalaRequerida(verif.requiere_escalas); setEscalasLista(verif.escalas ?? []);
            setEscalaMotivo(verif.motivo); setEscalasMensaje(verif.mensaje);
            setVista('cierre');
          }}><Text style={styles.cerrarBtnText}>Proceder a Cierre de Turno →</Text></TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* 📋 MODAL DE TAREAS INCIDENTALES */}
        <Modal visible={tareaOpen} animationType="slide" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.white, padding: 20, borderRadius: 12, gap: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.cacao }}>+ Agregar Tarea Incidental</Text>
              <TextInput 
                placeholder="Ej. Apoyo en traslado a sala o cambio de sábanas" 
                value={tareaDesc}
                onChangeText={setTareaDesc}
                placeholderTextColor={COLORS.textLight}
                style={{ borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 6, color: COLORS.cacao }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setTareaOpen(false)} style={{ padding: 10 }}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={guardarTareaManual} 
                  disabled={guardandoTarea}
                  style={{ backgroundColor: COLORS.cacao, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: '700' }}>{guardandoTarea ? "Guardando..." : "Confirmar Actividad"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 🚨 MODAL DE PROTOCOLO DE INCIDENTES CON MARCADO TELEFÓNICO REAL */}
        <Modal visible={incidenteOpen} animationType="slide" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 16 }}>
            <View style={{ backgroundColor: COLORS.white, padding: 24, borderRadius: 16, gap: 16 }}>
              <View style={{ alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 28 }}>🚨</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.red, marginTop: 6 }}>Protocolo de Emergencia Activo</Text>
                <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginTop: 2 }}>Selecciona una acción inmediata para reportar y pedir ayuda</Text>
              </View>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: COLORS.red, padding: 14, borderRadius: 10, gap: 12 }}
                onPress={async () => {
                  registrarIncidente("🚨 PROTOCOLO ACTIVO: El cuidador solicitó el despacho de una Ambulancia (911).", "SOS");
                  setIncidenteOpen(false);
                  try { await Linking.openURL('tel:911'); } catch (err) { Alert.alert("⚠️ Error", "Marcador telefónico falló."); }
                }}
              >
                <Text style={{ fontSize: 22 }}>🚑</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: COLORS.red }}>Llamar a la Ambulancia (911)</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight }}>Alerta roja en plataforma + Llamada inmediata</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: COLORS.gold, padding: 14, borderRadius: 10, gap: 12 }}
                onPress={async () => {
                  registrarIncidente("⚠️ ALERTA: Cuidador activa botón de pánico hacia el Celular Maestro SOS.", "SOS");
                  setIncidenteOpen(false);
                  const CELULAR_MAESTRO = "81XXXXXXXX"; 
                  try { await Linking.openURL(`tel:${CELULAR_MAESTRO}`); } catch (err) { Alert.alert("⚠️ Error", "Marcador no disponible."); }
                }}
              >
                <Text style={{ fontSize: 22 }}>🦾</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: COLORS.cacao }}>Llamar al Celular Maestro SOS</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight }}>Enlaza directo con el Administrador de Guardia</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: COLORS.green, padding: 14, borderRadius: 10, gap: 12 }}
                onPress={async () => {
                  registrarIncidente("ℹ️ REPORTE: Cuidador solicita contacto urgente con el Familiar Responsable.", "otro");
                  setIncidenteOpen(false);
                  const telFamiliar = pacienteActivo.telefono_responsable || "81XXXXXXXX";
                  try { await Linking.openURL(`tel:${telFamiliar}`); } catch (err) { Alert.alert("⚠️ Error", "Llamada falló."); }
                }}
              >
                <Text style={{ fontSize: 22 }}>📞</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: COLORS.green }}>Marcar al Familiar Responsable</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight }}>Notificación de estatus o incidencia menor</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIncidenteOpen(false)} style={{ marginTop: 6, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 }}>
                <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Cerrar Protocolo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 📝 MODAL PARA AGREGAR NOTA CLÍNICA DE CONTROL */}
        <Modal visible={notaOpen} animationType="slide" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.white, padding: 24, borderRadius: 16, gap: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.amber }}>📝 Agregar Nota a la Bitácora General</Text>
              <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: -8 }}>Este reporte se guardará en el historial permanente y será visible de inmediato para toda la red.</Text>
              <TextInput 
                placeholder="Escribe las observaciones del turno..." 
                value={notaTexto}
                onChangeText={setNotaTexto}
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={4}
                style={{ borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 8, minHeight: 80, color: COLORS.cacao, textAlignVertical: 'top' }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => { setNotaTexto(''); setNotaOpen(false); }} style={{ padding: 10 }}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={guardarNota} disabled={guardandoNota} style={{ backgroundColor: COLORS.amber, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                  <Text style={{ color: COLORS.white, fontWeight: '700' }}>{guardandoNota ? "Sincronizando..." : "Guardar en Historial"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  // ── 3. VISTA MONITOREO ESPONTÁNEO (BIENESTAR) ──
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={styles.signoLabel}>Intensidad del Dolor (Escala EVA)</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: dolorEva >= 7 ? COLORS.red : COLORS.gold }}>
                {dolorEva >= 7 ? '😭 Severo' : dolorEva >= 4 ? '😐 Moderado' : '😊 Leve'} ({dolorEva}/10)
              </Text>
            </View>
            <View style={styles.evaContainer}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                <TouchableOpacity key={n} style={[styles.evaBtn, dolorEva === n && styles.evaBtnActive, n >= 7 && dolorEva === n && { backgroundColor: COLORS.red, borderColor: COLORS.red }]} onPress={() => setDolorEva(n)}>
                  <Text style={[styles.evaBtnText, dolorEva === n && styles.evaBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.moduloCard}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao, marginBottom: 10 }}>Control de Hidratación (Líquidos aportados)</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {[1,2,3,4,5,6,7,8].map(v => (
                <TouchableOpacity key={v} onPress={() => setHidratacion(v)} style={[styles.vasoBtn, hidratacion >= v && { backgroundColor: COLORS.bluePale, borderColor: COLORS.blue }]}>
                  <Text style={{ fontSize: 16, opacity: hidratacion >= v ? 1 : 0.2 }}>💧</Text>
                </TouchableOpacity>
              ))}
              <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.blue, marginLeft: 'auto' }}>{hidratacion} Vasos</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Comportamiento y Conducta</Text>
          <View style={styles.estadoRow}>
            {[{ val: 'bien', icon: '😊', label: 'Estable' }, { val: 'regular', icon: '😐', label: 'Inquieto' }, { val: 'bajo', icon: '😔', label: 'Deprimido' }].map(e => (
              <TouchableOpacity key={e.val} style={[styles.estadoCard, estadoAnimo === e.val && styles.estadoCardActive]} onPress={() => setEstadoAnimo(e.val)}>
                <Text style={{ fontSize: 26 }}>{e.icon}</Text>
                <Text style={[styles.estadoLabel, estadoAnimo === e.val && { color: COLORS.gold }]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.confirmarBtn} onPress={guardarRegistroEspontaneo} disabled={guardandoEspontaneo}>
            {guardandoEspontaneo ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmarBtnText}>Guardar Parámetros de Bienestar →</Text>}
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
            {[{ val: 'bien', icon: '😊', label: 'Estable' }, { val: 'regular', icon: '😐', label: 'Regular' }, { val: 'preocupante', icon: '😟', label: 'Delicado' }].map((e) => (
              <TouchableOpacity key={e.val} style={[styles.estadoCard, estadoPaciente === e.val && styles.estadoCardActive]} onPress={() => setEstadoPaciente(e.val)}>
                <Text style={{ fontSize: 26 }}>{e.icon}</Text>
                <Text style={[styles.estadoLabel, estadoPaciente === e.val && { color: COLORS.gold }]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.signoCard}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao }}>Monitoreo de Peso de Cierre</Text>
            <View style={styles.signoControles}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setPeso(v => Math.max(30, parseFloat((v - 0.5).toFixed(1))))}><Text style={styles.signoBtnText}>−</Text></TouchableOpacity>
              <Text style={styles.signoVal}>{peso} kg</Text>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setPeso(v => Math.min(200, parseFloat((v + 0.5).toFixed(1))))}><Text style={styles.signoBtnText}>+</Text></TouchableOpacity>
            </View>
          </View>

          {escalaRequerida && (
            <View style={{ gap: 10, marginBottom: 10 }}>
              {escalasLista.includes('barthel') && (
                <View style={styles.evaluacionCard}>
                  <TouchableOpacity style={styles.evaluacionHeader} onPress={() => setBarthelOpen(!barthelOpen)}>
                    <View style={styles.evaluacionIconWrap}><Text style={{ fontSize: 16 }}>📋</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.evaluacionTitle}>Índice Funcional de Barthel</Text></View>
                    <Text style={styles.evaluacionScore}>{barthelTotal}/100</Text>
                  </TouchableOpacity>
                  {barthelOpen && (
                    <View style={styles.evaluacionContent}>
                      {BARTHEL_ITEMS.map((item, i) => (
                        <View key={i} style={{ marginBottom: 12 }}>
                          <Text style={styles.barthelItemLabel}>{item.label}</Text>
                          <View style={styles.barthelOpciones}>
                            {item.opciones.map((op) => (
                              <TouchableOpacity key={op.val} style={[styles.barthelOpcion, barthelScores[i] === op.val && styles.barthelOpcionActive]} onPress={() => { setBarthelTocado(true); const n = [...barthelScores]; n[i] = op.val; setBarthelScores(n); }}>
                                <Text style={[styles.barthelOpcionText, barthelScores[i] === op.val && styles.barthelOpcionTextActive]}>{op.val} - {op.txt}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={[styles.confirmarBtn, { backgroundColor: '#25D366', marginTop: 14, marginBottom: 8 }]} onPress={compartirWhatsApp}>
            <Text style={styles.confirmarBtnText}>📲 Enviar Resumen Familiar por WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmarBtn} onPress={ejecutarCierre}><Text style={styles.confirmarBtnText}>Confirmar y Concluir Turno</Text></TouchableOpacity>
          <View style={{ height: 40 }} />
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
  vasoBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  estadoRow: { flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 4 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginTop: 4 },
  signoCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  signoControles: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  signoBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  signoVal: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, minWidth: 60, textAlign: 'center' },
  evaluacionCard: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' },
  evaluacionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  evaluacionIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center' },
  evaluacionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  evaluacionScore: { fontSize: 12, fontWeight: '700', color: COLORS.gold, marginLeft: 'auto' },
  evaluacionContent: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14 },
  barthelItemLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  barthelOpciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  barthelOpcion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  barthelOpcionActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  barthelOpcionText: { fontSize: 11, color: COLORS.textLight },
  barthelOpcionTextActive: { color: COLORS.gold, fontWeight: '700' },
  confirmarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  pacienteCondiciones: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  alertCard: { borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: COLORS.border },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textDark },
  alertSub: { fontSize: 10, color: COLORS.textLight, marginTop: 2, lineHeight: 14 },
});