import { encolarPeticionOffline } from './offlineQueue';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';


let authToken: string | null = null;
let userNombre: string | null = null;
let userTipo: string | null = null;
let onSessionExpiredCallback: (() => void) | null = null;
let SecureStore: any;
let AsyncStorage: any;
try {
  SecureStore = require('expo-secure-store');
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.warn("⚠️ Advertencia: Error cargando módulos de almacenamiento persistente:", e);
}
// ──────────────────────────────────────────────────────────────
// GESTIÓN DE SESIÓN Y TOKENS
// ──────────────────────────────────────────────────────────────

export const setToken = async (token: string) => {
  authToken = token;
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync('vitanova_token', token);
    }
  } catch (err) {
    console.warn('Error guardando token en SecureStore:', err);
  }
};

export const getToken = () => authToken;
export const getUserNombre = () => userNombre;
export const getUserTipo = () => userTipo;

export const loadStoredToken = async () => {
  try {
    if (SecureStore) {
      const token = await SecureStore.getItemAsync('vitanova_token');
      if (token) authToken = token;
      return token;
    }
    return null;
  } catch {
    return null;
  }
};
export const registerOnSessionExpired = (callback: () => void) => {
  onSessionExpiredCallback = callback;
};
export const clearToken = async () => {
  authToken = null;
  userNombre = null;
  userTipo = null;
  
  try {
    if (SecureStore) await SecureStore.deleteItemAsync('vitanova_token');
    if (AsyncStorage) {
      await AsyncStorage.removeItem('usuario_tipo');
      await AsyncStorage.removeItem('usuario_rol');
    }
    console.log("🧼 Sesión e identidades completamente purgadas del dispositivo.");
  } catch (error) {
    console.error("Error al purgar el almacenamiento local:", error);
  }
};

const headers = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

// 🚀 INTERCEPTOR BLINDADO: Asegura token antes de enviar y maneja reintentos
export const fetchWithAuth = async (
  url: string, 
  options: RequestInit = {}, 
  reintentado: boolean = false,
  reintentosRed: number = 2
): Promise<Response> => {
  try {
    if (!authToken) {
      await loadStoredToken();
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...((options.headers as any) ?? {}),
      },
    });

    // Reintento con disco si el token en memoria falló
    if (res.status === 401 && !reintentado) {
      console.log("🔄 [AUTH] 401 recibido. Reintentando con token de disco...");
      const tokenDisco = await loadStoredToken();
      if (tokenDisco && tokenDisco !== authToken) {
        return await fetchWithAuth(url, options, true, reintentosRed);
      }
    }

    // 🥾 Expulsión inmediata ante token inválido/expirado
    if (res.status === 401) {
      console.warn("🚨 [SESIÓN CAÍDA] 401 confirmado. Redirigiendo a login...");
      await clearToken();
      if (onSessionExpiredCallback) {
        onSessionExpiredCallback();
      }
      throw new Error('UNAUTHORIZED');
    }

    return res;
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      throw error;
    }

    // ⚡ Filtro de saturación por ráfaga: reintenta tras 250ms antes de declarar offline
    if (reintentosRed > 0 && error?.message?.includes('Network request failed')) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return await fetchWithAuth(url, options, reintentado, reintentosRed - 1);
    }

    // 🛑 Si tras los reintentos persiste el fallo de red, se lanza a la cola offline
    console.log("⚠️ [OFFLINE / RED] Servidor inalcanzable temporalmente:", error?.message || error);
    throw error;
  }
};

// ──────────────────────────────────────────────────────────────
// ENDPOINTS DE AUTENTICACIÓN
// ──────────────────────────────────────────────────────────────

export const login = async (email: string, password: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.trim().toLowerCase(), 
        password 
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || 'Email o contraseña incorrectos');
    }

    if (data.access_token) {
      await setToken(data.access_token);
      userNombre = data.nombre ?? null;
      userTipo = data.tipo ?? null;
    }

    return data;
  } catch (e: any) {
    console.log('Error fetch login:', e);
    throw new Error(e.message || 'Error de conexión con el servidor');
  }
};

export const register = async (
  email: string, 
  password: string, 
  extra?: { acepta_aviso?: boolean; version_aviso?: string }
) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.trim().toLowerCase(), 
        password,
        acepta_aviso: extra?.acepta_aviso ?? true,
        version_aviso: extra?.version_aviso ?? 'v1.0',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Error al registrar usuario');
    }

    return data;
  } catch (e: any) {
    console.log('Error fetch registro:', e);
    throw new Error(e.message || 'Error de conexión con el servidor');
  }
};


// ==============================================================================
// 🪐 RUTAS CONVERTIDAS AL GUARDIÁN DE AUTENTICACIÓN CENTRAL (fetchWithAuth)
// ==============================================================================

export const getPacientes = async (origen: string = 'desconocido') => {
  try {
    console.log('📡 getPacientes desde:', origen);
    const res = await fetchWithAuth(`${BASE_URL}/medical/patients`);
    return await res.json();
  } catch (error) {
    return { error: String(error) };
  }
};

