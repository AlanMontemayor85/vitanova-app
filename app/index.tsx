import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { Bell, Calendar, MapPin, Pill } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { calibrarAcelerometroReloj, clearToken, enviarComandoReloj, forzarMedicionSignos, getAlertaPeso, getHoyLocalISO, getNotasTurno, getPacientes, getSignosRecientes, getTareasHoy, getTurnoActivoResumen, getUbicacion, getUltimoCierre, getUserNombre, loadStoredToken, MiembroEquipo } from '../services/api';
import { registrarNotificaciones } from '../services/notifications';
import { BannerAlertasPreventivas } from './components/BannerAlertasPreventivas';
import { TarjetaUltimoCierre } from './components/TarjetaUltimoCierre';
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
const formatearHora = (isoStr: string | null) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const pathname = usePathname();
  const pacienteId = paciente?.id;
  const [modoCuidadorFamiliar, setModoCuidadorFamiliar] = useState(false);
  const pacienteIndexRef = useRef(0);
  const modoSwitchParam = params.modoSwitch; // Puede ser 'familiar', 'ninguno', etc.
  const pacienteIdParam = params.pacienteId;
  const [notasExpandidas, setNotasExpandidas] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const miRol = paciente?.mi_rol || paciente?.equipo?.find((m: any) => m.es_usuario_actual)?.rol;
  const esPrincipal = miRol === 'familiar_principal';
  const esCoAdmin = miRol === 'familiar_co_admin';
  const esAdminRed = esPrincipal || esCoAdmin;
  const isFirstFocus = useRef(true);
  const [ubicacion, setUbicacion] = useState<any>(null);
  const cargando = Boolean(signosDispositivo?.cargando);
  const [modalConfigVisible, setModalConfigVisible] = useState(false);
  const [ejecutandoCmd, setEjecutandoCmd] = useState<string | null>(null);
  const [sensibilidadLocal, setSensibilidadLocal] = useState<number>(4);
  const [caidaActivaLocal, setCaidaActivaLocal] = useState<boolean>(true);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [totalTareasHoy, setTotalTareasHoy] = useState<number>(0);
  const [completadasTareasHoy, setCompletadasTareasHoy] = useState<number>(0);
  const solicitarConfirmacion = (
  titulo: string, 
  mensaje: string, 
  onConfirmar: () => Promise<void> | void,
  esDestructivo: boolean = false
) => {
  Alert.alert(
    titulo,
    mensaje,
    [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Confirmar", 
        style: esDestructivo ? "destructive" : "default",
        onPress: onConfirmar 
      }
    ],
    { cancelable: true }
  );
};
  
  const formatearHorarioRango = (horarioRaw: string | null | undefined): string => {
  if (!horarioRaw) return 'Sin horario';

  const formatearHoraUnica = (hora: string): string => {
    let soloHora = hora.includes('T') ? hora.split('T')[1] : hora;
    soloHora = soloHora.split('.')[0].split('-')[0].split('+')[0].trim();

    const partes = soloHora.split(':');
    if (partes.length < 1) return hora;

    let horas = parseInt(partes[0], 10);
    const minutos = partes[1] ? partes[1].padStart(2, '0') : '00';

    if (isNaN(horas)) return hora;

    const ampm = horas >= 12 ? 'p.m.' : 'a.m.';
    horas = horas % 12;
    horas = horas ? horas : 12;

    return `${horas}:${minutos} ${ampm}`;
  };

  // Si contiene un guion/rango (ej. "08:00 - 18:00" o "08:00 — 18:00")
  if (horarioRaw.includes('-') || horarioRaw.includes('—')) {
    const separador = horarioRaw.includes('—') ? '—' : '-';
    const partes = horarioRaw.split(separador);
    if (partes.length === 2) {
      return `${formatearHoraUnica(partes[0])} - ${formatearHoraUnica(partes[1])}`;
    }
  }

  return formatearHoraUnica(horarioRaw);
};

// 📡 1. Función para jalar la telemetría más reciente del reloj
// 📡 1. Función para jalar la telemetría más reciente del reloj (Corregida)
const cargarSignosDispositivo = async (idToLoad?: string) => {
  const targetId = idToLoad || pacienteId;
  if (!targetId) return;

  try {
    const res = await getSignosRecientes(targetId);

    if (res && res.success) {
      console.log(`📥 [INDEX] Telemetría obtenida para el paciente: ${targetId}`);

      // 🔌 Evaluamos si el reloj está en la base de carga
      const estaEnCarga = Boolean(res.cargando);

      // 🛡️ Reloj puesto solo si no está desconectado y no está en la base de carga
      const puesto = res.dispositivoPuesto !== false && res.sin_contacto !== true && !estaEnCarga;

      // ⚡ Conservamos la telemetría normalizada
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

      if (estaEnCarga) {
        console.log("🔌 [INDEX] Reloj detectado en base de carga magnética.");
      } else if (!puesto) {
        console.log("⌚ [INDEX] Reloj fuera de muñeca o en reposo (conservando última telemetría).");
      }

      setSignosDispositivo(normalizado);
      await AsyncStorage.setItem(
        `@vitals_${targetId}`,
        JSON.stringify(normalizado)
      );
    }

    // 2. Ubicación y batería
    try {
      const ubData = await getUbicacion(targetId);
      if (ubData && ubData.ubicacion) {
        setUbicacion(ubData.ubicacion);
      } else if (ubData) {
        setUbicacion(ubData);
      }
    } catch (ubErr) {
      console.log("⚠️ Error consultando ubicación/batería:", ubErr);
    }
  } catch (error) {
    console.log("⚠️ Error cargando signos vitales:", error);
  }
};


