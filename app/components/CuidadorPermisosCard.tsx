import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { togglePermisoExportar } from '../../services/api';

interface CuidadorProps {
  pacienteId: string;
  cuidador: {
    usuario_id: string;
    nombre_completo: string;
    rol: string;
    puede_exportar_datos: boolean;
  };
  onPermisoActualizado?: (nuevoEstado: boolean) => void;
}

export const CuidadorPermisosCard: React.FC<CuidadorProps> = ({
  pacienteId,
  cuidador,
  onPermisoActualizado,
}) => {
  const [puedeExportar, setPuedeExportar] = useState<boolean>(
    cuidador.puede_exportar_datos ?? false
  );
  const [cargando, setCargando] = useState<boolean>(false);

  const handleToggle = async (nuevoValor: boolean) => {
    setPuedeExportar(nuevoValor);
    setCargando(true);

    try {
      await togglePermisoExportar(pacienteId, cuidador.usuario_id, nuevoValor);
      if (onPermisoActualizado) {
        onPermisoActualizado(nuevoValor);
      }
    } catch (error: any) {
      setPuedeExportar(!nuevoValor);
      Alert.alert('Permiso Denegado', error.message || 'No se pudo actualizar el permiso.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.infoContainer}>
        <Text style={styles.nombre}>{cuidador.nombre_completo}</Text>
        <Text style={styles.rol}>Rol: {cuidador.rol}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.toggleRow}>
        <View style={styles.textGroup}>
          <Text style={styles.toggleLabel}>Descarga de Expediente / CSV</Text>
          <Text style={styles.toggleSubtext}>
            Permite exportar historial y auditorías clínicas.
          </Text>
        </View>

        {cargando ? (
          <ActivityIndicator size="small" color="#0066CC" style={styles.switchLoader} />
        ) : (
          <Switch
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={puedeExportar ? '#0066CC' : '#F3F4F6'}
            ios_backgroundColor="#D1D5DB"
            onValueChange={handleToggle}
            value={puedeExportar}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoContainer: { marginBottom: 12 },
  nombre: { fontSize: 16, fontWeight: '700', color: '#111827' },
  rol: { fontSize: 13, color: '#6B7280', textTransform: 'capitalize', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textGroup: { flex: 1, paddingRight: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  toggleSubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  switchLoader: { paddingHorizontal: 10 },
});