export const getUltimoCierre = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/ultimo-cierre`);
    if (!res || !res.ok) {
      return { cierre: null };
    }
    const data = await res.json();
    return data && data.cierre !== undefined ? data : { cierre: null };
  } catch (error) {
    // 🛡️ Silencioso para evitar pantalla roja en Hermes
    console.log('ℹ️ [RELEVO] No se pudo cargar el último cierre o sesión expirada');
    return { cierre: null };
  }
};

export const crearNotaTurno = async (
  pacienteId: string, 
  textoNota: string, 
  tipo: string = 'general'
) => {
  const url = `${BASE_URL}/pacientes/${pacienteId}/notas-turno`;
  const payload = {
    paciente_id: pacienteId,
    nota: textoNota,
    tipo,
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err) {
    // 🛡️ Si no hay red, guardar en cola local y responder positivamente a la vista
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Nota de turno (${tipo}): ${textoNota.substring(0, 30)}...`
    );

    return {
      success: true,
      offline: true,
      nota: {
        id: `temp_nota_${Date.now()}`,
        ...payload,
        offline_pendiente: true,
      },
      message: 'Nota guardada localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

// 🎯 Interface para escribir de forma segura en TypeScript
export interface DatosCierreTurno {
  pacienteId: string;
  estadoPaciente?: 'bien' | 'regular' | 'preocupante';
  dolorEva: number;
  estadoAnimo: string;
  hidratacion: number;
  alimentacion: string;
  spo2?: number | null;
  presionSistolica?: number | null;
  presionDiastolica?: number | null;
  frecuenciaCardiaca?: number | null;
  temperatura?: number | null;
  notas?: string;
  insumos?: any[];
}

export const enviarCierreTurno = async (datos: DatosCierreTurno) => {
  const url = `${BASE_URL}/turnos/cerrar`;
  const payload = {
    paciente_id: datos.pacienteId,
    estado_paciente: datos.estadoPaciente || 'bien',
    
    // 🎯 MAPEADO DIRECTO A FastAPI Y SUPABASE:
    dolor_eva: datos.dolorEva,
    estado_animo: datos.estadoAnimo,
    hidratacion_vasos: datos.hidratacion,
    alimentacion: datos.alimentacion,

    // Signos vitales opcionales
    spo2: datos.spo2 ? Number(datos.spo2) : null,
    presion_sistolica: datos.presionSistolica ? Number(datos.presionSistolica) : null,
    presion_diastolica: datos.presionDiastolica ? Number(datos.presionDiastolica) : null,
    frecuencia_cardiaca: datos.frecuenciaCardiaca ? Number(datos.frecuenciaCardiaca) : null,
    temperatura: datos.temperatura ? Number(datos.temperatura) : null,
    
    notas: datos.notas || null,
    inventario_usado: datos.insumos || []
  };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err) {
    // 🛡️ Si falla la red o el servidor, se encola en AsyncStorage
    await encolarPeticionOffline(
      url, 
      'POST', 
      payload, 
      `Cierre de turno paciente ${datos.pacienteId}`
    );
    return { 
      success: true, 
      offline: true, 
      message: 'Cierre de turno guardado localmente. Se sincronizará al recuperar conexión.' 
    };
  }
};
export const getHistorialCierres = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/historial-cierres`);
    if (!res || !res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.cierres)) return data.cierres;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes si no hay conexión
    console.log(`ℹ️ [HISTORIAL CIERRES] No disponible para ${pacienteId} o sin red`);
    return [];
  }
};


export const getTurnoActivo = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/turnos/activo/${pacienteId}`);
  return res.json();
};

