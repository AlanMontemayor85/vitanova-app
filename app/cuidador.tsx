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
import { registrarNotificaciones } from '../services/notifications';

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
  const [presionSist, setPresionSist] = useState('');
  const [presionDiast, setPresionDiast] = useState('');
  const [frecCard, setFrecCard] = useState('');
  const [spo2Manual, setSpo2Manual] = useState('');
  const [tempManual, setTempManual] = useState('');
  const [glucosa, setGlucosa] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Estado temporal para la sensibilidad de caídas recuperada del servidor
  const [sensibilidadCaidas, setSensibilidadCaidas] = useState('');

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
        const tempFresca = res.frescura?.temperatura === true;
        const bphrtFresco = res.frescura?.bphrt === true;

        if (bphrtFresco) {
          setSignosDispositivo({
            ...res,
            temperatura: tempFresca ? res.temperatura : "—",
            dispositivoPuesto: true
          });
        } else {
          setSignosDispositivo({
            success: true,
            spo2: "—",
            presion: "—", 
            fc: "—",
            temperatura: "—",
            dispositivoPuesto: false
          });
          console.log("⌚ [FRONTEND CUIDADOR] Dispositivo inactivo o retirado. Tablero en rayas.");
        }
      }
    } catch (error) {
      console.error("❌ Error sincronizando telemetría:", error);
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

  // ── EFECTO: REFRESCAR CONFIGURACIONES AL ENTRAR AL PACIENTE ──
  useEffect(() => {
    const refrescarDatosAlEntrar = async () => {
      if (!pacienteActivo?.id) return;
      try { 
        console.log("🔍 Rompiendo caché de navegación. Solicitando datos frescos al servidor...");
        
        const data = await getPacientes(); 
        if (data && data.patients) {
          const pFresco = data.patients.find((x: any) => x.id === pacienteActivo.id);
          if (pFresco && pFresco.peso_kg) {
            console.log("⚖️ Peso real recuperado de la BD:", pFresco.peso_kg);
            setPeso(pFresco.peso_kg);
          }
        }

        const token = await getToken(); 
        const resDisp = await fetch(
          `${BASE_URL}/pacientes/${pacienteActivo.id}/config-reloj`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const dataDisp = await resDisp.json();
        if (dataDisp?.sensibilidad_caidas) {
          setSensibilidadCaidas(dataDisp.sensibilidad_caidas.toString());
          console.log("⚙️ Sensibilidad cargada:", dataDisp.sensibilidad_caidas);
        }

      } catch (err) {
        console.log("⚠️ Error sincronizando datos en segundo plano:", err);
      }
    };

    refrescarDatosAlEntrar();
  }, [pacienteActivo?.id, params?.refresh]);

  // ── CARGA INICIAL ──
  
  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getPacientes();
        if (data.patients) setPacientes(data.patients);
        
        // ← AGREGAR: Registrar notificaciones push para el cuidador
        await registrarNotificaciones().catch(err => 
          console.log("Push omitido en cuidador:", err)
        );
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
    setSensibilidadCaidas('');
  };

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
      
      // 🎯 CORREGIDO: Eliminamos "Sidebar." para llamar directamente a la función importada
      const cambiosData = await detectarCambiosTurno(p.id);
      if (cambiosData.cambios && cambiosData.cambios.length > 0) {
        setPacienteActivo(p);
        setCambiosPendientes(cambiosData.cambios);
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
        spo2: spo2Manual ? Number(spo2Manual) : (signosDispositivo?.spo2 !== '—' ? Number(signosDispositivo?.spo2) : null),
        frecuencia_cardiaca: frecCard ? Number(frecCard) : (signosDispositivo?.fc !== '—' ? Number(signosDispositivo?.fc) : null),
        presion_sistolica: presionSist ? Number(presionSist) : null,
        presion_diastolica: presionDiast ? Number(presionDiast) : null,
        temperatura: tempManual ? Number(tempManual) : null,
        glucosa: glucosa ? Number(glucosa) : null,
        observaciones: observaciones.trim() || null,
      })
    });
    setPresionSist(''); setPresionDiast('');
    setFrecCard(''); setSpo2Manual('');
    setTempManual(''); setGlucosa('');
    setObservaciones('');
    setVista('turno');
    Alert.alert('✅ Registro guardado', 'Los datos de confort fueron actualizados.');
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

      let _sistolica = null;
      let _diastolica = null;
      if (signosDispositivo?.presion && String(signosDispositivo.presion).includes('/')) {
        const partes = String(signosDispositivo.presion).split('/');
        _sistolica = parseInt(partes[0], 10) || null;
        _diastolica = parseInt(partes[1], 10) || null;
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
          presion_sistolica: _sistolica,
          presion_diastolica: _diastolica,
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

        {!signosDispositivo?.dispositivoPuesto && (
          <View style={{
            backgroundColor: '#FFFBEB',
            borderLeftWidth: 4,
            borderLeftColor: '#F59E0B',
            padding: 12,
            borderRadius: 6,
            marginHorizontal: 16,
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Text style={{ color: '#B45309', fontSize: 12, fontWeight: '600', flex: 1 }}>
              ⚠️ <Text style={{ fontWeight: '800' }}>Situación Detectada:</Text> El paciente se ha retirado el reloj inteligente o el dispositivo se encuentra apagado.
            </Text>
          </View>
        )}

        <View style={[styles.monitorCard, { marginHorizontal: 16, marginTop: 16, backgroundColor: COLORS.white, borderColor: COLORS.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.textLight }}>📡 TELEMETRÍA DE HARDWARE EN VIVO</Text>
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
            <View style={{ alignItems: 'center' }}>
              {signosDispositivo?.temperatura && signosDispositivo.temperatura !== "—" ? (
                <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.green }}>
                  {`${signosDispositivo.temperatura}°`}
                </Text>
              ) : (
                <Text style={{ fontSize: 9, color: COLORS.gold, textAlign: 'center', fontWeight: '700' }}>
                  {'Presiona\n"Sensa Ahora"'}
                </Text>
              )}
              <Text style={styles.monitorSubTextLabel}>T. Corporal</Text>
            </View>
          </View>
        </View>
        {/* TARJETA CONFIG RELOJ — Vista Cuidador (solo lectura) */}
        {signosDispositivo?.reloj_config && (
          <View style={{
            backgroundColor: COLORS.white,
            borderRadius: 12,
            padding: 14,
            marginTop: 8,
            marginBottom: 4,
            marginHorizontal: 16,
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
                  if (config.sensibilidad === 2) return 'Detector de caídas: 🟡 Estándar';
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
          </View>
        )}
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

            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }} 
              onPress={() => router.push({
                pathname: '/grafica-signos' as any,
                params: { 
                  pacienteId: pacienteActivo.id, 
                  pacienteNombre: pacienteActivo.nombre_completo 
                }
              })}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>📊</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Gráficas</Text>
            </TouchableOpacity>
          </View>
          
          {/* 📝 SECCIÓN: NOTAS DEL CUIDADOR */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 15,
            marginBottom: 12 
          }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Notas del Cuidador (Últimos Relevos)
            </Text>
            
            <TouchableOpacity 
              style={[styles.iniciarBtn, { 
                paddingHorizontal: 14, 
                paddingVertical: 6,
                borderRadius: 20,
                marginBottom: 0 
              }]} 
              onPress={() => setNotaOpen(true)}
            >
              <Text style={[styles.iniciarBtnText, { fontSize: 12, fontWeight: 'bold' }]}>
                + Nota
              </Text>
            </TouchableOpacity>
          </View>

          {/* NOTAS RECIENTES */}
          {notas && notas.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 4 }}>
              {notas.map((n, i) => {
                const contenidoNota = n?.descripcion || n?.texto || "Nota de relevo registrada";
                return (
                  <View 
                    key={n?.id || i} 
                    style={[styles.alertCard, { 
                      backgroundColor: COLORS.amberPale, 
                      borderColor: '#F5DBA0', 
                      marginHorizontal: 0, 
                      marginBottom: 0 
                    }]}
                  >
                    <Text style={styles.alertIcon}>📝</Text>
                    <View style={styles.alertContent}>
                      <Text style={styles.alertTitle}>{String(contenidoNota).replace('📝 ', '')}</Text>
                      <Text style={styles.alertSub}>{`${n?.usuarios?.nombre_completo ?? 'Personal Vitanova'} · ${
                        n?.created_at 
                          ? new Date(n.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : ''
                      }`} </Text>
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
                <Text style={styles.alertSub}>Usa el botón superior para registrar incidencias o notas.</Text>
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
              <Text style={{ color: COLORS.red, marginRight: 6 }}>🚨</Text><Text style={[styles.accionBtnText, { color: COLORS.red }]}>Reportar Incidente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.accionBtn, { backgroundColor: COLORS.bluePale, borderColor: COLORS.blue }]} onPress={() => setVista('espontaneo')}>
              <Text style={{ color: COLORS.blue, marginRight: 6 }}>🩺</Text><Text style={[styles.accionBtnText, { color: COLORS.blue }]}>Registro Confort</Text>
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
    <View style={{ backgroundColor: COLORS.white, padding: 24, borderRadius: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.red, textAlign: 'center' }}>
        {'Protocolo de Emergencia'}
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginBottom: 4 }}>
        {'Selecciona a quién contactar'}
      </Text>

      {/* 911 */}
      <TouchableOpacity 
        style={{ backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: COLORS.red, padding: 14, borderRadius: 10 }} 
        onPress={() => { 
          registrarIncidente("Ambulancia 911", "SOS"); 
          setIncidenteOpen(false); 
          Linking.openURL('tel:911'); 
        }}
      >
        <Text style={{ fontWeight: '700', color: COLORS.red, textAlign: 'center' }}>{'🚑 Llamar a Ambulancia (911)'}</Text>
      </TouchableOpacity>

      {/* Familiar principal */}
      {pacienteActivo?.telefono_emergencia && (
        <TouchableOpacity 
          style={{ backgroundColor: COLORS.amberPale, borderWidth: 1, borderColor: COLORS.amber, padding: 14, borderRadius: 10 }} 
          onPress={() => { 
            registrarIncidente("Familiar principal", "urgencia"); 
            setIncidenteOpen(false); 
            Linking.openURL(`tel:${pacienteActivo.telefono_emergencia}`); 
          }}
        >
          <Text style={{ fontWeight: '700', color: COLORS.amber, textAlign: 'center' }}>
            {`👨‍👩‍👧 Familiar (${pacienteActivo.telefono_emergencia})`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Ambulancia aseguradora */}
      {pacienteActivo?.telefono_ambulancia && (
        <TouchableOpacity 
          style={{ backgroundColor: '#F0F8FF', borderWidth: 1, borderColor: '#4A90D9', padding: 14, borderRadius: 10 }} 
          onPress={() => { 
            registrarIncidente("Ambulancia aseguradora", "urgencia"); 
            setIncidenteOpen(false); 
            Linking.openURL(`tel:${pacienteActivo.telefono_ambulancia}`); 
          }}
        >
          <Text style={{ fontWeight: '700', color: '#4A90D9', textAlign: 'center' }}>
            {`🏥 Ambulancia Aseguradora (${pacienteActivo.telefono_ambulancia})`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Aseguradora */}
      {pacienteActivo?.telefono_aseguradora && (
        <TouchableOpacity 
          style={{ backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: COLORS.green, padding: 14, borderRadius: 10 }} 
          onPress={() => { 
            registrarIncidente("Aseguradora", "informativo"); 
            setIncidenteOpen(false); 
            Linking.openURL(`tel:${pacienteActivo.telefono_aseguradora}`); 
          }}
        >
          <Text style={{ fontWeight: '700', color: COLORS.green, textAlign: 'center' }}>
            {`📋 Aseguradora ${pacienteActivo.nombre_aseguradora ? `(${pacienteActivo.nombre_aseguradora})` : ''} - ${pacienteActivo.telefono_aseguradora}`}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        onPress={() => setIncidenteOpen(false)} 
        style={{ paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={{ color: COLORS.textLight }}>{'Cerrar'}</Text>
      </TouchableOpacity>
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

  // ── 3. VISTA MONITOREO ESPONTÁNEO (DISEÑO PREMIUM) ──
if (vista === 'espontaneo' && pacienteActivo) {
  // Aseguramos colores locales consistentes para hidratación
  const COMPONENT_COLORS = Object.assign({}, COLORS, {
    blue: '#2B73B4',
    bluePale: '#E6F0FA'
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COMPONENT_COLORS.cacao} />
      
      {/* HEADER ULTRA-CLEAN */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setVista('turno')} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Evaluación de Bienestar</Text>
          <Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* ESCALA DE DOLOR EVA (SELECTOR HORIZONTAL FLUIDO) */}
        <View style={styles.moduloCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.signoLabel}>Intensidad del Dolor (EVA)</Text>
            <View style={{ backgroundColor: dolorEva > 6 ? COMPONENT_COLORS.redPale : dolorEva > 3 ? COMPONENT_COLORS.goldPale : COMPONENT_COLORS.greenPale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: dolorEva > 6 ? COMPONENT_COLORS.red : dolorEva > 3 ? COMPONENT_COLORS.gold : COMPONENT_COLORS.green }}>
                {dolorEva}/10
              </Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                <TouchableOpacity 
                  key={n} 
                  style={[
                    styles.evaBtn, 
                    { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
                    dolorEva === n ? { backgroundColor: COMPONENT_COLORS.gold, borderColor: COMPONENT_COLORS.gold } : { backgroundColor: COMPONENT_COLORS.cream, borderColor: COMPONENT_COLORS.border }
                  ]} 
                  onPress={() => setDolorEva(n)}
                >
                  <Text style={[styles.evaBtnText, dolorEva === n && { color: COMPONENT_COLORS.white, fontWeight: '800' }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ESTADO DE ÁNIMO (CHIPS COGNITIVOS) */}
        <View style={styles.moduloCard}>
          <Text style={[styles.signoLabel, { marginBottom: 10 }]}>Estado de ánimo</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { val: 'tranquilo', icon: '😌', label: 'Tranquilo' },
              { val: 'ansioso', icon: '😰', label: 'Ansioso' },
              { val: 'triste', icon: '😢', label: 'Triste' },
              { val: 'agitado', icon: '😤', label: 'Agitado' },
              { val: 'confundido', icon: '😵', label: 'Confundido' },
              { val: 'alegre', icon: '😊', label: 'Alegre' },
            ].map(e => {
              const activo = estadoAnimo === e.val;
              return (
                <TouchableOpacity
                  key={e.val}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                    borderWidth: 1,
                    borderColor: activo ? COMPONENT_COLORS.gold : COMPONENT_COLORS.border,
                    backgroundColor: activo ? COMPONENT_COLORS.goldPale : COMPONENT_COLORS.white,
                    flexDirection: 'row', alignItems: 'center', gap: 6
                  }}
                  onPress={() => setEstadoAnimo(e.val)}
                >
                  <Text style={{ fontSize: 15 }}>{e.icon}</Text>
                  <Text style={{ fontSize: 13, fontWeight: activo ? '700' : '500', color: activo ? COMPONENT_COLORS.gold : COMPONENT_COLORS.textDark, textTransform: 'capitalize' }}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* HIDRATACIÓN (CONTADOR DE VASOS ESTILIZADO) */}
        <View style={styles.moduloCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.signoLabel}>Hidratación</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COMPONENT_COLORS.textLight }}>{hidratacion} de 8 vasos</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            {[1,2,3,4,5,6,7,8].map(n => {
              const tomado = hidratacion >= n;
              return (
                <TouchableOpacity
                  key={n}
                  style={{
                    width: 36, height: 36, borderRadius: 12,
                    borderWidth: 1,
                    borderColor: tomado ? COMPONENT_COLORS.blue : COMPONENT_COLORS.border,
                    backgroundColor: tomado ? COMPONENT_COLORS.bluePale : COMPONENT_COLORS.white,
                    justifyContent: 'center', alignItems: 'center'
                  }}
                  onPress={() => setHidratacion(n)}
                >
                  <Text style={{ fontSize: 16, color: tomado ? COMPONENT_COLORS.blue : COMPONENT_COLORS.textLight }}>💧</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ALIMENTACIÓN (SEGMENTED BUTTONS) */}
        <View style={styles.moduloCard}>
          <Text style={[styles.signoLabel, { marginBottom: 10 }]}>Alimentación</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { val: 'completa', label: '🍽️ Completa' },
              { val: 'parcial', label: '🥣 Parcial' },
              { val: 'ninguna', label: '❌ Ninguna' },
            ].map(a => {
              const activo = alimentacion === a.val;
              return (
                <TouchableOpacity
                  key={a.val}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 12,
                    borderWidth: 1,
                    borderColor: activo ? COMPONENT_COLORS.green : COMPONENT_COLORS.border,
                    backgroundColor: activo ? COMPONENT_COLORS.greenPale : COMPONENT_COLORS.white,
                    alignItems: 'center'
                  }}
                  onPress={() => setAlimentacion(a.val)}
                >
                  <Text style={{ fontSize: 13, color: activo ? COMPONENT_COLORS.green : COMPONENT_COLORS.textDark, fontWeight: '700' }}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SIGNOS VITALES MANUALES (TABLA EN GRID SIMÉTRICA) */}
        <View style={styles.moduloCard}>
          <Text style={[styles.signoLabel, { marginBottom: 14 }]}>Signos Vitales Manuales (Opcional)</Text>

          {/* Fila 1: Presión Arterial */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: COMPONENT_COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Presión Arterial (mmHg)</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COMPONENT_COLORS.border, backgroundColor: COMPONENT_COLORS.white }]}
              placeholder="Sistólica (Ej. 120)"
              placeholderTextColor={COMPONENT_COLORS.textLight}
              keyboardType="numeric"
              value={presionSist}
              onChangeText={setPresionSist}
            />
            <Text style={{ fontSize: 20, color: COMPONENT_COLORS.border, fontWeight: '300' }}>/</Text>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COMPONENT_COLORS.border, backgroundColor: COMPONENT_COLORS.white }]}
              placeholder="Diastólica (Ej. 80)"
              placeholderTextColor={COMPONENT_COLORS.textLight}
              keyboardType="numeric"
              value={presionDiast}
              onChangeText={setPresionDiast}
            />
          </View>

          {/* Fila 2: Frecuencia Cardíaca y SpO2 en Paralelo */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COMPONENT_COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Pulso (bpm)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COMPONENT_COLORS.border, backgroundColor: COMPONENT_COLORS.white, textAlign: 'center' }]}
                placeholder="Ej. 72"
                placeholderTextColor={COMPONENT_COLORS.textLight}
                keyboardType="numeric"
                value={frecCard}
                onChangeText={setFrecCard}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COMPONENT_COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Saturación (%)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COMPONENT_COLORS.border, backgroundColor: COMPONENT_COLORS.white, textAlign: 'center' }]}
                placeholder="Ej. 97"
                placeholderTextColor={COMPONENT_COLORS.textLight}
                keyboardType="numeric"
                value={spo2Manual}
                onChangeText={setSpo2Manual}
              />
            </View>
          </View>

          {/* Fila 3: Temperatura y Glucosa en Paralelo */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COMPONENT_COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Temperatura (°C)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COMPONENT_COLORS.border, backgroundColor: COMPONENT_COLORS.white, textAlign: 'center' }]}
                placeholder="Ej. 36.5"
                placeholderTextColor={COMPONENT_COLORS.textLight}
                keyboardType="numeric"
                value={tempManual}
                onChangeText={setTempManual}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COMPONENT_COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Glucosa (mg/dL)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COMPONENT_COLORS.border, backgroundColor: COMPONENT_COLORS.white, textAlign: 'center' }]}
                placeholder="Ej. 95"
                placeholderTextColor={COMPONENT_COLORS.textLight}
                keyboardType="numeric"
                value={glucosa}
                onChangeText={setGlucosa}
              />
            </View>
          </View>
        </View>

        {/* OBSERVACIONES CLÍNICAS */}
        <View style={styles.moduloCard}>
          <Text style={[styles.signoLabel, { marginBottom: 8 }]}>Observaciones Clínicas</Text>
          <TextInput
            style={{ 
              minHeight: 90, 
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: COMPONENT_COLORS.border,
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              color: COMPONENT_COLORS.textDark,
              backgroundColor: COMPONENT_COLORS.white
            }}
            placeholder="Describe brevemente el comportamiento, estado cognitivo, quejas o anomalías detectadas en el paciente..."
            placeholderTextColor={COMPONENT_COLORS.textLight}
            multiline
            value={observaciones}
            onChangeText={setObservaciones}
          />
        </View>

        {/* BOTÓN CONFIRMAR EN ACCIÓN PRINCIPAL */}
        <TouchableOpacity
          style={[styles.confirmarBtn, { borderRadius: 14, paddingVertical: 16, marginTop: 8 }]}
          onPress={guardarRegistroEspontaneo}
          disabled={guardandoEspontaneo}
        >
          <Text style={styles.confirmarBtnText}>
            {guardandoEspontaneo ? 'Consolidando Reporte...' : 'Guardar Parámetros →'}
          </Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
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

          {/* PESO EN CIERRE DE TURNO */}
          <Text style={styles.sectionTitle}>Peso del paciente (kg)</Text>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: COLORS.white,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 16,
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 20, marginRight: 8 }}>⚖️</Text>
            <TextInput
              style={{ flex: 1, fontSize: 16, color: COLORS.textDark, paddingVertical: 14 }}
              placeholder="Ej. 70.5"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={peso === 0 ? '' : peso.toString()} 
              onChangeText={(val) => {
                const textoLimpio = val.replace(',', '.');
                
                if (textoLimpio === '') {
                  setPeso(0);
                  return;
                }

                if (textoLimpio.endsWith('.')) {
                  const num = parseFloat(textoLimpio);
                  if (!isNaN(num)) setPeso(num);
                  return;
                }

                const num = parseFloat(textoLimpio);
                if (!isNaN(num)) {
                  setPeso(num);
                }
              }}
            />
            <Text style={{ fontSize: 13, color: COLORS.textLight }}>{'kg'}</Text>
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
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12 },
  backIcon: { color: COLORS.white, fontSize: 20 },
  greeting: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  userName: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  notifBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  notifIcon: { fontSize: 16 },
  body: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.cacao, marginBottom: 12 },
  pacienteCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  pacienteAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.goldPale, justifyContent: 'center', alignItems: 'center' },
  pacienteAvatarText: { color: COLORS.gold, fontWeight: '700', fontSize: 16 },
  pacienteNombre: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  pacienteCondiciones: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  badgeActivo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenPale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  badgeActivoText: { fontSize: 11, fontWeight: '700', color: COLORS.green },
  iniciarBtn: { backgroundColor: COLORS.cacao, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cacao },
  iniciarBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  turnoActivoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activoText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  monitorCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  monitorSubTextLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },
  estadoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMid, marginTop: 4 },
  confirmarBtn: { backgroundColor: COLORS.cacao, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  confirmarBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  moduloCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.cacao, marginBottom: 10 },
  evaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  evaBtn: { padding: 8, borderRadius: 4, backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border },
  evaBtnActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  evaBtnText: { fontSize: 12, color: COLORS.textDark, fontWeight: '600' },
  evaBtnTextActive: { color: COLORS.white },
  tareaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  tareaIcon: { fontSize: 18, marginRight: 12 },
  tareaInfo: { flex: 1 },
  tareaTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  tareaHora: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  tareaCheck: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: COLORS.border },
  accionesRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  accionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  accionBtnText: { fontSize: 12, fontWeight: '700' },
  cerrarBtn: { backgroundColor: COLORS.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  cerrarBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  alertCard: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  alertIcon: { fontSize: 18, marginRight: 10 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  alertSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  input: {
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
  paddingVertical: 10,
  fontSize: 15,
  color: COLORS.textDark,
  marginBottom: 16,
},
});