// ─────────────────────────────────────────
// Vitanova API — conexión al backend Railway
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router'; // 🎯 Importación clave para expulsión táctica
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

let authToken: string | null = null;
let userNombre: string | null = null;
let userTipo: string | null = null;

export const setToken = async (token: string) => {
  authToken = token;
  await SecureStore.setItemAsync('vitanova_token', token);
};

export const getToken = () => authToken;
export const getUserNombre = () => userNombre;
export const getUserTipo = () => userTipo;

export const loadStoredToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('vitanova_token');
    if (token) authToken = token;
    return token;
  } catch {
    return null;
  }
};

export const clearToken = async () => {
  authToken = null;
  userNombre = null;
  userTipo = null;
  
  try {
    await SecureStore.deleteItemAsync('vitanova_token');
    await AsyncStorage.removeItem('usuario_tipo');
    await AsyncStorage.removeItem('usuario_rol');
    console.log("🧼 Sesión e identidades completamente purgadas del dispositivo.");
  } catch (error) {
    console.error("Error al purgar el almacenamiento local:", error);
  }
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

// 🚀 INTERCEPTOR GLOBAL: Asegura el ruteo limpio y la expulsión inmediata ante caídas de sesión
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...((options.headers as any) ?? {}),
      },
    });

    // 🥾 DETECCIÓN Y EXPULSIÓN AUTOMÁTICA
    if (res.status === 401 || res.status === 403) {
      console.warn("🚨 [SESIÓN CAÍDA] Token inválido o expirado. Purgando acceso local...");
      await clearToken();
      router.replace('/login'); // 🎯 Te saca de inmediato a la pantalla de login
    }
    return res;
  } catch (error) {
    console.error("❌ Fallo crítico de red o Railway inalcanzable:", error);
    throw error;
  }
};

export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.access_token) {
    await setToken(data.access_token);
    userNombre = data.nombre ?? null;
    userTipo = data.tipo ?? null;
  }
  return data;
};

// ==============================================================================
// 🪐 RUTAS CONVERTIDAS AL GUARDIÁN DE AUTENTICACIÓN CENTRAL (fetchWithAuth)
// ==============================================================================

export const getPacientes = async () => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/medical/patients`);
    return await res.json();
  } catch (error) {
    return { error: String(error) };
  }
};

export const getUltimoCierre = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/ultimo-cierre`);
  const data = await res.json();
  console.log('getPacientes:', JSON.stringify(data));
  return data;
};

export const getNotasTurno = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/notas-turno`);
    if (!res.ok) return { notas: [] };
    const data = await res.json();
    return Array.isArray(data?.notas) ? data : { notas: [] };
  } catch {
    return { notas: [] };
  }
};

export const getHistorialCierres = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/historial-cierres`);
  return res.json();
};

export const getEquipoPaciente = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/equipo`);
  return res.json();
};

export const getTurnoActivo = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/turnos/activo/${pacienteId}`);
  return res.json();
};

export const completarTarea = async (tareaId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/tareas/${tareaId}/completar`, { method: 'PATCH' });
  return res.json();
};

export const getMedicamentos = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/medicamentos/${pacienteId}`);
  return res.json();
};

export const crearMedicamento = async (medicamento: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/medicamentos`, {
    method: 'POST',
    body: JSON.stringify(medicamento),
  });
  return res.json();
};

export const desactivarMedicamento = async (medicamentoId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/medicamentos/${medicamentoId}/desactivar`, { method: 'PATCH' });
  return res.json();
};

export const getTareasRecurrentes = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes/${pacienteId}`);
  return res.json();
};

export const crearTareaRecurrente = async (tarea: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes`, {
    method: 'POST',
    body: JSON.stringify(tarea),
  });
  return res.json();
};

export const crearPaciente = async (paciente: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes`, {
    method: 'POST',
    body: JSON.stringify(paciente),
  });
  return res.json();
};

export const actualizarPaciente = async (id: string, campos: any) => {
  try {
    const url = id === 'nuevo' ? `${BASE_URL}/pacientes/nuevo` : `${BASE_URL}/pacientes/${id}`;
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      body: JSON.stringify(campos),
    });

    if (!response.ok) {
      const textoError = await response.text();
      console.error("❌ El servidor de Railway respondió con error crudo:", textoError);
      throw new Error(`Error del servidor (${response.status}): ${textoError}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error en actualizarPaciente:", error);
    throw error;
  }
};

export const desactivarTareaRecurrente = async (tareaId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes/${tareaId}/desactivar`, { method: 'PATCH' });
  return res.json();
};

export const getAlertas = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/alertas`);
  return res.json();
};

export const getUbicacion = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/ubicacion`);
  return res.json();
};

export const registrarPushToken = async (token: string, plataforma: string) => {
  let auth = getToken();
  if (!auth) auth = await loadStoredToken();
  if (!auth) {
    console.log('📡 Push: sin sesión activa todavía, se omite el registro');
    return null;
  }

  const res = await fetch(`${BASE_URL}/push/register`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${auth}`,
      'Content-Type': 'application/json',  // ← faltaba esto
    },
    body: JSON.stringify({ token, plataforma }),
  });
  return res.json();
};
export const crearEvaluacion = async (data: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/evaluaciones/hogar`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getEvaluaciones = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/evaluaciones/hogar/${pacienteId}`);
  return res.json();
};

export const verificarEscalas = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/escalas/verificar/${pacienteId}`);
  return res.json();
};

export const guardarEscala = async (escala: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/escalas`, {
    method: 'POST',
    body: JSON.stringify(escala),
  });
  return res.json();
};