export const completarTarea = async (data: {
  paciente_id: string;
  tarea_id?: string;
  medicamento_id?: string;
  tipo: 'rutina' | 'medicamento';
  hora?: string;
  notas?: string;
}) => {
  const url = `${BASE_URL}/autocuidador/completar-tarea`;
  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // 🛡️ Encolar localmente y responder exitoso a la UI
    await encolarPeticionOffline(
      url,
      'POST',
      data,
      `Completar ${data.tipo}: ${data.medicamento_id || data.tarea_id || ''}`
    );
    return { success: true, offline: true, message: 'Guardado localmente' };
  }
};
export const descompletarTarea = async (data: {
  paciente_id: string;
  tarea_id?: string;
  medicamento_id?: string;
  tipo: 'rutina' | 'medicamento';
  hora?: string;
}) => {
  const url = `${BASE_URL}/autocuidador/descompletar-tarea`;
  try {
    const res = await fetchWithAuth(url, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    await encolarPeticionOffline(
      url,
      'DELETE',
      data,
      `Desmarcar ${data.tipo}: ${data.medicamento_id || data.tarea_id || ''}`
    );
    return { success: true, offline: true, message: 'Desmarcado localmente' };
  }
};
export const getMedicamentos = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/medicamentos/${pacienteId}`);
    if (!res || !res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.medicamentos)) return data.medicamentos;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes
    console.log(`ℹ️ [MEDICAMENTOS] No disponibles temporalmente para ${pacienteId}`);
    return [];
  }
};

export const crearMedicamento = async (pacienteId: string, data: any) => {
  const url = `${BASE_URL}/medicamentos`;
  const payload = {
    paciente_id: pacienteId,
    ...data,
    activo: true,
  };

  try {
    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const textResponse = await response.text();

    if (!response.ok) {
      console.log(`⚠️ [ERROR ${response.status} CREAR MEDICAMENTO]:`, textResponse);
      throw new Error(`HTTP ${response.status}`);
    }

    try {
      return JSON.parse(textResponse);
    } catch {
      return { success: true, detail: textResponse };
    }
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar creación del medicamento
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Crear medicamento: ${data?.nombre || data?.medicamento || 'Nuevo fármaco'}`
    );

    return {
      success: true,
      offline: true,
      id: `temp_med_${Date.now()}`,
      ...payload,
      message: 'Medicamento guardado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const desactivarMedicamento = async (medId: string) => {
  const url = `${BASE_URL}/medicamentos/${medId}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res || !res.ok) {
      const errText = await res.text().catch(() => '');
      console.log(`⚠️ [ERROR ${res?.status || 0} DESACTIVAR MEDICAMENTO]:`, errText);
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la eliminación/desactivación
    await encolarPeticionOffline(
      url,
      'DELETE',
      { medId },
      `Desactivar medicamento ID: ${medId}`
    );

    return {
      success: true,
      offline: true,
      message: 'Medicamento desactivado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
// 🔗 Vincular paciente a un grupo familiar / hogar
export const vincularPacientesHogar = async (pacientePrincipalId: string, pacienteAVincularId: string) => {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/pacientes/vincular-hogar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        paciente_principal_id: pacientePrincipalId,
        paciente_a_vincular_id: pacienteAVincularId,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('❌ Error al vincular pacientes:', err);
    return { status: 'error' };
  }
};

// 🔓 Desvincular paciente del grupo familiar
export const desvincularPacienteHogar = async (pacienteId: string) => {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/pacientes/desvincular-hogar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paciente_id: pacienteId }),
    });
    return await res.json();
  } catch (err) {
    console.error('❌ Error al desvincular paciente:', err);
    return { status: 'error' };
  }
};
export const getTareasRecurrentes = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes/${pacienteId}`);
    if (!res || !res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.tareas)) return data.tareas;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes
    console.log(`ℹ️ [TAREAS RECURRENTES] No disponibles temporalmente para ${pacienteId}`);
    return [];
  }
};
export const enviarComandoReloj = async (pacienteId: string, comando: string, argumento: string = '') => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/configurar-reloj`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comando,
        argumento,
      }),
    });
    return await res.json();
  } catch (error) {
    return { success: false, detail: String(error) };
  }
};
export const crearTareaRecurrente = async (pacienteId: string, data: any) => {
  // 🎯 FIX: Estructura unificada y directa usando fetchWithAuth
  const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes`, {
    method: 'POST',
    body: JSON.stringify({
      paciente_id: pacienteId,
      ...data,
      activo: true,
    }),
  });
  return res.json();
};

export const crearPaciente = async (paciente: any) => {
  const url = `${BASE_URL}/pacientes`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paciente),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar creación del paciente
    await encolarPeticionOffline(
      url,
      'POST',
      paciente,
      `Crear paciente: ${paciente?.nombre_completo || paciente?.nombre || 'Nuevo paciente'}`
    );

    return {
      success: true,
      offline: true,
      id: `temp_paciente_${Date.now()}`,
      ...paciente,
      message: 'Paciente registrado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const actualizarPaciente = async (id: string, campos: any) => {
  const url = id === 'nuevo' ? `${BASE_URL}/pacientes/nuevo` : `${BASE_URL}/pacientes/${id}`;

  try {
    const response = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campos),
    });

    if (!response || !response.ok) {
      const textoError = await response?.text().catch(() => '');
      console.log(`⚠️ [ERROR ${response?.status || 0} ACTUALIZAR PACIENTE]:`, textoError);
      throw new Error(`HTTP ${response?.status || 0}`);
    }

    return await response.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar actualización del paciente
    await encolarPeticionOffline(
      url,
      'PATCH',
      campos,
      `Actualizar paciente ID: ${id}`
    );

    return {
      success: true,
      offline: true,
      paciente: {
        id,
        ...campos,
        offline_pendiente: true,
      },
      message: 'Cambios guardados localmente. Se sincronizarán al recuperar conexión.',
    };
  }
};

