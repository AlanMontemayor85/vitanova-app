import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getUltimoCierre } from '../../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078', border: '#E0D8CC',
  green: '#2E7D32', greenPale: '#EAF5E8', amber: '#D4860A', amberPale: '#FFF4E0',
  red: '#D94F4F', redPale: '#FDEAEA'
};

const EMOJIS_ANIMO: Record<string, string> = {
  tranquilo: '😌 Tranquilo',
  alegre: '😊 Alegre',
  ansioso: '😰 Ansioso',
  triste: '😢 Triste',
  agitado: '😤 Agitado',
  confundido: '😵 Confundido',
  somnoliento: '😴 Somnoliento',
};

interface Props {
  pacienteId: string;
}

export const TarjetaUltimoCierre: React.FC<Props> = ({ pacienteId }) => {
  const [cierre, setCierre] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (pacienteId) {
      cargarCierre();
    }
  }, [pacienteId]);

  const cargarCierre = async () => {
    try {
      setLoading(true);
      const data = await getUltimoCierre(pacienteId);
      if (data && !data.error) {
        setCierre(data);
      }
    } catch (e) {
      console.error('Error cargando el último cierre:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, { justifyContent: 'center', height: 100 }]}>
        <ActivityIndicator size="small" color={COLORS.gold} />
      </View>
    );
  }

  if (!cierre) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Estado Físico y Conductual</Text>
        <Text style={styles.emptyText}>Sin registros de cierre de turno recientes.</Text>
      </View>
    );
  }

  // Color de semáforo para la intensidad del dolor (Escala EVA)
  const dolorVal = cierre.dolor_eva ?? 0;
  let dolorBg = COLORS.greenPale;
  let dolorColor = COLORS.green;
  let dolorLabel = 'Leve/Sin dolor';

  if (dolorVal >= 4 && dolorVal <= 6) {
    dolorBg = COLORS.amberPale;
    dolorColor = COLORS.amber;
    dolorLabel = 'Moderado';
  } else if (dolorVal >= 7) {
    dolorBg = COLORS.redPale;
    dolorColor = COLORS.red;
    dolorLabel = 'Severo';
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>📊 Estado del Último Relevo</Text>
        {cierre.created_at && (
          <Text style={styles.fechaBadge}>
            {new Date(cierre.created_at).toLocaleDateString('es-MX')}
          </Text>
        )}
      </View>

      {/* GRID DE PARÁMETROS PREVENTIVOS */}
      <View style={styles.grid}>
        {/* 🔴 DOLOR EVA */}
        <View style={[styles.pill, { backgroundColor: dolorBg, borderColor: dolorColor }]}>
          <Text style={styles.pillLabel}>Intensidad Dolor (EVA)</Text>
          <Text style={[styles.pillValue, { color: dolorColor }]}>
            {`${dolorVal}/10 (${dolorLabel})`}
          </Text>
        </View>

        {/* 🧠 ESTADO DE ÁNIMO / CONDUCTA */}
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Ánimo / Conducta</Text>
          <Text style={styles.pillValue}>
            {EMOJIS_ANIMO[cierre.estado_animo?.toLowerCase()] || cierre.estado_animo || 'No especificado'}
          </Text>
        </View>

        {/* 💧 HIDRATACIÓN */}
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Hidratación</Text>
          <Text style={styles.pillValue}>
            {`💧 ${cierre.hidratacion_vasos ?? 0} de 8 vasos (${(cierre.hidratacion_vasos ?? 0) * 250} ml)`}
          </Text>
        </View>

        {/* 🥗 ALIMENTACIÓN */}
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Ingesta Nutricional</Text>
          <Text style={styles.pillValue}>
            {cierre.alimentacion === 'completa' ? '🍽️ Completa (>75%)' :
             cierre.alimentacion === 'parcial' ? '🥣 Parcial (25-75%)' :
             cierre.alimentacion === 'ninguna' ? '❌ Nula (<25%)' : 'No especificada'}
          </Text>
        </View>
      </View>

      {/* 📝 NOTAS DE OBSERVACIÓN */}
      {cierre.notas && (
        <View style={styles.notasBox}>
          <Text style={styles.notasTitle}>📝 Observaciones del Cuidador:</Text>
          <Text style={styles.notasText}>{cierre.notas}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.cacao,
  },
  fechaBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    backgroundColor: COLORS.goldPale,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  grid: {
    gap: 8,
  },
  pill: {
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
    marginTop: 2,
  },
  notasBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  notasTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 2,
  },
  notasText: {
    fontSize: 12,
    color: COLORS.textDark,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 6,
  },
});