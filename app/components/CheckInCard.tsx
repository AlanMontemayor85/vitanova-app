import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { actualizarConfigCheckin, CheckinConfig, solicitarCheckinPaciente } from '../../services/api'; // Ajusta la ruta a tu api.ts

interface CheckinCardProps {
  patientId: string;
  initialConfig?: CheckinConfig;
  userToken: string;
}

export const CheckinControlCard = ({ patientId, initialConfig, userToken }: CheckinCardProps) => {
  const [loading, setLoading] = useState(false);
  const [activo, setActivo] = useState(initialConfig?.activo ?? false);
  const [horas] = useState(initialConfig?.horas ?? ['09:00', '20:00']);

  const handleDispararCheckin = async () => {
    setLoading(true);
    try {
      const data = await solicitarCheckinPaciente(patientId, userToken);
      if (data.success) {
        Alert.alert("🔔 Solicitud enviada", "El reloj comenzó a sonar. Esperando que el paciente presione el botón de voz.");
      } else {
        Alert.alert("Aviso", data.detail || "No se pudo solicitar el check-in.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (valor: boolean) => {
    setActivo(valor);
    try {
      await actualizarConfigCheckin(
        patientId,
        {
          activo: valor,
          horas: horas,
          dias: [1, 2, 3, 4, 5, 6, 7],
        },
        userToken
      );
    } catch (err: any) {
      Alert.alert("Error", "No se pudo guardar la configuración.");
      setActivo(!valor);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Ionicons name="shield-checkmark" size={22} color="#10B981" />
          <Text style={styles.cardTitle}>Verificación de Estado</Text>
        </View>
        <Switch
          value={activo}
          onValueChange={handleToggle}
          trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
          thumbColor={activo ? '#10B981' : '#F3F4F6'}
        />
      </View>

      <Text style={styles.description}>
        Solicita una confirmación sonora al reloj para asegurar que tu familiar está bien sin activar alarmas de pánico.
      </Text>

      {activo && (
        <View style={styles.scheduleBox}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.scheduleText}>
            Horarios programados: <Text style={styles.boldText}>{horas.join(' y ')}</Text>
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.actionButton, loading && styles.disabledButton]} 
        onPress={handleDispararCheckin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="radio-outline" size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.btnText}>Solicitar "Estoy Bien" Ahora</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  scheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  scheduleText: {
    fontSize: 12,
    color: '#4B5563',
  },
  boldText: {
    fontWeight: '600',
    color: '#111827',
  },
  actionButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  btnIcon: {
    marginRight: 6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});