export const desactivarTareaRecurrente = async (tareaId: string) => {
  const url = `${BASE_URL}/tareas-recurrentes/${tareaId}/desactivar`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la desactivación de la rutina
    await encolarPeticionOffline(
      url,
      'PATCH',
      { tarea_id: tareaId, activo: false },
      `Desactivar tarea recurrente ID: ${tareaId}`
    );

    return {
      success: true,
      offline: true,
      message: 'Rutina desactivada localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const getAlertas = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/alertas`);
    if (!res || !res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.alertas)) return data.alertas;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes si no hay red
    console.log(`ℹ️ [ALERTAS] No disponibles temporalmente para ${pacienteId}`);
    return [];
  }
};

export const getUbicacion = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/ubicacion`);
  return res.json();
};

export const registrarPushToken = async (token: string, plataforma: string) => {
  const url = `${BASE_URL}/push/register`;
  const payload = { token, plataforma };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar registro del Push Token
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Registro Push Token (${plataforma})`
    );

    return {
      success: true,
      offline: true,
      message: 'Token Push encolado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
export const solicitarGpsVivo = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/solicitar-gps-vivo`, {
    method: 'POST',
  });
  return res.json();
};
export const crearEvaluacion = async (data: any) => {
  const url = `${BASE_URL}/evaluaciones/hogar`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la evaluación del hogar
    await encolarPeticionOffline(
      url,
      'POST',
      data,
      `Evaluación del hogar: Paciente ${data?.paciente_id || 'general'}`
    );

    return {
      success: true,
      offline: true,
      id: `temp_eval_${Date.now()}`,
      ...data,
      message: 'Evaluación guardada localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
export const getInventario = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(
      `${BASE_URL}/pacientes/${pacienteId}/inventario`
    );

    if (!res || !res.ok) {
      return { items: [], total: 0 };
    }

    const data = await res.json();
    
    // 🛡️ Asegurar siempre un objeto con array de items
    if (Array.isArray(data)) {
      return { items: data, total: data.length };
    }
    
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0),
    };
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas si no hay conexión
    console.log(`ℹ️ [INVENTARIO] No disponible para ${pacienteId} o sin red`);
    return { items: [], total: 0 };
  }
};
export const getBateriaPaciente = async (pacienteId: string) => {
  try {
    const response = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/bateria`);

    if (!response || !response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    // 🛡️ Retorna null de forma silenciosa para no romper los indicadores de la UI
    console.log(`ℹ️ [BATERÍA] Nivel no disponible para ${pacienteId} o sin red`);
    return null;
  }
};
export const crearItemInventario = async (
  pacienteId: string,
  data: {
    tipo?: 'medicamento' | 'insumo' | 'otro';
    nombre: string;
    dosis?: string | null;
    cantidad?: number;
    unidad?: string;
    fecha_caducidad?: string | null;
    cantidad_minima?: number;
    es_compartido?: boolean;
    notas?: string | null;
    medicamento_id?: string | null;
  }
) => {
  const url = `${BASE_URL}/pacientes/${pacienteId}/inventario`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar registro de insumo o medicamento en el inventario
    await encolarPeticionOffline(
      url,
      'POST',
      data,
      `Nuevo insumo/stock: ${data.nombre} (${data.tipo || 'insumo'})`
    );

    return {
      success: true,
      offline: true,
      item: {
        id: `temp_inv_${Date.now()}`,
        paciente_id: pacienteId,
        ...data,
        offline_pendiente: true,
      },
      message: 'Artículo guardado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
export const actualizarItemInventario = async (
  itemId: string,
  data: Record<string, any>
) => {
  const url = `${BASE_URL}/inventario/${itemId}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la actualización del insumo/medicamento
    await encolarPeticionOffline(
      url,
      'PATCH',
      data,
      `Actualizar inventario ID: ${itemId}`
    );

    return {
      success: true,
      offline: true,
      item: {
        id: itemId,
        ...data,
        offline_pendiente: true,
      },
      message: 'Inventario actualizado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
export const sugerirDosisHistorica = async (pacienteId: string, nombre: string) => {
  try {
    const res = await fetchWithAuth(
      `${BASE_URL}/pacientes/${pacienteId}/sugerir-dosis?nombre=${encodeURIComponent(nombre)}`
    );

    if (!res || !res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    // 🛡️ Silencioso para autocompletado en UI sin conexión
    console.log(`ℹ️ [DOSIS HISTÓRICA] No sugerible para "${nombre}" o sin red`);
    return null;
  }
};
export const consumirItemInventario = async (
  itemId: string,
  cantidad: number = 1
) => {
  const url = `${BASE_URL}/inventario/${itemId}/consumir`;
  const payload = { cantidad };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar el consumo del insumo/medicamento
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Consumo inventario (${cantidad} uds) ID: ${itemId}`
    );

    return {
      success: true,
      offline: true,
      item_id: itemId,
      cantidad_consumida: cantidad,
      message: 'Consumo registrado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
export const eliminarItemInventario = async (itemId: string) => {
  const url = `${BASE_URL}/inventario/${itemId}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res || !res.ok) {
      const errText = await res?.text().catch(() => '');
      console.log(`⚠️ [ERROR ${res?.status || 0} ELIMINAR INVENTARIO]:`, errText);
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la eliminación del insumo/artículo
    await encolarPeticionOffline(
      url,
      'DELETE',
      { itemId },
      `Eliminar item inventario ID: ${itemId}`
    );

    return {
      success: true,
      offline: true,
      item_id: itemId,
      message: 'Artículo eliminado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};
export const getEvaluaciones = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/evaluaciones/hogar/${pacienteId}`);

    if (!res || !res.ok) {
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.evaluaciones)) return data.evaluaciones;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes sin conexión
    console.log(`ℹ️ [EVALUACIONES] No disponibles temporalmente para ${pacienteId}`);
    return [];
  }
};
// 1. Consumir medicamento aplicando la regla FEFO (descuento inteligente por caducidad)
export const consumirMedicamentoFEFO = async (
  pacienteId: string,
  nombreMedicamento: string,
  cantidad: number = 1.0
) => {
  const queryParams = new URLSearchParams({
    nombre_medicamento: nombreMedicamento,
    cantidad_a_descontar: String(cantidad),
  }).toString();

  const url = `${BASE_URL}/pacientes/${pacienteId}/consumir-medicamento?${queryParams}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar consumo FEFO de medicamento
    await encolarPeticionOffline(
      url,
      'POST',
      { pacienteId, nombreMedicamento, cantidad },
      `Consumo FEFO: ${nombreMedicamento} (${cantidad} dosis)`
    );

    return {
      success: true,
      offline: true,
      medicamento: nombreMedicamento,
      cantidad_descontada: cantidad,
      message: 'Consumo FEFO registrado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

// 2. Buscar si existe stock previo en el botiquín antes de crear la receta
export const buscarStockExistente = async (pacienteId: string, nombre: string) => {
  try {
    const res = await fetchWithAuth(
      `${BASE_URL}/pacientes/${pacienteId}/sugerir-dosis?nombre=${encodeURIComponent(nombre)}`
    );

    if (!res || !res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    // 🛡️ Silencioso para autocompletado en UI sin conexión
    console.log(`ℹ️ [STOCK EXISTENTE] Búsqueda no disponible para "${nombre}" o sin red`);
    return null;
  }
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
  const url = `${BASE_URL}/turnos/iniciar`;
  const payload = { paciente_id: pacienteId };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Manejo defensivo si el backend responde con error HTTP
    if (!res || !res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 403 || errorData?.error) {
        return {
          sin_horario: true,
          mensaje: errorData?.mensaje || errorData?.detail || 'Acceso denegado por horario.',
        };
      }
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    const data = await res.json();

    // 💡 Validación de respuesta con error lógico
    if (data.error) {
      return {
        sin_horario: true,
        mensaje: data.mensaje || data.detail || 'Acceso denegado por horario.',
      };
    }

    return data;
  } catch (err: any) {
    // Si la sesión expiró formalmente, propagar error
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar apertura de turno para sincronizar al volver la red
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Inicio de turno paciente ${pacienteId}`
    );

    return {
      success: true,
      offline: true,
      turno: {
        id: `temp_turno_${Date.now()}`,
        paciente_id: pacienteId,
        fecha_inicio: new Date().toISOString(),
        offline_pendiente: true,
      },
      mensaje: 'Turno iniciado en modo local (sin conexión). Se sincronizará automáticamente.',
    };
  }
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

