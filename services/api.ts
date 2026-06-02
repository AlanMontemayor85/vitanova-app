// ─────────────────────────────────────────
// Vitanova API — conexión al backend Railway
// ─────────────────────────────────────────

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
  await SecureStore.deleteItemAsync('vitanova_token');
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

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

export const getPacientes = async () => {
  const res = await fetch(`${BASE_URL}/medical/patients`, {
    headers: headers(),
  });
  return res.json();
};

export const getUltimoCierre = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/ultimo-cierre`, {
    headers: headers(),
  });
  const data = await res.json();
  console.log('getPacientes:', JSON.stringify(data));
  return data;
};

export const getNotasTurno = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/notas-turno`, {
    headers: headers(),
  });
  return res.json();
};

export const getHistorialCierres = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/historial-cierres`, {
    headers: headers(),
  });
  return res.json();
};
export const getEquipoPaciente = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/equipo`, {
    headers: headers(),
  });
  return res.json();
};
export const getTurnoActivo = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/turnos/activo/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};

export const completarTarea = async (tareaId: string) => {
  const res = await fetch(`${BASE_URL}/tareas/${tareaId}/completar`, {
    method: 'PATCH',
    headers: headers(),
  });
  return res.json();
};
export const getMedicamentos = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/medicamentos/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};

export const crearMedicamento = async (medicamento: object) => {
  const res = await fetch(`${BASE_URL}/medicamentos`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(medicamento),
  });
  return res.json();
};

export const desactivarMedicamento = async (medicamentoId: string) => {
  const res = await fetch(`${BASE_URL}/medicamentos/${medicamentoId}/desactivar`, {
    method: 'PATCH',
    headers: headers(),
  });
  return res.json();
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...((options.headers as any) ?? {}),
    },
  });
  if (res.status === 401) {
    await clearToken();
  }
  return res;
};

export const getTareasRecurrentes = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/tareas-recurrentes/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};

export const crearTareaRecurrente = async (tarea: object) => {
  const res = await fetch(`${BASE_URL}/tareas-recurrentes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(tarea),
  });
  return res.json();
};
export const crearPaciente = async (paciente: object) => {
  const res = await fetch(`${BASE_URL}/pacientes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(paciente),
  });
  return res.json();
};
export const actualizarPaciente = async (pacienteId: string, datos: object) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(datos),
  });
  return res.json();
};
export const desactivarTareaRecurrente = async (tareaId: string) => {
  const res = await fetch(`${BASE_URL}/tareas-recurrentes/${tareaId}/desactivar`, {
    method: 'PATCH',
    headers: headers(),
  });
  return res.json();
};
export const getAlertas = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/alertas`, {
    headers: headers(),
  });
  return res.json();
};
export const getUbicacion = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/ubicacion`, {
    headers: headers(),
  });
  return res.json();
};
export const registrarPushToken = async (token: string, plataforma: string) => {
  const res = await fetch(`${BASE_URL}/push/register`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ token, plataforma }),
  });
  return res.json();
};
export const crearEvaluacion = async (data: object) => {
  const res = await fetch(`${BASE_URL}/evaluaciones/hogar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getEvaluaciones = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/evaluaciones/hogar/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};
export const verificarEscalas = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/escalas/verificar/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};

export const guardarEscala = async (escala: object) => {
  const res = await fetch(`${BASE_URL}/escalas`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(escala),
  });
  return res.json();
};

export const getEscalas = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/escalas/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};
export const getDashboardMedico = async () => {
  const res = await fetch(`${BASE_URL}/medico/dashboard`, {
    headers: headers(),
  });
  return res.json();
};

export const getEvolucionPaciente = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/medico/paciente/${pacienteId}/evolucion`, {
    headers: headers(),
  });
  return res.json();
};
export const crearGeocerca = async (data: object) => {
  const res = await fetch(`${BASE_URL}/geocercas`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getGeocercas = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/geocercas/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};
export const iniciarTurno = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/turnos/iniciar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ paciente_id: pacienteId }),
  });
  const data = await res.json();
  console.log('iniciarTurno status:', res.status);
  console.log('iniciarTurno raw:', JSON.stringify(data));
  if (data.error === 'sin_horario') {
    return { sin_horario: true, mensaje: data.mensaje };
  }
  return data;
};
export const eliminarGeocerca = async (geocercaId: string) => {
  const res = await fetch(`${BASE_URL}/geocercas/${geocercaId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return res.json();
};
export const detectarCambiosTurno = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/turnos/cambios/${pacienteId}`, {
    headers: headers(),
  });
  return res.json();
};

