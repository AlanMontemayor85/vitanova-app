import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getHistorialCierres } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

export default function HistorialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pacienteId = params.pacienteId as string;
  const pacienteNombre = params.pacienteNombre as string;

  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getHistorialCierres(pacienteId);
        if (data.cierres) setCierres(data.cierres);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const estadoEmoji: Record<string, string> = {
    bien: '😊', regular: '😐', preocupante: '😟'
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Historial de turnos</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {cierres.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Sin historial aún</Text>
            <Text style={styles.emptyText}>Los cierres de turno aparecerán aquí</Text>
          </View>
        ) : (
          cierres.map((c, i) => (
            <View key={c.id} style={styles.cierreCard}>
              <View style={styles.cierreHeader}>
                <Text style={styles.cierreEmoji}>{estadoEmoji[c.estado_paciente] ?? '—'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cierreNombreCuidador}>
                    {c.usuarios?.nombre_completo ?? 'Cuidador'}
                  </Text>
                  <Text style={styles.cierreFecha}>
                    {new Date(c.created_at).toLocaleString('es-MX', {
                      day: 'numeric', month: 'long',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
                <View style={[styles.estadoPill, {
                  backgroundColor: c.estado_paciente === 'bien' ? COLORS.greenPale :
                    c.estado_paciente === 'preocupante' ? COLORS.redPale : COLORS.amberPale
                }]}>
                  <Text style={[styles.estadoPillText, {
                    color: c.estado_paciente === 'bien' ? COLORS.green :
                      c.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber
                  }]}>{c.estado_paciente}</Text>
                </View>
              </View>

              <View style={styles.signosRow}>
                <View style={styles.signoItem}>
                  <Text style={styles.signoVal}>{c.spo2 ?? '—'}%</Text>
                  <Text style={styles.signoLabel}>SpO₂</Text>
                </View>
                <View style={styles.signoItem}>
                  <Text style={styles.signoVal}>{c.presion_sistolica ?? '—'}/{c.presion_diastolica ?? '—'}</Text>
                  <Text style={styles.signoLabel}>Presión</Text>
                </View>
                <View style={styles.signoItem}>
                  <Text style={styles.signoVal}>{c.frecuencia_cardiaca ?? '—'}</Text>
                  <Text style={styles.signoLabel}>FC bpm</Text>
                </View>
                {c.peso_kg && (
                  <View style={styles.signoItem}>
                    <Text style={styles.signoVal}>{c.peso_kg}</Text>
                    <Text style={styles.signoLabel}>kg</Text>
                  </View>
                )}
              </View>

              {c.barthel_total !== null && (
                <View style={styles.escalaRow}>
                  <Text style={styles.escalaLabel}>📋 Barthel</Text>
                  <Text style={styles.escalaVal}>{c.barthel_total}/100 — {c.barthel_label}</Text>
                </View>
              )}
              {c.morse_total !== null && (
                <View style={styles.escalaRow}>
                  <Text style={styles.escalaLabel}>⚠️ Morse</Text>
                  <Text style={styles.escalaVal}>{c.morse_total} pts — {c.morse_label}</Text>
                </View>
              )}
              {c.mna_total !== null && (
                <View style={styles.escalaRow}>
                  <Text style={styles.escalaLabel}>🍽️ MNA</Text>
                  <Text style={styles.escalaVal}>{c.mna_total} pts — {c.mna_label}</Text>
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  emptyText: { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },
  cierreCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cierreHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cierreEmoji: { fontSize: 28 },
  cierreNombreCuidador: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  cierreFecha: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  estadoPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoPillText: { fontSize: 10, fontWeight: '700' },
  signosRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  signoItem: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 8, padding: 8, alignItems: 'center' },
  signoVal: { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  signoLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 2 },
  escalaRow: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, alignItems: 'center' },
  escalaLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textDark, minWidth: 70 },
  escalaVal: { fontSize: 11, color: COLORS.textLight, flex: 1 },
});