export const agregarTareaManual = async (tarea: any) => {
  const url = `${BASE_URL}/tareas`;
  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(tarea),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err) {
    // 🛡️ Si no hay conexión o falla el backend, se encola localmente
    await encolarPeticionOffline(
      url,
      'POST',
      tarea,
      `Tarea manual: ${tarea?.titulo || tarea?.descripcion || 'Nueva tarea'}`
    );
    return {
      success: true,
      offline: true,
      tarea: {
        id: `temp_${Date.now()}`,
        ...tarea,
        offline_pendiente: true,
      },
      message: 'Tarea guardada localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const getTareasHoy = async (pacienteId: string, fecha?: string) => {
  // 🇲🇽 Si le pasas fecha usa esa, si no, usa la fecha local de hoy
  let fechaConsulta = fecha;
  if (!fechaConsulta) {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    fechaConsulta = `${year}-${month}-${day}`;
  }

  try {
    const res = await fetchWithAuth(
      `${BASE_URL}/pacientes/${pacienteId}/tareas-dia?fecha=${fechaConsulta}&offset=360`
    );

    if (!res || !res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : (data?.tareas || []);
  } catch (error) {
    console.log(`ℹ️ [TAREAS HOY] Sin conexión o no disponibles para ${pacienteId}`);
    return [];
  }
};
// Antes se llamaba getTareasHoy (era de autocuidador)
export const getTareasHoyAutocuidador = async (pacienteId: string) => {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/autocuidador/tareas-hoy/${pacienteId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
};
// En utils.ts
export const getHoyLocalISO = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const completarActividad = async (actividadId: string, pacienteId: string) => {
  const url = `${BASE_URL}/actividades/completar`;
  const payload = { actividad_id: actividadId, paciente_id: pacienteId };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Completar actividad: ${actividadId}`
    );
    return { success: true, offline: true, message: 'Guardado localmente' };
  }
};

export const calibrarAcelerometroReloj = async (pacienteId: string, sensibilidad: string = "2") => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/configurar-reloj`, {
    method: 'POST',
    body: JSON.stringify({ comando: "FALL", argumento: sensibilidad }),
  });
  return res.json();
};

export const actualizarHorarioCuidador = async (
  pacienteId: string,
  usuarioId: string,
  datos: any
) => {
  const url = `${BASE_URL}/equipo/${pacienteId}/${usuarioId}/horario`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datos),
    });

    if (!res || !res.ok) {
      const errText = await res?.text().catch(() => '');
      console.log(`⚠️ [ERROR ${res?.status || 0} ACTUALIZAR HORARIO CUIDADOR]:`, errText);
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la actualización de horario/turno del cuidador
    await encolarPeticionOffline(
      url,
      'PATCH',
      datos,
      `Actualizar horario cuidador: Usuario ${usuarioId} de Paciente ${pacienteId}`
    );

    return {
      success: true,
      offline: true,
      paciente_id: pacienteId,
      usuario_id: usuarioId,
      horario: datos,
      message: 'Horario actualizado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const completarMedicamento = async (
  medId: string, 
  pacienteId: string, 
  descripcion: string, 
  horaProgramada: string
) => {
  const url = `${BASE_URL}/medicamentos/completar`;
  const payload = { 
    med_id: medId, 
    paciente_id: pacienteId, 
    descripcion, 
    hora_programada: horaProgramada 
  };

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    await encolarPeticionOffline(
      url,
      'POST',
      payload,
      `Completar medicamento: ${descripcion}`
    );
    return { success: true, offline: true, message: 'Guardado localmente' };
  }
};

