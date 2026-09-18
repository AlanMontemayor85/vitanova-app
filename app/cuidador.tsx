import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, View,
} from 'react-native';
import {
  agregarTareaManual,
  detectarCambiosTurno,
  enviarComandoReloj,
  fetchWithAuth,
  forzarMedicionSignos,
  getAlertaPeso,
  getBateriaPaciente,
  getInventario,
  getMisRoles,
  getNotasTurno,
  getPacientes,
  getSignosRecientes,
  getTareasDia,
  getTareasHoy, getToken,
  getTurnoActivo,
  getUbicacion,
  getUltimoCierre,
  iniciarTurno,
  loadStoredToken,
  verificarEscalas
} from '../services/api';
import { programarNotificacionTarea, registrarNotificaciones } from '../services/notifications';
import { encolarPeticionOffline, vaciarColaOffline } from '../services/offlineQueue';
import { BannerAlertasPreventivas } from './components/BannerAlertasPreventivas';
import { DictadoVozInput } from './components/DictadoVozInput';
import { SupervisionCuidadorCard } from './components/SupervisionCuidadorCard';
import { TarjetaUltimoCierre } from './components/TarjetaUltimoCierre';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textMid: '#4A4540', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', greenPale: '#EAF5E8', amber: '#D4860A',
  amberPale: '#FFF4E0', red: '#D94F4F', redPale: '#FDEAEA',
  blue: '#3A91FF', bluePale: '#EBF3FF', 
};
const formatearHora = (isoStr: string | null) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

export default function CuidadorScreen({
  pacienteProp = null, 
  modoFamiliar = false, 
  esFamiliarEnModoCuidador = false,   // ← nueva prop
  onRegresar,
  initialPacienteId = null,
  initialVista = null
}: any) {

  const params = useLocalSearchParams();
  const router = useRouter();


  const esSwitchFamiliar = 
    esFamiliarEnModoCuidador === true || 
    modoFamiliar === true || 
    !!pacienteProp || 
    params?.modoSwitch === 'cuidador_familiar';

  // A partir de ahora usaremos SIEMPRE "esSwitchFamiliar" 
  // en todos los candados de horario y navegación.

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
  const [mostrarAvisoMonitoreo, setMostrarAvisoMonitoreo] = useState<boolean>(false); // Inicia colapsado por defecto
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
  const [nombreUsuario, setNombreUsuario] = useState<string>('');
  const [alertas, setAlertas] = useState<any[]>([]);
  const [ubicacion, setUbicacion] = useState<any>(null);
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
  const yaTransicionadoRef = useRef(false);
  const [nuevaTareaDesc, setNuevaTareaDesc] = useState('');
  const [nuevaTareaTipo, setNuevaTareaTipo] = useState('otro');
  const [mostrarSignosReloj, setMostrarSignosReloj] = useState<boolean>(false);
  const [nuevaTareaHora, setNuevaTareaHora] = useState(''); // Ej. "11:30" o "" para incidental pura
  const vistaRef = useRef(vista);
  const yaEntroConsolaRef = useRef(false);
  // 📦 2. Estados para el inventario en el cierre de turno
  const [inventarioHogar, setInventarioHogar] = useState<any[]>([]);
  const [consumosTurno, setConsumosTurno] = useState<Record<string, number>>({});
  const [itemSeleccionadoDetalle, setItemSeleccionadoDetalle] = useState<any>(null);
  // 🎯 Estados para el reporte de falla de activos fijos / equipos
  const [itemFallaSeleccionado, setItemFallaSeleccionado] = useState<any>(null);
  const [descripcionFalla, setDescripcionFalla] = useState('');
  const [enviandoFalla, setEnviandoFalla] = useState(false);
  const [modalConfigVisible, setModalConfigVisible] = useState(false);
  const [ejecutandoCmd, setEjecutandoCmd] = useState<string | null>(null);
  const [pasosHoy, setPasosHoy] = useState<number | null>(null);
  const [bateria, setBateria] = useState<number | null>(null);
  const [modalConfigCuidadorVisible, setModalConfigCuidadorVisible] = useState(false);
  const cambiarConsumoItem = (itemId: string, delta: number) => {
    setConsumosTurno((prev: Record<string, number>) => {
      const actual = prev[itemId] || 0;
      const nuevo = Math.max(0, actual + delta);
      return { ...prev, [itemId]: nuevo };
    });
  };
  // Estado temporal para la sensibilidad de caídas recuperada del servidor
  const [sensibilidadCaidas, setSensibilidadCaidas] = useState('');
  const [notasExpandidas, setNotasExpandidas] = useState(false);
  // 🇲🇽 Convierte "2026-07-22" -> "22/07/2026" (Para mostrar al usuario)
  const ISOaLatino = (fechaISO: string) => {
    if (!fechaISO) return '';
    const partes = fechaISO.split('T')[0].split('-');
    if (partes.length !== 3) return fechaISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };
   // Estado inicial formateado como "22/07/2026"
  const hoyLatino = () => {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
};
  const formatearHoraBonita = (horaStr: string | null | undefined): string => {
  if (!horaStr || horaStr === 'Incidental') return 'Sin hora';
  
  // Limpiamos la cadena si viene como "14:00:00" o "14:00"
  const partes = horaStr.split(':');
  if (partes.length < 2) return horaStr;

  let hrs = parseInt(partes[0], 10);
  const mins = partes[1].padStart(2, '0');
  const ampm = hrs >= 12 ? 'p.m.' : 'a.m.';

  hrs = hrs % 12;
  hrs = hrs ? hrs : 12; // Si es 0 (medianoche) se convierte a 12

  return `${hrs}:${mins} ${ampm}`;
};
const formatearHorarioCompletoAMPM = (etiquetaRaw: string | undefined, horasRaw?: string): string => {
  if (!etiquetaRaw) return 'Programado';
  if (etiquetaRaw.toLowerCase().includes('24 hrs')) return etiquetaRaw;

  // Si viene en formato "08:00 a 16:00" o "08:00 - 16:00"
  return etiquetaRaw.replace(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(a|-)\s*(\d{1,2}:\d{2}(?::\d{2})?)/gi, (_, hIni, sep, hFin) => {
    return `${formatearHoraBonita(hIni)} a ${formatearHoraBonita(hFin)}`;
  });
};
const [nuevaTareaFecha, setNuevaTareaFecha] = useState(hoyLatino());
  // ⚙️ Convierte "22/07/2026" -> "2026-07-22" (Para enviar al backend)
  const LatinoaISO = (fechaLatino: string) => {
    if (!fechaLatino) return new Date().toISOString().split('T')[0];
    const partes = fechaLatino.split('/');
    if (partes.length !== 3) return fechaLatino;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  };
const formatearBadgeTurno = (estadoTurno: string, turnoInfo: any) => {
  if (estadoTurno === 'activo') {
    return {
      icono: '🟢',
      texto: 'En turno activo',
      bg: COLORS.greenPale,
      border: COLORS.green,
      color: COLORS.green
    };
  }

  if (estadoTurno === 'finalizado') {
    return {
      icono: '✅',
      texto: 'Turno concluido hoy',
      bg: '#EAF5E8',
      border: '#C8E6C9',
      color: '#2E7D32'
    };
  }

  // No iniciado: Mostrar Días y Horas limpios
  const diasTexto = turnoInfo?.dias || '';
  const horasTexto = formatearHorarioCompletoAMPM(turnoInfo?.horas);
  const detalle = [diasTexto, horasTexto].filter(Boolean).join(' · ');

  return {
    icono: '🕒',
    texto: detalle ? `${detalle}` : 'Horario programado',
    bg: '#F5F3EF',
    border: '#E8E3D8',
    color: '#6E675F'
  };
};
  // Estados para Picker
const [showDatePicker, setShowDatePicker] = useState(false);
const [showTimePicker, setShowTimePicker] = useState(false);

// Handler para cambio de Fecha
const onFechaChange = (event: any, selectedDate?: Date) => {
  setShowDatePicker(false);
  if (selectedDate) {
    const dia = String(selectedDate.getDate()).padStart(2, '0');
    const mes = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const anio = selectedDate.getFullYear();
    setNuevaTareaFecha(`${dia}/${mes}/${anio}`);
  }
};

// Handler para cambio de Hora
const onHoraChange = (event: any, selectedDate?: Date) => {
  setShowTimePicker(false);
  if (selectedDate) {
    const hrs = String(selectedDate.getHours()).padStart(2, '0');
    const mins = String(selectedDate.getMinutes()).padStart(2, '0');
    setNuevaTareaHora(`${hrs}:${mins}`);
  }
};

const lastFetchRef = useRef(0);
const ejecutarComandoCuidador = async (comando: 'FIND' | 'PEDO' | 'RESET', argumento: string = '') => {
  if (!pacienteActivo?.id) return;
  try {
    setEjecutandoCmd(comando);
    const res = await enviarComandoReloj(pacienteActivo.id, comando, argumento);
    if (res?.success) {
      let msg = 'Comando enviado.';
      if (comando === 'FIND') msg = 'El reloj está sonando (1 min).';
      if (comando === 'PEDO') msg = 'Podómetro activado (24h).';
      if (comando === 'RESET') msg = 'El reloj se está reiniciando.';
      Alert.alert('Éxito', msg);
    } else {
      Alert.alert('Aviso', res?.detail || 'No se pudo comunicar con el reloj.');
    }
  } catch {
    Alert.alert('Error', 'Error de conexión con el servidor.');
  } finally {
    setEjecutandoCmd(null);
  }
};
const cargarNivelBateria = async (pacienteId: string) => {
  try {
    const data = await getBateriaPaciente(pacienteId);
    if (data?.bateria_pct !== undefined) {
      // Si tienes el estado declarado:
      setBateria?.(data.bateria_pct);
    }
  } catch (err: any) {
    // 🛡️ Log silencioso con tipado seguro para evitar la advertencia de TS y LogBox
    console.log('⚠️ [BATERÍA] No disponible para este rol o sesión:', err?.message || String(err));
  }
};
const confirmarReinicioCuidador = () => {
  Alert.alert(
    '¿Reiniciar Reloj?',
    'El reloj se reiniciará y tardará aproximadamente 1 minuto en reconectarse.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reiniciar', style: 'destructive', onPress: () => ejecutarComandoCuidador('RESET') }
    ]
  );
};
const refrescarPacientes = async (
    origen: string = 'lista',
    forzar: boolean = false
  ) => {
    const now = Date.now();
    if (!forzar && now - lastFetchRef.current < 8000) {
      console.log('⏭️ Skip getPacientes', origen);
      return;
    }
    lastFetchRef.current = now;

    try {
      const esSwitch = params.modoSwitch === 'cuidador' || esSwitchFamiliar;
      const rolPeticion = esSwitch ? 'familiar' : 'cuidador';
      
      const data = await getPacientes(origen, rolPeticion);
      if (data?.patients) {
        setPacientes([...data.patients]);
        if (data.usuario_nombre) setNombreUsuario(data.usuario_nombre);
      }
    } catch (e) {
      console.error('❌ Error refrescando pacientes:', e);
    }
  };
 // 1. Cargar y normalizar signos en Cuidador
const sincronizarSignosReloj = async (pacienteIdTarget: string, forzarSensado: boolean = false) => {
  if (!pacienteIdTarget) return;

  try {
    if (forzarSensado) {
      setCargandoSignos(true);
      // Optimista: apagamos temporalmente el modo carga visual si decide medir
      setSignosDispositivo((prev: any) => (prev ? { ...prev, cargando: false } : prev));
      await forzarMedicionSignos(pacienteIdTarget);
      Alert.alert("📡 Solicitud enviada", "El reloj comenzará la lectura en unos segundos...");
    }

    // Consulta de telemetría fresca
    const res = await getSignosRecientes(pacienteIdTarget);

    if (res && res.success) {
      const estaEnCarga = Boolean(res.cargando || res.estado_contacto === 'cargando');
      const puesto = res.dispositivoPuesto !== false && res.sin_contacto !== true && !estaEnCarga;

      // 🚶‍♂️ Extraer pasos del payload inicial
      const pasosDetectados =
        res.pasos ??
        res.pasos_hoy ??
        res.data?.pasos ??
        res.steps ??
        null;

      if (pasosDetectados !== null && !isNaN(Number(pasosDetectados))) {
        setPasosHoy(Number(pasosDetectados));
      }

      const normalizado = {
        ...res,
        cargando: estaEnCarga,
        spo2: res.spo2 ?? "—",
        presion: res.presion ?? "—",
        fc: res.fc ?? "—",
        temperatura: res.temperatura ?? "—",
        condicion_carita: res.condicion_carita ?? "—",
        dispositivoPuesto: puesto,
        sin_contacto: !puesto,
      };

      setSignosDispositivo(normalizado);
    }

    if (forzarSensado) {
      // Re-verificación táctica a los 20s
      setTimeout(async () => {
        const resReintento = await getSignosRecientes(pacienteIdTarget);
        if (resReintento?.success) {
          const estaEnCargaRe = Boolean(resReintento.cargando || resReintento.estado_contacto === 'cargando');
          
          // 🚶‍♂️ Actualizar pasos tras la lectura forzada
          const pasosRe =
            resReintento.pasos ??
            resReintento.pasos_hoy ??
            resReintento.data?.pasos ??
            resReintento.steps ??
            null;

          if (pasosRe !== null && !isNaN(Number(pasosRe))) {
            setPasosHoy(Number(pasosRe));
          }

          setSignosDispositivo({
            ...resReintento,
            cargando: estaEnCargaRe,
            dispositivoPuesto: resReintento.dispositivoPuesto !== false && !estaEnCargaRe,
          });
        }
        setCargandoSignos(false);
      }, 20000);
    }
  } catch (error) {
    console.log("⚠️ Error sincronizando signos en cuidador:", error);
    setCargandoSignos(false);
  }
};
   
