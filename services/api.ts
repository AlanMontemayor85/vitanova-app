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
  return res.json();
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
export const crearLead = async (lead: object) => {
  const res = await fetch(`${BASE_URL}/leads`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(lead),
  });
  return res.json();
};