export const crearInvitacion = async (datos: Record<string, any>) => {
  const url = `${BASE_URL}/invitaciones`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datos),
    });

    const data = await res.json().catch(() => ({}));

    if (!res || !res.ok) {
      const errorMsg = data?.detail || `Error al crear invitación (${res?.status || 0})`;
      console.log(`⚠️ [CREAR INVITACIÓN]:`, errorMsg);
      throw new Error(errorMsg);
    }

    return data;
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      throw error;
    }

    console.log('⚠️ [CREAR INVITACIÓN] Error en petición:', error?.message || error);
    throw new Error(
      error?.message || 'No se pudo generar la invitación. Verifica tu conexión a internet.'
    );
  }
};

export const buscarInvitacion = async (codigo: string) => {
  if (!codigo || typeof codigo !== 'string') {
    return null;
  }

  const codigoLimpio = encodeURIComponent(codigo.trim().toLowerCase());
  const url = `${BASE_URL}/invitaciones/buscar?codigo=${codigoLimpio}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res || !res.ok) {
      return null;
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    // 🛡️ Silencioso para validaciones en UI sin conexión o código no encontrado
    console.log(`ℹ️ [INVITACIÓN] Código "${codigo}" no encontrado o sin red`);
    return null;
  }
};

export const aceptarInvitacion = async (token: string) => {
  const url = `${BASE_URL}/invitaciones/${encodeURIComponent(token)}/aceptar`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res || !res.ok) {
      throw new Error(data?.detail || `Error al aceptar invitación (${res?.status || 0})`);
    }

    return data;
  } catch (error: any) {
    if (error?.message === 'UNAUTHORIZED') {
      throw error;
    }

    console.log(`⚠️ [ACEPTAR INVITACIÓN] Error procesando token:`, error?.message || error);
    throw new Error(
      error?.message || 'No se pudo aceptar la invitación. Verifica tu conexión a internet o la vigencia del enlace.'
    );
  }
};

export const removerDelEquipo = async (pacienteId: string, usuarioId: string) => {
  const url = `${BASE_URL}/equipo/${pacienteId}/${usuarioId}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res || !res.ok) {
      const errText = await res?.text().catch(() => '');
      console.log(`⚠️ [ERROR ${res?.status || 0} REMOVER EQUIPO]:`, errText);
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la remoción del miembro del equipo
    await encolarPeticionOffline(
      url,
      'DELETE',
      { pacienteId, usuarioId },
      `Remover del equipo: Usuario ${usuarioId} de Paciente ${pacienteId}`
    );

    return {
      success: true,
      offline: true,
      paciente_id: pacienteId,
      usuario_id: usuarioId,
      message: 'Miembro removido localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const getSignosVitalesHistorico = async (pacienteId: string, limit: number = 10) => {
  try {
    const res = await fetchWithAuth(
      `${BASE_URL}/pacientes/${pacienteId}/signos-vitales-historico?limit=${limit}`
    );

    if (!res || !res.ok) {
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.historico)) return data.historico;
    if (Array.isArray(data?.signos)) return data.signos;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para gráficos o tablas de telemetría sin conexión
    console.log(`ℹ️ [SIGNOS HISTÓRICO] No disponibles para ${pacienteId} o sin red`);
    return [];
  }
};
export const getTurnoActivoResumen = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(
      `${BASE_URL}/pacientes/${pacienteId}/turno-activo-resumen`
    );

    if (!res || !res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes si no hay red
    console.log(`ℹ️ [TURNO ACTIVO RESUMEN] No disponible para ${pacienteId} o sin red`);
    return null;
  }
};
export interface MiembroEquipo {
  id: string;
  usuario_id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  puede_exportar_datos: boolean;
  activo: boolean;
}