// ⚡ 2. Función para disparar la ráfaga 'hrtstart' por Redis
const ejecutarMedicionRemota = async () => {
  const idReal = paciente?.id || paciente?.paciente_id || pacienteId;

  if (!idReal || midiendo) {
    console.warn("⚠️ Abortando medición: El ID del paciente llegó vacío:", idReal);
    return;
  }
  
  setMidiendo(true);

  // 🚀 ACTUALIZACIÓN OPTIMISTA: Quitamos el modo carga en la UI al instante
  setSignosDispositivo((prev: any) => (prev ? { ...prev, cargando: false } : prev));

  try {
    await forzarMedicionSignos(idReal);
    Alert.alert("📡 Solicitud enviada", "El reloj comenzará la lectura en unos segundos...");
    
    // ⏱️ Doble verificación táctica (a los 15s y confirmación a los 30s)
    setTimeout(async () => {
      await cargarSignosDispositivo(idReal);
    }, 15000);

    setTimeout(async () => {
      await cargarSignosDispositivo(idReal);
      setMidiendo(false);
    }, 30000);

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
// 🎯 INTERCEPTOR OPERATIVO: Normalización y saneamiento de estado de Turno
const corregirResumenTurno = (turnoOriginal: any, listadoMedicamentos: any[], listadoTareas: any[]) => {
  if (!turnoOriginal) return null;

  const hoyStr = getHoyLocalISO();

  // 1. Filtrar medicamentos vigentes para hoy
  const medsHoy = (listadoMedicamentos || []).filter(med => {
    return med.fecha_inicio && med.fecha_inicio <= hoyStr && (!med.fecha_fin || med.fecha_fin >= hoyStr);
  });
  const totalMedsTurno = medsHoy.reduce((acc, med) => acc + (Array.isArray(med.horarios) ? med.horarios.length : 1), 0);

  // 2. Filtrar tareas vigentes excluyendo notas
  const tareasHoy = (listadoTareas || []).filter(tarea => {
    const tipo = String(tarea.tipo || tarea.categoria || '').toLowerCase().trim();
    const esNota = tipo === 'nota' || tipo === 'nota_cuidador' || tipo.includes('nota');
    const esVigente = tarea.fecha_inicio && tarea.fecha_inicio <= hoyStr && (!tarea.fecha_fin || tarea.fecha_fin >= hoyStr);
    return esVigente && !esNota;
  });

  const tareasCompletadasHoy = tareasHoy.filter(tarea => tarea.completada || tarea.status === 'completada').length;
  const totalReal = totalMedsTurno + tareasHoy.length;

  return {
    ...turnoOriginal,
    total: totalReal,
    completadas: tareasCompletadasHoy,
    tareas_completadas: tareasCompletadasHoy
  };
};

const ejecutarComandoReloj = async (
  comando: 'FIND' | 'PEDO' | 'RESET' | 'POWEROFF' | 'FALLDOWN' | 'LSSET',
  argumento: string = ''
) => {
  if (!paciente?.id) return;

  // Guardar estado previo para rollback en caso de fallo
  const estadoPrevioCaida = signosDispositivo?.reloj_config?.caida_activa;
  const estadoPrevioSens = signosDispositivo?.reloj_config?.sensibilidad_caidas ?? signosDispositivo?.reloj_config?.sensibilidad ?? 4;

  try {
    setEjecutandoCmd(comando);

    // ⚡ 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA
    if (comando === 'FALLDOWN') {
      const nuevoEstado = argumento.startsWith('1');
      setSignosDispositivo((prev: any) => ({
        ...prev,
        reloj_config: {
          ...prev?.reloj_config,
          caida_activa: nuevoEstado,
        },
      }));
    }

    if (comando === 'LSSET') {
      const nuevoNivel = parseInt(argumento.split('+')[0], 10) || 4;
      setSensibilidadLocal(nuevoNivel);
      setSignosDispositivo((prev: any) => ({
        ...prev,
        reloj_config: {
          ...prev?.reloj_config,
          sensibilidad_caidas: nuevoNivel,
          sensibilidad: nuevoNivel,
        },
      }));
    }

    const res = await enviarComandoReloj(paciente.id, comando, argumento);

    if (res?.success) {
      let msg = 'Comando enviado con éxito.';
      if (comando === 'FIND') msg = 'El reloj está sonando (1 min).';
      if (comando === 'PEDO') msg = 'Podómetro activado (24h).';
      if (comando === 'RESET') msg = 'El reloj se está reiniciando.';
      if (comando === 'POWEROFF') msg = 'El reloj se ha apagado remotamente.';
      if (comando === 'FALLDOWN') msg = `Detector de caídas ${argumento.startsWith('1') ? 'activado' : 'desactivado'}.`;
      if (comando === 'LSSET') msg = 'Sensibilidad ajustada correctamente.';
      Alert.alert('Éxito', msg);
    } else {
      // 🔄 Revertir si el backend/dispositivo rechazó la orden
      revertirEstadoLocal(comando, estadoPrevioCaida, estadoPrevioSens);
      Alert.alert('Aviso', res?.detail || 'No se pudo comunicar con el dispositivo.');
    }
  } catch {
    // 🔄 Revertir en error de conexión
    revertirEstadoLocal(comando, estadoPrevioCaida, estadoPrevioSens);
    Alert.alert('Error', 'Error de conexión con el servidor.');
  } finally {
    setEjecutandoCmd(null);
  }
};

// Función auxiliar de Rollback
const revertirEstadoLocal = (comando: string, prevCaida: boolean, prevSens: number) => {
  if (comando === 'FALLDOWN') {
    setSignosDispositivo((prev: any) => ({
      ...prev,
      reloj_config: {
        ...prev?.reloj_config,
        caida_activa: prevCaida,
      },
    }));
  }
  if (comando === 'LSSET') {
    setSensibilidadLocal(prevSens);
    setSignosDispositivo((prev: any) => ({
      ...prev,
      reloj_config: {
        ...prev?.reloj_config,
        sensibilidad_caidas: prevSens,
        sensibilidad: prevSens,
      },
    }));
  }
};

const confirmarAccionCritica = (tipo: 'RESET' | 'POWEROFF') => {
    const esReset = tipo === 'RESET';
    Alert.alert(
      esReset ? '¿Reiniciar Reloj?' : '¿Apagar Reloj?',
      esReset
        ? 'El reloj se reiniciará y tardará ~1 minuto en reconectar.'
        : '⚠️ ATENCIÓN: Si apagas el reloj remotamente, requerirá ser encendido físicamente con su botón.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: esReset ? 'Reiniciar' : 'Apagar', 
          style: 'destructive',
          onPress: () => ejecutarComandoReloj(tipo)
        }
      ]
    );
  };
useEffect(() => {
  if (signosDispositivo?.reloj_config) {
    const config = signosDispositivo.reloj_config;
    const sensBackend = Number(config.sensibilidad ?? config.sensibilidad_caidas ?? 4);
    setSensibilidadLocal(sensBackend);
    setCaidaActivaLocal(Boolean(config.caida_activa));
  }
}, [signosDispositivo]);