useEffect(() => {
  if (vista === 'turno' && pacienteActivo?.id) {
    
    // 🧼 LIMPIEZA INMEDIATA: Evita que Jorge herede el tablero pasivo de Blanca
    setSignosDispositivo({
      success: true,
      spo2: "—",
      presion: "—",
      fc: "—",
      temperatura: "—",
      dispositivoPuesto: false
    });

    // 🔄 Función combinada de actualización
    // 🔄 Función combinada de actualización
    const actualizarTelemetriaYBateria = async () => {
      sincronizarSignosReloj(pacienteActivo.id);
      
      // 🔋 Cargar batería y ubicación
      try {
        const ubData = await getUbicacion(pacienteActivo.id);
        if (ubData?.ubicacion) {
          setUbicacion(ubData.ubicacion);
        }
      } catch (e: any) {
        // 🛡️ Si expiró la sesión, limpiamos el intervalo y dejamos actuar al auto-logout
        if (e?.message === 'UNAUTHORIZED') {
          if (interval) clearInterval(interval);
          return;
        }
        console.log("⚠️ [TELEMETRÍA] No se pudo actualizar batería/ubicación:", e?.message || e);
      }
    };

    // Ejecución inicial al cambiar de paciente/vista
    actualizarTelemetriaYBateria();
    
    // Polling cada 30 segundos
    const interval = setInterval(actualizarTelemetriaYBateria, 30000);
    
    return () => clearInterval(interval);
  }
}, [vista, pacienteActivo?.id]);
  // 📦 CARGA DE INVENTARIO DEL HOGAR AL ABRIR EL CIERRE DE TURNO
 
  useEffect(() => {
    const cargarInventarioHogar = async () => {
      if (vista === 'cierre' && pacienteActivo?.id) {
        try {
          console.log("📦 [CIERRE TURNO] Solicitando inventario para:", pacienteActivo.id);
          const res = await getInventario(pacienteActivo.id);

          const listaItems = res?.items || (Array.isArray(res) ? res : []);

          // 🎯 FILTRO CORREGIDO: Excluimos 'medicamento' para evitar doble descuento
          const soloInsumosLibres = listaItems.filter((item: any) => 
            Number(item.cantidad) > 0 && item.tipo !== 'medicamento'
          );

          console.log(`✅ [CIERRE TURNO] ${soloInsumosLibres.length} insumos libres cargados.`);
          setInventarioHogar(soloInsumosLibres);
        } catch (err) {
          console.error("❌ Error cargando inventario en cierre:", err);
        }
      }
    };

    cargarInventarioHogar();
  }, [vista, pacienteActivo?.id]);
  // ── EFECTO: REFRESCAR CONFIGURACIONES AL ENTRAR AL PACIENTE ──
  useEffect(() => {
    const refrescarDatosAlEntrar = async () => {
      if (!pacienteActivo?.id) return;
      
      try { 
        console.log("🔍 Rompiendo caché de navegación. Solicitando datos frescos al servidor...");
        
        const data = await getPacientes('entrar-paciente'); 
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
        
        // Asignamos el valor si viene del servidor, si no, se queda en limpio
        if (dataDisp && dataDisp.sensibilidad_caidas !== undefined && dataDisp.sensibilidad_caidas !== null) {
          setSensibilidadCaidas(dataDisp.sensibilidad_caidas.toString());
          console.log("⚙️ Sensibilidad cargada:", dataDisp.sensibilidad_caidas);
        } else {
          setSensibilidadCaidas(''); // 🧼 Reset si este paciente no tiene reloj configurado
        }

      } catch (err) {
        console.log("⚠️ Error sincronizando datos en segundo plano:", err);
      }
    };

    // 🧼 LIMPIEZA INMEDIATA ANTES DE LA PETICIÓN:
    // Evita el parpadeo de 3 segundos limpiando el peso y la sensibilidad vieja
    setSensibilidadCaidas(''); 
    setPeso(0); // O setPeso(0) / setPeso(null) según cómo inicialices tu estado de peso

    refrescarDatosAlEntrar();
  }, [pacienteActivo?.id, params?.refresh]);

  
  
 // ── CARGA INICIAL ──
  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        vaciarColaOffline();

        const esSwitch = params.modoSwitch === 'cuidador' || esSwitchFamiliar;
        
        // 🎯 Si viene de Switch Familiar pedimos sus familiares; si es Cuidador laboral, sus pacientes de turno
        const rolPeticion = esSwitch ? 'familiar' : 'cuidador';

        if (!esSwitch) {
          await AsyncStorage.setItem('rol_activo', 'cuidador');
        }

        const data = await getPacientes('cuidador-mount', rolPeticion);
        
        if (data?.usuario_nombre) {
          setNombreUsuario(data.usuario_nombre);
        }
        
        if (data?.patients) {
          // Si venimos con un paciente específico por params (ej. María), lo priorizamos
          const pIdObjetivo = params.pacienteId || pacienteProp?.id;
          
          const pacientesMapeados = data.patients.map((p: any) => {
            if (pIdObjetivo && String(p.id) === String(pIdObjetivo)) {
              return { 
                ...p, 
                rol_en_equipo: 'familiar_principal',
                usuarioRol: 'familiar_principal'
              };
            }
            return p;
          });
          
          setPacientes(pacientesMapeados);
        }
        
        await registrarNotificaciones().catch(err => 
          console.log("Push omitido en cuidador:", err)
        );
      } catch (e) {
        console.error('Error en carga cuidador:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [params.modoSwitch, params.pacienteId]);

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

        getPacientes('vistaInicial-turno').then(data => {
          if (data.patients) setPacientes(data.patients);
        });
      } catch (e) {
        console.error('Error parseando paciente o validando turno:', e);
        setVista('lista');
      }
    }
  }, [params.vistaInicial, params.paciente]);
  // ── EFECTO: DETECTAR REGRESO DE REGISTRO-SALUD Y LEVANTAR CONSOLA ──
    useEffect(() => {
    if (vista !== 'lista') return;
    vaciarColaOffline();
    refrescarPacientes('lista', true); // forzar al entrar a lista
  }, [vista]);

  useEffect(() => { vistaRef.current = vista; }, [vista]);

  useEffect(() => {
  yaTransicionadoRef.current = false;
}, [pacienteActivo?.id]);
useFocusEffect(
  useCallback(() => {
    if (vistaRef.current === 'lista') return;
    if (yaTransicionadoRef.current) return;

    if (pacienteActivo?.id && vistaRef.current !== 'turno') {
      console.log('🔍 [FOCUS CHECK] Validando estatus de turno para:', pacienteActivo.nombre_completo);

      // 👑 CASO FAMILIAR: No espera respuesta del servidor, entra directo
      if (esSwitchFamiliar) {
        console.log('👑 [FOCUS] Familiar Principal detectado → Forzando consola de inmediato');
        yaTransicionadoRef.current = true;
        setVista('turno');
        
        const turnoLocal = turnoActivoRef.current || {
          id: `turno-familiar-${Date.now()}`,
          paciente_id: pacienteActivo.id,
          modo: 'monitoreo_familiar',
          hora_inicio: new Date().toISOString(),
          es_local: true
        };
        
        setTurnoActivo(turnoLocal);
        turnoActivoRef.current = turnoLocal;
        cargarTurno(pacienteActivo.id).catch(() => {});
        return;
      }

      // 🩺 CASO CUIDADOR: Valida con el servidor de forma segura
      getTurnoActivo(pacienteActivo.id)
        .then((turnoData) => {
          if (vistaRef.current === 'lista') return;

          if (turnoData?.turno && vistaRef.current !== 'turno') {
            console.log('🎯 Turno activo confirmado. Transicionando a consola...');
            yaTransicionadoRef.current = true;
            setVista('turno');
            setTurnoActivo(turnoData.turno);
            turnoActivoRef.current = turnoData.turno;
            cargarTurno(pacienteActivo.id).catch((err) =>
              console.log('⚠️ Carga secundaria de turno interrumpida:', err)
            );
          }
        })
        .catch((err) => console.log('Error pasivo en focus check:', err));
    }
  }, [pacienteActivo?.id, esSwitchFamiliar])
);

const cargarTurno = async (pacienteId: string) => {
  try {
    // ⚡ PROMISE.ALL EN PARALELO (Resiliente a fallos de red)
    const [turnoData, tareasData, notasData, cierreData, alertaPesoData] = await Promise.all([
      getTurnoActivo(pacienteId).catch(() => ({ turno: null })),
      getTareasDia(pacienteId).catch(() => ({ tareas: [] })),
      getNotasTurno(pacienteId).catch(() => ({ notas: [] })),
      getUltimoCierre(pacienteId).catch(() => ({ cierre: null })),
      getAlertaPeso(pacienteId).catch(() => ({ alerta: null }))
    ]);

    if (tareasData?.sin_horario) {
      if (!esSwitchFamiliar) {
        Alert.alert(
          'Sin horario asignado',
          'El familiar principal no ha configurado tu horario de entrada ni los días habilitados.',
          [{ text: 'Entendido', onPress: () => setVista('lista') }]
        );
        return;
      } else {
        console.log("👑 Familiar Principal en Modo Monitoreo → acceso permitido (sin restricción de horario)");
      }
    }

    // 1. Turno
    if (turnoData?.turno) {
      setTurnoActivo(turnoData.turno);
      turnoActivoRef.current = turnoData.turno;
    } else if (esSwitchFamiliar && !turnoActivoRef.current) {
      // Si estamos offline y es familiar, mantenemos/creamos el turno local
      const turnoFamiliarOffline = {
        id: `turno-familiar-${Date.now()}`,
        paciente_id: pacienteId,
        modo: 'monitoreo_familiar',
        hora_inicio: new Date().toISOString()
      };
      setTurnoActivo(turnoFamiliarOffline);
      turnoActivoRef.current = turnoFamiliarOffline;
    }

    // 2. Tareas del día (Solo sobreescribe si el backend devolvió datos)
    if (tareasData?.tareas && tareasData.tareas.length > 0) {
      setTareas(tareasData.tareas);
    }

    // 3. Notas
    if (notasData?.notas && Array.isArray(notasData.notas)) {
      setNotas(notasData.notas.slice(0, 5));
    }

    // 4. Último cierre y peso
    if (cierreData?.cierre) setUltimoCierre(cierreData.cierre);
    if (alertaPesoData?.alerta) setAlertaPeso(alertaPesoData);

  } catch (err) {
    console.warn("⚠️ Error general en cargarTurno:", err);
  }
};

