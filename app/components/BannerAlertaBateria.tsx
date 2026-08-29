import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  bateriaPct?: number | null;
  ultimaConexion?: string | null;
  estaCargando?: boolean;
}

export const BannerAlertaBateria: React.FC<Props> = ({
  bateriaPct,
  ultimaConexion,
  estaCargando = false,
}) => {
  // 1. Parsear fecha UTC de manera segura
  const obtenerMinutosDesconectado = (): number => {
    if (!ultimaConexion) return 9999;
    try {
      const fechaNormalizada = ultimaConexion.includes('Z') || ultimaConexion.includes('+')
        ? ultimaConexion
        : `${ultimaConexion.replace(' ', 'T')}Z`;
      
      const diffMs = new Date().getTime() - new Date(fechaNormalizada).getTime();
      return Math.floor(diffMs / (1000 * 60));
    } catch {
      return 9999;
    }
  };

  const diffMin = obtenerMinutosDesconectado();
  const nivelBateria = bateriaPct ?? 0;
  const estaFueraDeLinea = diffMin > 10;
  const esBateriaBaja = nivelBateria <= 10 && !estaCargando;

  // Si está en línea y con buena batería, no mostrar nada
  if (!estaFueraDeLinea && !esBateriaBaja) return null;

  // Formato legible de tiempo desconectado
  const tiempoDescTexto = diffMin > 60 
    ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` 
    : `${diffMin} min`;

  // Caso 1: Batería crítica (<= 5%)
  if (nivelBateria <= 5 && !estaCargando) {
    return (
      <View style={[styles.alertaCard, styles.cardCritica]}>
        <View style={styles.iconoCol}>
          <Ionicons name="battery-dead" size={30} color="#DC2626" />
        </View>
        <View style={styles.textoCol}>
          <Text style={styles.tituloCritico}>RELOJ APAGADO O SIN BATERÍA ({nivelBateria}%)</Text>
          <Text style={styles.instruccionCritica}>
            1. Conecte el reloj a su base magnética.{"\n"}
            2. Espere unos minutos y mantenga presionado el botón lateral 4 segundos.
          </Text>
        </View>
      </View>
    );
  }

  // Caso 2: Apagado / Fuera de línea con batería remanente
  return (
    <View style={[styles.alertaCard, styles.cardOffline]}>
      <View style={styles.iconoCol}>
        <Ionicons name="cloud-offline" size={28} color="#D97706" />
      </View>
      <View style={styles.textoCol}>
        <Text style={styles.tituloOffline}>RELOJ FUERA DE LÍNEA ({tiempoDescTexto})</Text>
        <Text style={styles.instruccionOffline}>
          Última batería registrada: <Text style={{ fontWeight: '700' }}>{nivelBateria}%</Text>.{"\n"}
          Verifique que el reloj esté encendido y con cobertura móvil.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  alertaCard: {
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
  cardCritica: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 5,
    borderLeftColor: '#DC2626',
  },
  cardOffline: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 5,
    borderLeftColor: '#D97706',
  },
  iconoCol: {
    marginRight: 12,
    marginTop: 2,
  },
  textoCol: {
    flex: 1,
  },
  tituloCritico: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  instruccionCritica: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontWeight: '500',
  },
  tituloOffline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  instruccionOffline: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    fontWeight: '500',
  },
});