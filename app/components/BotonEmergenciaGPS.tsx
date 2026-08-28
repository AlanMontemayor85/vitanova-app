import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { getUbicacion, solicitarGpsVivo } from '../../services/api';

interface Props {
  pacienteId: string;
  onPosicionFijada?: (coords: { lat: number; lng: number }) => void;
}

export const BotonEmergenciaGPS: React.FC<Props> = ({
  pacienteId,
  onPosicionFijada,
}) => {
  const [cargando, setCargando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (segundosRestantes > 0) {
      timer = setInterval(() => {
        setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [segundosRestantes]);

  const formatearTiempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ejecutarSolicitud = async () => {
    try {
      setCargando(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Llama a tu función nativa de api.ts
      await solicitarGpsVivo(pacienteId);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSegundosRestantes(1200); // 20 minutos

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

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      '🚨 Modo Búsqueda Activa',
      '¿Deseas forzar el GPS y rastrear al paciente en tiempo real (cada 10s)?',
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
              {activo ? 'BÚSQUEDA ACTIVA (10s)' : 'SOLICITAR GPS EN VIVO'}
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