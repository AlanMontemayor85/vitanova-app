// ─────────────────────────────────────────
// Vitanova API — conexión al backend Railway
// ─────────────────────────────────────────

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

// Guardar token en memoria (en producción usar SecureStore)
let authToken: string | null = null;

export const setToken = (token: string) => { authToken = token; };
export const getToken = () => authToken;
let userNombre: string | null = null;
export const getUserNombre = () => userNombre;

const headers = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

export const getUltimoCierre = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/ultimo-cierre`, {
    headers: headers(),
  });
  return res.json();
};
// ── AUTH ──────────────────────────────────
export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.access_token) {
    authToken = data.access_token;
    userNombre = data.nombre ?? null;
}
  return data;
  
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

export const getNotasTurno = async (pacienteId: string) => {
  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/notas-turno`, {
    headers: headers(),
  });
  return res.json();
};
// ── PACIENTES ─────────────────────────────
export const getPacientes = async () => {
  const res = await fetch(`${BASE_URL}/medical/patients`, {
    headers: headers(),
  });
  return res.json();
};

// ── LEADS ─────────────────────────────────
export const crearLead = async (lead: object) => {
  const res = await fetch(`${BASE_URL}/leads`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(lead),
  });
  return res.json();
};

