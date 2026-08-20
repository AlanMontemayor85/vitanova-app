import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { enviarComandoReloj } from '../../services/api';


const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078', border: '#E0D8CC',
  green: '#2E7D32', greenPale: '#EAF5E8', amber: '#D4860A', amberPale: '#FFF4E0',
  red: '#D94F4F', redPale: '#FDEAEA'
};
interface Props {
  pacienteId: string;
  userRole: string;
}

export const ControlRelojCard: React.FC<Props> = ({ pacienteId, userRole }) => {
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const esAdminOFamiliar = ['admin', 'familiar_principal', 'familiar_co_admin'].includes(userRole);

  const ejecutarComando = async (comando: 'FIND' | 'PEDO' | 'RESET' | 'POWEROFF', argumento: string = '') => {
    try {
      setEjecutando(comando);
      const data = await enviarComandoReloj(pacienteId, comando, argumento);
      if (data?.success) {
        let msg = 'Comando enviado.';
        if (comando === 'FIND') msg = 'El reloj está sonando (1 minuto).';
        if (comando === 'PEDO') msg = 'Podómetro activado (24h).';
        if (comando === 'RESET') msg = 'El reloj se está reiniciando.';
        if (comando === 'POWEROFF') msg = 'El reloj se apagó remotamente.';
        Alert.alert('Éxito', msg);
      } else {
        Alert.alert('Aviso', data?.detail || 'No se pudo comunicar con el reloj.');
      }
    } catch {
      Alert.alert('Error', 'Error de conexión con el servidor.');
    } finally {
      setEjecutando(null);
    }
  };

  const confirmarAccionCritica = (tipo: 'RESET' | 'POWEROFF') => {
    const esReset = tipo === 'RESET';
    Alert.alert(
      esReset ? '¿Reiniciar Reloj?' : '¿Apagar Reloj?',
      esReset
        ? 'El reloj se reiniciará y tardará ~1 minuto en reconectar.'
        : '⚠️ ATENCIÓN: Si apagas el reloj remotamente, requerirá encendido físico manual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: esReset ? 'Reiniciar' : 'Apagar', style: 'destructive', onPress: () => ejecutarComando(tipo) }
      ]
    );
  };

  return (
  <View style={styles.relojControlContainer}>
    <View style={styles.relojControlHeader}>
      <Ionicons name="watch-outline" size={16} color={COLORS.gold} />
      <Text style={styles.relojControlTitle}>Control Remoto de Hardware</Text>
    </View>

    {/* Botones Frecuentes */}
    <View style={styles.relojControlGrid}>
      <TouchableOpacity
        style={styles.btnRelojPrimario}
        disabled={ejecutando !== null}
        onPress={() => ejecutarComando('FIND')}
      >
        {ejecutando === 'FIND' ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : (
          <>
            <Ionicons name="volume-high-outline" size={16} color={COLORS.gold} />
            <Text style={styles.btnRelojPrimarioText}>Hacer Sonar</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnRelojSecundario}
        disabled={ejecutando !== null}
        onPress={() => ejecutarComando('PEDO', '1')}
      >
        {ejecutando === 'PEDO' ? (
          <ActivityIndicator color={COLORS.cacao} size="small" />
        ) : (
          <>
            <Ionicons name="footsteps-outline" size={16} color={COLORS.cacao} />
            <Text style={styles.btnRelojSecundarioText}>Activar Pasos</Text>
          </>
        )}
      </TouchableOpacity>
    </View>

    {/* Zona de Mantenimiento Remoto */}
    {esAdminOFamiliar && (
      <View style={styles.relojAdminSection}>
        <TouchableOpacity
          style={styles.btnAdminAction}
          disabled={ejecutando !== null}
          onPress={() => confirmarAccionCritica('RESET')}
        >
          <Ionicons name="reload-outline" size={13} color={COLORS.textDark} />
          <Text style={styles.btnAdminText}>Reiniciar</Text>
        </TouchableOpacity>

        <View style={styles.relojDividerVertical} />

        <TouchableOpacity
          style={styles.btnAdminAction}
          disabled={ejecutando !== null}
          onPress={() => confirmarAccionCritica('POWEROFF')}
        >
          <Ionicons name="power-outline" size={13} color="#DC2626" />
          <Text style={styles.btnAdminTextDanger}>Apagar</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);
};

const styles = StyleSheet.create({
  relojControlContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  relojControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
  },
  relojControlTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.cacao,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  relojControlGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  btnRelojPrimario: {
    flex: 1,
    backgroundColor: COLORS.cacao,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnRelojPrimarioText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnRelojSecundario: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnRelojSecundarioText: {
    color: COLORS.cacao,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  relojAdminSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  btnAdminAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  btnAdminText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  btnAdminTextDanger: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  relojDividerVertical: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.border,
  },
});