// 📋 Obtener el listado de miembros del equipo y sus permisos
export const getEquipoPaciente = async (pacienteId: string): Promise<MiembroEquipo[]> => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/equipo`);

    if (!res || !res.ok) {
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.equipo)) return data.equipo;
    return [];
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes si no hay red
    console.log(`ℹ️ [EQUIPO PACIENTE] No disponible temporalmente para ${pacienteId}`);
    return [];
  }
};
export const verifyOtp = async (email: string, token: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        token: token.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || 'Código inválido o expirado');
    }

    if (data.access_token) {
      await setToken(data.access_token);
    }

    return data;
  } catch (e: any) {
    console.log('Error fetch verifyOtp:', e);
    throw new Error(e.message || 'Error de conexión con el servidor');
  }
};
export const forgotPassword = async (email: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Error al solicitar recuperación');
    }
    return data;
  } catch (e: any) {
    throw new Error(e.message || 'Error de conexión');
  }
};

export const resetPassword = async (email: string, token: string, nuevaPassword: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        nueva_password: nuevaPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Código inválido o expirado');
    }
    return data;
  } catch (e: any) {
    throw new Error(e.message || 'Error de conexión');
  }
};
// 🔘 Alternar (Toggle) permiso de exportación/descarga de datos clínicos
export const togglePermisoExportar = async (
  pacienteId: string,
  cuidadorUsuarioId: string,
  puedeExportar: boolean
) => {
  const res = await fetchWithAuth(
    `${BASE_URL}/pacientes/${pacienteId}/cuidadores/${cuidadorUsuarioId}/permiso-exportar`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puede_exportar: puedeExportar }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al actualizar permiso de exportación');
  }
  return res.json();
};
export const getAlertaPeso = async (pacienteId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/alerta-peso`);

    if (!res || !res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    // 🛡️ Silencioso para evitar pantallas rojas en Hermes si no hay red
    console.log(`ℹ️ [ALERTA PESO] No disponible para ${pacienteId} o sin red`);
    return null;
  }
};
export const resendConfirmation = async (email: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Error al reenviar correo');
    }
    return data;
  } catch (e: any) {
    throw new Error(e.message || 'Error de conexión');
  }
};
export const getTareasDia = async (pacienteId: string, fecha?: string) => {
  const hoy = fecha || new Date().toLocaleDateString('en-CA');
  const offsetMinutos = new Date().getTimezoneOffset();
  const url = `${BASE_URL}/pacientes/${pacienteId}/tareas-dia?fecha=${encodeURIComponent(hoy)}&offset=${offsetMinutos}`;

  try {
    const res = await fetchWithAuth(url);

    if (!res || !res.ok) {
      return { tareas: [], sin_horario: false };
    }

    const data = await res.json();

    // Si el backend responde con un arreglo plano
    if (Array.isArray(data)) {
      return { tareas: data, sin_horario: false };
    }

    // Si el backend responde con el objeto completo { tareas: [...], sin_horario: ... }
    return {
      sin_horario: Boolean(data?.sin_horario),
      tareas: Array.isArray(data?.tareas) ? data.tareas : [],
      ...data,
    };
  } catch (error) {
    console.log(`ℹ️ [TAREAS DÍA] No disponibles temporalmente para ${pacienteId} (${hoy})`);
    return { tareas: [], sin_horario: false };
  }
};
export const getSignosRecientes = async (patientId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${patientId}/signos-recientes`);

    if (!res || !res.ok) {
      return { success: false, spo2: "—", presion: "—", fc: "—", temperatura: "—" };
    }

    return await res.json();
  } catch (error) {
    // 🛡️ Silencioso para telemetría sin señal o en standby
    console.log(`ℹ️ [SIGNOS RECIENTES] No disponibles temporalmente para ${patientId}`);
    return { success: false, spo2: "—", presion: "—", fc: "—", temperatura: "—" };
  }
};

export const forzarMedicionSignos = async (patientId: string) => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/pacientes/${patientId}/forzar-medicion`, {
      method: 'POST',
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }

    if (!res.ok) {
      const errorMsg = data?.detail || data?.mensaje || data?.message || data?.error || text || `Error HTTP ${res.status}`;
      throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    }

    return data;
  } catch (error: any) {
    console.error("❌ Error en servicio forzarMedicionSignos:", error);
    return { status: "error", error: error.message || String(error) };
  }
};


