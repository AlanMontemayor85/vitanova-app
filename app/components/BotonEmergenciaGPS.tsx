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

interface Props {
  pacienteId: string;
  apiBaseUrl: string;
  authToken: string;
  onPosicionFijada?: (coords: { lat: number; lng: number }) => void;
}

export const BotonEmergenciaGPS: React.FC<Props> = ({
  pacienteId,
  apiBaseUrl,
  authToken,
  onPosicionFijada,
}) => {
  const [cargando, setCargando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // Temporizador de cuenta regresiva (TTL de 20 min / 1200 seg)
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
      // Pulso háptico de advertencia/inicio
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const res = await fetch(`${apiBaseUrl}/pacientes/${pacienteId}/solicitar-gps-vivo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        // Feedback háptico de éxito
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSegundosRestantes(1200); // 20 minutos

        if (data.ubicacion && onPosicionFijada) {
          onPosicionFijada({
            lat: Number(data.ubicacion.lat),
            lng: Number(data.ubicacion.lng),
          });
        }
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Aviso', data.detail || 'No se pudo iniciar el modo búsqueda.');
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Falla de red al conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  const handlePress = async () => {
    // Impacto háptico medio al tocar el botón
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      '🚨 Modo Búsqueda Activa',
      '¿Deseas forzar el GPS y rastrear al familiar en tiempo real (reporte cada 10s)?',
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
    backgroundColor: '#0284C7',
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