import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { enviarComandoReloj } from '../../services/api'; // Ajusta la ruta a tu archivo de API

interface Props {
  pacienteId: string;
  userRole: 'admin' | 'familiar_principal' | 'familiar_co_admin' | 'familiar' | 'cuidador' | 'cuidador_contratado';
  relojOnline?: boolean;
}

export const ControlRelojCard: React.FC<Props> = ({ pacienteId, userRole, relojOnline = true }) => {
  const [ejecutando, setEjecutando] = useState<string | null>(null);

  // Determinar permisos
  const esAdminOFamiliar = ['admin', 'familiar_principal', 'familiar_co_admin', 'familiar'].includes(userRole);

  const ejecutarComando = async (comando: 'FIND' | 'PEDO' | 'RESET' | 'POWEROFF', argumento: string = '') => {
    try {
      setEjecutando(comando);
      
      const data = await enviarComandoReloj(pacienteId, comando, argumento);

      if (data?.success) {
        let msg = 'Comando enviado con éxito.';
        if (comando === 'FIND') msg = 'El reloj está sonando (duración: 1 minuto).';
        if (comando === 'PEDO') msg = 'Podómetro activado (conteo 24h).';
        if (comando === 'RESET') msg = 'El reloj se está reiniciando.';
        if (comando === 'POWEROFF') msg = 'El reloj se ha apagado remotamente.';
        Alert.alert('Éxito', msg);
      } else {
        Alert.alert('Aviso', data?.detail || 'No se pudo comunicar con el reloj.');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Error al conectar con el servidor.');
    } finally {
      setEjecutando(null);
    }
  };

  const confirmarAccionCritica = (tipo: 'RESET' | 'POWEROFF') => {
    const esReset = tipo === 'RESET';
    Alert.alert(
      esReset ? '¿Reiniciar Reloj?' : '¿Apagar Reloj?',
      esReset
        ? 'El reloj se reiniciará y tardará cerca de 1 minuto en reconectarse.'
        : '⚠️ ATENCIÓN: Si apagas el reloj remotamente, alguien tendrá que presionar el botón físico en persona para volver a encenderlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: esReset ? 'Reiniciar' : 'Apagar', 
          style: 'destructive',
          onPress: () => ejecutarComando(tipo)
        }
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="watch-outline" size={20} color="#0E7490" />
        <Text style={styles.title}>Control de Hardware del Reloj</Text>
      </View>

      {/* 🟢 SECCIÓN COMÚN: Cuidador y Familiares (Index) */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          disabled={ejecutando !== null}
          onPress={() => ejecutarComando('FIND')}
        >
          {ejecutando === 'FIND' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="volume-high-outline" size={18} color="#fff" />
              <Text style={styles.btnTextPrimary}>Hacer Sonar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          disabled={ejecutando !== null}
          onPress={() => ejecutarComando('PEDO', '1')}
        >
          {ejecutando === 'PEDO' ? (
            <ActivityIndicator color="#0E7490" size="small" />
          ) : (
            <>
              <Ionicons name="footsteps-outline" size={18} color="#0E7490" />
              <Text style={styles.btnTextSecondary}>Activar Pasos</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 🔴 SECCIÓN EXCLUSIVA: Solo Familiares / Admins (Index) */}
      {esAdminOFamiliar && (
        <View style={styles.adminSection}>
          <Text style={styles.adminLabel}>Acciones de Administración Remota</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnWarning]}
              disabled={ejecutando !== null}
              onPress={() => confirmarAccionCritica('RESET')}
            >
              {ejecutando === 'RESET' ? (
                <ActivityIndicator color="#B45309" size="small" />
              ) : (
                <>
                  <Ionicons name="reload-outline" size={16} color="#B45309" />
                  <Text style={styles.btnTextWarning}>Reiniciar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              disabled={ejecutando !== null}
              onPress={() => confirmarAccionCritica('POWEROFF')}
            >
              {ejecutando === 'POWEROFF' ? (
                <ActivityIndicator color="#B91C1C" size="small" />
              ) : (
                <>
                  <Ionicons name="power-outline" size={16} color="#B91C1C" />
                  <Text style={styles.btnTextDanger}>Apagar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: '#0891B2',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  btnSecondary: {
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  btnTextSecondary: {
    color: '#0E7490',
    fontWeight: '600',
    fontSize: 13,
  },
  adminSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  adminLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  btnWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  btnTextWarning: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 12,
  },
  btnDanger: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnTextDanger: {
    color: '#991B1B',
    fontWeight: '600',
    fontSize: 12,
  },
});