export const transferirPendientes = async (turnoId: string, pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/turnos/transferir-pendientes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ turno_id: turnoId, paciente_id: pacienteId }),
  });
  return res.json();
};

export const agregarTareaManual = async (tarea: object) => {
  const res = await fetch(`${BASE_URL}/tareas`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(tarea),
  });
  return res.json();
};
export const getTareasHoy = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/tareas-hoy`, {
    headers: headers(),
  });
  return res.json();
};

export const completarActividad = async (actividadId: string, pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/actividades/completar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ actividad_id: actividadId, paciente_id: pacienteId }),
  });
  return res.json();
};

export const actualizarHorarioCuidador = async (
  pacienteId: string,
  usuarioId: string,
  datos: { horario_inicio: string; horario_fin: string; dias_semana: string[] }
) => {
  const res = await fetch(`${BASE_URL}/equipo/${pacienteId}/${usuarioId}/horario`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(datos),
  });
  return res.json();
};

export const completarMedicamento = async (
  medId: string, 
  pacienteId: string, 
  descripcion: string,
  horaProgramada: string
) => {
  const res = await fetch(`${BASE_URL}/medicamentos/completar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ 
      med_id: medId, 
      paciente_id: pacienteId,
      descripcion,
      hora_programada: horaProgramada
    }),
  });
  return res.json();
};
export const crearInvitacion = async (datos: object) => {
  const res = await fetch(`${BASE_URL}/invitaciones`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(datos),
  });
  return res.json();
};
export const register = async (email: string, password: string) => {
  console.log('Registrando en:', `${BASE_URL}/auth/register`);
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    console.log('Respuesta registro:', data);
    return data;
  } catch (e) {
    console.log('Error fetch registro:', e);
    throw e;
  }
};
export const buscarInvitacion = async (codigo: string) => {
  const res = await fetch(`${BASE_URL}/invitaciones/buscar?codigo=${codigo.toLowerCase()}`);
  const raw = await res.text();
  console.log('buscarInvitacion raw:', raw);
  return JSON.parse(raw);
};

export const aceptarInvitacion = async (token: string) => {
  const authToken = await loadStoredToken();
  const res = await fetch(`${BASE_URL}/invitaciones/${token}/aceptar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  return res.json();
};
export const removerDelEquipo = async (pacienteId: string, usuarioId: string) => {
  const res = await fetch(`${BASE_URL}/equipo/${pacienteId}/${usuarioId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return res.json();
};
export const getSignosVitalesHistorico = async (pacienteId: string, limit: number = 10) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/signos-vitales-historico?limit=${limit}`, {
    headers: headers(),
  });
  return res.json();
};
export const getTurnoActivoResumen = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/turno-activo-resumen`, {
    headers: headers(),
  });
  return res.json();
};
export const getAlertaPeso = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/alerta-peso`, {
    headers: headers(),
  });
  return res.json();
};
export const getTareasDia = async (pacienteId: string, fecha?: string) => {
  const hoy = fecha || new Date().toLocaleDateString('en-CA');
  const offsetMinutos = new Date().getTimezoneOffset(); // 360 para CST, 300 para EST, 480 para PST
  const res = await fetch(
    `${BASE_URL}/pacientes/${pacienteId}/tareas-dia?fecha=${hoy}&offset=${offsetMinutos}`, 
    { headers: headers() }
  );
  return res.json();
};
export const crearLead = async (lead: object) => {
  const res = await fetch(`${BASE_URL}/leads`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(lead),
  });
  
  return res.json();
};