// 🔄 Carga inicial y Enrutador Inteligente Relacional
useEffect(() => {

  console.log("🚀 [INIT DISPARADO]", { 
  refresh: params.refresh, 
  modoSwitchParam, 
  paramModoSwitch: params.modoSwitch,
  time: new Date().toISOString() 
});

  const init = async () => {
    try {
      setLoading(true);

      // 0. 🧼 LIMPIEZA INICIAL
      await AsyncStorage.removeItem('@offline_queue');
      setTurnoResumen(null);
      setUltimoCierre(null);
      setNotas([]);

      // 1. Validar Onboarding local
      const onboardingCompletado = await AsyncStorage.getItem('onboarding_completado');
      if (!onboardingCompletado) {
        router.replace('/onboarding');
        return;
      }

      // 2. Verificar token de sesión
      const token = await loadStoredToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      // 3. Aduana Biomédica
      const data = await getPacientes('init');
      console.log("📌 [ORDEN BACKEND]", data?.patients?.map((p: any, i: number) => `[${i}]: ${p.nombre_completo} (ID: ${p.id})`));
      
      if (data && data.usuario_nombre && typeof setNombreUsuario === 'function') {
        setNombreUsuario(data.usuario_nombre);
      }
      await registrarNotificaciones().catch(err => console.log("Push omitido en simulación:", err));

      if (!data || data.no_autenticado || data.error || data.detail === 'Token inválido o expirado') {
        await clearToken();
        router.replace('/login');
        return;
      }

      // 🛑 CANDADO DE SEGURIDAD:
      // Si el backend pide completar perfil, no hay tipo de usuario, 
      // O el nombre viene vacío/nulo, REBOTAR a /completar-perfil SÍ O SÍ.
      if (
        data.status === 'pending_profile' || 
        data.requiere_perfil || 
        !data.usuario_tipo || 
        !data.usuario_nombre || 
        data.usuario_nombre.trim() === ''
      ) {
        console.log("⚠️ Perfil incompleto detectado. Redirigiendo obligatoriamente a /completar-perfil");
        router.replace('/completar-perfil');
        return;
      }
      // Segmentación de Rutas
      const tipo = data.usuario_tipo;
      const esCuidadorPuro = tipo === 'cuidador' || tipo === 'cuidador_contratado';
      // 🎯 Reemplaza tu línea actual de esFamiliar por esta:
      const esFamiliar = 
        tipo === 'familiar' || 
        tipo === 'admin' || 
        tipo === 'familiar_principal' || 
        tipo === 'familiar_co_admin'; 
      if (esCuidadorPuro) {
        router.replace({
          pathname: '/cuidador' as any,
          params: { usuarioRol: 'cuidador_contratado', modoSwitch: 'ninguno' }
        });
        return;
      }

      if (esFamiliar) {
        // 🎯 SOLO nos desviamos si el usuario expresamente activó el Modo Cuidador.
        // Si el valor es 'familiar', 'ninguno' o no viene nada, la condición da false 
        // y el código continúa directo al Paso 4 (Flujo Normal de Familiar).
        const quiereModoCuidador = modoSwitchParam === 'cuidador';

        if (quiereModoCuidador) {
          router.replace({
            pathname: '/cuidador' as any,
            params: {
              usuarioRol: 'familiar_principal',
              modoSwitch: 'cuidador', // Notificamos a la vista cuidador su nuevo estado
              pacienteId: pacienteIdParam || data.patients?.[0]?.id,
              refresh: Date.now().toString()
            }
          });
          return;
        }
      } else if (tipo === 'autonomo') {
        router.replace({ pathname: '/autocuidador' as any, params: { pacienteId: data.patients?.[0]?.id } });
        return;
      } else if (tipo === 'medico') {
        router.replace('/medico');
        return;
      }

      if (data.patients && data.patients.length > 0) {
        // 📌 1. Estabilizamos el orden por ID para que Railway no nos mueva las sillas
        const pacientesEstables = [...data.patients].sort((a, b) => 
          String(a.id).localeCompare(String(b.id))
        );

        setPacientes(pacientesEstables);

        // 📌 2. Leemos la posición sobre la lista que YA está ordenada
        const idxActual = pacienteIndexRef.current ?? 0;
        const p = pacientesEstables[idxActual] || pacientesEstables[0];
        setPaciente(p);

        // Peticiones paralelas originales que ya te funcionaban
        const [cierreData, notasData, alertaPesoData, turnoRes, tareasHoyData] = await Promise.all([
          getUltimoCierre(p.id).catch(() => ({ cierre: null })),
          getNotasTurno(p.id).catch(() => ({ notas: [] })),
          getAlertaPeso(p.id).catch(() => ({ alerta: null })),
          getTurnoActivoResumen(p.id).catch(() => ({ turno: null })),
          getTareasHoy(p.id, getHoyLocalISO()).catch((err) => {
            console.log("❌ FALLO getTareasHoy:", err);
            return null;
          })
        ]);

        if (cierreData?.cierre) setUltimoCierre(cierreData.cierre);
        if (notasData?.notas) setNotas(notasData.notas);
        if (alertaPesoData?.alerta) setAlertaPeso(alertaPesoData);

        // 🎯 EXTRAER EL ARRAY COMPLETO DE TAREAS RECIBIDO
        const listaTareas = Array.isArray(tareasHoyData)
          ? tareasHoyData
          : (tareasHoyData?.tareas || []);
        
        // 🔍 LOG DE DEPURACIÓN DETALLADO
        console.log("==========================================");
        console.log("🔍 DIAGNÓSTICO EN FRONTEND (Index.tsx):");
        console.log("📦 Respuesta cruda de tareasHoyData:", JSON.stringify(tareasHoyData));
        console.log("📋 Cantidad de tareas en la lista:", listaTareas.length);
        
        listaTareas.forEach((t: any, index: number) => {
          const estaCompletada = 
            t.completada === true || 
            t.completada === 1 || 
            String(t.completada).toLowerCase() === "true";

          console.log(
            `  [${index + 1}] ID: ${t.id} | Desc: "${t.descripcion}" | Tipo: ${t.tipo} | Incidental: ${t.es_incidental} | RAW completada: ${JSON.stringify(t.completada)} -> EVALUADO: ${estaCompletada ? "✅ TRUE" : "❌ FALSE"}`
          );
        });

        const totalCalculado = tareasHoyData?.total !== undefined 
          ? Number(tareasHoyData.total) 
          : listaTareas.length;

        const completadasCalculadas = listaTareas.filter((t: any) => 
          t.completada === true || 
          t.completada === 1 || 
          String(t.completada).toLowerCase() === "true"
        ).length;

        console.log(`📊 RESULTADO FINAL EVALUADO: ${completadasCalculadas} / ${totalCalculado}`);
        console.log("==========================================");
        setTotalTareasHoy(totalCalculado);
        setCompletadasTareasHoy(completadasCalculadas);
        // 🎯 SETEAR EN EL ESTADO
        // 🎯 SETEAR EN EL ESTADO (Soporte para múltiples turnos simultáneos)
        const turnosRecibidos = Array.isArray(turnoRes?.turnos)
          ? turnoRes.turnos
          : (turnoRes?.turno ? [turnoRes.turno] : (Array.isArray(turnoRes) ? turnoRes : []));

        if (turnosRecibidos.length > 0) {
          // Mapeamos los turnos respetando el conteo de tareas de cada uno
          const turnosProcesados = turnosRecibidos.map((t: any) => ({
            ...t,
            cuidador_nombre: t.cuidador_nombre || "Turno del Día",
            horario: t.horario || "00:00 - 23:59",
            // Si el turno ya trae sus tareas calculadas del backend las usa, sino asigna el cálculo del día
            total: t.total !== undefined ? t.total : totalCalculado,
            completadas: t.completadas !== undefined ? t.completadas : completadasCalculadas,
          }));

          setTurnoResumen(turnosProcesados);
        } else {
          setTurnoResumen([]);
        }

      } else {
        router.replace('/perfil-paciente');
        return;
      }

    } catch (e) {
      console.error('❌ Error crítico en el init de la Home:', e);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  init();
}, [
  params.refresh, 
  pacienteIndex, 
  modoSwitchParam, 
  params.modoSwitch, 
  vistaModo, 
  modoCuidadorFamiliar,
  refreshKey
]);

useEffect(() => {
  const subTareas = DeviceEventEmitter.addListener('RECARGAR_TAREAS', () => {
    console.log("⚡ [INDEX] Recibida orden de recargar tareas...");
    setRefreshKey(prev => prev + 1);
  });

  const subCuidadores = DeviceEventEmitter.addListener('RECARGAR_CUIDADORES', () => {
    console.log("⚡ [INDEX] Recibida orden de recargar cuidadores...");
    setRefreshKey(prev => prev + 1);
  });

  return () => {
    subTareas.remove();
    subCuidadores.remove();
  };
}, []);
useEffect(() => {
  console.log("🔄 [INDEX] Modo de visualización cambiado a:", vistaModo, "| Paciente:", paciente?.id);
}, [vistaModo, paciente?.id]);


useEffect(() => {
  if (params.abrirModoCuidador === 'true') {
    console.log("🔄 Restaurando switch + Consola");
    setModoCuidadorFamiliar(true);
  }
}, [params.abrirModoCuidador]);


useFocusEffect(
  useCallback(() => {
    // Primer focus = montaje inicial → lo deja el init
    if (isFirstFocus.current) {
      isFirstFocus.current = false;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await loadStoredToken();
        if (!token || cancelled) return;

        const idx = pacienteIndexRef.current ?? 0;
        const data = await getPacientes('focus-refresh');
        if (cancelled || !data?.patients?.length) return;
        if (data.no_autenticado || data.detail === 'Token inválido o expirado') return;

        const pacientesEstables = [...data.patients].sort((a, b) =>
          String(a.id).localeCompare(String(b.id))
        );
        setPacientes(pacientesEstables);

        const p = pacientesEstables[idx] || pacientesEstables[0];
        setPaciente(p);

        
      } catch (e) {
        console.log('focus-refresh omitido:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [])
);
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
  }, 60000);

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

      {/* ── 1. ENCABEZADO DINÁMICO SEGÚN MODO ── */}
      {modoCuidadorFamiliar ? (
        /* 🩺 HEADER ULTRA-COMPACTO (MODO CONSOLA) */
        <View style={styles.headerConsolaCompacto}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Text style={{ fontSize: 13 }}>🩺</Text>
            <Text style={styles.userNameConsola} numberOfLines={1}>
              {nombreUsuario || getUserNombre() || 'Cuidador'}
            </Text>
            <View style={styles.badgeConsola}>
              <Text style={styles.badgeConsolaText}>MODO SWITCH</Text>
            </View>
          </View>

          {/* SWITCH COMPACTO */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Switch
              value={modoCuidadorFamiliar}
              onValueChange={setModoCuidadorFamiliar}
              trackColor={{ false: '#767577', true: COLORS.gold } as any}
              thumbColor="#ffffff"
              ios_backgroundColor="#3e3e3e"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
            <TouchableOpacity 
              style={styles.notifBtnMin}
              onPress={async () => {
                await clearToken();
                router.replace('/login');
              }}
            >
              <Text style={{ fontSize: 13 }}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* 👨‍👩‍👧 HEADER AMPLIO HABITUAL (MODO FAMILIAR) */
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'}
            </Text>
            <Text style={styles.userName}>{nombreUsuario || getUserNombre() || 'Familiar'}</Text>
          </View>

          {/* SWITCH MODO */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>👨‍👩‍👧</Text>
            <Switch
              value={modoCuidadorFamiliar}
              onValueChange={setModoCuidadorFamiliar}
              trackColor={{ false: '#767577', true: COLORS.gold } as any}
              thumbColor="#ffffff"
              ios_backgroundColor="#3e3e3e"
            />
          </View>

          <TouchableOpacity 
            style={[styles.notifBtn, { marginRight: 5 }]}
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
      )}

      {/* ── 2. CONTENIDO PRINCIPAL SEGÚN MODO ── */}
      {modoCuidadorFamiliar ? (
        <CuidadorScreen
          key={params.pacienteIdConsola || 'embed'}
          pacienteProp={paciente}
          modoFamiliar={true}
          esFamiliarEnModoCuidador={true}
          onRegresar={() => setModoCuidadorFamiliar(false)}
          initialPacienteId={params.pacienteIdConsola as string}
          initialVista={params.pacienteIdConsola ? 'turno' : 'lista'}
        />
      ) : (
        /* 👨‍👩‍👧 MODO FAMILIAR (Tu interfaz normal continua hacia abajo con el fragmento <>) */
        <>
          {/* PATIENT CARD */}
        <View style={{
          backgroundColor: '#3D3732', // Tu color cacao oscuro actual
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 12,
          marginHorizontal: 16,
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* ⬅️ Flecha Izquierda */}
          {pacientes.length > 1 ? (
            <TouchableOpacity 
              onPress={() => {
                const newIndex = (pacienteIndex - 1 + pacientes.length) % pacientes.length;
                setPacienteIndex(newIndex);
                setPaciente(pacientes[newIndex]);
                pacienteIndexRef.current = newIndex;
              }}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(191, 154, 64, 0.2)',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: COLORS.gold, fontSize: 20, fontWeight: '800', marginTop: -2 }}>‹</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 32 }} />}

          {/* 🎯 ÁREA CENTRAL: Avatar + Datos del Paciente */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginRight: 8 }}>
            
            {/* Avatar Clicable */}
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/perfil-paciente' as any,
                params: { paciente: JSON.stringify(paciente) }
              })}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: COLORS.goldPale,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
                borderWidth: 1.5,
                borderColor: COLORS.gold,
              }}
            >
              <Text style={{ color: COLORS.cacao, fontWeight: '800', fontSize: 16 }}>{iniciales}</Text>
            </TouchableOpacity>

            {/* Información Clínica */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                PERSONA A TU CUIDADO
              </Text>

              {esCoAdmin && (
                <View style={{ backgroundColor: COLORS.gold, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, alignSelf: 'flex-start', marginVertical: 2 }}>
                  <Text style={{ fontSize: 7, fontWeight: '800', color: COLORS.cacao }}>⭐ CO-ADMIN</Text>
                </View>
              )}

              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.white, marginTop: 1 }} numberOfLines={1}>
                {nombre}
              </Text>
              
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 }} numberOfLines={1}>
                {condiciones}
              </Text>

              {pacientes.length > 1 && (
                <Text style={{ fontSize: 9, color: COLORS.gold, marginTop: 2, fontWeight: '700' }}>
                  {pacienteIndex + 1} de {pacientes.length}
                </Text>
              )}
            </View>
          </View>

          {/* 🟢 BADGE STATUS (Lado Derecho) */}
          <View style={{ alignItems: 'flex-end', justifyContent: 'center', marginRight: 4 }}>
            {(() => {
              const tieneReloj = Boolean(paciente?.reloj_imei && paciente.reloj_imei.trim() !== '');
              const textoEstado = paciente?.estado_salud || paciente?.estado || (tieneReloj ? 'Estable' : 'Manual');
              const colorDot = paciente?.estado_salud === 'Alerta' 
                ? COLORS.red 
                : (tieneReloj ? COLORS.green : COLORS.gold);

              return (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(61, 170, 106, 0.15)', // Fondo translúcido verde suave
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(61, 170, 106, 0.3)',
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colorDot, marginRight: 5 }} />
                  <Text style={{ color: colorDot, fontSize: 10, fontWeight: '800' }}>{textoEstado}</Text>
                </View>
              );
            })()}
          </View>

          {/* ➡️ Flecha Derecha */}
          {pacientes.length > 1 ? (
            <TouchableOpacity 
              onPress={() => {
                const newIndex = (pacienteIndex + 1) % pacientes.length;
                setPacienteIndex(newIndex);
                setPaciente(pacientes[newIndex]);
                pacienteIndexRef.current = newIndex;
              }}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(191, 154, 64, 0.2)',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: COLORS.gold, fontSize: 20, fontWeight: '800', marginTop: -2 }}>›</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 32 }} />}

        </View>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* ⌚ SOLO SE MUESTRA SI EL PACIENTE TIENE UN RELOJ VINCULADO (IMEI) */}
            {Boolean(paciente?.reloj_imei) && (
              <>
                {/* VITALS CON TELEMETRÍA EN VIVO */}
              <View style={styles.vitalsContainer}>
                {/* CABECERA DEL MÓDULO */}
                <View style={styles.vitalsHeaderRow}>
                  
                  {/* Título + Live Dot + Pill Batería */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.liveDot} />
                    <Text style={styles.vitalsHeaderTitle}>Telemetría en Vivo</Text>
                      {/* 🔋 PILL DE BATERÍA ESTANDARIZADA CON DETECCIÓN DE APAGADO Y DESCONEXIÓN */}
                      {(() => {
                        const batVal =
                          ubicacion?.bateria_pct ??
                          ubicacion?.bateria ??
                          signosDispositivo?.bateria_pct ??
                          signosDispositivo?.bateria ??
                          signosDispositivo?.data?.bateria_pct ??
                          paciente?.bateria_pct ??
                          null;

                        const ultimaConexionStr =
                          ubicacion?.ultima_conexion ??
                          ubicacion?.updated_at ??
                          signosDispositivo?.ultima_conexion ??
                          signosDispositivo?.created_at ??
                          paciente?.updated_at ??
                          null;

                        // Cálculo de tiempo transcurrido
                        let diffMinutos = 0;
                        if (ultimaConexionStr) {
                          try {
                            const fechaNorm = ultimaConexionStr.includes('Z') || ultimaConexionStr.includes('+')
                              ? ultimaConexionStr
                              : `${ultimaConexionStr.replace(' ', 'T')}Z`;
                            diffMinutos = Math.floor((new Date().getTime() - new Date(fechaNorm).getTime()) / (1000 * 60));
                          } catch {
                            diffMinutos = 0;
                          }
                        }

                        const numBat = batVal !== null && typeof batVal === 'number' ? batVal : null;
                        const estaFueraDeLinea = diffMinutos > 10;
                        const esAgotada = (numBat !== null && numBat <= 3) || (numBat !== null && numBat <= 5 && estaFueraDeLinea);
                        const esBaja = numBat !== null && numBat > 3 && numBat < 20;

                        // Estilos dinámicos
                        let bgPill = '#E8F5E9';
                        let borderPill = '#C8E6C9';
                        let textPill = '#2E7D32';
                        let iconPill = '🔋';
                        let labelPill = numBat !== null ? `${numBat}%` : '--%';

                        if (esAgotada) {
                          bgPill = '#FEE2E2';
                          borderPill = '#DC2626';
                          textPill = '#991B1B';
                          iconPill = '⚠️';
                          labelPill = 'APAGADO';
                        } else if (estaFueraDeLinea) {
                          bgPill = '#FEF3C7';
                          borderPill = '#F59E0B';
                          textPill = '#B45309';
                          iconPill = '📡';
                          labelPill = numBat !== null ? `OFF (${numBat}%)` : 'OFF';
                        } else if (esBaja) {
                          bgPill = '#FFEBEE';
                          borderPill = '#FFCDD2';
                          textPill = '#D94F4F';
                          iconPill = '🪫';
                        }

                        const handlePillPress = () => {
                          if (esAgotada) {
                            Alert.alert(
                              '⚠️ Reloj Apagado por Batería Agotada',
                              'El dispositivo se apagó al descargarse por completo.\n\n' +
                              '1. Conéctelo a la base de carga magnética.\n' +
                              '2. Espere 5 minutos para que tome carga básica.\n' +
                              '3. Mantenga presionado el botón lateral 4 segundos para encenderlo.\n\n' +
                              'El reloj no enviará datos hasta que se encienda nuevamente.',
                              [{ text: 'Entendido', style: 'default' }]
                            );
                          } else if (estaFueraDeLinea) {
                            const tiempoTexto = diffMinutos > 60 
                              ? `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m` 
                              : `${diffMinutos} min`;
                            Alert.alert(
                              '📡 Reloj Fuera de Línea',
                              `El reloj no se comunica desde hace ${tiempoTexto}.\n\n` +
                              `• Última batería registrada: ${numBat !== null ? numBat + '%' : 'No disponible'}\n` +
                              '• Verifique si el dispositivo fue apagado manualmente o se encuentra sin cobertura móvil.',
                              [{ text: 'Entendido', style: 'default' }]
                            );
                          }
                        };

                        return (
                          <TouchableOpacity
                            activeOpacity={esAgotada || estaFueraDeLinea ? 0.7 : 1}
                            onPress={handlePillPress}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: bgPill,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: borderPill,
                              marginLeft: 4,
                            }}
                          >
                            <Text style={{ fontSize: 10, marginRight: 2 }}>
                              {iconPill}
                            </Text>
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '800',
                                color: textPill,
                              }}
                            >
                              {labelPill}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}
                  </View>

                  {/* Botón Sensa Ahora */}
                  <TouchableOpacity 
                    style={[
                      styles.btnMedir, 
                      {
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        minWidth: 105,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      midiendo 
                        ? { backgroundColor: '#E65100', opacity: 0.9 } 
                        : signosDispositivo?.cargando 
                          ? { backgroundColor: '#455A64', opacity: 0.9 } 
                          : null
                    ]} 
                    onPress={() => {
                      if (signosDispositivo?.cargando) {
                        Alert.alert(
                          "🔌 Reloj en Modo Carga",
                          "El sistema detectó que el reloj estaba cargando. ¿El paciente ya lo tiene colocado en la muñeca?",
                          [
                            { text: "Cancelar", style: "cancel" },
                            { 
                              text: "Sí, ya lo tiene puesto", 
                              onPress: () => ejecutarMedicionRemota() 
                            }
                          ]
                        );
                        return;
                      }
                      ejecutarMedicionRemota();
                    }}
                    disabled={midiendo}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.btnMedirText,
                      { fontSize: 11, fontWeight: '800', textAlign: 'center' },
                      (midiendo || signosDispositivo?.cargando) && { color: '#FFFFFF' }
                    ]}>
                      {midiendo 
                        ? "⏳ Sensando..." 
                        : signosDispositivo?.cargando
                          ? "🔌 En Carga " 
                          : "⚡ Sensa Ahora"}
                    </Text>
                  </TouchableOpacity>
                </View>

                  {/* FILA 1: ESTADO DE BIENESTAR, TEMPERATURA Y PESO */}
                  <View style={styles.vitalsGridRow}>
                    {/* CONDICIÓN GENERAL */}
                    <View style={styles.vitalCard}>
                      <Text style={[styles.vitalEmoji, {
                        color: signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'critica' ? COLORS.red 
                          : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'regular' ? COLORS.amber 
                          : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'buena' ? COLORS.green
                          : COLORS.textLight
                      }]}>
                        {signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'critica' ? '😟' 
                          : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'regular' ? '😐' 
                          : signosDispositivo?.frescura?.bphrt && signosDispositivo?.condicion_carita === 'buena' ? '😊' 
                          : '—'}
                      </Text>
                      <Text style={styles.vitalLabel}>Condición</Text>
                    </View>

                    {/* TEMPERATURA CORPORAL */}
                    <View style={styles.vitalCard}>
                      <View style={styles.valueWithUnitRow}>
                        <Text style={[styles.vitalVal, { color: signosDispositivo?.frescura?.temperatura ? COLORS.green : COLORS.textDark }]}>
                          {signosDispositivo?.frescura?.temperatura && signosDispositivo?.temperatura && signosDispositivo?.temperatura !== "—" 
                            ? signosDispositivo.temperatura 
                            : '—'}
                        </Text>
                        {signosDispositivo?.frescura?.temperatura && signosDispositivo?.temperatura !== "—" && (
                          <Text style={styles.vitalUnit}>°C</Text>
                        )}
                      </View>
                      <Text style={styles.vitalLabel}>Temp. Corp.</Text>
                      {signosDispositivo?.temp_ts && (
                        <Text style={styles.subtextoHora}>
                          {formatearHora(signosDispositivo.temp_ts)}
                        </Text>
                      )}
                    </View>

                    {/* PESO */}
                    <View style={styles.vitalCard}>
                      <View style={styles.valueWithUnitRow}>
                        <Text style={[styles.vitalVal, { color: COLORS.cacao }]}>
                          {signosDispositivo?.peso && signosDispositivo?.peso !== "—"
                            ? signosDispositivo.peso.replace(" kg", "") 
                            : (ultimoCierre?.peso_kg ? `${ultimoCierre.peso_kg}` : '—')}
                        </Text>
                        <Text style={styles.vitalUnit}>kg</Text>
                      </View>
                      <Text style={styles.vitalLabel}>Peso</Text>
                    </View>
                  </View>

                  {/* FILA 2: OXIMETRÍA, PRESIÓN ARTERIAL Y FRECUENCIA CARDÍACA */}
                  <View style={styles.vitalsGridRow}>
                    {/* SPO2 */}
                    <View style={styles.vitalCard}>
                      <View style={styles.valueWithUnitRow}>
                        <Text style={[styles.vitalVal, { color: COLORS.cacao }]}>
                          {signosDispositivo?.frescura?.spo2 && signosDispositivo?.spo2 !== "—" 
                            ? signosDispositivo?.spo2 
                            : '—'}
                        </Text>
                        <Text style={styles.vitalUnit}>%</Text>
                      </View>
                      <Text style={styles.vitalLabel}>SpO₂</Text>
                      {signosDispositivo?.spo2_ts && (
                        <Text style={styles.subtextoHora}>
                          {formatearHora(signosDispositivo.spo2_ts)}
                        </Text>
                      )}
                    </View>

                    {/* PRESIÓN ARTERIAL */}
                    <View style={styles.vitalCard}>
                      <View style={styles.valueWithUnitRow}>
                        <Text style={[styles.vitalVal, { color: COLORS.cacao }]}>
                          {signosDispositivo?.frescura?.bphrt && signosDispositivo?.presion !== "—" 
                            ? signosDispositivo?.presion.split('/')[0] 
                            : '—'}
                          <Text style={styles.vitalValSmall}>
                            {signosDispositivo?.frescura?.bphrt && signosDispositivo?.presion !== "—" 
                              ? `/${signosDispositivo?.presion.split('/')[1]}` 
                              : ''}
                          </Text>
                        </Text>
                        <Text style={styles.vitalUnit}>mmHg</Text>
                      </View>
                      <Text style={styles.vitalLabel}>Presión</Text>
                      {signosDispositivo?.bphrt_ts && (
                        <Text style={styles.subtextoHora}>
                          {formatearHora(signosDispositivo.bphrt_ts)}
                        </Text>
                      )}
                    </View>

                    {/* FRECUENCIA CARDÍACA */}
                    <View style={styles.vitalCard}>
                      <View style={styles.valueWithUnitRow}>
                        <Text style={[styles.vitalVal, { color: signosDispositivo?.frescura?.bphrt ? COLORS.red : COLORS.textDark }]}>
                          {signosDispositivo?.frescura?.bphrt && signosDispositivo?.fc !== "—" 
                            ? signosDispositivo?.fc 
                            : '—'}
                        </Text>
                        <Text style={styles.vitalUnit}>bpm</Text>
                      </View>
                      <Text style={styles.vitalLabel}>F. Cardíaca</Text>
                      {signosDispositivo?.bphrt_ts && (
                        <Text style={styles.subtextoHora}>
                          {formatearHora(signosDispositivo.bphrt_ts)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                  
              
               {/* TARJETA CONFIG RELOJ */}
{signosDispositivo?.reloj_config && (
  <TouchableOpacity 
    activeOpacity={0.7}
    onPress={() => setModalConfigVisible(true)}
    style={{
      backgroundColor: COLORS.white,
      borderRadius: 14,
      padding: 14,
      marginTop: 8,
      marginBottom: 16,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    }}
  >
    <Text style={{ fontSize: 24 }}>⚙️</Text>
    
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.cacao, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Configuración del reloj
      </Text>
      
      {/* Estado del detector y sensibilidad */}
      <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>
        {(() => {
          const config = signosDispositivo?.reloj_config;
          if (!config?.caida_activa) return 'Detector de caídas: ⭕ Desactivado';
          
          const sens = Number(config?.sensibilidad ?? config?.sensibilidad_caidas ?? 4);
          switch (sens) {
            case 1: return 'Detector de caídas: 🔴 Muy Alta (1)';
            case 2: return 'Detector de caídas: 🟠 Alta (2)';
            case 3: return 'Detector de caídas: 🟡 Media (3)';
            case 4: return 'Detector de caídas: 🟢 Estándar (4)';
            case 5: return 'Detector de caídas: 🔵 Baja (5)';
            case 6: return 'Detector de caídas: ⚪ Mínima (6)';
            default: return `Detector de caídas: 🟢 Estándar (${sens > 6 ? 4 : sens})`;
          }
        })()}
      </Text>

      {/* Fecha de última sincronización */}
      <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 1 }}>
        {(() => {
          const uc = signosDispositivo?.reloj_config?.ultima_configuracion;
          if (!uc) return 'Última sinc: Sin registro';
          try {
            const fecha = new Date(uc);
            return `Última sinc: ${fecha.toLocaleDateString('es-MX', { 
              day: 'numeric', 
              month: 'short', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}`;
          } catch {
            return 'Última sinc: Sin registro';
          }
        })()}
      </Text>
    </View>

    {/* Botón Acción */}
    <View style={{
      backgroundColor: COLORS.goldPale,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(191, 154, 64, 0.3)',
    }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.gold }}>Ajustar</Text>
    </View>
  </TouchableOpacity>
)}
              </>
            )}
            
           {/* ======================================================== */}
            {/* ⚡ SECCIÓN 1: TURNOS ACTIVOS DE CUIDADO                  */}
            {/* ======================================================== */}
            {(() => {
              // 1. Extraemos la lista cruda
              let turnosBrutos: any[] = [];
              if (Array.isArray(turnoResumen)) {
                turnosBrutos = turnoResumen;
              } else if (Array.isArray(turnoResumen?.turnos)) {
                turnosBrutos = turnoResumen.turnos;
              } else if (turnoResumen?.turno) {
                turnosBrutos = Array.isArray(turnoResumen.turno) ? turnoResumen.turno : [turnoResumen.turno];
              } else if (turnoResumen && typeof turnoResumen === 'object' && turnoResumen.id) {
                turnosBrutos = [turnoResumen];
              }

              // 🚫 2. FILTRAR AL FAMILIAR PRINCIPAL (Solo cuidadores contratados/profesionales)
              const listaCuidadores = turnosBrutos.filter((t: any) => {
                const esFamiliar = 
                  t.es_cobertura === true ||
                  t.tipo_turno === 'familiar' ||
                  t._clase === 'familiar' ||
                  t.rol === 'familiar_principal' ||
                  t.rol === 'admin';
                return !esFamiliar;
              });

              // 🟢 Asignación directa desde los estados actualizados
              const totalTareas = totalTareasHoy;
              const completadasTareas = completadasTareasHoy;
              const hayCuidadores = listaCuidadores.length > 0;

              return (
                <View style={{ marginTop: 12, marginBottom: 8 }}>
                  {/* 🏷️ HEADER DE LA SECCIÓN CON EL CONTADOR ÚNICO */}
                  <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={styles.sectionTitle}>
                      {listaCuidadores.length > 1 ? `Turnos activos (${listaCuidadores.length})` : 'Turno activo'}
                    </Text>

                    {/* 📊 BADGE ÚNICO GLOBAL DE TAREAS DEL PACIENTE */}
                  <View style={{
                    backgroundColor: '#F5EFE6',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E8DFD1',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#8C6D23' }}>
                      {`${completadasTareas}/${totalTareas}`}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#8C8275' }}>
                      tareas
                    </Text>
                  </View>
                  </View>

                  {/* 📋 LISTA DE CUIDADORES EN TURNO */}
                  {hayCuidadores ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {listaCuidadores.map((turno: any, idx: number) => (
                        <View 
                          key={turno.id || turno.turno_id || idx} 
                          style={[
                            styles.turnoCard, 
                            { 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              paddingHorizontal: 14,
                              paddingVertical: 12
                            }
                          ]}
                        >
                          {/* 👤 Avatar con iniciales */}
                          <View style={styles.turnoAvatar}>
                            <Text style={styles.turnoAvatarText}>
                              {turno.cuidador_nombre
                                ?.split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase() || 'CU'}
                            </Text>
                          </View>

                          {/* ℹ️ Nombre y Horario completo */}
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.turnoName, { fontSize: 15, fontWeight: '700' }]} numberOfLines={1}>
                              {turno.cuidador_nombre}
                            </Text>
                            
                            <Text style={[styles.turnoHora, { fontSize: 12, color: '#8C8275', marginTop: 2 }]} numberOfLines={1}>
                              {formatearHorarioRango(turno.horario || turno.hora_inicio)}
                            </Text>
                          </View>

                          {/* 🟢 Indicador sutil de turno en curso */}
                          <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#2E7D32',
                            marginRight: 4
                          }} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.turnoCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 16, marginTop: 8 }]}>
                      <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: 'center' }}>
                        Sin cuidadores contratados en turno activo
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
            
            {/* 📊 Estado del último cierre registrado */}
            {pacienteId && <TarjetaUltimoCierre pacienteId={pacienteId} />}

            {/* 🛡️ Alertas y tamizaje preventivo basado en tendencias */}
            {pacienteId && <BannerAlertasPreventivas pacienteId={pacienteId} />}
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
                        params: { pacienteId: paciente?.id }
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

            {/* ========================================================== */}
            {/* 📝 NOTAS DEL CUIDADOR (CON ACORDEÓN DESPLEGABLE)          */}
            {/* ========================================================== */}
            <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
              Notas del Cuidador
            </Text>

            {notas && notas.length > 0 ? (
              <View style={{ gap: 8, marginBottom: 4 }}>
                {/* Evaluamos qué notas renderizar según el estado de expansión */}
                {(notasExpandidas ? notas.slice(0, 5) : [notas[0]]).map((n, i) => {
                  const contenidoNota = n?.descripcion || n?.texto || "Nota de relevo registrada";
                  return (
                    <View 
                      key={n?.id || i} 
                      style={[styles.alertCard, { 
                        backgroundColor: COLORS.amberPale, 
                        borderColor: '#F5DBA0', 
                        marginHorizontal: 0, 
                        marginBottom: 0,
                        flexDirection: 'row',
                        alignItems: 'center'
                      }]}
                    >
                      <Text style={styles.alertIcon}>📝</Text>
                      <View style={[styles.alertContent, { flex: 1, justifyContent: 'center' }]}>
                        <Text style={styles.alertTitle}>
                          {String(contenidoNota).replace('📝 ', '')}
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
                  );
                })}

                {/* Botón de despliegue interactivo (Visible si hay más de 1 nota) */}
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
              </View>
            ) : (
              <View style={[styles.alertCard, { backgroundColor: '#F9F9F9', borderColor: COLORS.border, marginHorizontal: 0 }]}>
                <Text style={styles.alertIcon}>🔍</Text>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Sin notas en el bloque actual</Text>
                  <Text style={styles.alertSub}>El cuidador aún no ha registrado notas de relevo.</Text>
                </View>
              </View>
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
            { 
              Icon: MapPin, 
              label: 'Mapa', 
              ruta: '/mapa', 
              active: pathname === '/mapa',
              requiereReloj: true // ⌚ Solo visible con hardware activo
            },
            { 
              Icon: Pill, 
              label: 'Medicam.', 
              ruta: '/medicamentos', 
              active: pathname === '/medicamentos',
              requiereReloj: false
            },                          
            { 
              Icon: Bell, 
              label: 'Alertas', 
              ruta: '/alertas', 
              active: pathname === '/alertas',
              requiereReloj: false
            },
            { 
              Icon: Calendar, 
              label: 'Calendario', 
              ruta: '/calendario', 
              active: pathname === '/calendario',
              requiereReloj: false
            },
          ]
          // 🎯 FILTRO: Si el ítem requiere reloj y el paciente no tiene IMEI (es null/vacío), se oculta
          .filter((item) => {
            if (item.requiereReloj) {
              return Boolean(paciente?.reloj_imei && paciente.reloj_imei.trim() !== '');
            }
            return true;
          })
          .map((item) => {
            const IconComponent = item.Icon;
            const activeColor = item.active ? COLORS.gold : '#777777';

            return (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                onPress={() => {
                  router.push({
                    pathname: item.ruta as any,
                    params: {
                      pacienteId: paciente?.id,
                      pacienteNombre: paciente?.nombre_completo,
                    }
                  });
                }}
              >
                {/* Renderiza el componente de Lucide con el color dinámico correcto */}
                <IconComponent size={22} color={activeColor} style={{ marginBottom: 4 }} />
                
                <Text style={[styles.navLabel, item.active && { color: COLORS.gold }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
          {/* 🎛️ MODAL DE CONTROL Y CONFIGURACIÓN DEL RELOJ CON CONFIRMACIONES */}
          <Modal
            visible={modalConfigVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalConfigVisible(false)}
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
                maxHeight: '85%',
              }}>
                
                {/* Cabecera */}
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
                      Ajustes: {nombre}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setModalConfigVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={24} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24 }}
                >

                  {/* 🟢 1. ACCIONES OPERATIVAS */}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                    Acciones Operativas
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
                        paddingVertical: 11,
                        gap: 6,
                      }}
                      disabled={ejecutandoCmd !== null}
                      onPress={() => {
                        solicitarConfirmacion(
                          "🔊 Hacer Sonar Dispositivo",
                          `¿Deseas enviar una señal acústica continua al reloj de ${nombre} para localizarlo?`,
                          () => ejecutarComandoReloj('FIND')
                        );
                      }}
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
                        paddingVertical: 11,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        gap: 6,
                      }}
                      disabled={ejecutandoCmd !== null}
                      onPress={() => {
                        solicitarConfirmacion(
                          "🚶 Activar Sensor de Pasos",
                          "¿Deseas encender y sincronizar el podómetro continuo 24h en el reloj?",
                          () => ejecutarComandoReloj('PEDO', '1')
                        );
                      }}
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

                  {/* Reiniciar */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: COLORS.goldPale,
                      borderRadius: 10,
                      paddingVertical: 11,
                      borderWidth: 1,
                      borderColor: 'rgba(191, 154, 64, 0.25)',
                      gap: 6,
                      marginBottom: 20,
                    }}
                    disabled={ejecutandoCmd !== null}
                    onPress={() => {
                      solicitarConfirmacion(
                        "🔄 Reiniciar Reloj Remotamente",
                        "El dispositivo se reiniciará y tardará aproximadamente 60 segundos en reconectarse a la red celular.",
                        () => confirmarAccionCritica('RESET'),
                        true
                      );
                    }}
                  >
                    {ejecutandoCmd === 'RESET' ? (
                      <ActivityIndicator color={COLORS.gold} size="small" />
                    ) : (
                      <>
                        <Ionicons name="reload-outline" size={15} color={COLORS.gold} />
                        <Text style={{ color: COLORS.cacao, fontSize: 11, fontWeight: '800' }}>Reiniciar Reloj</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* 🛡️ 2. DETECTOR DE CAÍDAS & SENSIBILIDAD */}
                  <View style={{
                    backgroundColor: COLORS.cream,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    marginBottom: 20,
                  }}>
                    {/* Encabezado Switch con Confirmación */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.cacao }}>
                          Detector de Caídas
                        </Text>
                        <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 1 }}>
                          {Boolean(signosDispositivo?.reloj_config?.caida_activa) 
                            ? '🟢 Activo: Dispara alerta SOS ante impactos' 
                            : '⚪ Desactivado: El sensor no emitirá alertas'}
                        </Text>
                      </View>
                      
                      <Switch
                        value={Boolean(signosDispositivo?.reloj_config?.caida_activa)}
                        disabled={ejecutandoCmd === 'FALLDOWN'}
                        onValueChange={(nuevoEstado) => {
                          solicitarConfirmacion(
                            nuevoEstado ? "🛡️ Activar Detección de Caídas" : "⚠️ Desactivar Detección",
                            nuevoEstado 
                              ? "¿Deseas habilitar el monitoreo de caídas e impactos para este paciente?"
                              : "¿Estás seguro de apagar el sensor de caídas? El sistema no podrá notificar emergencias por caídas.",
                            async () => {
                              await ejecutarComandoReloj('FALLDOWN', nuevoEstado ? '1,1' : '0,0');
                            },
                            !nuevoEstado
                          );
                        }}
                        trackColor={{ false: '#D1D5DB', true: COLORS.gold }}
                        thumbColor={COLORS.white}
                      />
                    </View>

                    {/* Selector de Sensibilidad con Confirmación */}
                    <View style={{ opacity: Boolean(signosDispositivo?.reloj_config?.caida_activa) ? 1 : 0.45 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>
                        Sensibilidad del Sensor
                      </Text>
                      
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        {[
                          { val: 1, label: '🔴 Muy Alta (1)', desc: 'Mínimo movimiento' },
                          { val: 2, label: '🟠 Alta (2)', desc: 'Adulto frágil' },
                          { val: 3, label: '🟡 Media (3)', desc: 'Sensibilidad balanceada' },
                          { val: 4, label: '🟢 Estándar (4)', desc: 'Uso diario normal' },
                          { val: 5, label: '🔵 Baja (5)', desc: 'Impacto moderado' },
                          { val: 6, label: '⚪ Mínima (6)', desc: 'Impactos severos' },
                        ].map((op) => {
                          const activo = Number(sensibilidadLocal) === op.val;
                          const caidaHabilitada = Boolean(signosDispositivo?.reloj_config?.caida_activa);

                          return (
                            <TouchableOpacity
                              key={op.val}
                              activeOpacity={0.8}
                              disabled={!caidaHabilitada || ejecutandoCmd === 'LSSET'}
                              style={{
                                width: '48.5%',
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                borderRadius: 10,
                                backgroundColor: activo ? COLORS.cacao : COLORS.white,
                                borderWidth: activo ? 2 : 1,
                                borderColor: activo ? COLORS.gold : COLORS.border,
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                shadowColor: activo ? '#000' : 'transparent',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: activo ? 0.2 : 0,
                                shadowRadius: 4,
                                elevation: activo ? 4 : 0,
                              }}
                              onPress={() => {
                                if (activo) return; // Si ya está seleccionado, no hacer nada

                                solicitarConfirmacion(
                                  "🎯 Ajustar Sensibilidad de Caída",
                                  `¿Cambiar nivel a "${op.label}" (${op.desc})?`,
                                  async () => {
                                    setSensibilidadLocal(op.val);
                                    await ejecutarComandoReloj('LSSET', `${op.val}+${op.val}`);
                                  }
                                );
                              }}
                            >
                              {activo && (
                                <View style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 6,
                                  backgroundColor: COLORS.gold,
                                  borderRadius: 10,
                                  paddingHorizontal: 4,
                                  paddingVertical: 1,
                                }}>
                                  <Text style={{ fontSize: 8, fontWeight: '900', color: COLORS.cacao }}>✓ ACTIVO</Text>
                                </View>
                              )}

                              <Text style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: activo ? COLORS.white : COLORS.textDark,
                                marginTop: activo ? 4 : 0,
                              }}>
                                {op.label}
                              </Text>

                              <Text style={{
                                fontSize: 8.5,
                                fontWeight: '600',
                                color: activo ? COLORS.gold : COLORS.textLight,
                                marginTop: 3,
                                textAlign: 'center',
                              }}>
                                {op.desc}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* 🛑 3. APAGADO REMOTO */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(220, 38, 38, 0.08)',
                      borderRadius: 10,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(220, 38, 38, 0.2)',
                      gap: 8,
                      marginBottom: 16,
                    }}
                    disabled={ejecutandoCmd !== null}
                    onPress={() => {
                      solicitarConfirmacion(
                        "🛑 Apagar Reloj Remotamente",
                        "⚠️ ATENCIÓN: El reloj se apagará por completo y NO podrá encenderse a distancia (requerirá presionar el botón físico en el dispositivo). ¿Confirmas el apagado?",
                        () => confirmarAccionCritica('POWEROFF'),
                        true
                      );
                    }}
                  >
                    {ejecutandoCmd === 'POWEROFF' ? (
                      <ActivityIndicator color="#DC2626" size="small" />
                    ) : (
                      <>
                        <Ionicons name="power-outline" size={16} color="#DC2626" />
                        <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '800' }}>Apagar Reloj Remotamente</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Cerrar Modal */}
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
                    onPress={() => setModalConfigVisible(false)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textDark }}>Cerrar</Text>
                  </TouchableOpacity>

                  <View style={{ height: 20 }} />

                </ScrollView>
              </View>
            </View>
          </Modal>
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
  // ── 1. ESTRUCTURA Y CONTENEDORES PRINCIPALES ──
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // ── 2. ENCABEZADO PRINCIPAL (MODO FAMILIAR) ──
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  greeting: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.gold, // 👈 Estandarizado a dorado institucional
    marginBottom: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  notifBtn: {
    width: 36, 
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', 
    justifyContent: 'center',
  },
  notifIcon: { 
    fontSize: 16 
  },

  // ── 3. ENCABEZADO COMPACTO (MODO SWITCH / CONSOLA) ──
  headerConsolaCompacto: {
    backgroundColor: COLORS.cacao,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 38) : 48,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2820',
  },
  userNameConsola: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  badgeConsola: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeConsolaText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.cacao,
    letterSpacing: 0.5,
  },
  notifBtnMin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── 4. TARJETA PRINCIPAL DEL PACIENTE ──
  patientCard: {
    backgroundColor: COLORS.cacao,
    marginHorizontal: 16,
    marginTop: 12,      
    marginBottom: 20,   
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  patientAvatar: {
    width: 44, 
    height: 44, 
    borderRadius: 22,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2, 
    borderColor: COLORS.gold,
  },
  patientAvatarText: {
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.gold,
  },
  patientInfo: { 
    flex: 1 
  },
  patientName: {
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.white,
  },
  patientAge: {
    fontSize: 11, 
    color: 'rgba(255,255,255,0.6)', 
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4,
    backgroundColor: COLORS.greenPale,
    borderRadius: 20, 
    paddingHorizontal: 10, 
    paddingVertical: 4,
    borderWidth: 1, 
    borderColor: COLORS.green + '40',
  },
  statusDot: {
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: COLORS.green,
  },
  statusText: {
    fontSize: 9, 
    fontWeight: '800', 
    color: COLORS.green, 
    letterSpacing: 0.5,
  },

  // ── 5. SECCIÓN DE SIGNOS VITALES Y SENSADO ──
  vitalsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,  
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  vitalsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
 vitalsHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.cacao,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  btnMedir: {
    backgroundColor: COLORS.cacao,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnMedirDesactivado: {
    opacity: 0.5,
  },
  btnMedirText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  vitalsGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vitalVal: {
    fontSize: 16, 
    fontWeight: '800', 
    color: COLORS.gold, 
    lineHeight: 20,
  },
  vitalValSmall: {
    fontSize: 10,
  },
  valueWithUnitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  vitalEmoji: {
    fontSize: 22,
    lineHeight: 26,
    marginBottom: 2,
  },

 
  vitalUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  vitalLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
 
 

  // ── 6. SECCIONES, CABECERAS Y ENLACES ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 1,
    textTransform: 'uppercase', 
    color: COLORS.cacao,
  },
  sectionLink: {
    fontSize: 11, 
    fontWeight: '700', 
    color: COLORS.gold,
  },

  // ── 7. BOTONES DE ACCIÓN RÁPIDA ──
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  qaIcon: { 
    fontSize: 20, 
    marginBottom: 4 
  },
  qaLabel: {
    fontSize: 9, 
    fontWeight: '700', 
    color: COLORS.textDark, 
    textAlign: 'center',
  },

  // ── 8. LISTA DE TAREAS Y TARJETAS DE TURNO ──
  tareaCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tareaIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  tareaInfo: {
    flex: 1,
  },
  tareaTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  tareaHora: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textLight,
    marginTop: 2,
  },
  tareaCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  turnoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14, 
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, 
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  turnoLeft: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
  },
  turnoAvatar: {
    width: 38, 
    height: 38, 
    borderRadius: 19,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  turnoAvatarText: {
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.gold,
  },
  turnoName: {
    fontSize: 13, 
    fontWeight: '700', 
    color: COLORS.textDark,
  },
  turnoHora: {
    fontSize: 10, 
    color: COLORS.textLight, 
    marginTop: 1,
  },
  turnoProgress: {
    alignItems: 'center',
    backgroundColor: COLORS.goldPale,
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 6,
  },
  turnoProgressText: {
    fontSize: 15, 
    fontWeight: '800', 
    color: COLORS.gold,
  },
  turnoProgressLabel: {
    fontSize: 8, 
    color: COLORS.gold, 
    fontWeight: '700',
  },

  // ── 9. TARJETAS DE ALERTA Y AVISOS ──
  alertCard: {
    borderRadius: 12, 
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
  },
  alertIcon: { 
    fontSize: 18 
  },
  alertContent: { 
    flex: 1 
  },
  alertTitle: {
    fontSize: 12, 
    fontWeight: '700', 
    color: COLORS.textDark,
  },
  alertSub: {
    fontSize: 10, 
    color: COLORS.textLight, 
    marginTop: 2, 
    lineHeight: 14,
  },
  alertTime: {
    fontSize: 9, 
    color: COLORS.textLight,
  },

  // ── 10. BOTONES GENERALES DE ACCIÓN ──
  iniciarBtn: {
    backgroundColor: COLORS.cacao,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
  },
  iniciarBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // ── 11. BARRA DE NAVEGACIÓN INFERIOR (BOTTOM NAV) ──
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 20 : 28, 
  },
  navItem: {
    flex: 1, 
    alignItems: 'center', 
    gap: 3,
  },
  navIcon: { 
    fontSize: 18 
  },
  navLabel: {
    fontSize: 9, 
    fontWeight: '700', 
    color: COLORS.textLight,
  },
  bannerVerificando: {
  backgroundColor: '#FFF3CD',
  borderColor: '#FFEEBA',
  borderWidth: 1,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 8,
  marginBottom: 10,
  alignItems: 'center',
},
textoBanner: {
  color: '#856404',
  fontSize: 12,
  fontWeight: '600',
},
subtextoHora: {
  fontSize: 10,
  color: COLORS.textLight || '#6c757d',
  marginTop: 2,
  textAlign: 'center',
},
});