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

  reintentado: boolean = false

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

        return await fetchWithAuth(url, options, true);

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



    // 🛑 Silenciamos LogBox en desarrollo cambiando console.error por log limpio

    console.log("⚠️ [OFFLINE / RED] Servidor inalcanzable temporalmente:", error?.message || error);

    throw error;

  }

};



// ──────────────────────────────────────────────────────────────

// ENDPOINTS DE AUTENTICACIÓN

// ──────────────────────────────────────────────────────────────
// ── TIPADO DE ROLES DE USUARIO ──
export interface RolesUsuarioResponse {
  usuario_id?: string;
  nombre?: string;
  tipo_base?: string;
  tiene_familiar?: boolean;
  tiene_cuidador?: boolean;
  total_pacientes_familiar?: number;
  total_pacientes_cuidador?: number;
  es_cuenta_dual?: boolean;
  requiere_perfil?: boolean;
}

export const getRolesUsuario = async (): Promise<RolesUsuarioResponse | null> => {
  try {
    const res = await fetchWithAuth('/usuarios/roles');
    return res as RolesUsuarioResponse;
  } catch (error) {
    console.error('⚠️ Error obteniendo roles de usuario:', error);
    return null;
  }
};


export const getRelojServidorConfig = async (): Promise<{ host: string; port: string }> => {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/config/reloj-servidor`, {
      method: 'GET',
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('⚠️ Fallback activado para servidor TCP:', err);
  }

  return {
    host: 'gps.vitanovaintegralis.com',
    port: '55538',
  };
};
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

    if (!res.ok) return { cierres: [] };

    const data = await res.json();

    return Array.isArray(data) ? data : (data?.cierres || []);

  } catch (error) {

    console.error('Error al obtener historial de cierres:', error);

    return { cierres: [] };

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

  const res = await fetchWithAuth(`${BASE_URL}/medicamentos/${pacienteId}`);

  return res.json();

};



export const crearMedicamento = async (pacienteId: string, data: any) => {

  // 🎯 FIX: Se propaga el objeto completo (data) e incluimos el Content-Type para FastAPI

  const response = await fetchWithAuth(`${BASE_URL}/medicamentos`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

    },

    body: JSON.stringify({

      paciente_id: pacienteId,

      ...data,

      activo: true,

    }),

  });



  // 🛡️ Lectura defensiva para evitar crash de JSON.parse

  const textResponse = await response.text();



  if (!response.ok) {

    console.error(`❌ [ERROR ${response.status} CREAR MEDICAMENTO]:`, textResponse);

    throw new Error(`Error ${response.status}: ${textResponse}`);

  }



  return JSON.parse(textResponse);

};



export const desactivarMedicamento = async (medId: string) => {

  const res = await fetchWithAuth(`${BASE_URL}/medicamentos/${medId}`, {

    method: 'DELETE',

    headers: {

      'Content-Type': 'application/json',

    },

  });



  if (!res.ok) {

    const errText = await res.text();

    console.error(`❌ [ERROR ${res.status} DESACTIVAR MEDICAMENTO]:`, errText);

    throw new Error(`Error ${res.status}: ${errText}`);

  }



  return await res.json();

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

  const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes/${pacienteId}`);

  return res.json();

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

  const res = await fetchWithAuth(`${BASE_URL}/push/register`, {

    method: 'POST',

    body: JSON.stringify({ token, plataforma }),

  });

  return res.json();

};

export const solicitarGpsVivo = async (pacienteId: string) => {

  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/solicitar-gps-vivo`, {

    method: 'POST',

  });

  return res.json();

};
export const detenerGpsVivo = async (pacienteId: string) => {
  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/detener-gps-vivo`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Error al detener modo en vivo');
  }
  return await res.json();
};
export const crearEvaluacion = async (data: object) => {

  const res = await fetchWithAuth(`${BASE_URL}/evaluaciones/hogar`, {

    method: 'POST',

    body: JSON.stringify(data),

  });

  return res.json();

};

export const getInventario = async (pacienteId: string) => {

  try {

    const res = await fetchWithAuth(

      `${BASE_URL}/pacientes/${pacienteId}/inventario`

    );

    return await res.json();

  } catch (error) {

    console.error('❌ getInventario:', error);

    return { items: [], total: 0, error: String(error) };

  }

};

