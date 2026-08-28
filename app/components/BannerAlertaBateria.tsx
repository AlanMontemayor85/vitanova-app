import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  bateriaPct?: number;
  ultimaConexion?: string;
  estaCargando?: boolean;
}

export const BannerAlertaBateria: React.FC<Props> = ({
  bateriaPct = 0,
  ultimaConexion,
  estaCargando = false,
}) => {
  // Calculamos si lleva más de 10 min desconectado con batería crítica
  const esBateriaCriticaOApagado = () => {
    if (bateriaPct <= 3 && !estaCargando) return true;
    
    if (ultimaConexion) {
      const diffMin = (new Date().getTime() - new Date(ultimaConexion).getTime()) / (1000 * 60);
      if (bateriaPct <= 5 && diffMin > 10) return true;
    }
    return false;
  };

  if (!esBateriaCriticaOApagado()) return null;

  return (
    <View style={styles.alertaCard}>
      <View style={styles.iconoCol}>
        <Ionicons name="battery-dead" size={32} color="#DC2626" />
      </View>
      <View style={styles.textoCol}>
        <Text style={styles.titulo}>RELOJ APAGADO POR BATERÍA AGOTADA</Text>
        <Text style={styles.instruccion}>
          1. Conecte el reloj a su base de carga magnética.{"\n"}
          2. Espere 5 minutos a que tome carga básica.{"\n"}
          3. Mantenga presionado el botón lateral por 4 segundos para encenderlo.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  alertaCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 5,
    borderLeftColor: '#DC2626',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  iconoCol: {
    marginRight: 12,
    marginTop: 2,
  },
  textoCol: {
    flex: 1,
  },
  titulo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  instruccion: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontWeight: '500',
  },
});