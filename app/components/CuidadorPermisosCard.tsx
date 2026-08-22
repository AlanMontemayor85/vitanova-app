import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { togglePermisoExportar } from '../../services/api';

interface CuidadorProps {
  pacienteId: string;
  cuidador: {
    usuario_id: string;
    nombre_completo?: string;
    nombre?: string;
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

  const nombreMostrar = cuidador.nombre_completo || cuidador.nombre || 'Cuidador';

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
        <Text style={styles.nombre}>{nombreMostrar}</Text>
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
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoContainer: {
    marginBottom: 10,
  },
  nombre: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  rol: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  toggleSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  switchLoader: {
    paddingHorizontal: 10,
  },
});

export default CuidadorPermisosCard;