export const getBateriaPaciente = async (pacienteId: string) => {

  try {

    const token = await getToken(); // Asegúrate de tener getToken() importado/definido

    const response = await fetch(`${BASE_URL}/pacientes/${pacienteId}/bateria`, {

      method: 'GET',

      headers: {

        'Content-Type': 'application/json',

        Authorization: `Bearer ${token}`, // 🔑 Crítico para evitar el 401 UNAUTHORIZED

      },

    });



    if (!response.ok) {

      throw new Error(`Error HTTP: ${response.status}`);

    }



    return await response.json();

  } catch (error) {

    // Retornamos null en lugar de lanzar error para no romper la UI

    console.log(`⚠️ Batería no disponible para ${pacienteId}:`, error);

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

  const res = await fetchWithAuth(

    `${BASE_URL}/pacientes/${pacienteId}/inventario`,

    {

      method: 'POST',

      body: JSON.stringify(data),

    }

  );

  return res.json();

};

export const actualizarItemInventario = async (

  itemId: string,

  data: Record<string, any>

) => {

  const res = await fetchWithAuth(`${BASE_URL}/inventario/${itemId}`, {

    method: 'PATCH',

    body: JSON.stringify(data),

  });

  return res.json();

};

export const sugerirDosisHistorica = async (pacienteId: string, nombre: string) => {

  const res = await fetchWithAuth(

    `${BASE_URL}/pacientes/${pacienteId}/sugerir-dosis?nombre=${encodeURIComponent(nombre)}`

  );

  return res.json();

};

export const consumirItemInventario = async (

  itemId: string,

  cantidad: number = 1

) => {

  const res = await fetchWithAuth(

    `${BASE_URL}/inventario/${itemId}/consumir`,

    {

      method: 'POST',

      body: JSON.stringify({ cantidad }),

    }

  );

  return res.json();

};

export const eliminarItemInventario = async (itemId: string) => {

  console.log(`🚨 [API FETCH] Intentando DELETE -> ${BASE_URL}/inventario/${itemId}`);

  try {

    const res = await fetchWithAuth(`${BASE_URL}/inventario/${itemId}`, {

      method: 'DELETE',

    });

    const json = await res.json();

    console.log(`✅ [API FETCH] Respuesta (${res.status}):`, json);

    return json;

  } catch (err) {

    console.error("❌ [API FETCH] Error de red o ejecución:", err);

    throw err;

  }

};

export const getEvaluaciones = async (pacienteId: string) => {

  const res = await fetchWithAuth(`${BASE_URL}/evaluaciones/hogar/${pacienteId}`);

  return res.json();

};

// 1. Consumir medicamento aplicando la regla FEFO (descuento inteligente por caducidad)

export const consumirMedicamentoFEFO = async (

  pacienteId: string,

  nombreMedicamento: string,

  cantidad: number = 1.0

) => {

  const res = await fetchWithAuth(

    `${BASE_URL}/pacientes/${pacienteId}/consumir-medicamento?nombre_medicamento=${encodeURIComponent(

      nombreMedicamento

    )}&cantidad_a_descontar=${cantidad}`,

    {

      method: 'POST',

    }

  );

  return res.json();

};



// 2. Buscar si existe stock previo en el botiquín antes de crear la receta

export const buscarStockExistente = async (pacienteId: string, nombre: string) => {

  const res = await fetchWithAuth(

    `${BASE_URL}/pacientes/${pacienteId}/sugerir-dosis?nombre=${encodeURIComponent(nombre)}`

  );

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

 

  // 💡 Si 'error' existe en el JSON devuelto por la API (sea cual sea la cadena de error)

  if (data.error) {

    return { sin_horario: true, mensaje: data.mensaje || "Acceso denegado por horario." };

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



export const getTareasHoy = async (pacienteId: string, fecha?: string) => {

  const token = getToken();

 

  // 🇲🇽 Si le pasas fecha usa esa, si no, usa la fecha local de hoy

  let fechaConsulta = fecha;

  if (!fechaConsulta) {

    const ahora = new Date();

    const year = ahora.getFullYear();

    const month = String(ahora.getMonth() + 1).padStart(2, '0');

    const day = String(ahora.getDate()).padStart(2, '0');

    fechaConsulta = `${year}-${month}-${day}`;

  }



  const res = await fetch(`${BASE_URL}/pacientes/${pacienteId}/tareas-dia?fecha=${fechaConsulta}&offset=360`, {

    headers: { 'Authorization': `Bearer ${token}` }

  });

  return res.json();

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

  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/equipo`);

  if (!res.ok) {

    const errorData = await res.json().catch(() => ({}));

    throw new Error(errorData.detail || 'Error al obtener equipo del paciente');

  }

  return res.json();

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

  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${pacienteId}/alerta-peso`);

  return res.json();

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



  const res = await fetchWithAuth(`${BASE_URL}/pacientes/${patientId}/configurar-reloj`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

    },

    body: JSON.stringify(body),

  });



  return res.json();

};

export const actualizarMedicamento = async (medicamentoId: string, data: any) => {

  // 🪐 Integrado al Guardián fetchWithAuth

  const res = await fetchWithAuth(`${BASE_URL}/medicamentos/${medicamentoId}`, {

    method: 'PATCH',

    body: JSON.stringify(data),

  });

  return res.json();

};



export const actualizarTareaRecurrente = async (tareaId: string, data: any) => {

  // 🪐 Integrado al Guardián fetchWithAuth

  const res = await fetchWithAuth(`${BASE_URL}/tareas-recurrentes/${tareaId}`, {

    method: 'PATCH',

    body: JSON.stringify(data),

  });

  return res.json();

};

export async function registrarUsuario(

  email: string,

  password: string,

  aceptaAviso: boolean = true

) {

  const response = await fetch(`${BASE_URL}/auth/registro`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

    },

    body: JSON.stringify({

      email,

      password,

      acepta_aviso: aceptaAviso,

      version_aviso: 'v1.0'

    }),

  });



  const data = await response.json();

  if (!response.ok) {

    throw new Error(data.detail || 'Error al registrar usuario');

  }

  return data;

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