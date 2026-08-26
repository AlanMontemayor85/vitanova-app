import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { loadStoredToken } from './api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';
const COLA_KEY = '@vitanova_offline_queue_v1';

export interface PeticionOffline {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  descripcion: string;
  createdAt: string;
}

/**
 * Guarda una petición pendiente en el disco del dispositivo cuando no hay internet o falla la red.
 */
export async function encolarPeticionOffline(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: any,
  descripcion: string = 'Registro asistencial'
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(COLA_KEY);
    const cola: PeticionOffline[] = raw ? JSON.parse(raw) : [];

    const nuevoItem: PeticionOffline = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url,
      method,
      body,
      descripcion,
      createdAt: new Date().toISOString(),
    };

    cola.push(nuevoItem);
    await AsyncStorage.setItem(COLA_KEY, JSON.stringify(cola));
    console.log(`📦 [OFFLINE QUEUE] Petición encolada con éxito: "${descripcion}" (Total en cola: ${cola.length})`);
  } catch (err) {
    console.error('❌ Error al guardar petición offline en AsyncStorage:', err);
  }
}

/**
 * Vacía la cola enviando en ráfaga las peticiones pendientes cuando vuelve el internet.
 */
export async function vaciarColaOffline(): Promise<{ exitosos: number; pendientes: number }> {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { exitosos: 0, pendientes: 0 };
    }

    const token = await loadStoredToken();
    if (!token) {
      console.log('⚠️ [OFFLINE QUEUE] No hay sesión activa para procesar la cola.');
      return { exitosos: 0, pendientes: 0 };
    }

    const raw = await AsyncStorage.getItem(COLA_KEY);
    const cola: PeticionOffline[] = raw ? JSON.parse(raw) : [];
    if (cola.length === 0) return { exitosos: 0, pendientes: 0 };

    console.log(`🔄 [OFFLINE SYNC] Procesando ${cola.length} peticiones pendientes...`);

    const noEnviados: PeticionOffline[] = [];
    let exitosos = 0;

    for (const item of cola) {
      // 🎯 Resuelve automáticamente URLs relativas o absolutas
      const urlCompleta = item.url.startsWith('http')
        ? item.url
        : `${BASE_URL}${item.url.startsWith('/') ? '' : '/'}${item.url}`;

      try {
        const response = await fetch(urlCompleta, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: item.method !== 'DELETE' ? JSON.stringify(item.body) : undefined,
        });

        if (response.ok || response.status === 200 || response.status === 201 || response.status === 204) {
          exitosos++;
          console.log(`✅ [OFFLINE SYNC] Sincronizado: ${item.descripcion}`);
        } else {
          // Si el backend arrojó 5xx o timeout (408), conservamos en cola
          if (response.status >= 500 || response.status === 408) {
            noEnviados.push(item);
          } else {
            // Errores de validación 400/422 se descartan para no generar bucles infinitos
            console.warn(`⚠️ [OFFLINE SYNC] Descartado por status ${response.status}: ${item.descripcion}`);
          }
        }
      } catch (reqErr) {
        // Fallo físico de conexión durante el intento
        noEnviados.push(item);
      }
    }

    await AsyncStorage.setItem(COLA_KEY, JSON.stringify(noEnviados));
    console.log(`🏁 [OFFLINE SYNC] Fin del proceso: ${exitosos} sincronizados, ${noEnviados.length} restantes.`);
    return { exitosos, pendientes: noEnviados.length };
  } catch (err) {
    console.error('❌ Error vaciando la cola offline:', err);
    return { exitosos: 0, pendientes: 0 };
  }
}