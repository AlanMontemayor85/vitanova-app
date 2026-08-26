import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
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
    console.log(`📦 [OFFLINE QUEUE] Petición encolada: "${descripcion}" (Total: ${cola.length})`);
  } catch (err) {
    console.error('❌ Error al guardar en AsyncStorage:', err);
  }
}

export async function vaciarColaOffline(): Promise<{ exitosos: number; pendientes: number }> {
  try {
    const netState = await Network.getNetworkStateAsync();
    if (!netState.isConnected || !netState.isInternetReachable) {
      return { exitosos: 0, pendientes: 0 };
    }

    const token = await loadStoredToken();
    if (!token) return { exitosos: 0, pendientes: 0 };

    const raw = await AsyncStorage.getItem(COLA_KEY);
    const cola: PeticionOffline[] = raw ? JSON.parse(raw) : [];
    if (cola.length === 0) return { exitosos: 0, pendientes: 0 };

    console.log(`🔄 [OFFLINE SYNC] Procesando ${cola.length} peticiones pendientes...`);

    const noEnviados: PeticionOffline[] = [];
    let exitosos = 0;

    for (const item of cola) {
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
          if (response.status >= 500 || response.status === 408) {
            noEnviados.push(item);
          } else {
            console.warn(`⚠️ [OFFLINE SYNC] Descartado status ${response.status}: ${item.descripcion}`);
          }
        }
      } catch {
        noEnviados.push(item);
      }
    }

    await AsyncStorage.setItem(COLA_KEY, JSON.stringify(noEnviados));
    return { exitosos, pendientes: noEnviados.length };
  } catch (err) {
    console.error('❌ Error vaciando cola offline:', err);
    return { exitosos: 0, pendientes: 0 };
  }
}