const resetEstados = () => {
  yaTransicionadoRef.current = false;
  setPacienteActivo(null);
  setTurnoActivo(null);
  turnoActivoRef.current = null;
  setTareas([]);
  setNotas([]);
  setUltimoCierre(null);
  setAlertaPeso(null);
  setEstadoPaciente('bien');
  setPeso(70.0);
  setDolorEva(0);
  setHidratacion(0);
  setEstadoAnimo('bien');
  setAlimentacion('bien');
  setBarthelScores(new Array(10).fill(0));
  setMorseScores(new Array(6).fill(0));
  setMnaScores(new Array(6).fill(0));
  setBarthelOpen(false);
  setMorseOpen(false);
  setMnaOpen(false);
  setBarthelTocado(false);
  setMorseTocado(false);
  setMnaTocado(false);
  setEscalaRequerida(false);
  setEscalasLista([]);
  setSensibilidadCaidas('');
};
    
  const manejarInicioTurno = async (p: any) => {
  if (esSwitchFamiliar) {
    console.log("👑 Familiar en switch → saltando validación de horario de cuidador");
  }

  if (iniciando) return;
  setIniciando(true);

  // 1. Limpieza
  setSignosDispositivo(null);

  // ───────────────────────────────────────────────
  // 🛡️ VALIDACIÓN GLOBAL DE HORARIO PARA CUIDADORES
  // ───────────────────────────────────────────────
  if (!esSwitchFamiliar) {
    try {
      const tareasCheck = await getTareasHoy(p.id);
      console.log("🧪 CHECK HORARIO:", tareasCheck);

      // A. Sin horario o días no permitidos
      if (tareasCheck?.sin_horario === true) {
        Alert.alert(
          'Sin horario asignado',
          tareasCheck.mensaje || 'El familiar principal no ha configurado tu horario ni los días habilitados.'
        );
        setIniciando(false);
        return;
      }

      // B. ⛔ Límite de horario +1h de tolerancia superado
      if (tareasCheck?.fuera_de_turno === true) {
        Alert.alert(
          'Fuera de Turno',
          tareasCheck.mensaje || 'Tu horario asignado ha concluido y el tiempo de tolerancia ha finalizado.'
        );
        setIniciando(false);
        return;
      }
    } catch (errorCheck) {
      console.error("⚠️ Error consultando check horario:", errorCheck);
    }
  }

  const tieneHardware = p.reloj_imei && p.reloj_imei.trim() !== "";

  // ───────────────────────────────────────────────
  // CASO 1: Sin reloj (como Jorge)
  // ───────────────────────────────────────────────
  if (!tieneHardware) {
    setIniciando(false);

    Alert.alert(
      'Sin Dispositivo Vinculado',
      `${p.nombre_completo} no tiene un reloj inteligente configurado. ¿Deseas iniciar el turno con captura manual de signos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Capturar Signos e Iniciar', 
          onPress: async () => {
            try {
              // 1. Iniciamos el turno en backend
              await iniciarTurno(p.id);
              console.log("✅ Turno iniciado manualmente para:", p.nombre_completo);
              
              await refrescarPacientes();

              // 2. 🎯 Redirigimos a Registro de Salud Manual (igual que Blanca)
              irARegistroSalud(p);

            } catch (err) {
              console.error("❌ Error al iniciar turno manual:", err);
              Alert.alert("Error", "No se pudo iniciar el turno. Intenta de nuevo.");
            }
          } 
        }
      ]
    );
    return;
  }

  // ───────────────────────────────────────────────
  // CASO 2: Con reloj (como Blanca)
  // ───────────────────────────────────────────────
  try {
    const cambiosData = await detectarCambiosTurno(p.id);
    if (cambiosData.changes && cambiosData.changes.length > 0) {
      setPacienteActivo(p);
      setCambiosPendientes(cambiosData.changes);
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
    params: { 
      paciente: JSON.stringify(p), 
      momento: 'inicio_turno',
      // 🎯 Solo marcamos el switch si realmente somos el Familiar Principal
      modoSwitch: esSwitchFamiliar ? 'cuidador_familiar' : 'ninguno'
    },
  });
};
const guardarRegistroEspontaneo = async () => {
  setGuardandoEspontaneo(true);
  
  // 🧹 Función auxiliar para resetear inputs y volver a la vista del turno
  const limpiarInputsYVolver = () => {
    setPresionSist('');
    setPresionDiast('');
    setFrecCard('');
    setSpo2Manual('');
    setTempManual('');
    setGlucosa('');
    setObservaciones('');
    setVista('turno');
  };

  const pesoFinal = peso && Number(peso) > 0 ? Number(peso) : null;

  const payload = {
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
    peso_kg: pesoFinal,
    observaciones: observaciones.trim() || null,
  };

  try {
    const token = await loadStoredToken();
    if (!token) throw new Error('No hay sesión activa');

    const res = await fetch(`${BASE_URL}/registros/salud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Servidor respondió con status ${res.status}`);
    }

    const data = await res.json();

    // 🔄 Recargamos notas si hay conexión
    try {
      const notasData = await getNotasTurno(pacienteActivo.id);
      if (notasData && Array.isArray(notasData.notas)) {
        setNotas(notasData.notas.slice(0, 5));
      }
    } catch (err) {
      console.log("No se pudieron refrescar notas de fondo:", err);
    }

    limpiarInputsYVolver();
    Alert.alert('✅ Registro Guardado', 'La toma manual se registró correctamente en la bitácora.');

  } catch (e: any) {
    console.warn('⚠️ Sin red al registrar salud espontánea. Guardando en cola local...', e);
    
    // 🎯 ENCOLAMIENTO OFFLINE
    try {
      await encolarPeticionOffline(
        `${BASE_URL}/registros/salud`,
        'POST',
        payload,
        `Toma manual/confort - ${pacienteActivo?.nombre_completo || 'Paciente'}`
      );

      limpiarInputsYVolver();
      Alert.alert(
        '💾 Guardado Localmente',
        'La toma se registró en este dispositivo y se enviará automáticamente cuando recuperes conexión a internet.'
      );
    } catch (queueErr) {
      console.error('❌ Error guardando en cola offline:', queueErr);
      Alert.alert('⚠️ Error', 'No se pudo registrar la toma ni guardar localmente.');
    }
  } finally {
    setGuardandoEspontaneo(false);
  }
};
  const guardarNota = async () => {
  if (!notaTexto.trim()) return;
  setGuardandoNota(true);
  
  const idTurnoActivo = turnoActivoRef.current?.id || turnoActivo?.id || null;
  const textoCapturado = notaTexto.trim();

  const payload = { 
    paciente_id: pacienteActivo.id, 
    turno_id: idTurnoActivo, 
    texto: textoCapturado 
  };

  // 🎯 1. UI OPTIMISTA INMEDIATA: La nota aparece en pantalla y el modal se cierra
  const nuevaNotaSimulada = {
    descripcion: `📝 ${textoCapturado}`,
    texto: textoCapturado,
    hora_completada: new Date().toISOString(),
    created_at: new Date().toISOString(),
    usuarios: { nombre_completo: nombreUsuario || 'Personal Vitanova' }
  };

  setNotaTexto(''); 
  setNotaOpen(false);
  setNotas((prevNotas) => {
    const notasPrevias = Array.isArray(prevNotas) ? prevNotas : [];
    return [nuevaNotaSimulada, ...notasPrevias].slice(0, 5);
  });

  // 🎯 2. INTENTO DE ENVÍO POR RED
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/notas`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Status ${response.status}`);

    // Refresco pasivo de fondo si hay red
    try {
      const notasData = await getNotasTurno(pacienteActivo.id);
      if (notasData && Array.isArray(notasData.notas) && notasData.notas.length > 0) {
        setNotas(notasData.notas.slice(0, 5));
      }
    } catch (fetchErr) {
      console.log("Refresco de fondo ignorado:", fetchErr);
    }

  } catch (e) { 
    console.warn("⚠️ Sin red al registrar nota. Encolando offline...", e);
    
    // 🎯 3. ENCOLAMIENTO OFFLINE TRANSPARENTE
    try {
      await encolarPeticionOffline(
        `${BASE_URL}/notas`,
        'POST',
        payload,
        `Nota de turno - ${textoCapturado.slice(0, 30)}...`
      );
    } catch (queueErr) {
      console.error("❌ Error guardando nota en cola offline:", queueErr);
    }
  } finally { 
    setGuardandoNota(false); 
  }
};
 const guardarTareaManual = async () => {
  if (!nuevaTareaDesc.trim() && !tareaDesc.trim()) return;
  setGuardandoTarea(true);

  const descripcionLimpia = (nuevaTareaDesc || tareaDesc).trim();
  const tipoActual = nuevaTareaTipo || tareaTipo;
  const horaActual = nuevaTareaHora || tareaHora || null;
  const idTemporal = `incidental-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const hoyISO = new Date().toISOString().split('T')[0];
  const horaProgramadaFormatted = horaActual ? `${horaActual}:00` : null;

  const payload = { 
    turno_id: turnoActivoRef.current?.id || null, 
    paciente_id: pacienteActivo.id, 
    tipo: tipoActual, 
    descripcion: descripcionLimpia, 
    hora_programada: horaProgramadaFormatted, 
    es_incidental: true,
    fecha_inicio: hoyISO,
    fecha_fin: hoyISO
  };

  // 🎯 1. UI OPTIMISTA: Insertar la tarea en la lista del turno de inmediato
  setTareas(prev => [
    ...prev, 
    { 
      id: idTemporal, 
      tipo: tipoActual, 
      descripcion: descripcionLimpia, 
      hora_programada: horaProgramadaFormatted, 
      hora: horaActual || null,
      completada: false, 
      es_incidental: true,
      fecha_inicio: hoyISO,
      fecha_fin: hoyISO
    }
  ]);

  // 🔔 2. Notificación local en el teléfono (funciona 100% offline)
  if (horaActual) {
    try {
      const tituloNotif = tipoActual.toUpperCase();
      const nombrePaciente = pacienteActivo?.nombre || pacienteActivo?.nombre_completo || '';
      await programarNotificacionTarea(
        tituloNotif, 
        descripcionLimpia, 
        horaActual, 
        nombrePaciente
      );
    } catch (notifErr) {
      console.log("No se pudo agendar notificación local:", notifErr);
    }
  }

  // 🧹 3. Limpiar formulario y cerrar modal sin trabar al cuidador
  setNuevaTareaDesc(''); 
  setTareaDesc('');
  setNuevaTareaHora(''); 
  setTareaHora('');
  setTareaOpen(false);

  // 🎯 4. INTENTO DE ENVÍO AL SERVIDOR CON FALLBACK OFFLINE
  try {
    const res = await agregarTareaManual(payload);
    
    // Si el backend responde con el ID real de Supabase, actualizamos el ID temporal
    const idReal = res?.tarea_id || res?.id;
    if (idReal) {
      setTareas(prev => prev.map(t => t.id === idTemporal ? { ...t, id: idReal } : t));
    }
  } catch (e) { 
    console.warn("⚠️ Sin conexión al guardar tarea incidental. Encolando offline...", e);
    
    // 🎯 5. ENCOLAMIENTO OFFLINE
    try {
      await encolarPeticionOffline(
        `${BASE_URL}/tareas/manual`,
        'POST',
        payload,
        `Tarea incidental: ${descripcionLimpia}`
      );
    } catch (queueErr) {
      console.error("❌ Error guardando tarea en cola offline:", queueErr);
    }
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
// ── 🧠 LÓGICA DE COMPLETADO DE TAREAS ──────────────────────────────
const handleConfirmarTarea = (t: any) => {
  if (t.completada) {
    Alert.alert('Completada', `"${t.descripcion}" ya fue registrada.`);
    return;
  }

  Alert.alert(
    'Confirmar ejecución',
    `¿Confirmas la realización de: ${t.descripcion}?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: '✓ Confirmar',
        onPress: async () => {
          // Optimistic UI update
          setTareas((prev: any[]) =>
            prev.map((item) => (item.id === t.id ? { ...item, completada: true } : item))
          );

          try {
            if (t.tipo === 'medicamento' || t.med_id) {
              const medUuid = t.med_id || String(t.id).replace(/^med_/, '').split('_')[0];
              const horaProg = t.hora_programada || t.hora || '08:00';
              const horaFormateada = horaProg.length === 5 ? `${horaProg}:00` : horaProg;

              await fetchWithAuth(`${BASE_URL}/medicamentos/completar`, {
                method: 'POST',
                body: JSON.stringify({
                  med_id: medUuid,
                  paciente_id: pacienteActivo.id,
                  descripcion: t.descripcion,
                  hora_programada: horaFormateada,
                }),
              });
            } else if (t.es_incidental) {
              await fetchWithAuth(`${BASE_URL}/tareas/${t.id}/completar`, {
                method: 'PATCH',
                body: JSON.stringify({
                  paciente_id: pacienteActivo.id,
                  completada: true,
                }),
              });
            } else {
              const idRutina = t.actividad_id || t.id;
              await fetchWithAuth(`${BASE_URL}/actividades/completar`, {
                method: 'POST',
                body: JSON.stringify({
                  actividad_id: idRutina,
                  paciente_id: pacienteActivo.id,
                }),
              });
            }
          } catch (err) {
            console.error(`❌ Error registrando ${t.descripcion}:`, err);
            // Rollback en caso de fallo
            setTareas((prev: any[]) =>
              prev.map((item) => (item.id === t.id ? { ...item, completada: false } : item))
            );
          }
        },
      },
    ]
  );
};

// ── 🏷️ BADGE DE TEMPORALIDAD ─────────────────────────────────────────
const renderTemporalidadBadge = (t: any) => {
  const hoyISO = new Date().toISOString().split('T')[0];
  const fechaTareaISO = t.fecha_inicio ? String(t.fecha_inicio).split('T')[0] : hoyISO;
  const tieneHora = Boolean(t.hora_programada || (t.hora && t.hora !== 'Incidental'));
  const esFechaFuturaODiferente = fechaTareaISO !== hoyISO;

  if (t.es_incidental) {
    const esAgendada = tieneHora || esFechaFuturaODiferente;
    return (
      <Text style={[styles.badgeText, { color: esAgendada ? '#0284C7' : '#D97706' }]}>
        {esAgendada ? '⏰ Agendada' : '⚡ Del Día'}
      </Text>
    );
  }

  if (!t.fecha_fin) {
    return <Text style={[styles.badgeText, { color: COLORS.gold }]}>♾️ Permanente</Text>;
  }

  const inicioClean = ISOaLatino(String(t.fecha_inicio));
  const finClean = ISOaLatino(String(t.fecha_fin));

  if (inicioClean === finClean) {
    return <Text style={[styles.badgeText, { color: '#64748B' }]}>📍 {inicioClean}</Text>;
  }

  return (
    <Text style={[styles.badgeText, { color: '#64748B' }]}>
      📆 {inicioClean} al {finClean}
    </Text>
  );
};
  const compartirWhatsApp = () => {
    // 🎯 1. Jerarquía de Signos Vitales (Manual si existe, si no usa Reloj)
    const valSpo2 = spo2Manual || signosDispositivo?.spo2 || '';
    
    // Presión
    let valPresion = '';
    if (presionSist && presionDiast) {
      valPresion = `${presionSist}/${presionDiast}`;
    } else if (signosDispositivo?.presion) {
      valPresion = String(signosDispositivo.presion);
    }

    const valFc = frecCard || signosDispositivo?.fc || '';
    const valTemp = tempManual || signosDispositivo?.temperatura || '';
    const valGlucosa = glucosa || '';
    const valPeso = peso && peso !== 0 ? peso : '';

    // 🎯 2. Condición y Conducta del Paciente
    const emojiEstado = estadoPaciente === 'bien' ? '🟢' : estadoPaciente === 'preocupante' ? '🔴' : '🟡';
    const textoEstado = estadoPaciente === 'bien' ? 'Estable' : estadoPaciente === 'preocupante' ? 'Delicado' : 'Regular';
    const animoTexto = estadoAnimo ? estadoAnimo.toUpperCase() : 'TRANQUILO';

    // 🎯 3. Formateo de Signos Vitales para WhatsApp
    const signosArr: string[] = [];
    if (valSpo2) signosArr.push(`• *SpO₂:* ${valSpo2}%`);
    if (valPresion) signosArr.push(`• *Presión:* ${valPresion} mmHg`);
    if (valFc) signosArr.push(`• *FC:* ${valFc} bpm`);
    if (valTemp) signosArr.push(`• *Temp:* ${valTemp} °C`);
    if (valGlucosa) signosArr.push(`• *Glucosa:* ${valGlucosa} mg/dL`);
    if (valPeso) signosArr.push(`• *Peso:* ${valPeso} kg`);

    const signosVitalesTexto = signosArr.length > 0 
      ? signosArr.join('\n') 
      : '• Signos registrados en consola digital';

    // 🎯 4. Consumo de Insumos del Turno
    const consumosMap = consumosTurno || {};
    const inventarioArr = inventarioHogar || [];
    const insumosConsumidosKeys = Object.keys(consumosMap).filter(id => consumosMap[id] > 0);
    
    const insumosTexto = insumosConsumidosKeys.length > 0
      ? insumosConsumidosKeys.map(id => {
          const item = inventarioArr.find((i: any) => i.id === id);
          return item ? `• ${item.nombre}: *${consumosMap[id]} ${item.unidad || 'piezas'}*` : null;
        }).filter(Boolean).join('\n')
      : '• Ninguno consumido';

    // 🎯 5. Parámetros de Confort (Dolor EVA, Hidratación, Alimentos)
    const vasosHidratacion = typeof hidratacion === 'number' ? hidratacion : 0;
    const alimentacionTexto = alimentacion ? alimentacion.toUpperCase() : 'COMPLETA';

    const obsTexto = (observaciones && typeof observaciones === 'string' && observaciones.trim()) 
      ? `\n📝 *OBSERVACIONES DEL CUIDADOR:*\n_"${observaciones.trim()}"_\n` 
      : '';

    // 🎯 6. Ensamblado del Mensaje Estructurado
    const mensaje = [
      `🏛️ *VITANOVA INTEGRALIS — REPORTE DE TURNO*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Paciente:* ${pacienteActivo?.nombre_completo || 'Paciente'}`,
      `📅 *Fecha/Hora:* ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} | ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      `🩺 *Condición de Entrega:* ${emojiEstado} *${textoEstado}*`,
      `🧠 *Ánimo/Conducta:* ${animoTexto}`,
      `🩹 *Dolor (EVA):* ${dolorEva}/10`,
      ``,
      `📊 *SIGNOS VITALES:*`,
      signosVitalesTexto,
      ``,
      `🥣 *NUTRICIÓN E HIDRATACIÓN:*`,
      `• *Alimentación:* ${alimentacionTexto}`,
      `• *Hidratación:* ${vasosHidratacion} de 8 vasos (${vasosHidratacion * 250} ml)`,
      ``,
      `📦 *INSUMOS USADOS EN TURNO:*`,
      insumosTexto,
      obsTexto,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Turno finalizado de forma segura.*`,
      `_Vitanova Integralis — Cuidado y Confort en Casa_`
    ].filter(Boolean).join('\n');

    // 🎯 7. Abrir WhatsApp
    const url = `whatsapp://send?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp no está disponible o instalado en este dispositivo.');
    });
  };
  // ── GESTIÓN DE RETORNO / CAMBIO DE ROL ──
const handleRegresarOpciones = async () => {
  try {
    // 1. Si está dentro de la consola del turno, primero regresar a la lista de pacientes
    if (vista !== 'lista') {
      resetEstados();
      setVista('lista');
      return;
    }

    // 2. Si venía de "Modo Cuidador" (Switch temporal desde familiar)
    if (params.modoSwitch === 'cuidador' || esSwitchFamiliar) {
      router.replace('/');
      return;
    }

    // 3. Si es usuario Multi-Rol, regresar al selector de accesos
    const rolesData = await getMisRoles();
    if (rolesData?.multi_rol) {
      await AsyncStorage.removeItem('rol_activo');
      router.replace('/selector-rol');
      return;
    }

    // 4. Si es cuidador puro en la pantalla de lista, salir a login o inicio
    router.replace('/');
  } catch (err) {
    console.error('Error al gestionar regreso en cuidador:', err);
    router.replace('/');
  }
};
  const ejecutarCierre = async () => {
  if (!pacienteActivo?.id) {
    Alert.alert('Error', 'No se detectó un paciente activo para cerrar el turno.');
    return;
  }

  // 🧹 Función auxiliar para limpiar la UI y refrescar estado
  const limpiarYSalir = async (mensajeTitulo: string, mensajeCuerpo: string) => {
    try {
      // 1. Limpiar campos clínicos del formulario
      setPresionSist('');
      setPresionDiast('');
      setFrecCard('');
      setSpo2Manual('');
      setTempManual('');
      setGlucosa('');
      setObservaciones('');
      setDolorEva(0);
      setEstadoAnimo('');
      setHidratacion(0);
      setAlimentacion('');
      setConsumosTurno({});

      // 2. 🛑 PURGAR ESTADOS Y REFERENCIAS DE TURNO ACTIVO
      setPacienteActivo(null);
      setTurnoActivo(null);
      if (turnoActivoRef) turnoActivoRef.current = null;
      resetEstados();

      // 3. 🔄 Refrescar lista de pacientes de forma tolerante (no bloqueante)
      try {
        const pData = await getPacientes('cierre-turno');
        if (pData?.patients) {
          setPacientes(pData.patients);
        }
      } catch (e) {
        console.warn("No se pudo refrescar lista tras cierre:", e);
      }

      // 4. Salir a la lista
      setVista('lista');
      Alert.alert(mensajeTitulo, mensajeCuerpo);

      if (esSwitchFamiliar || params.modoSwitch === 'familiar') {
        router.replace({
          pathname: '/' as any,
          params: { refresh: String(Date.now()) }
        });
      }
    } catch (errLimpieza) {
      console.error("Error en limpiarYSalir:", errLimpieza);
      setVista('lista');
    }
  };

  // 🎯 1. RESOLUCIÓN CLÍNICA: 100% MANUAL (Cero herencia pasiva del reloj)
  const finalSistolica = presionSist && presionSist.trim() !== '' 
    ? parseInt(presionSist.trim(), 10) 
    : null;

  const finalDiastolica = presionDiast && presionDiast.trim() !== '' 
    ? parseInt(presionDiast.trim(), 10) 
    : null;

  const finalSpo2 = spo2Manual && spo2Manual.trim() !== '' 
    ? parseInt(spo2Manual.trim(), 10) 
    : null;

  const finalFc = frecCard && frecCard.trim() !== '' 
    ? parseInt(frecCard.trim(), 10) 
    : null;

  const finalTemp = tempManual && tempManual.trim() !== '' 
    ? parseFloat(tempManual.trim()) 
    : null;

  const finalGlucosa = glucosa && String(glucosa).trim() !== '' 
    ? parseInt(String(glucosa).trim(), 10) 
    : null;

  const finalPeso = peso && String(peso).trim() !== '' && Number(peso) > 0 
    ? parseFloat(String(peso)) 
    : null;

  // 📦 2. INVENTARIO E INSUMOS CONSUMIDOS
  const insumosConsumidosArray = Object.entries(consumosTurno || {})
    .filter(([_, cant]) => (cant as number) > 0)
    .map(([itemId, cant]) => {
      const itemInfo = (inventarioHogar || []).find((inv: any) => inv.id === itemId);
      return {
        id: itemId,
        inventario_id: itemId,
        nombre: itemInfo?.nombre || 'Insumo',
        usado_hoy: cant,
        cantidad: cant,
        unidad: itemInfo?.unidad || 'piezas',
        tipo: 'insumo',
        registrado_por: typeof nombreUsuario !== 'undefined' ? nombreUsuario : 'Personal Vitanova'
      };
    });

  // 📝 3. CONSOLIDACIÓN SEGURA DE NOTAS (Con Try/Catch aislado que NUNCA tumba el cierre)
  let notasConsolidadas = "Sin notas incidentales en el turno.";
  try {
    const token = await getToken();
    const notasRes = await fetch(`${BASE_URL}/notas?paciente_id=${pacienteActivo.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (notasRes.ok) {
      const datasetNotas = await notasRes.json();
      const arrayParaFiltrar = Array.isArray(datasetNotas?.notas) 
        ? datasetNotas.notas 
        : (Array.isArray(datasetNotas?.registros) ? datasetNotas.registros : null);

      if (arrayParaFiltrar) {
        const idTurnoActual = turnoActivoRef?.current?.id || turnoActivo?.id || params.turnoId;
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
    }
  } catch (errNotas) {
    console.warn("⚠️ No se pudieron consultar notas del servidor. Usando buffer local...", errNotas);
    if (Array.isArray(notas) && notas.length > 0) {
      notasConsolidadas = notas.map((n: any) => n.descripcion || n.texto || "Nota local").join('\n');
    }
  }

  // 📦 4. PAYLOAD FINAL DEFINITIVO (Glucosa garantizada)
  const idTurnoFinal = turnoActivoRef?.current?.id || turnoActivo?.id || params.turnoId;

  const bodyPayload = {
    turno_id: idTurnoFinal, 
    paciente_id: pacienteActivo.id, 
    estado_paciente: estadoPaciente || 'bien', 
    peso_kg: finalPeso,
    spo2: finalSpo2,
    frecuencia_cardiaca: finalFc,
    presion_sistolica: finalSistolica,
    presion_diastolica: finalDiastolica,
    temperatura: finalTemp,
    glucosa: finalGlucosa, // 👈 🟢 Glucosa presente y validada
    notas: notasConsolidadas, 
    barthel_scores: barthelTocado ? barthelScores : null, 
    barthel_total: barthelTocado ? barthelTotal : null, 
    barthel_label: barthelTocado ? getBarthelLabel(barthelTotal) : null,
    dolor_eva: typeof dolorEva === 'number' ? dolorEva : 0,
    estado_animo: estadoAnimo || 'tranquilo',
    hidratacion_vasos: typeof hidratacion === 'number' ? hidratacion : 0,
    alimentacion: alimentacion || 'completa',
    observaciones: (observaciones && typeof observaciones === 'string') ? observaciones.trim() : null,
    inventario_usado: insumosConsumidosArray,
    insumos: insumosConsumidosArray,
  };

  console.log('🚀 [CIERRE] Payload listo para enviar:', JSON.stringify(bodyPayload, null, 2));

  // 5. INTENTO DE ENVÍO DIRECTO ONLINE
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/turnos/cerrar`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(bodyPayload),
    });

    console.log('📡 [CIERRE] Status HTTP recibido:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Servidor respondió HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    if (data.status === 'ok') {
      // Éxito online garantizado
      await limpiarYSalir(
        '✅ Turno Cerrado',
        'La bitácora del día se ha consolidado y los signos clínicos fueron registrados.'
      );
      return;
    } else {
      throw new Error(data.mensaje || 'Respuesta no exitosa al cerrar turno');
    }

  } catch (errEnvioOnline: any) {
    console.warn("⚠️ Falló el envío directo. Procediendo a encolamiento offline:", errEnvioOnline);

    // 6. RESPALDO EN COLA OFFLINE (Reutilizando idéntico bodyPayload, sin clones ni relojes)
    try {
      const payloadOffline = {
        ...bodyPayload,
        notas: bodyPayload.notas || "Cierre consolidado en modo offline."
      };

      await encolarPeticionOffline(
        `${BASE_URL}/turnos/cerrar`,
        'POST',
        payloadOffline,
        `Cierre de turno - ${pacienteActivo?.nombre_completo || 'Paciente'}`
      );

      await limpiarYSalir(
        '💾 Guardado Localmente',
        'El turno se cerró en el dispositivo. La información se sincronizará automáticamente al recuperar conexión a internet.'
      );
    } catch (queueErr) {
      console.error("❌ Fallo crítico al guardar en cola offline:", queueErr);
      Alert.alert('⚠️ Error', 'No se pudo registrar el cierre ni guardar localmente.');
    }
  }
};


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

 // ── 1. VISTA LISTA DE USUARIOS ──
  if (vista === 'lista') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        
        {/* HEADER PROPIO DEL CUIDADOR */}
        {!pacienteProp && (
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Bienvenido</Text>
              <Text style={styles.userName}>
                {esSwitchFamiliar
                  ? (nombreUsuario || 'Monitoreo Familiar')
                  : (nombreUsuario || 'Cuidador')}
              </Text>
            </View>

            {/* 👨‍👩‍👧 1. PUERTA CUIDADOR ➔ FAMILIAR */}
            <TouchableOpacity 
              style={[styles.notifBtn, { marginRight: 8 }]} 
              onPress={() => router.push('/perfil-paciente' as any)}
            >
              <Text style={{ fontSize: 16 }}>👨‍👩‍👧</Text>
            </TouchableOpacity>

            {/* 🔗 2. ACEPTAR INVITACIÓN */}
            <TouchableOpacity 
              style={[styles.notifBtn, { marginRight: 8 }]} 
              onPress={() => router.push('/aceptar-invitacion' as any)}
            >
              <Text style={styles.notifIcon}>🔗</Text>
            </TouchableOpacity>

            {/* 🚪 3. SALIR / CAMBIAR DE ROL */}
            <TouchableOpacity 
              style={styles.notifBtn} 
              onPress={handleRegresarOpciones}
            >
              <Text style={styles.notifIcon}>🚪</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LISTADO DE PACIENTES */}
        <ScrollView 
          style={[styles.body, pacienteProp && { marginTop: 16 }]} 
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Tus usuarios hoy</Text>
          
         {pacientes.map((p) => {
          const estadoTurno = p.estado_turno ?? 'no_iniciado';
          const turnoInfo = p.turno_info;

          // 🕒 Formatear Días y Rango Horario
          const diasTexto = turnoInfo?.dias || '';
          const horasAMPM = formatearHorarioCompletoAMPM(turnoInfo?.horas || turnoInfo?.etiqueta);
          const horarioCompleto = [diasTexto, horasAMPM].filter(Boolean).join(' · ') || 'Horario programado';

          const esMiFamiliarPropio = p.rol_en_equipo === 'familiar_principal' || 
                                     p.rol_en_equipo === 'familiar_co_admin' || 
                                     p.rol_en_equipo === 'admin';

          return (
            <View key={p.id} style={styles.pacienteCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={styles.pacienteAvatar}>
                  <Text style={styles.pacienteAvatarText}>{p.nombre_completo?.[0]}</Text>
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={styles.pacienteNombre}>{p.nombre_completo}</Text>
                  <Text style={styles.pacienteCondiciones}>
                    {p.condiciones_medicas?.join(' · ') ?? 'Sin condiciones crónicas'}
                  </Text>

                  {/* 🕒 HORARIO FIJO + BADGE INDIVIDUAL */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F5F3EF',
                      borderColor: '#E8E3D8',
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      gap: 4
                    }}>
                      <Text style={{ fontSize: 10 }}>🕒</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#6E675F' }}>
                        {horarioCompleto}
                      </Text>
                    </View>

                    {/* Badge de finalizado: se muestra solo cuando este paciente específico cerró turno */}
                    {estadoTurno === 'finalizado' && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#EAF5E8',
                        borderColor: '#C8E6C9',
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 3,
                        borderRadius: 8,
                        gap: 3
                      }}>
                        <Text style={{ fontSize: 9 }}>✓</Text>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2E7D32' }}>
                          Concluido hoy
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Badge en cabecera: SOLO si ESTE paciente en particular está en turno */}
                {estadoTurno === 'activo' && (
                  <View style={styles.badgeActivo}>
                    <View style={styles.activoDot} />
                    <Text style={styles.badgeActivoText}>En Turno</Text>
                  </View>
                )}
              </View>

              {/* 🎯 BOTÓN BASADO EXCLUSIVAMENTE EN EL ESTADO DEL TURNO */}
              {estadoTurno === 'activo' ? (
                /* 🟢 1. ÚNICAMENTE EL PACIENTE CON TURNO EN CURSO MUESTRA ABRIR CONSOLA */
                <TouchableOpacity 
                  style={[styles.iniciarBtn, { backgroundColor: '#EBF7EE', borderColor: '#2E7D32', borderWidth: 1.5, marginTop: 12 }]} 
                  onPress={() => {
                    setPacienteActivo(p); 
                    cargarTurno(p.id); 
                    setVista('turno'); 
                  }}
                >
                  <Text style={[styles.iniciarBtnText, { color: '#2E7D32', fontWeight: '800' }]}>
                    Abrir Consola de Control →
                  </Text>
                </TouchableOpacity>
              ) : (
                /* ⚪ 2. NO INICIADO O CONCLUIDO HOY */
                <TouchableOpacity 
                  style={[styles.iniciarBtn, { marginTop: 12 }]} 
                  onPress={async () => {
                    if (iniciando) return;

                    // Si es cuidador contratado y no le toca hoy, se bloquea
                    if (!esSwitchFamiliar && !esMiFamiliarPropio && turnoInfo?.es_dia_laboral === false) {
                      Alert.alert(
                        'Día no asignado',
                        `Hoy no tienes turno programado con ${p.nombre_completo}.\nTus días asignados son: ${diasTexto || 'Ninguno'}.`
                      );
                      return;
                    }

                    setIniciando(true);
                    try {
                      console.log("🩺 Iniciando sesión para:", p.nombre_completo);

                      // Si es familiar directo en switch, inicia su sesión limpia para este paciente
                      if (esSwitchFamiliar || esMiFamiliarPropio) {
                        await manejarInicioTurno({
                          ...p,
                          rol_en_equipo: 'familiar_principal',
                          usuarioRol: 'familiar_principal'
                        });
                      } else {
                        const tareasCheck = await getTareasDia(p.id);
                        if (tareasCheck?.sin_horario) {
                          Alert.alert(
                            'Sin horario asignado',
                            'Pídele al familiar principal que configure tu horario y los días en que puedes ingresar.'
                          );
                          return;
                        }

                        await manejarInicioTurno({
                          ...p,
                          rol_en_equipo: p.rol_en_equipo || 'cuidador_contratado',
                          usuarioRol: 'cuidador_contratado'
                        });
                      }

                    } catch (error) {
                      console.error("❌ Error al transicionar el turno:", error);
                    } finally {
                      setIniciando(false);
                    }
                  }} 
                  disabled={iniciando}
                >
                  <Text style={styles.iniciarBtnText}>
                    {iniciando ? 'Sincronizando...' : 'Iniciar Turno / Verificación →'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        </ScrollView>

        {/* MODAL DE CAMBIOS PENDIENTES */}
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
  // 2. VISTA CONSOLA DE TURNO ACTIVA
  if (vista === 'turno' && pacienteActivo) {
    const tareasPendientes = tareas.filter(t => !t.completada);

    return (
      <View key={pacienteActivo.id} style={{ display: 'flex', flex: 1 }}>
        
        {/* Renderizamos la barra operativa normal sin el botón extra del emoji familiar */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleRegresarOpciones}
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Consola operativa</Text>
            <Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text>
          </View>

          <View style={styles.turnoActivoPill}>
            <View style={styles.activoDot} />
            <Text style={styles.activoText}>Monitoreo</Text>
          </View>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
       {/* ⌚ 1. MÉTRICAS Y TELEMETRÍA EN VIVO (CUIDADOR) */}
{Boolean(pacienteActivo?.reloj_imei && pacienteActivo.reloj_imei.trim() !== '') && (
  <SupervisionCuidadorCard
    signosDispositivo={signosDispositivo}
    ubicacion={ubicacion}
    pacienteActivo={pacienteActivo}
    pasosHoy={pasosHoy}
    ultimoCierre={null}
    onRefreshData={async (id) => {
      await sincronizarSignosReloj(id || pacienteActivo.id, true);
    }}
  />
)}
            
{/* ACCIONES DE BITÁCORA (DURANTE EL TURNO) */}
<Text style={[styles.sectionTitle, { marginTop: 20 }]}>Acciones de bitácora</Text>
<View style={styles.accionesRow}>
  {/* Reportar Incidente */}
  <TouchableOpacity 
    style={[styles.accionBtn, { backgroundColor: COLORS.redPale, borderColor: COLORS.red }]} 
    onPress={() => setIncidenteOpen(true)}
  >
    <Text style={{ color: COLORS.red, marginRight: 6 }}>🚨</Text>
    <Text style={[styles.accionBtnText, { color: COLORS.red }]}>Reportar Incidente</Text>
  </TouchableOpacity>

  {/* Registro Manual de Signos */}
  <TouchableOpacity 
    style={[
      styles.accionBtn, 
      { 
        backgroundColor: COLORS.bluePale, 
        borderColor: COLORS.blue,
        flex: 1,
        minHeight: 46,
        paddingHorizontal: 8,
        paddingVertical: 6,
      }
    ]} 
    onPress={() => setVista('espontaneo')}
  >
    <Text style={{ fontSize: 16, marginRight: 6 }}>🩺</Text>
    <Text 
      style={[
        styles.accionBtnText, 
        { 
          color: COLORS.blue, 
          flex: 1, 
          flexShrink: 1, 
          fontSize: 11, 
          lineHeight: 14,
          textAlign: 'center'
        }
      ]}
      numberOfLines={2}
    >
      Registro Signos Vitales Manual
    </Text>
  </TouchableOpacity>
</View>

        
       {/* 🎯 ACCESOS RÁPIDOS DE CONTROL (Condicionados por UX) */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Accesos rápidos de control</Text>

        {pacienteProp || pacienteActivo?.rol_en_equipo === 'familiar_principal' || pacienteActivo?.usuarioRol === 'familiar_principal' ? (
          /* ⚡ MODO CONSOLA: Acordeón colapsable para ahorrar espacio vertical */
          <View style={{
            backgroundColor: COLORS.cream,
            borderRadius: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            overflow: 'hidden'
          }}>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setMostrarAvisoMonitoreo(!mostrarAvisoMonitoreo)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>👨‍👩‍👧</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: COLORS.textDark }}>
                  Modo de Monitoreo Activo
                </Text>
              </View>
              
              <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.gold }}>
                {mostrarAvisoMonitoreo ? '▲ Ocultar' : '▼ Info'}
              </Text>
            </TouchableOpacity>

            {mostrarAvisoMonitoreo && (
              <View style={{
                paddingHorizontal: 14,
                paddingBottom: 10,
                paddingTop: 2,
                borderTopWidth: 1,
                borderTopColor: COLORS.border,
              }}>
                <Text style={{ fontSize: 10.5, color: COLORS.textLight, textAlign: 'center', lineHeight: 15 }}>
                  Para visualizar las gráficas, el mapa de ubicación o la red de cuidadores, por favor regrese al modo familiar usando el interruptor superior.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* 👨‍👩‍👧 MODO OPERATIVO: Tarjeta Contenedora Unificada */
          <View style={{
            backgroundColor: COLORS.white,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingVertical: 12,
            paddingHorizontal: 8,
            marginBottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 2,
          }}>
            {/* 💬 Cuidadores */}
            <TouchableOpacity 
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center' }}
              onPress={() => {
                router.push({
                  pathname: '/red-cuidadores' as any,
                  params: { pacienteId: pacienteActivo?.id, pacienteNombre: pacienteActivo?.nombre_completo, isCuidador: 'true' }
                });
              }}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#ECFDF5',
                borderWidth: 1,
                borderColor: 'rgba(16, 185, 129, 0.25)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <Text style={{ fontSize: 20 }}>💬</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' }}>
                Cuidadores
              </Text>
            </TouchableOpacity>

            {/* ⚠️ Alertas */}
            <TouchableOpacity 
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center' }} 
              onPress={() => router.push({ 
                pathname: '/alertas' as any, 
                params: { 
                  pacienteId: pacienteActivo?.id, 
                  pacienteNombre: pacienteActivo?.nombre_completo,
                  rol: 'cuidador' 
                } 
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#FFFBEB',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.25)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' }}>
                Alertas
              </Text>
            </TouchableOpacity>

            {/* 📍 Ubicación (Condicionada estrictamente a la existencia del reloj) */}
            {Boolean(pacienteActivo?.reloj_imei && pacienteActivo.reloj_imei.trim() !== '') && (
              <TouchableOpacity 
                activeOpacity={0.7}
                style={{ flex: 1, alignItems: 'center' }} 
                onPress={() => router.push({
                  pathname: '/mapa' as any,
                  params: {
                    pacienteId: pacienteActivo?.id,
                    pacienteNombre: pacienteActivo?.nombre_completo,
                    miRol: 'cuidador',
                  } as any,
                })}
              >
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' }}>
                  Ubicación
                </Text>
              </TouchableOpacity>
            )}

            {/* 📊 Gráficas */}
            <TouchableOpacity 
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center' }} 
              onPress={() => router.push({
                pathname: '/grafica-signos' as any,
                params: { 
                  pacienteId: pacienteActivo?.id, 
                  pacienteNombre: pacienteActivo?.nombre_completo 
                }
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#F5F3FF',
                borderWidth: 1,
                borderColor: 'rgba(139, 92, 246, 0.25)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <Text style={{ fontSize: 20 }}>📊</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' }}>
                Gráficas
              </Text>
            </TouchableOpacity>
          </View>
        )}
{/* 📋 RELEVO CLÍNICO DEL TURNO PREVIO */}
{Boolean(pacienteActivo?.id) && (
  <TarjetaUltimoCierre 
    pacienteId={pacienteActivo.id} 
    esCuidador={true} 
  />
)}
{/* 🚨 1. TAMIZAJE PREVENTIVO / ALERTAS CLÍNICAS (CDS) */}
        {Boolean(pacienteActivo?.id) && (
          <BannerAlertasPreventivas pacienteId={pacienteActivo.id} />
        )}
{/* ========================================================== */}
{/* 📋 1. PLAN DE CUIDADOS DEL DÍA                             */}
{/* ========================================================== */}
<View style={styles.planHeaderRow}>
  <View style={styles.planTitleBadgeGroup}>
    <Text style={styles.planSectionTitle}>Plan de cuidados del día</Text>
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{tareasPendientes.length}</Text>
    </View>
  </View>
  <TouchableOpacity 
    activeOpacity={0.8} 
    style={styles.btnIncidentalModern} 
    onPress={() => setTareaOpen(true)}
  >
    <Text style={styles.btnIncidentalPlus}>+</Text>
    <Text style={styles.btnIncidentalText}>Incidental</Text>
  </TouchableOpacity>
</View>

{tareasPendientes.map((t) => {
  const horaOriginal = t.hora_programada || (t.hora !== 'Incidental' ? t.hora : null);
  const horaTexto = horaOriginal
    ? formatearHoraBonita(horaOriginal)
    : (t.fecha_inicio ? ISOaLatino(String(t.fecha_inicio)) : 'Sin hora');

  const subtituloDosis = [t.dosis, t.via_administracion].filter(Boolean).join(' · ');
  const indicacionVisible = t.indicaciones || t.instrucciones || (!t.es_incidental ? t.notas : null);

  return (
    <View 
      key={t.id} 
      style={[styles.careCard, t.completada && styles.careCardCompleted]}
    >
      <View style={styles.careCardBody}>
        {/* Icono de tipo con burbuja suave */}
        <View style={[styles.iconContainer, t.completada && styles.iconContainerCompleted]}>
          <Text style={styles.iconEmoji}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>
        </View>

        {/* Información central */}
        <View style={styles.cardContent}>
          <Text 
            style={[styles.taskTitle, t.completada && styles.taskTitleCompleted]}
            numberOfLines={2}
          >
            {t.descripcion}
          </Text>

          {Boolean(subtituloDosis) && (
            <Text style={styles.taskDosageText}>{subtituloDosis}</Text>
          )}

          {/* Fila de metadatos: Hora + Badge de frecuencia */}
          <View style={styles.metaRow}>
            <View style={styles.timeTag}>
              <Text style={styles.timeIcon}>🕒</Text>
              <Text style={styles.timeText}>{horaTexto}</Text>
            </View>
            <View style={styles.recurrencePill}>
              {renderTemporalidadBadge(t)}
            </View>
          </View>

          {/* Indicaciones médicas / notas */}
          {Boolean(indicacionVisible) && (
            <View style={styles.instructionsCallout}>
              <Text style={styles.bulbIcon}>💡</Text>
              <Text style={styles.instructionsText} numberOfLines={2}>
                {indicacionVisible}
              </Text>
            </View>
          )}
        </View>

        {/* Acciones del extremo derecho: Info y Check */}
        <View style={styles.actionsColumn}>
          <TouchableOpacity
            style={styles.modernInfoButton}
            activeOpacity={0.7}
            onPress={() => setItemSeleccionadoDetalle(t)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.modernInfoText}>ℹ️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.touchableCheckArea, t.completada && styles.checkAreaCompleted]}
            activeOpacity={0.7}
            onPress={() => handleConfirmarTarea(t)}
          >
            {t.completada ? (
              <Text style={styles.checkmarkSymbol}>✓</Text>
            ) : (
              <View style={styles.emptyCheckHole} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
})}
         
         {/* ========================================================== */}
{/* 📝 NOTAS DEL CUIDADOR (SOLO OBSERVACIONES HUMANAS)        */}
{/* ========================================================== */}
{(() => {
  // 🧹 1. FILTRADO: Excluimos cualquier log de toma de constantes
  const notasSoloTexto = (notas || []).filter((n) => {
    const raw = String(n?.descripcion || n?.texto || '').trim();
    return !raw.includes('[TOMA MANUAL ESPONTÁNEA]');
  });

  const hayNotas = notasSoloTexto.length > 0;
  const notasAMostrar = notasExpandidas ? notasSoloTexto.slice(0, 5) : notasSoloTexto.slice(0, 1);

  return (
    <>
      {/* CABECERA: Título, contador de notas, botón +Nota y acordeón */}
      <View style={styles.notasHeaderRow}>
        <View style={styles.notasTitleGroup}>
          <Text style={styles.sectionTitle}>Notas del Cuidador</Text>
          {hayNotas && (
            <View style={styles.notasCountBadge}>
              <Text style={styles.notasCountText}>{notasSoloTexto.length}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Botón rápido para registrar nota manual */}
          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.iniciarBtn, { 
              paddingHorizontal: 12, 
              paddingVertical: 5, 
              borderRadius: 16,
              marginBottom: 0,
            }]} 
            onPress={() => setNotaOpen(true)}
          >
            <Text style={[styles.iniciarBtnText, { fontSize: 11, fontWeight: '800' }]}>
              + Nota
            </Text>
          </TouchableOpacity>

          {/* Acordeón táctil */}
          {notasSoloTexto.length > 1 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setNotasExpandidas(!notasExpandidas)}
              style={styles.acordeonBtnPill}
            >
              <Text style={styles.acordeonBtnText}>
                {notasExpandidas ? 'Ver menos' : `Historial (+${notasSoloTexto.length - 1})`}
              </Text>
              <Text style={styles.acordeonChevron}>{notasExpandidas ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LISTA DE NOTAS HUMANAS O ESTADO VACÍO */}
      {hayNotas ? (
        <View style={styles.notasListContainer}>
          {notasAMostrar.map((n, i) => {
            const rawTexto = String(n?.descripcion || n?.texto || '').trim();
            const textoLimpio = rawTexto.replace(/^📝\s*/, '').trim();
            
            const autor = 
              n?.usuarios?.nombre_completo || 
              (Array.isArray(n?.usuarios) && n?.usuarios[0]?.nombre_completo) ||
              n?.nombre_cuidador || 
              'Personal Vitanova';

            const fechaRaw = n?.created_at || n?.hora_completada;
            const fechaTexto = fechaRaw
              ? new Date(fechaRaw).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <View key={n?.id || i} style={styles.notaCard}>
                <View style={styles.notaStripe} />

                <View style={styles.notaBody}>
                  <View style={styles.notaIconBubble}>
                    <Text style={styles.notaIconText}>✍️</Text>
                  </View>

                  <View style={styles.notaContentCol}>
                    <Text style={styles.notaTextoPrincipal}>
                      {textoLimpio}
                    </Text>

                    <View style={styles.notaMetaRow}>
                      <Text style={styles.notaAutor}>{autor}</Text>
                      {Boolean(fechaTexto) && (
                        <>
                          <Text style={styles.notaSeparador}>•</Text>
                          <Text style={styles.notaFecha}>{fechaTexto}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.notaEmptyCard}>
          <View style={styles.notaEmptyIconCircle}>
            <Text style={{ fontSize: 16 }}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notaEmptyTitle}>Sin notas en el turno actual</Text>
            <Text style={styles.notaEmptySub}>
              Los cuidadores no han reportado novedades u observaciones recientes.
            </Text>
          </View>
        </View>
      )}
    </>
  );
})()}
{/* 🎛️ 2. TARJETA CONFIGURACIÓN DEL RELOJ (CUIDADOR) */}
{Boolean(pacienteActivo?.reloj_imei && pacienteActivo.reloj_imei.trim() !== '') &&
  Boolean(signosDispositivo?.reloj_config) && (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setModalConfigCuidadorVisible(true)}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 14,
        marginTop: 8,
        marginBottom: 12,
        alignSelf: 'stretch',
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 22 }}>{'⚙️'}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: COLORS.textDark,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Configuración del reloj
        </Text>

        {/* Estado del Detector de Caídas */}
        <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>
          {(() => {
            const config = signosDispositivo?.reloj_config;
            if (!config?.caida_activa) return 'Detector de caídas: ⭕ Desactivado';

            const sens = Number(config?.sensibilidad ?? config?.sensibilidad_caidas);
            switch (sens) {
              case 1: return 'Detector de caídas: 🔴 Muy Alta (1)';
              case 2: return 'Detector de caídas: 🟠 Alta (2)';
              case 3: return 'Detector de caídas: 🟡 Media (3)';
              case 4: return 'Detector de caídas: 🟢 Estándar (4)';
              case 5: return 'Detector de caídas: 🔵 Baja (5)';
              case 6: return 'Detector de caídas: ⚪ Mínima (6)';
              default: return 'Detector de caídas: 🟢 Estándar (4)';
            }
          })()}
        </Text>

        {/* Última Sincronización */}
        <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 2 }}>
          {(() => {
            const uc = signosDispositivo?.reloj_config?.ultima_configuracion;
            if (!uc) return 'Última sincronización: Sin registro aún';
            try {
              const fecha = new Date(uc);
              if (isNaN(fecha.getTime())) return 'Última sincronización: Sin registro aún';
              return `Última sincronización: ${fecha.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}`;
            } catch {
              return 'Última sincronización: Sin registro aún';
            }
          })()}
        </Text>
      </View>

      {/* Botón Ajustar */}
      <View
        style={{
          backgroundColor: COLORS.goldPale,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(191, 154, 64, 0.3)',
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.gold }}>
          Ajustar
        </Text>
      </View>
    </TouchableOpacity>
)}
 {/* 🏁 FINALIZACIÓN DE JORNADA (AL FONDO DE LA PANTALLA) */}
<View style={{ marginTop: 24, marginBottom: 8, alignSelf: 'stretch' }}>
  <TouchableOpacity 
    style={styles.cerrarBtn} 
    activeOpacity={0.85}
    onPress={async () => {
      const verif = await verificarEscalas(pacienteActivo.id);
      setEscalaRequerida(verif.requiere_escalas);
      setEscalasLista(verif.escalas ?? []);
      setVista('cierre');
    }}
  >
    <Text style={styles.cerrarBtnText}>Proceder a Cierre de Turno →</Text>
  </TouchableOpacity>
</View>

{/* Espaciador final para que la barra inferior no tape el botón */}
<View style={{ height: 60 }} />         
          
        </ScrollView>
         
        {/* MODAL TAREAS INCIDENTALES */}
        <Modal
  animationType="slide"
  transparent={true}
  visible={tareaOpen}
  onRequestClose={() => setTareaOpen(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <Text style={styles.modalTitle}>➕ Nueva Actividad / Cita</Text>

      {/* Descripción / Nombre */}
      <Text style={styles.inputLabel}>Descripción / Nombre</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Cita con Cardiólogo, Comprar medicina..."
        value={nuevaTareaDesc}
        onChangeText={setNuevaTareaDesc}
      />

      {/* Selector de Categoría */}
      <Text style={styles.inputLabel}>Categoría</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15, flexWrap: 'wrap' }}>
        {['alimentacion', 'cuidado', 'medica', 'otro'].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chipCat, nuevaTareaTipo === cat && styles.chipCatSelected]}
            onPress={() => setNuevaTareaTipo(cat)}
          >
            <Text style={[styles.chipCatText, nuevaTareaTipo === cat && styles.chipCatTextSelected]}>
              {cat.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 🕐 SELECTOR ÚNICO DE HORA (OPCIONAL) */}
      <View style={{ marginBottom: 15 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.inputLabel}>Hora (Opcional)</Text>
          {nuevaTareaHora ? (
            <TouchableOpacity onPress={() => setNuevaTareaHora('')}>
              <Text style={{ fontSize: 11, color: COLORS.red || '#EF4444', fontWeight: '600' }}>Borrar hora</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={{
            borderWidth: 1,
            borderColor: COLORS.border || '#E2E8F0',
            borderRadius: 8,
            padding: 12,
            backgroundColor: nuevaTareaHora ? (COLORS.white || '#FFFFFF') : '#F8FAFC',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 4,
          }}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: nuevaTareaHora ? (COLORS.cacao || '#1E293B') : '#94A3B8' }}>
            {nuevaTareaHora ? `🕐 ${nuevaTareaHora} hrs` : '⚡ Sin hora específica (Para hoy)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 🕐 DATETIMEPICKER DE HORA */}
      {showTimePicker && (
        <DateTimePicker
          value={(() => {
            const partes = (nuevaTareaHora || '12:00').split(':').map(Number);
            const d = new Date();
            d.setHours(partes[0] || 12, partes[1] || 0, 0, 0);
            return d;
          })()}
          mode="time"
          is24Hour={true}
          display="spinner"
          onChange={onHoraChange}
        />
      )}

      {/* BOTONES DE ACCIÓN */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
        <TouchableOpacity
          style={styles.btnSecundario}
          onPress={() => {
            setTareaOpen(false);
            setNuevaTareaDesc('');
            setNuevaTareaHora('');
          }}
        >
          <Text style={styles.btnSecundarioTexto}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnPrimario}
          disabled={guardandoTarea}
          onPress={guardarTareaManual}
        >
          <Text style={styles.btnPrimarioTexto}>
            {guardandoTarea ? 'Guardando...' : 'Guardar Tarea'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  </View>
</Modal>
{/* 🎛️ MODAL OPERATIVO DE HARDWARE (CUIDADOR) */}
      <Modal
        visible={modalConfigCuidadorVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalConfigCuidadorVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(43, 35, 29, 0.65)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: Platform.OS === 'android' ? 32 : 40,
            maxHeight: '88%',
          }}>
            
            {/* Header del Modal */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>⚙️</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.cacao, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Ajustes Operativos: {pacienteActivo?.nombre_completo?.split(' ')[0] ?? 'Paciente'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setModalConfigCuidadorVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              
              {/* 🟢 SECCIÓN 1: COMANDOS OPERATIVOS */}
              <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                Comandos de Soporte
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {/* Hacer Sonar */}
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: COLORS.cacao,
                    borderRadius: 10,
                    paddingVertical: 12,
                    gap: 6,
                  }}
                  disabled={ejecutandoCmd !== null}
                  onPress={() => ejecutarComandoCuidador('FIND')}
                >
                  {ejecutandoCmd === 'FIND' ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="volume-high-outline" size={16} color={COLORS.gold} />
                      <Text style={{ color: COLORS.white, fontSize: 11, fontWeight: '800' }}>Hacer Sonar</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Activar Pasos */}
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: COLORS.cream,
                    borderRadius: 10,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    gap: 6,
                  }}
                  disabled={ejecutandoCmd !== null}
                  onPress={() => ejecutarComandoCuidador('PEDO', '1')}
                >
                  {ejecutandoCmd === 'PEDO' ? (
                    <ActivityIndicator color={COLORS.cacao} size="small" />
                  ) : (
                    <>
                      <Ionicons name="footsteps-outline" size={16} color={COLORS.cacao} />
                      <Text style={{ color: COLORS.cacao, fontSize: 11, fontWeight: '800' }}>Activar Pasos</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Reiniciar Reloj */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.goldPale,
                  borderRadius: 10,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(191, 154, 64, 0.25)',
                  gap: 6,
                  marginBottom: 20,
                }}
                disabled={ejecutandoCmd !== null}
                onPress={confirmarReinicioCuidador}
              >
                {ejecutandoCmd === 'RESET' ? (
                  <ActivityIndicator color={COLORS.gold} size="small" />
                ) : (
                  <>
                    <Ionicons name="reload-outline" size={16} color={COLORS.gold} />
                    <Text style={{ color: COLORS.cacao, fontSize: 12, fontWeight: '800' }}>Reiniciar Dispositivo</Text>
                  </>
                )}
              </TouchableOpacity>


              {/* 🛡️ SECCIÓN 2: NIVEL DE SENSIBILIDAD ACTIVO (SOLO LECTURA ULTRA-COMPACTA) */}
              <View style={{
                backgroundColor: COLORS.cream,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                  Detector de Caídas
                </Text>

                {(() => {
                  const config = signosDispositivo?.reloj_config;
                  const activo = Boolean(config?.caida_activa);
                  const sens = Number(config?.sensibilidad ?? config?.sensibilidad_caidas ?? 4);

                  const niveles: Record<number, { dot: string; label: string; desc: string }> = {
                    1: { dot: '🔴', label: 'Muy Alta (1)', desc: 'Mínimo movimiento' },
                    2: { dot: '🟠', label: 'Alta (2)', desc: 'Para adulto mayor muy frágil' },
                    3: { dot: '🟡', label: 'Media (3)', desc: 'Sensibilidad balanceada' },
                    4: { dot: '🟢', label: 'Estándar (4)', desc: 'Uso diario regular' },
                    5: { dot: '🔵', label: 'Baja (5)', desc: 'Requiere impacto moderado' },
                    6: { dot: '⚪', label: 'Mínima (6)', desc: 'Solo impactos severos' },
                  };

                  const actual = niveles[sens] || niveles[4];

                  return (
                    <View style={{
                      backgroundColor: COLORS.white,
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      {/* Bolita de color del nivel */}
                      <View style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: activo ? COLORS.cacao : COLORS.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: activo ? COLORS.gold : 'transparent',
                      }}>
                        <Text style={{ fontSize: 16 }}>{activo ? actual.dot : '⭕'}</Text>
                      </View>

                      {/* Información de estado */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textDark }}>
                            {activo ? `Sensibilidad: ${actual.label}` : 'Sensor Desactivado'}
                          </Text>
                          {activo && (
                            <View style={{ backgroundColor: COLORS.goldPale, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 8, fontWeight: '900', color: COLORS.gold }}>FAMILIAR</Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>
                          {activo ? actual.desc : 'Configurado desde la consola familiar'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Botón Cerrar */}
              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.cream,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  marginBottom: 10,
                }}
                onPress={() => setModalConfigCuidadorVisible(false)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textDark }}>Cerrar</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />

            </ScrollView>
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
       {/* Médico tratante */}
        {pacienteActivo?.telefono_medico && (
          <TouchableOpacity 
            style={{ backgroundColor: '#F0F8FF', borderWidth: 1, borderColor: '#4A90D9', padding: 14, borderRadius: 10 }} 
            onPress={() => { 
              registrarIncidente("Médico tratante", "consulta"); 
              setIncidenteOpen(false); 
              Linking.openURL(`tel:${pacienteActivo.telefono_medico}`); 
            }}
          >
            <Text style={{ fontWeight: '700', color: '#4A90D9', textAlign: 'center' }}>
              {`👨‍⚕️ ${pacienteActivo.medico_tratante ?? 'Médico'} (${pacienteActivo.telefono_medico})`}
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

       {/* MODAL ADICIONAR NOTA CON DICTADO POR VOZ */}
        <Modal visible={notaOpen} animationType="fade" transparent={true}>
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 }}>
            <View
              style={{
                backgroundColor: COLORS.white,
                padding: 22,
                borderRadius: 20,
                gap: 16,
                borderWidth: 1,
                borderColor: '#ECE7DF',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 5,
              }}
            >
              {/* Cabecera Clínica */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: COLORS.cacao,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Agregar Observación Clínica
                </Text>
              </View>

              {/* Entrada con Dictado por Voz IA integrado */}
              <DictadoVozInput
                label="Descripción de la nota"
                placeholder="Describe eventos, estado de ánimo, cambios o indicaciones..."
                value={notaTexto}
                onChangeText={setNotaTexto}
                minHeight={90}
              />

              {/* Botones de Acción */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => {
                    setNotaTexto('');
                    setNotaOpen(false);
                  }}
                  disabled={guardandoNota}
                  style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: COLORS.textLight, fontSize: 12, fontWeight: '700' }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={guardarNota}
                  disabled={guardandoNota || !notaTexto.trim()}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: !notaTexto.trim() ? '#E2E8F0' : COLORS.gold,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 12,
                    shadowColor: COLORS.gold,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: !notaTexto.trim() ? 0 : 0.25,
                    shadowRadius: 5,
                    elevation: !notaTexto.trim() ? 0 : 2,
                  }}
                >
                  <Text
                    style={{
                      color: !notaTexto.trim() ? '#94A3B8' : COLORS.cacao,
                      fontSize: 12,
                      fontWeight: '800',
                      letterSpacing: 0.3,
                    }}
                  >
                    {guardandoNota ? 'Guardando...' : 'Guardar Nota'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
     

}

  // ── 3. VISTA MONITOREO ESPONTÁNEO (DISEÑO PREMIUM ESTANDARIZADO) ──
  if (vista === 'espontaneo') {
    return (
      <View style={styles.espontaneoContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        
        {/* ENCABEZADO ESTANDARIZADO CON DORADOS */}
        <View style={styles.espontaneoHeader}>
          <TouchableOpacity 
            onPress={() => setVista('turno')} 
            style={styles.espontaneoBackBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.espontaneoBackIcon}>←</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.espontaneoTagline}>REGISTRO ESPONTÁNEO</Text>
            <Text style={styles.espontaneoTitle} numberOfLines={1}>Captura Manual de Signos</Text>
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>MANUAL</Text>
          </View>
        </View>

        <ScrollView style={styles.espontaneoBody} showsVerticalScrollIndicator={false}>
          
          {/* MÓDULO 1: SIGNOS VITALES PRINCIPALES */}
          <View style={styles.cardModulo}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>🩺 Presión Arterial y Oxigenación</Text>
            </View>

            {/* PRESIÓN ARTERIAL */}
            <Text style={styles.fieldLabel}>Presión Arterial (Sistólica / Diastólica)</Text>
            <View style={styles.paRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.inputCentradoGrande}
                  placeholder="120"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={presionSist}
                  onChangeText={setPresionSist}
                />
                <Text style={styles.inputSubLabel}>Sistólica (mmHg)</Text>
              </View>
              
              <Text style={styles.paSeparator}>/</Text>
              
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.inputCentradoGrande}
                  placeholder="80"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={presionDiast}
                  onChangeText={setPresionDiast}
                />
                <Text style={styles.inputSubLabel}>Diastólica (mmHg)</Text>
              </View>
            </View>

            {/* SPO2 Y PULSO */}
            <View style={styles.gridDosColumnas}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>SpO₂ Oxígeno</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.inputClean}
                    placeholder="98"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={spo2Manual}
                    onChangeText={setSpo2Manual}
                  />
                  <Text style={styles.suffixText}>%</Text>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Pulso Cardiaco</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.inputClean}
                    placeholder="72"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={frecCard}
                    onChangeText={setFrecCard}
                  />
                  <Text style={styles.suffixText}>bpm</Text>
                </View>
              </View>
            </View>
          </View>

          {/* MÓDULO 2: BIOMETRÍA Y TEMPERATURA */}
          <View style={styles.cardModulo}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>🌡️ Temperatura, Glucosa y Peso</Text>
            </View>

            <View style={styles.gridDosColumnas}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Temperatura</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.inputClean}
                    placeholder="36.5"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={tempManual}
                    onChangeText={setTempManual}
                  />
                  <Text style={styles.suffixText}>°C</Text>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Glucosa Capilar</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.inputClean}
                    placeholder="95"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={glucosa}
                    onChangeText={setGlucosa}
                  />
                  <Text style={styles.suffixText}>mg/dL</Text>
                </View>
              </View>
            </View>

            {/* PESO */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Peso Corporal</Text>
            <View style={styles.inputWithSuffix}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>⚖️</Text>
              <TextInput
                style={styles.inputClean}
                placeholder="70.5"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={peso === 0 ? '' : peso.toString()}
                onChangeText={(val) => {
                  const textoLimpio = val.replace(',', '.');
                  if (textoLimpio === '') { setPeso(0); return; }
                  if (textoLimpio.endsWith('.')) { const num = parseFloat(textoLimpio); if (!isNaN(num)) setPeso(num); return; }
                  const num = parseFloat(textoLimpio);
                  if (!isNaN(num)) setPeso(num);
                }}
              />
              <Text style={styles.suffixText}>kg</Text>
            </View>
          </View>

          {/* MÓDULO 3: NOTAS DE OBSERVACIÓN CON DICTADO POR VOZ */}
          <View style={styles.cardModulo}>
            <DictadoVozInput
              label="Notas y Contexto de la Toma"
              placeholder="Ej. Paciente en reposo tras consumir alimentos..."
              value={observaciones}
              onChangeText={setObservaciones}
              minHeight={80}
            />
          </View>

          {/* BOTONES Y ACCIONES (CON MARGEN INFERIOR DE SEGURIDAD) */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.btnGuardarPro}
              onPress={guardarRegistroEspontaneo}
              disabled={guardandoEspontaneo}
              activeOpacity={0.8}
            >
              {guardandoEspontaneo ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.btnGuardarProText}>💾 Guardar Medición Clínica</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnCancelarPro}
              onPress={() => setVista('turno')}
              activeOpacity={0.6}
            >
              <Text style={styles.btnCancelarProText}>Cancelar y Volver</Text>
            </TouchableOpacity>
          </View>

          

          {/* 🎯 MARGEN DE RESGUARDO PARA BOTONES DE NAVEGACIÓN ANDROID */}
          <View style={{ height: 60 }} />

         
        </ScrollView>
      </View>
      
    );
  }
// ── 4. VISTA CIERRE DE TURNO (DISEÑO PRO & DESPLEGABLE) ──
  if (vista === 'cierre' && pacienteActivo) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        
        {/* ENCABEZADO ESTANDARIZADO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('turno')} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>CIERRE DE OPERACIONES</Text>
            <Text style={styles.userName} numberOfLines={1}>{pacienteActivo.nombre_completo}</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

            {/* 1. CONDICIÓN DE ENTREGA (3 OPCIONES CLINICAS) */}
            <Text style={styles.sectionTitle}>Condición de Entrega del Paciente</Text>
            <View style={styles.estadoRow}>
              {[
                { val: 'bien', icon: '😊', label: 'Estable' },
                { val: 'regular', icon: '😐', label: 'Regular' },
                { val: 'preocupante', icon: '😟', label: 'Delicado' }
              ].map((e) => (
                <TouchableOpacity 
                  key={e.val} 
                  style={[styles.estadoCard, estadoPaciente === e.val && styles.estadoCardActive]} 
                  onPress={() => setEstadoPaciente(e.val)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 24 }}>{e.icon}</Text>
                  <Text style={[styles.estadoLabel, estadoPaciente === e.val && { color: COLORS.gold }]}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 2. 🩺 SIGNOS VITALES DE CIERRE (CAPTURA MANUAL CLÍNICA) */}
<View style={{ backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, padding: 14 }}>
  
  {/* CABECERA DIRECTA */}
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.cacao }}>
        🩺 Signos Vitales de Cierre
      </Text>
      <View style={{ backgroundColor: COLORS.greenPale, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.green }}>
          📝 Toma Manual
        </Text>
      </View>
    </View>
  </View>

  <Text style={{ fontSize: 10, color: COLORS.textLight, marginBottom: 12 }}>
    Ingresa las constantes vitales tomadas antes de finalizar el turno (deja en blanco los que no se hayan medido):
  </Text>

  {/* PRESIÓN ARTERIAL */}
  <Text style={styles.fieldLabel}>PRESIÓN ARTERIAL (mmHg)</Text>
  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
    <TextInput
      style={[styles.inputCentradoGrande, { flex: 1, paddingHorizontal: 4 }]}
      placeholder="Sistólica (ej. 120)"
      placeholderTextColor={COLORS.textLight}
      keyboardType="numeric"
      value={presionSist}
      onChangeText={setPresionSist}
    />
    <Text style={{ fontWeight: '700', color: COLORS.textLight, fontSize: 18 }}>/</Text>
    <TextInput
      style={[styles.inputCentradoGrande, { flex: 1, paddingHorizontal: 4 }]}
      placeholder="Diastólica (ej. 80)"
      placeholderTextColor={COLORS.textLight}
      keyboardType="numeric"
      value={presionDiast}
      onChangeText={setPresionDiast}
    />
  </View>

  {/* SPO2 Y PULSO */}
  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>SpO₂ (%)</Text>
      <TextInput
        style={styles.inputCentradoGrande}
        placeholder="Ej. 98"
        placeholderTextColor={COLORS.textLight}
        keyboardType="numeric"
        value={spo2Manual}
        onChangeText={setSpo2Manual}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>PULSO (bpm)</Text>
      <TextInput
        style={styles.inputCentradoGrande}
        placeholder="Ej. 72"
        placeholderTextColor={COLORS.textLight}
        keyboardType="numeric"
        value={frecCard}
        onChangeText={setFrecCard}
      />
    </View>
  </View>

  {/* TEMPERATURA Y GLUCOSA */}
  <View style={{ flexDirection: 'row', gap: 10 }}>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>TEMP (°C)</Text>
      <TextInput
        style={styles.inputCentradoGrande}
        placeholder="Ej. 36.5"
        placeholderTextColor={COLORS.textLight}
        keyboardType="numeric"
        value={tempManual}
        onChangeText={setTempManual}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>GLUCOSA (mg/dL)</Text>
      <TextInput
        style={styles.inputCentradoGrande}
        placeholder="Ej. 95"
        placeholderTextColor={COLORS.textLight}
        keyboardType="numeric"
        value={glucosa}
        onChangeText={setGlucosa}
      />
    </View>
  </View>
</View>

{/* 3. PESO CORPORAL */}
<Text style={styles.sectionTitle}>Peso del paciente (kg)</Text>
<View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, marginBottom: 16 }}>
  <Text style={{ fontSize: 18, marginRight: 8 }}>⚖️</Text>
  <TextInput
    style={{ flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textDark, paddingVertical: 12 }}
    placeholder="Ej. 70.5"
    placeholderTextColor={COLORS.textLight}
    keyboardType="numeric"
    value={peso === 0 ? '' : peso.toString()}
    onChangeText={(val) => {
      const textoLimpio = val.replace(',', '.');
      if (textoLimpio === '') { setPeso(0); return; }
      if (textoLimpio.endsWith('.')) { const num = parseFloat(textoLimpio); if (!isNaN(num)) setPeso(num); return; }
      const num = parseFloat(textoLimpio);
      if (!isNaN(num)) setPeso(num);
    }}
  />
  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textLight }}>kg</Text>
