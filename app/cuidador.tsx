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
  agregarTareaManual, clearToken, completarActividad, completarMedicamento,
  consumirItemInventario,
  detectarCambiosTurno,
  getAlertaPeso,
  getInventario,
  getNotasTurno,
  getPacientes,
  getSignosRecientes,
  getTareasDia,
  getTareasHoy, getToken,
  getTurnoActivo,
  getUltimoCierre,
  iniciarTurno,
  loadStoredToken,
  verificarEscalas
} from '../services/api';
import { programarNotificacionTarea, registrarNotificaciones } from '../services/notifications';

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
  
  const [nuevaTareaHora, setNuevaTareaHora] = useState(''); // Ej. "11:30" o "" para incidental pura
  const vistaRef = useRef(vista);
  const yaEntroConsolaRef = useRef(false);
  // 📦 2. Estados para el inventario en el cierre de turno
  const [inventarioHogar, setInventarioHogar] = useState<any[]>([]);
  const [consumosTurno, setConsumosTurno] = useState<Record<string, number>>({});
  const [itemSeleccionadoDetalle, setItemSeleccionadoDetalle] = useState<any>(null);
  // 🎯 3. AQUÍ VA ESTA FUNCIÓN HELPER:
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
const [nuevaTareaFecha, setNuevaTareaFecha] = useState(hoyLatino());
  // ⚙️ Convierte "22/07/2026" -> "2026-07-22" (Para enviar al backend)
  const LatinoaISO = (fechaLatino: string) => {
    if (!fechaLatino) return new Date().toISOString().split('T')[0];
    const partes = fechaLatino.split('/');
    if (partes.length !== 3) return fechaLatino;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
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
    const data = await getPacientes(origen);
    if (data?.patients) {
      setPacientes([...data.patients]);
      if (data.usuario_nombre) setNombreUsuario(data.usuario_nombre);
    }
  } catch (e) {
    console.error('❌ Error refrescando pacientes:', e);
  }
};
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
      
      // 🧼 LIMPIEZA INMEDIATA: Evita que Jorge herede el tablero pasivo de Blanca
      setSignosDispositivo({
        success: true,
        spo2: "—",
        presion: "—",
        fc: "—",
        temperatura: "—",
        dispositivoPuesto: false
      });

      sincronizarSignosReloj(pacienteActivo.id);
      
      const interval = setInterval(() => {
        sincronizarSignosReloj(pacienteActivo.id);
      }, 30000);
      
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
        const data = await getPacientes('cuidador-mount');
        if (data?.usuario_nombre) {
          setNombreUsuario(data.usuario_nombre);
        }
        if (data.patients) {
          // 🎯 Mantenemos el rol de familiar_principal si entramos desde el modo switch
          const pacientesMapeados = data.patients.map((p: any) => {
            // Si el paciente que llegó coincide con el embebido actual, le inyectamos su rol real
            if (pacienteProp && p.id === pacienteProp.id) {
              return { 
                ...p, 
                rol_en_equipo: pacienteProp.rol_en_equipo || 'familiar_principal',
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
    refrescarPacientes('lista', true); // forzar al entrar a lista
  }, [vista]);

  useEffect(() => { vistaRef.current = vista; }, [vista]);

  useEffect(() => {
  yaTransicionadoRef.current = false;
}, [pacienteActivo?.id]);

useFocusEffect(
  useCallback(() => {
    // Usuario eligió ver la lista → no forzar consola
    if (vistaRef.current === 'lista') return;

    if (yaTransicionadoRef.current) return;

    if (pacienteActivo?.id && vistaRef.current !== 'turno') {
      console.log(
        '🔍 [FOCUS CHECK] Validando estatus de turno para:',
        pacienteActivo.nombre_completo
      );

      getTurnoActivo(pacienteActivo.id)
        .then((turnoData) => {
          // Por si cambió de vista mientras respondía el API
          if (vistaRef.current === 'lista') return;

          if (turnoData?.turno && vistaRef.current !== 'turno') {
            console.log('🎯 Turno activo confirmado. Transicionando a consola...');
            yaTransicionadoRef.current = true;
            setVista('turno');
            setTurnoActivo(turnoData.turno);
            turnoActivoRef.current = turnoData.turno;
            cargarTurno(pacienteActivo.id).catch((err) =>
              console.log('⚠️ Carga de telemetría secundaria interrumpida:', err)
            );
          }
        })
        .catch((err) => console.log('Error pasivo en focus check:', err));
    }
  }, [pacienteActivo?.id])
);
  const cargarTurno = async (pacienteId: string) => {
    const [turnoData, tareasData, notasData, cierreData, alertaPesoData] = await Promise.all([
      getTurnoActivo(pacienteId),
      getTareasDia(pacienteId),
      getNotasTurno(pacienteId),
      getUltimoCierre(pacienteId),
      getAlertaPeso(pacienteId)
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
  try {
    const token = await loadStoredToken();
    if (!token) return;

    // 🎯 Parseo del peso
    const pesoFinal = peso && Number(peso) > 0 ? Number(peso) : null;

    const res = await fetch(`${BASE_URL}/registros/salud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
        peso_kg: pesoFinal,
        observaciones: observaciones.trim() || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      // 🧼 Limpiamos los inputs
      setPresionSist('');
      setPresionDiast('');
      setFrecCard('');
      setSpo2Manual('');
      setTempManual('');
      setGlucosa('');
      setObservaciones('');
      
      // 🔄 REFRESCADO INTELIGENTE: Recargamos las notas desde el servidor
      // Así la nueva toma manual aparecerá en la sección de "Notas del Cuidador" inmediatamente
      try {
        const notasData = await getNotasTurno(pacienteActivo.id);
        if (notasData && Array.isArray(notasData.notas)) {
          setNotas(notasData.notas.slice(0, 5)); // Mantenemos el límite de 5 para la UI
        }
      } catch (err) {
        console.error("Error al refrescar las notas tras registro espontáneo:", err);
      }
      
      setVista('turno');
      Alert.alert('✅ Registro Guardado', 'La toma manual se registró correctamente en la bitácora.');
    } else {
      Alert.alert('⚠️ Error', data.mensaje || 'No se pudo guardar el registro.');
    }

  } catch (e) {
    console.error('❌ Error guardando registro espontáneo:', e);
    Alert.alert('Error de Conexión', 'Ocurrió un problema al enviar la información.');
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
  if (!nuevaTareaDesc.trim() && !tareaDesc.trim()) return;
  setGuardandoTarea(true);

  const descripcionLimpia = (nuevaTareaDesc || tareaDesc).trim();
  const tipoActual = nuevaTareaTipo || tareaTipo;
  const horaActual = nuevaTareaHora || tareaHora || null;
  const idTemporal = `incidental-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const hoyISO = new Date().toISOString().split('T')[0];
  const horaProgramadaFormatted = horaActual ? `${horaActual}:00` : null;

  try {
    const res = await agregarTareaManual({ 
      turno_id: turnoActivoRef.current?.id || null, 
      paciente_id: pacienteActivo.id, 
      tipo: tipoActual, 
      descripcion: descripcionLimpia, 
      hora_programada: horaProgramadaFormatted, 
      es_incidental: true,
      fecha_inicio: hoyISO,
      fecha_fin: hoyISO
    });
    
    const idFinal = res?.tarea_id || res?.id || idTemporal;

    // Directo al estado de hoy
    setTareas(prev => [
      ...prev, 
      { 
        id: idFinal, 
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

    // 🔔 SI SE ESPECIFICÓ UNA HORA, PROGRAMAMOS LA NOTIFICACIÓN PUSH LOCAL
    if (horaActual) {
      const tituloNotif = tipoActual.toUpperCase();
      const nombrePaciente = pacienteActivo?.nombre || pacienteActivo?.nombre_completo || '';

      await programarNotificacionTarea(
        tituloNotif, 
        descripcionLimpia, 
        horaActual, 
        nombrePaciente
      );
    }

    // Limpiar formulario y cerrar modal
    setNuevaTareaDesc(''); 
    setTareaDesc('');
    setNuevaTareaHora(''); 
    setTareaHora('');
    setTareaOpen(false);

  } catch (e) { 
    console.error("❌ Error en guardarTareaManual:", e); 
    Alert.alert("Error", "No se pudo guardar la tarea.");
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
    // 📦 1. PROCESAR CONSUMOS DE INVENTARIO DEL TURNO
    for (const [itemId, cantidadUsada] of Object.entries(consumosTurno)) {
      if (cantidadUsada > 0) {
        try {
          await consumirItemInventario(itemId, cantidadUsada);
        } catch (invErr) {
          console.error(`❌ Error al consumir item ${itemId} en cierre:`, invErr);
        }
      }
    }

    // 2. CONSOLIDACIÓN DE NOTAS
    const notasRes = await fetch(`${BASE_URL}/notas?paciente_id=${pacienteActivo.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const datasetNotas = await notasRes.json();
    const arrayParaFiltrar = Array.isArray(datasetNotas?.notas) 
      ? datasetNotas.notas 
      : (Array.isArray(datasetNotas?.registros) ? datasetNotas.registros : null);

    let notasConsolidadas = "Sin notas incidentales en el turno.";
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

    // 🎯 3. RESOLUCIÓN DE JERARQUÍA: MANUAL PREVALECE SOBRE RELOJ
    // Presión Arterial
    let finalSistolica = presionSist ? parseInt(presionSist, 10) : null;
    let finalDiastolica = presionDiast ? parseInt(presionDiast, 10) : null;
    
    // Fallback al reloj solo si no se escribió nada manual
    if (!finalSistolica && signosDispositivo?.presion && String(signosDispositivo.presion).includes('/')) {
      const partes = String(signosDispositivo.presion).split('/');
      finalSistolica = parseInt(partes[0], 10) || null;
      finalDiastolica = parseInt(partes[1], 10) || null;
    }

    // SpO2 (Oxígeno)
    const finalSpo2 = spo2Manual 
      ? parseInt(spo2Manual, 10) 
      : (signosDispositivo?.spo2 ? parseInt(String(signosDispositivo.spo2), 10) : null);

    // Pulso (Frecuencia Cardíaca)
    const finalFc = frecCard 
      ? parseInt(frecCard, 10) 
      : (signosDispositivo?.fc ? parseInt(String(signosDispositivo.fc), 10) : null);

    // Temperatura
    const finalTemp = tempManual 
      ? parseFloat(tempManual) 
      : (signosDispositivo?.temperatura ? parseFloat(String(signosDispositivo.temperatura)) : null);

    // Peso
    const finalPeso = peso && String(peso).trim() !== '' && Number(peso) > 0 
      ? parseFloat(String(peso)) 
      : null;
    // 📦 Transformar consumosTurno a arreglo para persistirlo en el Cierre de Turno
   
    const insumosConsumidosArray = Object.entries(consumosTurno)
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
          // 🎯 NUEVO: Identifica quién ejecutó el consumo
          registrado_por: typeof nombreUsuario !== 'undefined' ? nombreUsuario : 'Personal Vitanova'
        };
      });
    // 4. REGISTRO FINAL DE CIERRE EN BACKEND
    const bodyPayload = {
      turno_id: turnoActivoRef.current?.id || turnoActivo?.id || params.turnoId, 
      paciente_id: pacienteActivo.id, 
      estado_paciente: estadoPaciente, 
      
      // 🛡️ Signos con jerarquía clínica (Manual primero, Reloj segundo)
      peso_kg: finalPeso,
      spo2: finalSpo2,
      frecuencia_cardiaca: finalFc,
      presion_sistolica: finalSistolica,
      presion_diastolica: finalDiastolica,
      temperatura: finalTemp,
      
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

    // 🔍 LOG 1: Muestra exactamente los datos que van a salir hacia FastAPI/Supabase
    console.log('🚀 [CIERRE] Payload enviado a /turnos/cerrar:', JSON.stringify(bodyPayload, null, 2));

    const res = await fetch(`${BASE_URL}/turnos/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(bodyPayload),
    });

    // 🔍 LOG 2: Muestra el status HTTP de la respuesta del servidor (ej. 200 OK)
    console.log('📡 [CIERRE] Status HTTP recibido:', res.status);


    const data = await res.json();
    if (data.status === 'ok') {
      const pData = await getPacientes('cierre');
      if (pData.patients) setPacientes(pData.patients);
      
      // Reset de campos
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
      
      resetEstados(); 
      setVista('lista');
      
      Alert.alert('✅ Turno Cerrado', 'La bitácora del día se ha consolidado y los signos clínicos fueron registrados.');
      router.replace({
        pathname: '/' as any,
        params: { 
          refresh: String(Date.now()),
          modoSwitch: undefined,
          usuarioRol: undefined
        }
      });
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
        
        {/* HEADER PROPIO DEL CUIDADOR */}
        {/* 🎯 Solo lo pintamos si NO está embebido en el index familiar */}
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
            <TouchableOpacity style={[styles.notifBtn, { marginRight: 8 }]} onPress={() => router.push('/aceptar-invitacion' as any)}>
              <Text style={styles.notifIcon}>🔗</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifBtn} onPress={async () => { await clearToken(); router.replace('/login'); }}>
              <Text style={styles.notifIcon}>🚪</Text>
            </TouchableOpacity>
            {modoFamiliar && (
              <TouchableOpacity 
                style={[styles.notifBtn, { marginRight: 8 }]} 
                onPress={() => {
                  if (onRegresar) {
                    onRegresar(); // Retorna al index familiar en memoria sin navegar por URL
                  } else {
                    router.replace('/');
                  }
                }}
              >
                <Text style={{ fontSize: 14 }}>👨‍👩‍👧</Text>
              </TouchableOpacity>
              )}
            </View>
          )}

       {/* Agregamos un pequeño margen superior estético si el header del index está presente */}
        <ScrollView style={[styles.body, pacienteProp && { marginTop: 16 }]} showsVerticalScrollIndicator={false}>
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

                {/* 1. BOTÓN CUANDO EL TURNO NO ESTÁ ACTIVO */}
                {estadoTurno !== 'activo' && (
                  <TouchableOpacity 
                    style={[styles.iniciarBtn, { marginTop: 10 }]} 
                    onPress={async () => {
                      if (iniciando) return;
                      setIniciando(true);
                      
                      try {
                        console.log("🩺 Iniciando verificación de turno para:", p.nombre_completo);

                        // 🛡️ Chequeo de horario SOLO para cuidadores reales
                        if (!esSwitchFamiliar) {
                          const tareasCheck = await getTareasHoy(p.id); // cambia a getTareasDia si se llama así
                          if (tareasCheck?.sin_horario) {
                            Alert.alert(
                              'Sin horario asignado',
                              'Pídele al familiar principal que configure tu horario y los días en que puedes ingresar.'
                            );
                            return;
                          }
                        }

                        // Le pasamos el paciente con el rol correcto
                        await manejarInicioTurno({
                          ...p,
                          rol_en_equipo: esSwitchFamiliar ? 'familiar_principal' : (p.rol_en_equipo || 'cuidador_contratado'),
                          usuarioRol: esSwitchFamiliar ? 'familiar_principal' : 'cuidador_contratado'
                        });

                        // Nota: Ya NO forzamos setVista('turno') aquí.
                        // Dejamos que manejarInicioTurno o avanzarAlTurno se encarguen de la navegación.
                        
                      } catch (error) {
                        console.error("❌ Error al transicionar el turno:", error);
                      } finally {
                        setIniciando(false);
                      }
                    }} 
                    disabled={iniciando}
                  >
                    <Text style={styles.iniciarBtnText}>
                      {iniciando ? 'Sincronizando...' : 'Proceder a Verificación →'}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* 2. BOTÓN CUANDO EL TURNO YA ESTÁ ACTIVO */}
                {estadoTurno === 'activo' && (
                  <TouchableOpacity 
                    style={[styles.iniciarBtn, { backgroundColor: COLORS.greenPale, borderColor: COLORS.green, marginTop: 10 }]} 
                    onPress={() => {
                      console.log("🩺 Abriendo Consola. Asegurando sincronización a modo operativo...");
                      
                      // Forzamos síncronamente los estados locales para levantar el render
                      setPacienteActivo(p); 
                      cargarTurno(p.id); 
                      setVista('turno'); 
                    }}
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

  // 2. VISTA CONSOLA DE TURNO ACTIVA
  if (vista === 'turno' && pacienteActivo) {
    const tareasPendientes = tareas.filter(t => !t.completada);

    return (
      <View key={pacienteActivo.id} style={{ display: 'flex', flex: 1 }}>
        
        {/* Renderizamos la barra operativa normal sin el botón extra del emoji familiar */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={async () => {
              setVista('lista');
              resetEstados();
              await refrescarPacientes('lista', true);
            }}
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
        {/* ⌚ SECCIÓN DE HARDWARE Y TELEMETRÍA (Solo visible si pacienteActivo tiene reloj IMEI) */}
        {Boolean(pacienteActivo?.reloj_imei && pacienteActivo.reloj_imei.trim() !== '') && (
          <>
            {/* TARJETA 1: TELEMETRÍA EN VIVO */}
            <View style={[styles.monitorCard, { marginHorizontal: 16, marginTop: 16, backgroundColor: COLORS.white, borderColor: COLORS.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.textLight }}>📡 TELEMETRÍA EN VIVO</Text>
                <TouchableOpacity 
                  onPress={() => sincronizarSignosReloj(pacienteActivo.id, true)} 
                  disabled={cargandoSignos}
                  style={[styles.iniciarBtn, { paddingHorizontal: 10, paddingVertical: 4 }, cargandoSignos && { backgroundColor: COLORS.border }]}
                >
                  <Text style={styles.iniciarBtnText}>{cargandoSignos ? "Inyectando Comando..." : "⚡ Sensa Ahora "}</Text>
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

            {/* TARJETA 2: CONFIG RELOJ — Vista Cuidador (solo lectura) */}
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
              </View>
            )}
          </>
        )}



        {/* 🎯 ACCESOS RÁPIDOS DE CONTROL (Condicionados por UX) */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Accesos rápidos de control</Text>

        {pacienteProp || pacienteActivo?.rol_en_equipo === 'familiar_principal' || pacienteActivo?.usuarioRol === 'familiar_principal' ? (
          /* ⚡ MODO CONSOLA: Acordeón colapsable para ahorrar espacio vertical */
          <View style={{
            backgroundColor: COLORS.cream,
            borderRadius: 10,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            overflow: 'hidden'
          }}>
            {/* Cabecera delgada siempre visible (Haz clic para expandir/colapsar) */}
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setMostrarAvisoMonitoreo(!mostrarAvisoMonitoreo)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>👨‍👩‍👧</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textDark }}>
                  Modo de Monitoreo Activo
                </Text>
              </View>
              
              <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.gold }}>
                {mostrarAvisoMonitoreo ? '▲ Ocultar' : '▼ Info'}
              </Text>
            </TouchableOpacity>

            {/* Contenido explicativo (Solo visible al desplegar) */}
            {mostrarAvisoMonitoreo && (
              <View style={{
                paddingHorizontal: 12,
                paddingBottom: 10,
                paddingTop: 2,
                borderTopWidth: 1,
                borderTopColor: COLORS.border + '50',
              }}>
                <Text style={{ fontSize: 10, color: COLORS.textLight, textAlign: 'center', lineHeight: 14 }}>
                  Para visualizar las gráficas, el mapa de ubicación o la red de cuidadores, por favor regrese al modo familiar usando el interruptor de arriba.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* 👨‍👩‍👧 MODO NORMAL: Botones de acceso directo */
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {/* 💬 Cuidadores */}
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
              onPress={() => {
                router.push({
                  pathname: '/red-cuidadores' as any,
                  params: { pacienteId: pacienteActivo?.id, pacienteNombre: pacienteActivo?.nombre_completo, isCuidador: 'true' }
                });
              }}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>💬</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Cuidadores</Text>
            </TouchableOpacity>

            {/* ⚠️ Alertas */}
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }} 
              onPress={() => router.push({ 
                pathname: '/alertas' as any, 
                params: { 
                  pacienteId: pacienteActivo?.id, 
                  pacienteNombre: pacienteActivo?.nombre_completo,
                  rol: 'cuidador' 
                } 
              })}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>⚠️</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Alertas</Text>
            </TouchableOpacity>

            {/* 📍 Ubicación */}
            {Boolean(pacienteActivo?.reloj_imei && pacienteActivo.reloj_imei.trim() !== '') && (
              <TouchableOpacity 
                style={{ 
                  flex: 1, 
                  backgroundColor: COLORS.white, 
                  borderRadius: 12, 
                  padding: 10, 
                  alignItems: 'center', 
                  borderWidth: 1, 
                  borderColor: COLORS.border 
                }} 
                onPress={() => router.push({
                  pathname: '/mapa' as any,
                  params: { 
                    pacienteId: pacienteActivo?.id, 
                    pacienteNombre: pacienteActivo?.nombre_completo 
                  }
                })}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📍</Text>
                <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>
                  Ubicación
                </Text>
              </TouchableOpacity>
            )}

            {/* 📊 Gráficas */}
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }} 
              onPress={() => router.push({
                pathname: '/grafica-signos' as any,
                params: { 
                  pacienteId: pacienteActivo?.id, 
                  pacienteNombre: pacienteActivo?.nombre_completo 
                }
              })}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>📊</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center' }}>Gráficas</Text>
            </TouchableOpacity>
          </View>
        )}

         {/* ========================================================== */}
          {/* 1. 📋 PLAN DE CUIDADOS DEL DÍA                             */}
          {/* ========================================================== */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 }}>
            <Text style={styles.sectionTitle}>Plan de cuidados del día ({tareasPendientes.length})</Text>
            <TouchableOpacity style={[styles.iniciarBtn, { paddingHorizontal: 12, paddingVertical: 4 }]} onPress={() => setTareaOpen(true)}>
              <Text style={[styles.iniciarBtnText, { fontSize: 11 }]}>+ Incidental</Text>
            </TouchableOpacity>
          </View>

          {tareasPendientes.map((t) => {
            const renderTemporalidadTarea = () => {
              const hoyISO = new Date().toISOString().split('T')[0];
              const fechaTareaISO = t.fecha_inicio ? String(t.fecha_inicio).split('T')[0] : hoyISO;
              
              const tieneHora = Boolean(t.hora_programada || (t.hora && t.hora !== 'Incidental'));
              const esFechaFuturaODiferente = fechaTareaISO !== hoyISO;

              if (t.es_incidental) {
                const esAgendada = tieneHora || esFechaFuturaODiferente;

                return (
                  <Text style={{ fontSize: 10, color: esAgendada ? '#0284C7' : '#D97706', fontWeight: '600' }}>
                    {esAgendada ? '⏰ Agendada' : '⚡ Del Día'}
                  </Text>
                );
              }

              const fInicio = t.fecha_inicio;
              const fFin = t.fecha_fin;

              if (!fFin || fFin === null || fFin === '') {
                return <Text style={{ fontSize: 10, color: COLORS.gold, fontWeight: '600' }}>♾️ Permanente</Text>;
              }

              const inicioClean = ISOaLatino(String(fInicio));
              const finClean = ISOaLatino(String(fFin));

              if (inicioClean === finClean) {
                return <Text style={{ fontSize: 10, color: '#555', fontWeight: '600' }}>📍 {inicioClean}</Text>;
              }

              return (
                <Text style={{ fontSize: 10, color: '#555', fontWeight: '600' }}>
                  📆 {inicioClean} al {finClean}
                </Text>
              );
            };

            // 🎯 HORA FORMATO 12 HRS (Limpio y Amigable)
            const horaOriginal = t.hora_programada || (t.hora && t.hora !== 'Incidental' ? t.hora : null);
            const horaTexto = horaOriginal 
              ? formatearHoraBonita(horaOriginal)
              : (t.fecha_inicio ? ISOaLatino(String(t.fecha_inicio)) : 'Sin hora');

            return (
              <TouchableOpacity 
                key={t.id} 
                style={styles.tareaCard} 
                onPress={() => {
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
                }}
              >
                <Text style={styles.tareaIcon}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>

                <View style={styles.tareaInfo}>
                  <Text style={styles.tareaTexto}>{t.descripcion}</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={styles.tareaHora}>{horaTexto}</Text>
                    <Text style={{ fontSize: 10, color: '#CCC' }}>·</Text>
                    <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#EAEAEA' }}>
                      {renderTemporalidadTarea()}
                    </View>
                  </View>
                </View>

                {/* ℹ️ BOTÓN INFORMATIVO INTELIGENTE (Dentro de la tarjeta) */}
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    setItemSeleccionadoDetalle(t);
                  }}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    backgroundColor: '#F1F5F9',
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    marginRight: 8
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569' }}>ℹ️</Text>
                </TouchableOpacity>

                <View style={styles.tareaCheck} />
              </TouchableOpacity>
            );
          })}
          {/* MODAL INFORMATIVO */}
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
              <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 20, width: '100%', maxWidth: 340, elevation: 5 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 }}>
                  {itemSeleccionadoDetalle?.descripcion || itemSeleccionadoDetalle?.nombre || 'Detalle de la tarea'}
                </Text>

                {/* 🎯 1. HORA FORMATO 12 HRS (Convierte 19:00 a 7:00 p.m.) */}
                {(itemSeleccionadoDetalle?.hora || itemSeleccionadoDetalle?.hora_programada) && (
                  <Text style={{ fontSize: 12, color: '#0EA5E9', fontWeight: '700', marginBottom: 14 }}>
                    ⏰ Horario: {formatearHoraBonita(itemSeleccionadoDetalle.hora_programada || itemSeleccionadoDetalle.hora)}
                  </Text>
                )}

                {/* 📍 Ubicación en Casa */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>
                    📍 Ubicación en Casa:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    {itemSeleccionadoDetalle?.ubicacion || 'Botiquín principal / Almacén general.'}
                  </Text>
                </View>

                {/* 💡 Indicaciones / Modo de Uso */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>
                    💡 Indicaciones / Modo de Uso:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    {itemSeleccionadoDetalle?.indicaciones || itemSeleccionadoDetalle?.instrucciones || 'Sin indicaciones especiales.'}
                  </Text>
                </View>

                {/* 📌 Notas adicionales (🎯 2. Solo se muestra si es DIFERENTE a Indicaciones) */}
                {(() => {
                  const ind = itemSeleccionadoDetalle?.indicaciones || itemSeleccionadoDetalle?.instrucciones || '';
                  const notas = itemSeleccionadoDetalle?.notas || '';
                  
                  if (!notas || notas.trim() === ind.trim()) return null;

                  return (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>
                        📌 Notas Adicionales:
                      </Text>
                      <Text style={{ fontSize: 13, color: '#334155' }}>
                        {notas}
                      </Text>
                    </View>
                  );
                })()}

                <TouchableOpacity 
                  style={{ marginTop: 10, backgroundColor: '#0EA5E9', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => setItemSeleccionadoDetalle(null)}
                >
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
          {/* ========================================================== */}
          {/* 2. 📝 NOTAS DEL CUIDADOR (ABAJO Y CON ACORDEÓN DESPLEGABLE) */}
          {/* ========================================================== */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 20,
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

          {/* NOTAS CON ACORDEÓN DE CONTROL INTERACTIVO */}
          {notas && notas.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 4 }}>
              {(() => {
                // Si no está expandido, renderiza únicamente la nota de arriba (última registrada).
                // Al presionar el switch, expande limpiamente un bloque con las 5 últimas notas.
                const notasAMostrar = notasExpandidas ? notas.slice(0, 5) : [notas[0]];
                
                return (
                  <>
                    {notasAMostrar.map((n, i) => {
                      const contenidoNota = n?.descripcion || n?.texto || "Nota de relevo registrada";

                      // 🎯 Lógica robusta para extraer el nombre del operador sin fallar
                      const autorNombre = 
                        n?.usuarios?.nombre_completo || 
                        (Array.isArray(n?.usuarios) && n?.usuarios[0]?.nombre_completo) ||
                        n?.nombre_cuidador || 
                        'Personal Vitanova';

                      const fechaRaw = n?.created_at || n?.hora_completada;

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
                            <Text style={styles.alertSub}>{`${autorNombre} · ${
                              fechaRaw 
                                ? new Date(fechaRaw).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : ''
                            }`}</Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Botón de despliegue interactivo (Solo visible si hay más de una nota) */}
                    {notas.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => setNotasExpandidas(!notasExpandidas)}
                        style={{ 
                          paddingVertical: 7, 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          backgroundColor: '#FDF8EE', 
                          borderRadius: 8, 
                          borderWidth: 1, 
                          borderColor: '#F5DBA0',
                          marginTop: 2 
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.amber }}>
                          {notasExpandidas ? "🔼 Ver menos notas" : `🔽 Ver historial completo (+${notas.length - 1} notas)`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              })()}
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

          {/* ACCIONES DE BITÁCORA */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Acciones de bitácora</Text>
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
if (vista === 'espontaneo') {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      {/* ENCABEZADO */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setVista('turno')} 
          style={styles.backBtn}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>REGISTRO ESPONTÁNEO</Text>
          <Text style={styles.userName}>Toma Manual de Signos Vitales</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 }}>
          
          <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.cacao, marginBottom: 16, textTransform: 'uppercase' }}>
            🩺 Captura de Parámetros Clínicos
          </Text>

          {/* 1. PRESIÓN ARTERIAL */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>
            Presión Arterial (mmHg)
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }]}
              placeholder="Sistólica (120)"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={presionSist}
              onChangeText={setPresionSist}
            />
            <Text style={{ fontSize: 20, color: COLORS.textLight, fontWeight: '700' }}>/</Text>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }]}
              placeholder="Diastólica (80)"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={presionDiast}
              onChangeText={setPresionDiast}
            />
          </View>

          {/* 2. SPO2 Y PULSO */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>
                SpO₂ Oxígeno (%)
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, textAlign: 'center' }]}
                placeholder="Ej. 98"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={spo2Manual}
                onChangeText={setSpo2Manual}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>
                Pulso (bpm)
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, textAlign: 'center' }]}
                placeholder="Ej. 72"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={frecCard}
                onChangeText={setFrecCard}
              />
            </View>
          </View>

          {/* 3. TEMPERATURA Y GLUCOSA */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>
                Temperatura (°C)
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, textAlign: 'center' }]}
                placeholder="Ej. 36.5"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={tempManual}
                onChangeText={setTempManual}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>
                Glucosa (mg/dL)
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, textAlign: 'center' }]}
                placeholder="Ej. 95"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={glucosa}
                onChangeText={setGlucosa}
              />
            </View>
          </View>

          {/* PESO */}
            <Text style={styles.sectionTitle}>Peso del paciente (kg)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>⚖️</Text>
              <TextInput
                style={{ flex: 1, fontSize: 16, color: COLORS.textDark, paddingVertical: 14 }}
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
              <Text style={{ fontSize: 13, color: COLORS.textLight }}>{'kg'}</Text>
            </View>

          {/* 5. OBSERVACIONES ADICIONALES */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6 }}>
            Notas / Observaciones
          </Text>
          <TextInput
            style={[styles.input, { height: 75, textAlignVertical: 'top', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 10 }]}
            placeholder="Escribe algún detalle relevante de la toma..."
            placeholderTextColor={COLORS.textLight}
            multiline
            value={observaciones}
            onChangeText={setObservaciones}
          />

          {/* BOTÓN DE GUARDADO */}
          <TouchableOpacity
            style={[styles.cerrarBtn, { marginTop: 10, paddingVertical: 14 }]}
            onPress={guardarRegistroEspontaneo}
            disabled={guardandoEspontaneo}
          >
            {guardandoEspontaneo ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.cerrarBtnText}>💾 Guardar Toma Manual</Text>
            )}
          </TouchableOpacity>

          {/* BOTÓN DE CANCELAR */}
          <TouchableOpacity
            style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }}
            onPress={() => setVista('turno')}
          >
            <Text style={{ color: COLORS.textLight, fontSize: 13, fontWeight: '600' }}>Cancelar y Volver</Text>
          </TouchableOpacity>

        </View>
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
          <TouchableOpacity onPress={() => setVista('turno')} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Cierre de operaciones</Text>
            <Text style={styles.userName}>{pacienteActivo.nombre_completo}</Text>
          </View>
        </View>

        {/* 🚀 COMPONENTE CLAVE: Evita que el teclado sepulte el input de observaciones */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

            {/* CONDICIÓN DE ENTREGA */}
            <Text style={styles.sectionTitle}>Condición de Entrega del Paciente</Text>
            <View style={styles.estadoRow}>
              {[{ val: 'bien', icon: '😊', label: 'Estable' }, { val: 'regular', icon: '😐', label: 'Regular' }].map((e) => (
                <TouchableOpacity key={e.val} style={[styles.estadoCard, estadoPaciente === e.val && styles.estadoCardActive]} onPress={() => setEstadoPaciente(e.val)}>
                  <Text style={{ fontSize: 26 }}>{e.icon}</Text>
                  <Text style={[styles.estadoLabel, estadoPaciente === e.val && { color: COLORS.gold }]}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
             {/* 🩺 SECCIÓN DE SIGNOS VITALES EN CIERRE */}
            <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 }}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.cacao }}>
                  🩺 Signos Vitales de Cierre
                </Text>
                <View style={{ backgroundColor: signosDispositivo ? COLORS.greenPale : COLORS.amberPale, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: signosDispositivo ? COLORS.green : COLORS.amber }}>
                    {signosDispositivo ? '⌚ Reloj detectado' : '📝 Captura manual'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 10, color: COLORS.textLight, marginBottom: 12 }}>
                {signosDispositivo 
                  ? 'Puedes ingresar valores manuales si se tomaron con equipo médico (baumanómetro, glucómetro). Si se dejan vacíos, se usarán los del reloj.'
                  : 'Ingresa los signos tomados durante el turno:'}
              </Text>

              {/* Presión Arterial */}
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 }}>
                PRESIÓN ARTERIAL (mmHg)
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontSize: 13 }}
                  placeholder={
                    signosDispositivo?.presion && String(signosDispositivo.presion).includes('/')
                      ? `Reloj: ${String(signosDispositivo.presion).split('/')[0]}`
                      : "Sistólica"
                  }
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={presionSist}
                  onChangeText={setPresionSist}
                />
                <Text style={{ fontWeight: '700', color: COLORS.textLight }}>/</Text>
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontSize: 13 }}
                  placeholder={
                    signosDispositivo?.presion && String(signosDispositivo.presion).includes('/')
                      ? `Reloj: ${String(signosDispositivo.presion).split('/')[1] || ''}`
                      : "Diastólica"
                  }
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={presionDiast}
                  onChangeText={setPresionDiast}
                />
              </View>

              {/* SpO2 y Pulso */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 }}>SpO₂ (%)</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontSize: 13 }}
                    placeholder={signosDispositivo?.spo2 ? `Reloj: ${signosDispositivo.spo2}%` : "Ej. 98"}
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={spo2Manual}
                    onChangeText={setSpo2Manual}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 }}>PULSO (bpm)</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontSize: 13 }}
                    placeholder={signosDispositivo?.fc ? `Reloj: ${signosDispositivo.fc}` : "Ej. 72"}
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={frecCard}
                    onChangeText={setFrecCard}
                  />
                </View>
              </View>

              {/* Temperatura y Glucosa */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 }}>TEMP (°C)</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontSize: 13 }}
                    placeholder={signosDispositivo?.temperatura ? `Reloj: ${signosDispositivo.temperatura}°` : "Ej. 36.5"}
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={tempManual}
                    onChangeText={setTempManual}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 }}>GLUCOSA (mg/dL)</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, textAlign: 'center', fontSize: 13 }}
                    placeholder="Ej. 95"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="numeric"
                    value={glucosa}
                    onChangeText={setGlucosa}
                  />
                </View>
              </View>

            </View>
            {/* PESO */}
            <Text style={styles.sectionTitle}>Peso del paciente (kg)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>⚖️</Text>
              <TextInput
                style={{ flex: 1, fontSize: 16, color: COLORS.textDark, paddingVertical: 14 }}
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
              <Text style={{ fontSize: 13, color: COLORS.textLight }}>{'kg'}</Text>
            </View>

            {/* 🔴 INTENSIDAD DEL DOLOR (ESCALA EVA) */}
          <Text style={styles.sectionTitle}>{`Intensidad del Dolor (Escala EVA): ${dolorEva}/10`}</Text>
          <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 8 }}>
            0 = Sin dolor | 1-3 = Leve | 4-6 = Moderado | 7-10 = Severo
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
              // Colorimetría clínica según nivel de dolor
              let activeBg = COLORS.greenPale;
              let activeColor = COLORS.green;
              if (n >= 4 && n <= 6) { activeBg = COLORS.amberPale; activeColor = COLORS.amber; }
              if (n >= 7) { activeBg = COLORS.redPale; activeColor = COLORS.red; }

              const esSeleccionado = dolorEva === n;

              return (
                <TouchableOpacity
                  key={n}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    borderWidth: 2,
                    borderColor: esSeleccionado ? activeColor : COLORS.border,
                    backgroundColor: esSeleccionado ? activeBg : COLORS.white,
                    justifyContent: 'center', alignItems: 'center'
                  }}
                  onPress={() => setDolorEva(n)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: esSeleccionado ? activeColor : COLORS.textLight }}>
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 🧠 ESTADO CONDUCTUAL Y ÁNIMO (CRITERIOS CAM / NPI-Q) */}
          <Text style={styles.sectionTitle}>Estado de ánimo / Conducta</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
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
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                  borderWidth: 1,
                  borderColor: estadoAnimo === e.val ? COLORS.gold : COLORS.border,
                  backgroundColor: estadoAnimo === e.val ? COLORS.goldPale : COLORS.white,
                }}
                onPress={() => setEstadoAnimo(e.val)}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: estadoAnimo === e.val ? COLORS.gold : COLORS.textLight }}>
                  {`${e.icon} ${e.label}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 💧 HIDRATACIÓN (CRITERIOS ESPEN) */}
          <Text style={styles.sectionTitle}>{`Hidratación Aportada: ${hidratacion} de 8 vasos (Aprox. ${(hidratacion * 250)} ml)`}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setHidratacion(hidratacion === n ? 0 : n)}
                style={{ alignItems: 'center' }}
              >
                <Text style={{ fontSize: 26, opacity: hidratacion >= n ? 1 : 0.25 }}>💧</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 🥗 APORTE NUTRICIONAL (CRITERIOS MNA) */}
          <Text style={styles.sectionTitle}>Ingesta de Alimentos</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[
              { val: 'completa', label: '🍽️ Completa (>75%)' },
              { val: 'parcial', label: '🥣 Parcial (25-75%)' },
              { val: 'ninguna', label: '❌ Nula (<25%)' },
            ].map(a => (
              <TouchableOpacity
                key={a.val}
                style={{
                  flex: 1, padding: 10, borderRadius: 10,
                  borderWidth: 1,
                  borderColor: alimentacion === a.val ? COLORS.green : COLORS.border,
                  backgroundColor: alimentacion === a.val ? COLORS.greenPale : COLORS.white,
                  alignItems: 'center'
                }}
                onPress={() => setAlimentacion(a.val)}
              >
                <Text style={{ fontSize: 10, color: alimentacion === a.val ? COLORS.green : COLORS.textLight, fontWeight: '700', textAlign: 'center' }}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

            {/* ALIMENTACIÓN */}
            <Text style={styles.sectionTitle}>Alimentación</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { val: 'completa', label: '🍽️ Completa' },
                { val: 'parcial', label: '🥣 Parcial' },
                { val: 'ninguna', label: '❌ Ninguna' },
              ].map(a => (
                <TouchableOpacity
                  key={a.val}
                  style={{
                    flex: 1, padding: 10, borderRadius: 10,
                    borderWidth: 1,
                    borderColor: alimentacion === a.val ? COLORS.green : COLORS.border,
                    backgroundColor: alimentacion === a.val ? COLORS.greenPale : COLORS.white,
                    alignItems: 'center'
                  }}
                  onPress={() => setAlimentacion(a.val)}
                >
                  <Text style={{ fontSize: 11, color: alimentacion === a.val ? COLORS.green : COLORS.textLight, fontWeight: '700' }}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 📦 INSUMOS CONSUMIDOS EN ESTE TURNO */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textDark, marginTop: 16, marginBottom: 8 }}>
          📦 Insumos consumidos en este turno
        </Text>

        {!inventarioHogar || inventarioHogar.length === 0 ? (
          <View style={{
            backgroundColor: COLORS.white,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            marginBottom: 16
          }}>
            <Text style={{ color: COLORS.textLight, fontSize: 12 }}>
              Sin insumos registrados en el inventario del hogar.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8, marginBottom: 16 }}>
            {inventarioHogar.map((item: any) => {
              const usandose = consumosTurno[item.id] || 0;

              return (
                <View 
                  key={item.id} 
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontWeight: '800', color: COLORS.textDark, fontSize: 13 }}>
                      {item.nombre}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
                      Disponible: {item.cantidad} {item.unidad}
                    </Text>
                  </View>

                  {/* Botones de consumo (-1 / +1) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {/* Botón Decrementar (Flecha Abajo) */}
                    <TouchableOpacity
                      onPress={() => cambiarConsumoItem(item.id, -1)}
                      disabled={usandose <= 0}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: COLORS.cream,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        opacity: usandose <= 0 ? 0.3 : 1, // Se atenúa si ya está en 0
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: COLORS.cacao, fontSize: 13 }}>▼</Text>
                    </TouchableOpacity>

                    {/* Valor Usándose */}
                    <Text style={{ fontWeight: '800', fontSize: 14, minWidth: 20, textAlign: 'center', color: COLORS.cacao }}>
                      {usandose}
                    </Text>

                    {/* Botón Incrementar (Flecha Arriba) */}
                    <TouchableOpacity
                      onPress={() => {
                        if (usandose < item.cantidad) {
                          cambiarConsumoItem(item.id, 1);
                        }
                      }}
                      disabled={usandose >= item.cantidad}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: COLORS.cream,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        opacity: usandose >= item.cantidad ? 0.3 : 1, // Se atenúa si llega al stock máximo
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: COLORS.cacao, fontSize: 13 }}>▲</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

            {/* OBSERVACIONES */}
            <Text style={styles.sectionTitle}>Observaciones del turno</Text>
            <View style={{ backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 16 }}>
              <TextInput
                style={{ fontSize: 14, color: COLORS.textDark, paddingVertical: 14, minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Comportamiento, incidencias, notas importantes..."
                placeholderTextColor={COLORS.textLight}
                multiline
                value={observaciones}
                onChangeText={setObservaciones}
              />
            </View>

            <TouchableOpacity style={[styles.confirmarBtn, { backgroundColor: '#25D366' }]} onPress={compartirWhatsApp}>
              <Text style={styles.confirmarBtnText}>{'📲 Resumen por WhatsApp'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.confirmarBtn} onPress={ejecutarCierre}>
              <Text style={styles.confirmarBtnText}>{'Confirmar y Concluir Turno'}</Text>
            </TouchableOpacity>
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
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
// 🎨 Estilos para Modales y Formularios
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  inputSmall: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  
  // 🏷️ Chips de Categoría
  chipCat: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipCatSelected: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  chipCatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  chipCatTextSelected: {
    color: '#FFFFFF',
  },

  // 🔘 Botones
  btnPrimario: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimarioTexto: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnSecundario: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnSecundarioTexto: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
});