interface ConfigurarRelojParams {
  sensibilidad?: number | string;
  comando?: string;
  argumento?: string;
}

export const configurarReloj = async (
  patientId: string,
  paramsOrSensibilidad?: ConfigurarRelojParams | number | string,
  comandoPosicional?: string,
  argumentoPosicional?: string
) => {
  let body: { comando?: string; argumento?: string } = {};

  // Caso 1: Llamada con argumentos posicionales clásicos (ej. paciente.id, undefined, 'FALLDOWN', '1,1')
  if (comandoPosicional) {
    body = { comando: comandoPosicional, argumento: argumentoPosicional };
  }
  // Caso 2: Objeto de parámetros { comando: 'FALLDOWN', argumento: '1,1' } o { sensibilidad: 4 }
  else if (typeof paramsOrSensibilidad === 'object' && paramsOrSensibilidad !== null) {
    if (paramsOrSensibilidad.comando) {
      body = { comando: paramsOrSensibilidad.comando, argumento: paramsOrSensibilidad.argumento };
    } else if (paramsOrSensibilidad.sensibilidad !== undefined) {
      body = { comando: 'LSSET', argumento: String(paramsOrSensibilidad.sensibilidad) };
    }
  }
  // Caso 3: Sensibilidad directa como número o string
  else if (typeof paramsOrSensibilidad === 'number' || typeof paramsOrSensibilidad === 'string') {
    body = { comando: 'LSSET', argumento: String(paramsOrSensibilidad) };
  }

  const url = `${BASE_URL}/pacientes/${patientId}/configurar-reloj`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar comando TCP/SMS de configuración del reloj
    await encolarPeticionOffline(
      url,
      'POST',
      body,
      `Comando reloj (${body.comando || 'SET'}): Paciente ${patientId}`
    );

    return {
      success: true,
      offline: true,
      comando: body.comando,
      argumento: body.argumento,
      message: 'Comando guardado localmente. Se enviará al reloj al recuperar conexión.',
    };
  }
};
export const actualizarMedicamento = async (medicamentoId: string, data: any) => {
  const url = `${BASE_URL}/medicamentos/${medicamentoId}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res || !res.ok) {
      const errText = await res?.text().catch(() => '');
      console.log(`⚠️ [ERROR ${res?.status || 0} ACTUALIZAR MEDICAMENTO]:`, errText);
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la actualización del medicamento
    await encolarPeticionOffline(
      url,
      'PATCH',
      data,
      `Actualizar medicamento: ${data?.nombre || medicamentoId}`
    );

    return {
      success: true,
      offline: true,
      medicamento: {
        id: medicamentoId,
        ...data,
        offline_pendiente: true,
      },
      message: 'Medicamento actualizado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};

export const actualizarTareaRecurrente = async (tareaId: string, data: any) => {
  const url = `${BASE_URL}/tareas-recurrentes/${tareaId}`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res || !res.ok) {
      const errText = await res?.text().catch(() => '');
      console.log(`⚠️ [ERROR ${res?.status || 0} ACTUALIZAR TAREA RECURRENTE]:`, errText);
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar la actualización de la rutina
    await encolarPeticionOffline(
      url,
      'PATCH',
      data,
      `Actualizar rutina: ${data?.titulo || data?.nombre || tareaId}`
    );

    return {
      success: true,
      offline: true,
      tarea: {
        id: tareaId,
        ...data,
        offline_pendiente: true,
      },
      message: 'Rutina actualizada localmente. Se sincronizará al recuperar conexión.',
    };
  }
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
export async function registrarUsuario(
  email: string,
  password: string,
  aceptaAviso: boolean = true
) {
  const url = `${BASE_URL}/auth/registro`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        acepta_aviso: aceptaAviso,
        version_aviso: 'v1.0',
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.detail || `Error al registrar usuario (${response.status})`);
    }

    return data;
  } catch (error: any) {
    console.log('⚠️ [REGISTRO USUARIO] Error en petición:', error?.message || error);
    throw new Error(error?.message || 'Error de conexión al registrar usuario. Verifica tu red.');
  }
}
export const crearLead = async (lead: any) => {
  const url = `${BASE_URL}/leads`;

  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lead),
    });

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res?.status || 0}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      throw err;
    }

    // 🛡️ Modo Offline: Encolar registro de prospecto / lead
    await encolarPeticionOffline(
      url,
      'POST',
      lead,
      `Nuevo Lead: ${lead?.nombre || lead?.nombre_contacto || lead?.email || 'Prospecto comercial'}`
    );

    return {
      success: true,
      offline: true,
      id: `temp_lead_${Date.now()}`,
      ...lead,
      message: 'Prospecto guardado localmente. Se sincronizará al recuperar conexión.',
    };
  }
};