</View>

            {/* 4. 🔴 INTENSIDAD DEL DOLOR (ESCALA EVA MEJORADA) */}
            <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>{`Intensidad del Dolor (Escala EVA): ${dolorEva}/10`}</Text>
              <Text style={{ fontSize: 10, color: COLORS.textLight, marginBottom: 12 }}>
                0 = Sin dolor | 1-3 = Leve | 4-6 = Moderado | 7-10 = Severo
              </Text>
              
              {/* 🎯 GRID EQUILIBRADO: Distribución responsiva */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                  let activeBg = COLORS.greenPale;
                  let activeColor = COLORS.green;
                  if (n >= 4 && n <= 6) { activeBg = COLORS.amberPale; activeColor = COLORS.amber; }
                  if (n >= 7) { activeBg = COLORS.redPale; activeColor = COLORS.red; }

                  const esSeleccionado = dolorEva === n;

                  return (
                    <TouchableOpacity
                      key={n}
                      style={{
                        width: 36, 
                        height: 36, 
                        borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: esSeleccionado ? activeColor : COLORS.border,
                        backgroundColor: esSeleccionado ? activeBg : COLORS.cream,
                        justifyContent: 'center', 
                        alignItems: 'center'
                      }}
                      onPress={() => setDolorEva(n)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: esSeleccionado ? activeColor : COLORS.textDark }}>
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. 🧠 ESTADO CONDUCTUAL Y ÁNIMO */}
            <Text style={styles.sectionTitle}>Estado de ánimo / Conducta</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[
                { val: 'tranquilo', icon: '😌', label: 'Tranquilo' },
                { val: 'alegre', icon: '😊', label: 'Alegre' },
                { val: 'ansioso', icon: '😰', label: 'Ansioso' },
                { val: 'triste', icon: '😢', label: 'Triste' },
                { val: 'agitado', icon: '😤', label: 'Agitado' },
                { val: 'confundido', icon: '😵', label: 'Confundido' },
                { val: 'somnoliento', icon: '😴', label: 'Somnoliento' },
              ].map(e => (
                <TouchableOpacity
                  key={e.val}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
                    borderWidth: 1,
                    borderColor: estadoAnimo === e.val ? COLORS.gold : COLORS.border,
                    backgroundColor: estadoAnimo === e.val ? COLORS.goldPale : COLORS.white,
                  }}
                  onPress={() => setEstadoAnimo(e.val)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: estadoAnimo === e.val ? COLORS.gold : COLORS.textDark }}>
                    {`${e.icon} ${e.label}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 6. 💧 HIDRATACIÓN (APORTE EN VASOS) */}
            <Text style={styles.sectionTitle}>{`Hidratación: ${hidratacion} de 8 vasos (${(hidratacion * 250)} ml)`}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: COLORS.white, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setHidratacion(hidratacion === n ? 0 : n)}
                  style={{ alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 22, opacity: hidratacion >= n ? 1 : 0.2 }}>💧</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 7. 🥗 APORTE NUTRICIONAL */}
            <Text style={styles.sectionTitle}>Ingesta de Alimentos</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {[
                { val: 'completa', label: '🍽️ Completa' },
                { val: 'parcial', label: '🥣 Parcial' },
                { val: 'ninguna', label: '❌ Nula' }, // 👈 El valor 'ninguna' empata con la alerta RED
              ].map(a => (
                <TouchableOpacity
                  key={a.val}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10,
                    borderWidth: 1,
                    borderColor: alimentacion === a.val ? COLORS.green : COLORS.border,
                    backgroundColor: alimentacion === a.val ? COLORS.greenPale : COLORS.white,
                    alignItems: 'center'
                  }}
                  onPress={() => setAlimentacion(a.val)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11, color: alimentacion === a.val ? COLORS.green : COLORS.textDark, fontWeight: '700', textAlign: 'center' }}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 8. 📦 INSUMOS Y EQUIPOS DEL HOGAR */}
            {(() => {
              const lista = inventarioHogar || [];
              
              // 🎯 FILTRADO INTELIGENTE Y BLINDADO
              // Identifica activos por es_consumible, tipo O por palabras clave en el nombre (Silla, Bastón, etc.)
              const esEquipoActivo = (i: any) => {
                const nombre = (i.nombre || '').toLowerCase();
                return (
                  i.es_consumible === false || 
                  i.tipo === 'otro' || 
                  i.tipo === 'equipo' || 
                  i.tipo === 'activo' ||
                  nombre.includes('silla') ||
                  nombre.includes('baston') ||
                  nombre.includes('bastón') ||
                  nombre.includes('andadera') ||
                  nombre.includes('concentrador') ||
                  nombre.includes('oxigeno') ||
                  nombre.includes('oxígeno') ||
                  nombre.includes('cama') ||
                  nombre.includes('grua') ||
                  nombre.includes('grúa')
                );
              };

              const consumibles = lista.filter((i: any) => !esEquipoActivo(i));
              const activosFijos = lista.filter((i: any) => esEquipoActivo(i));

              return (
                <View style={{ marginBottom: 16 }}>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* 📦 A. SECCIÓN INSUMOS CONSUMIBLES */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <Text style={styles.sectionTitle}>📦 Insumos consumidos en este turno</Text>

                  {consumibles.length === 0 ? (
                    <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 }}>
                      <Text style={{ color: COLORS.textLight, fontSize: 11 }}>Sin insumos consumibles registrados.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8, marginBottom: 16 }}>
                      {consumibles.map((item: any) => {
                        const usandose = consumosTurno[item.id] || 0;

                        return (
                          <View 
                            key={item.id} 
                            style={{
                              backgroundColor: COLORS.white,
                              borderRadius: 12,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            {/* BOTÓN DE INFORMACIÓN E INFO DEL ITEM */}
                            <TouchableOpacity 
                              style={{ flex: 1, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              onPress={() => setItemSeleccionadoDetalle(item)}
                              activeOpacity={0.7}
                            >
                              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ fontSize: 13 }}>ℹ️</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', color: COLORS.textDark, fontSize: 12 }}>
                                  {item.nombre}
                                </Text>
                                <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 1 }}>
                                  Disponible: {item.cantidad} {item.unidad || 'piezas'}
                                </Text>
                              </View>
                            </TouchableOpacity>

                            {/* CONTROLES DE CANTIDAD (▼ 0 ▲) */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                onPress={() => cambiarConsumoItem(item.id, -1)}
                                disabled={usandose <= 0}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  backgroundColor: COLORS.cream,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: COLORS.border,
                                  opacity: usandose <= 0 ? 0.3 : 1,
                                }}
                              >
                                <Text style={{ fontWeight: '800', color: COLORS.cacao, fontSize: 12 }}>▼</Text>
                              </TouchableOpacity>

                              <Text style={{ fontWeight: '800', fontSize: 13, minWidth: 18, textAlign: 'center', color: COLORS.cacao }}>
                                {usandose}
                              </Text>

                              <TouchableOpacity
                                onPress={() => {
                                  if (usandose < item.cantidad) {
                                    cambiarConsumoItem(item.id, 1);
                                  }
                                }}
                                disabled={usandose >= item.cantidad}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  backgroundColor: COLORS.cream,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: COLORS.border,
                                  opacity: usandose >= item.cantidad ? 0.3 : 1,
                                }}
                              >
                                <Text style={{ fontWeight: '800', color: COLORS.cacao, fontSize: 12 }}>▲</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}


                  {/* ──────────────────────────────────────────────────────── */}
                  {/* ♿ B. SECCIÓN EQUIPOS Y ACTIVOS FIJOS (Silla, Bastón, etc.) */}
                  {/* ──────────────────────────────────────────────────────── */}
                  {activosFijos.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>♿ Equipos y Activos Fijos del Hogar</Text>

                      <View style={{ gap: 8, marginBottom: 16 }}>
                        {activosFijos.map((item: any) => (
                          <View 
                            key={item.id} 
                            style={{
                              backgroundColor: COLORS.white,
                              borderRadius: 12,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            {/* BOTÓN DE INFORMACIÓN E INFO DEL EQUIPO */}
                            <TouchableOpacity 
                              style={{ flex: 1, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              onPress={() => setItemSeleccionadoDetalle(item)}
                              activeOpacity={0.7}
                            >
                              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ fontSize: 13 }}>ℹ️</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', color: COLORS.textDark, fontSize: 12 }}>
                                  {item.nombre}
                                </Text>
                                <Text style={{ fontSize: 10, color: COLORS.gold || '#BF9A40', fontWeight: '700', marginTop: 1 }}>
                                  ♿ {item.cantidad || 1} {item.unidad || 'unidad(es)'} en casa
                                </Text>
                              </View>
                            </TouchableOpacity>

                          </View>
                        ))}
                      </View>
                    </>
                  )}

                </View>
              );
            })()}
            
            {/* 9. OBSERVACIONES DEL TURNO CON DICTADO POR VOZ */}
            <DictadoVozInput
              label="Observaciones del turno"
              placeholder="Comportamiento, incidencias, notas importantes..."
              value={observaciones}
              onChangeText={setObservaciones}
              minHeight={80}
            />

            {/* 10. ACCIONES FINALES */}
            <TouchableOpacity style={[styles.confirmarBtn, { backgroundColor: '#25D366', marginTop: 0, marginBottom: 8 }]} onPress={compartirWhatsApp}>
              <Text style={styles.confirmarBtnText}>📲 Resumen por WhatsApp</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.confirmarBtn} onPress={ejecutarCierre}>
              <Text style={styles.confirmarBtnText}>Confirmar y Concluir Turno</Text>
            </TouchableOpacity>
            
            {/* ESPACIO DE SEGURIDAD PARA LIBERAR LA BARRA NATIVA */}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* 🎯 1. MODAL DE DETALLE DEL ÍTEM (INFORMACIÓN ℹ️) */}
          {/* ──────────────────────────────────────────────────────────── */}
          <Modal 
            visible={!!itemSeleccionadoDetalle} 
            transparent 
            animationType="fade" 
            onRequestClose={() => setItemSeleccionadoDetalle(null)}
          >
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
              activeOpacity={1}
              onPress={() => setItemSeleccionadoDetalle(null)}
            >
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#E0D8CC', elevation: 5 }}>
                
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#4A4540', marginBottom: 4, textTransform: 'uppercase' }}>
                  {(itemSeleccionadoDetalle as any)?.nombre || 'Detalle del Elemento'}
                </Text>

                <Text style={{ fontSize: 12, color: '#BF9A40', fontWeight: '800', marginBottom: 12 }}>
                  📌 Categoría: {((itemSeleccionadoDetalle as any)?.tipo || 'Insumo').toUpperCase()}
                </Text>

                {/* UBICACIÓN */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#8A8078', textTransform: 'uppercase', marginBottom: 3 }}>
                    📍 Ubicación en Casa:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#2C2820', fontWeight: '600' }}>
                    {(itemSeleccionadoDetalle as any)?.ubicacion || 'Almacén general / Botiquín'}
                  </Text>
                </View>

                {/* NOTAS / INSTRUCCIONES */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#8A8078', textTransform: 'uppercase', marginBottom: 3 }}>
                    💡 Instrucciones / Notas:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#2C2820', fontWeight: '600', lineHeight: 18 }}>
                    {(itemSeleccionadoDetalle as any)?.notas || 'Sin observaciones adicionales.'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={{ backgroundColor: '#4A4540', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
                  onPress={() => setItemSeleccionadoDetalle(null)}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Entendido</Text>
                </TouchableOpacity>

              </View>
            </TouchableOpacity>
          </Modal>


        </KeyboardAvoidingView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // ── 1. ESTRUCTURA Y CONTENEDORES BASE ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  espontaneoContainer: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  body: { 
    flex: 1, 
    padding: 16 
  },
  espontaneoBody: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 12 
  },

  // ── 2. ENCABEZADOS Y NAVEGACIÓN ESTANDARIZADOS ──
  header: { 
    backgroundColor: COLORS.cacao, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52, 
    paddingHorizontal: 16, 
    paddingBottom: 14, 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  espontaneoHeader: { 
    backgroundColor: COLORS.cacao, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52, 
    paddingBottom: 14, 
    paddingHorizontal: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderBottomWidth: 1, 
    borderBottomColor: '#3A3530',
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 10,
  },
  espontaneoBackBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  backIcon: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  espontaneoBackIcon: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  greeting: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  espontaneoTagline: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  userName: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  espontaneoTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  notifBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  notifIcon: { fontSize: 16 },

  // ── 3. BADGES E INDICADORES DE ESTADO ──
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(191, 154, 64, 0.15)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: COLORS.gold, 
    gap: 5 
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gold },
  liveBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.gold, letterSpacing: 0.5 },
  badgeActivo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenPale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  badgeActivoText: { fontSize: 11, fontWeight: '700', color: COLORS.green },
  turnoActivoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activoText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },

  // ── 4. TARJETAS Y MÓDULOS REUTILIZABLES ──
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.cacao, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  pacienteCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  pacienteAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.goldPale, justifyContent: 'center', alignItems: 'center' },
  pacienteAvatarText: { color: COLORS.gold, fontWeight: '700', fontSize: 16 },
  pacienteNombre: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  pacienteCondiciones: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  monitorCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  monitorSubTextLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },
  moduloCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardModulo: { 
    backgroundColor: COLORS.white, 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: { borderBottomWidth: 1, borderBottomColor: COLORS.border + '60', paddingBottom: 8, marginBottom: 12 },
  cardHeaderTitle: { fontSize: 12, fontWeight: '800', color: COLORS.cacao, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── 5. SELECTORES Y CONTROLES DE ESTADO ──
  estadoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMid, marginTop: 4 },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.cacao, marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  evaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  evaBtn: { padding: 8, borderRadius: 4, backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border },
  evaBtnActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  evaBtnText: { fontSize: 12, color: COLORS.textDark, fontWeight: '600' },
  evaBtnTextActive: { color: COLORS.white },

  // ── 6. CAMPOS DE ENTRADA (INPUTS) ──
  input: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10, fontSize: 15, color: COLORS.textDark, marginBottom: 16 },
  inputSmall: { backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: COLORS.textDark },
  inputLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 4 },
  paRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  paSeparator: { fontSize: 24, fontWeight: '300', color: COLORS.textLight, marginTop: -16 },
  inputCentradoGrande: { backgroundColor: COLORS.cream, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 20, fontWeight: '800', color: COLORS.textDark, textAlign: 'center', paddingVertical: 10 },
  inputSubLabel: { fontSize: 9, color: COLORS.textLight, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  gridDosColumnas: { flexDirection: 'row', gap: 12 },
  inputWithSuffix: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  inputClean: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textDark, paddingVertical: 10, textAlign: 'center' },
  suffixText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginLeft: 4 },
  textAreaPro: { backgroundColor: COLORS.cream, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, fontSize: 13, color: COLORS.textDark, height: 70, textAlignVertical: 'top' },

  // ── 7. LISTAS, LISTADO DE TAREAS Y ALERTAS ──
  tareaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  tareaIcon: { fontSize: 18, marginRight: 12 },
  tareaInfo: { flex: 1 },
  tareaTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textDark },
  tareaHora: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  tareaCheck: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: COLORS.border },
  alertCard: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  alertIcon: { fontSize: 18, marginRight: 10 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  alertSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

  // ── 8. BOTONES ACCIONABLES Y ESTANDARIZADOS ──
  iniciarBtn: { backgroundColor: COLORS.cacao, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cacao },
  iniciarBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  confirmarBtn: { backgroundColor: COLORS.cacao, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  confirmarBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  cerrarBtn: { backgroundColor: COLORS.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  cerrarBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  accionesRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  accionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  accionBtnText: { fontSize: 12, fontWeight: '700' },
  actionSection: { marginTop: 8, gap: 8, marginBottom: 8 },
  btnGuardarPro: { backgroundColor: COLORS.cacao, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.cacao, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  btnGuardarProText: { color: COLORS.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  btnCancelarPro: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnCancelarProText: { color: COLORS.textDark, fontSize: 13, fontWeight: '700' },

  // Botones Modales Estandarizados con la Paleta Institucional
  btnPrimario: { backgroundColor: COLORS.cacao, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnPrimarioTexto: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  btnSecundario: { backgroundColor: COLORS.cream, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  btnSecundarioTexto: { color: COLORS.textDark, fontWeight: '700', fontSize: 13 },

  // ── 9. MODALES Y CHIPS DE CATEGORÍA ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, marginBottom: 16, textTransform: 'uppercase' },
  chipCat: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border },
  chipCatSelected: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipCatText: { fontSize: 11, fontWeight: '600', color: COLORS.textLight },
  chipCatTextSelected: { color: COLORS.white, fontWeight: '800' },
  // ── HEADER DEL PLAN ──
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  planTitleBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  countBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  btnIncidentalModern: {
    backgroundColor: '#292524',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  btnIncidentalPlus: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '900',
  },
  btnIncidentalText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── TARJETA DEL CUIDADO ──
  careCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  careCardCompleted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.65,
  },
  careCardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  // ── ICONO LATERAL ──
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconContainerCompleted: {
    backgroundColor: '#E2E8F0',
  },
  iconEmoji: {
    fontSize: 18,
  },

  // ── CONTENIDO CENTRAL ──
  cardContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  taskDosageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeIcon: {
    fontSize: 11,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  recurrencePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // ── INSTRUCCIONES CALLOUT ──
  instructionsCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    gap: 5,
  },
  bulbIcon: {
    fontSize: 11,
  },
  instructionsText: {
    fontSize: 11,
    color: '#854D0E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },

  // ── COLUMNA DERECHA (INFO + CHECK) ──
  actionsColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginLeft: 4,
  },
  modernInfoButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modernInfoText: {
    fontSize: 12,
  },
  touchableCheckArea: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkAreaCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  emptyCheckHole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  checkmarkSymbol: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  notasHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  notasTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notasCountBadge: {
    backgroundColor: '#FEF3D6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5DBA0',
  },
  notasCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#BF9A40',
  },
  acordeonBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF8EE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5DBA0',
  },
  acordeonBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#BF9A40',
  },
  acordeonChevron: {
    fontSize: 9,
    color: '#BF9A40',
  },
  notasListContainer: {
    gap: 8,
    marginBottom: 4,
  },
  notaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECE7DF',
    overflow: 'hidden',
    position: 'relative',
  },
  notaStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#BF9A40',
  },
  notaBody: {
    flexDirection: 'row',
    padding: 12,
    paddingLeft: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  notaIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBF7EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notaIconText: {
    fontSize: 13,
  },
  notaContentCol: {
    flex: 1,
  },
  notaTextoPrincipal: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E1B18',
    lineHeight: 18,
    marginBottom: 4,
  },
  notaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  notaAutor: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6D645B',
  },
  notaSeparador: {
    fontSize: 10,
    color: '#998E84',
  },
  notaFecha: {
    fontSize: 10,
    color: '#998E84',
  },
  notaEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECE7DF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notaEmptyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F6F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notaEmptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3E3832',
  },
  notaEmptySub: {
    fontSize: 10.5,
    color: '#998E84',
    marginTop: 1,
  },
});