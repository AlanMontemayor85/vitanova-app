// ─────────────────────────────────────────
// Vitanova API — conexión al backend Railway
// ─────────────────────────────────────────

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

// Guardar token en memoria (en producción usar SecureStore)
let authToken: string | null = null;

export const setToken = (token: string) => { authToken = token; };
export const getToken = () => authToken;
export const getUserNombre = () => getUserNombre;
const headers = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

// ── AUTH ──────────────────────────────────
export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.access_token) setToken(data.access_token);
  return data;
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

