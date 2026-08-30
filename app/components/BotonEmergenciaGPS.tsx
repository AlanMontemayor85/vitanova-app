import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { detenerGpsVivo, getUbicacion, solicitarGpsVivo } from '../../services/api';
interface Props {
  pacienteId: string;
  onPosicionFijada?: (coords: { lat: number; lng: number }) => void;
}

const STORAGE_KEY = (id: string) => `@vitanova_emergencia_expira_${id}`;
const DURACION_EMERGENCIA_SEG = 600; // 10 minutos (600 s)

export const BotonEmergenciaGPS: React.FC<Props> = ({
  pacienteId,
  onPosicionFijada,
}) => {
  const [cargando, setCargando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 🔄 1. Sincronizar tiempo real restante desde AsyncStorage
  const sincronizarTemporizador = async () => {
    try {
      const storedExpira = await AsyncStorage.getItem(STORAGE_KEY(pacienteId));
      if (!storedExpira) {
        setSegundosRestantes(0);
        return;
      }

      const expiraMs = parseInt(storedExpira, 10);
      const diffSegundos = Math.floor((expiraMs - Date.now()) / 1000);

      if (diffSegundos > 0) {
        setSegundosRestantes(diffSegundos);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY(pacienteId));
        setSegundosRestantes(0);
      }
    } catch (e) {
      console.warn('Error leyendo temporizador de emergencia:', e);
    }
  };

  // 📱 2. Escuchar montaje y cambios de primer/segundo plano
  useEffect(() => {
    sincronizarTemporizador();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        sincronizarTemporizador();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pacienteId]);

  // ⏱️ 3. Intervalo de descuento por segundo
  useEffect(() => {
    if (segundosRestantes > 0) {
      timerRef.current = setInterval(() => {
        setSegundosRestantes((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            AsyncStorage.removeItem(STORAGE_KEY(pacienteId));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [segundosRestantes > 0]);

  const formatearTiempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ejecutarSolicitud = async () => {
    try {
      setCargando(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      await solicitarGpsVivo(pacienteId);

      // Guardar tiempo de expiración absoluto (10 minutos desde ahora)
      const expiraMs = Date.now() + DURACION_EMERGENCIA_SEG * 1000;
      await AsyncStorage.setItem(STORAGE_KEY(pacienteId), expiraMs.toString());
      setSegundosRestantes(DURACION_EMERGENCIA_SEG);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Consulta ubicación fresca a los 3 segundos
      setTimeout(async () => {
        try {
          const res = await getUbicacion(pacienteId);
          const rawLat = res?.ubicacion?.lat ?? res?.ubicacion?.latitud;
          const rawLng = res?.ubicacion?.lng ?? res?.ubicacion?.longitud;
          if (rawLat && rawLng && onPosicionFijada) {
            onPosicionFijada({ lat: Number(rawLat), lng: Number(rawLng) });
          }
        } catch (e) {
          console.error('Error obteniendo fix:', e);
        }
      }, 3000);
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Aviso', 'No se pudo iniciar el modo búsqueda en este momento.');
    } finally {
      setCargando(false);
    }
  };

  const ejecutarDetener = async () => {
    try {
      setCargando(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await detenerGpsVivo(pacienteId);
      await AsyncStorage.removeItem(STORAGE_KEY(pacienteId));
      setSegundosRestantes(0);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Modo Reposo', 'El reloj regresó a modo normal de ahorro de batería.');
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Aviso', 'No se pudo detener el modo en vivo en el servidor.');
    } finally {
      setCargando(false);
    }
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (segundosRestantes > 0) {
      Alert.alert(
        '🛑 Detener Búsqueda Activa',
        '¿Deseas regresar el reloj a su modo reposo (15 min) para enfriarlo y ahorrar batería?',
        [
          { text: 'Continuar Rastreando', style: 'cancel' },
          {
            text: 'Detener',
            style: 'destructive',
            onPress: ejecutarDetener,
          },
        ]
      );
      return;
    }

    Alert.alert(
      '🚨 Modo Búsqueda Activa',
      '¿Deseas forzar el GPS y rastrear al paciente en tiempo real (cada 10s durante 10 min)?\n\n⚠️ Este modo consume más batería.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar',
          style: 'destructive',
          onPress: ejecutarSolicitud,
        },
      ]
    );
  };

  const activo = segundosRestantes > 0;

  return (
    <TouchableOpacity
      style={[styles.boton, activo ? styles.botonActivo : styles.botonInactivo]}
      onPress={handlePress}
      disabled={cargando}
      activeOpacity={0.8}
    >
      {cargando ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <View style={styles.contenedorInterno}>
          <Ionicons
            name={activo ? 'radio' : 'navigate-circle'}
            size={24}
            color="#FFFFFF"
            style={styles.icono}
          />
          <View style={styles.bloqueTexto}>
            <Text style={styles.textoTitulo}>
              {activo ? 'DETENER BÚSQUEDA ACTIVA (10s)' : 'SOLICITAR GPS EN VIVO'}
            </Text>
            {activo && (
              <Text style={styles.textoSub}>
                Tiempo restante: {formatearTiempo(segundosRestantes)} min
              </Text>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  boton: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3.5,
  },
  botonInactivo: {
    backgroundColor: '#BF9A40',
  },
  botonActivo: {
    backgroundColor: '#DC2626',
  },
  contenedorInterno: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icono: {
    marginRight: 10,
  },
  bloqueTexto: {
    justifyContent: 'center',
  },
  textoTitulo: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  textoSub: {
    color: '#FEE2E2',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
});