export const getEscalas = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/escalas/${pacienteId}`);
  return res.json();
};

export const getDashboardMedico = async () => {
  const res = await fetchWithAuth(`${BASE_URL}/medico/dashboard`);
  return res.json();
};

export const getEvolucionPaciente = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/medico/paciente/${pacienteId}/evolucion`);
  return res.json();
};

export const crearGeocerca = async (data: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/geocercas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getGeocercas = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/geocercas/${pacienteId}`);
  return res.json();
};

export const iniciarTurno = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/turnos/iniciar`, {
    method: 'POST',
    body: JSON.stringify({ paciente_id: pacienteId }),
  });
  const data = await res.json();
  if (data.error === 'sin_horario') {
    return { sin_horario: true, mensaje: data.mensaje };
  }
  return data;
};

export const eliminarGeocerca = async (geocercaId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/geocercas/${geocercaId}`, { method: 'DELETE' });
  return res.json();
};

export const detectarCambiosTurno = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/turnos/cambios/${pacienteId}`);
  return res.json();
};

export const transferirPendientes = async (turnoId: string, pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/turnos/transferir-pendientes`, {
    method: 'POST',
    body: JSON.stringify({ turno_id: turnoId, paciente_id: pacienteId }),
  });
  return res.json();
};

export const reiniciarRegistroServidor = async () => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/reiniciar-registro`, { method: 'DELETE' });
    return await response.json();
  } catch (error) {
    console.error("Error en reiniciarRegistroServidor:", error);
    return { error: true };
  }
};

export const agregarTareaManual = async (tarea: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/tareas`, {
    method: 'POST',
    body: JSON.stringify(tarea),
  });
  return res.json();
};

export const getTareasHoy = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/tareas-hoy`);
  return res.json();
};

export const completarActividad = async (actividadId: string, pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/actividades/completar`, {
    method: 'POST',
    body: JSON.stringify({ actividad_id: actividadId, paciente_id: pacienteId }),
  });
  return res.json();
};

export const calibrarAcelerometroReloj = async (pacienteId: string, sensibilidad: string = "2") => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/configurar-reloj`, {
    method: 'POST',
    body: JSON.stringify({ comando: "FALL", argumento: sensibilidad }),
  });
  return res.json();
};

export const actualizarHorarioCuidador = async (pacienteId: string, usuarioId: string, datos: any) => {
  const res = await fetchWithAuth(`${BASE_URL}/equipo/${pacienteId}/${usuarioId}/horario`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
  return res.json();
};

export const completarMedicamento = async (medId: string, pacienteId: string, descripcion: string, horaProgramada: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/medicamentos/completar`, {
    method: 'POST',
    body: JSON.stringify({ med_id: medId, paciente_id: pacienteId, descripcion, hora_programada: horaProgramada }),
  });
  return res.json();
};

export const crearInvitacion = async (datos: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/invitaciones`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return res.json();
};

export const register = async (email: string, password: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return await res.json();
  } catch (e) {
    console.log('Error fetch registro:', e);
    throw e;
  }
};

export const buscarInvitacion = async (codigo: string) => {
  const res = await fetch(`${BASE_URL}/invitaciones/buscar?codigo=${codigo.toLowerCase()}`);
  return JSON.parse(await res.text());
};

export const aceptarInvitacion = async (token: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/invitaciones/${token}/aceptar`, { method: 'POST' });
  return res.json();
};

export const removerDelEquipo = async (pacienteId: string, usuarioId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/equipo/${pacienteId}/${usuarioId}`, { method: 'DELETE' });
  return res.json();
};

export const getSignosVitalesHistorico = async (pacienteId: string, limit: number = 10) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/signos-vitales-historico?limit=${limit}`);
  return res.json();
};

export const getTurnoActivoResumen = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/turno-activo-resumen`);
  return res.json();
};

export const getAlertaPeso = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/alerta-peso`);
  return res.json();
};

export const getTareasDia = async (pacienteId: string, fecha?: string) => {
  const hoy = fecha || new Date().toLocaleDateString('en-CA');
  const offsetMinutos = new Date().getTimezoneOffset();
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/tareas-dia?fecha=${hoy}&offset=${offsetMinutos}`);
  return res.json();
};

export const getSignosRecientes = async (patientId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${patientId}/signos-recientes`);
    return await res.json();
  } catch (error) {
    console.error("❌ Error en servicio getSignosRecientes:", error);
    return { success: false, spo2: "—", presion: "—", fc: "—", temperatura: "—" };
  }
};

export const forzarMedicionSignos = async (patientId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${patientId}/forzar-medicion`, { method: 'POST' });
    return await res.json();
  } catch (error) {
    console.error("❌ Error en servicio forzarMedicionSignos:", error);
    return { status: "error", error: String(error) };
  }
};

export const configurarReloj = async (
  patientId: string, 
  sensibilidad?: string,
  comando?: string,
  argumento?: string
) => {
  const token = getToken();
  const body = comando 
    ? { comando, argumento }
    : sensibilidad 
      ? { comando: 'FALL', argumento: sensibilidad }
      : {};
      
  const res = await fetch(`${BASE_URL}/pacientes/${patientId}/configurar-reloj`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  return res.json();
};

export const crearLead = async (lead: object) => {
  const res = await fetchWithAuth(`${BASE_URL}/leads`, {
    method: 'POST',
    body: JSON.stringify(lead),
  });
  return res.json();
};