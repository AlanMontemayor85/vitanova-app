import { useRouter } from 'expo-router';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const COLORS = {
  gold: '#BF9A40',
  goldLight: '#D4B060',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textMid: '#4A4540',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
};

const medicamentos = [
  {
    hora: 'Mañana — 8:00 AM',
    meds: [
      { nombre: 'Metformina', dosis: '500mg · Con el desayuno', icon: '💊', estado: 'done' },
      { nombre: 'Losartán', dosis: '50mg · En ayunas', icon: '💉', estado: 'done' },
    ],
  },
  {
    hora: 'Tarde — 3:00 PM',
    meds: [
      { nombre: 'Metformina', dosis: '500mg · Con la comida', icon: '💊', estado: 'pendiente' },
    ],
  },
  {
    hora: 'Noche — 9:00 PM',
    meds: [
      { nombre: 'Atorvastatina', dosis: '20mg · Antes de dormir', icon: '🌙', estado: 'done' },
    ],
  },
];

export default function MedicamentosScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Medicamentos</Text>
          <Text style={styles.subtitle}>Viernes 9 de mayo · María Guadalupe</Text>
        </View>
      </View>

      {/* PROGRESO */}
      <View style={styles.progressWrap}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Adherencia hoy</Text>
          <Text style={styles.progressVal}>3 de 4 tomados</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {medicamentos.map((grupo) => (
          <View key={grupo.hora} style={styles.grupo}>
            <Text style={styles.grupoLabel}>{grupo.hora}</Text>
            {grupo.meds.map((med) => (
              <View
                key={med.nombre + med.dosis}
                style={[
                  styles.medCard,
                  med.estado === 'pendiente' && styles.medCardPendiente,
                ]}
              >
                <View style={styles.medIcon}>
                  <Text style={styles.medIconText}>{med.icon}</Text>
                </View>
                <View style={styles.medInfo}>
                  <Text style={styles.medNombre}>{med.nombre}</Text>
                  <Text style={styles.medDosis}>{med.dosis}</Text>
                </View>
                <View style={[
                  styles.checkCircle,
                  med.estado === 'done' ? styles.checkDone : styles.checkPending,
                ]}>
                  <Text style={styles.checkIcon}>
                    {med.estado === 'done' ? '✓' : '○'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: COLORS.white },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  progressWrap: {
    backgroundColor: COLORS.cacao,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  progressVal: { fontSize: 11, fontWeight: '700', color: COLORS.gold },
  progressBar: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', width: '75%',
    backgroundColor: COLORS.gold, borderRadius: 3,
  },
  body: { flex: 1, padding: 16 },
  grupo: { marginBottom: 20 },
  grupoLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.textLight,
    marginBottom: 8,
  },
  medCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  medCardPendiente: {
    borderColor: 'rgba(212,134,10,0.3)',
    backgroundColor: '#FFFCF5',
  },
  medIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', justifyContent: 'center',
  },
  medIconText: { fontSize: 18 },
  medInfo: { flex: 1 },
  medNombre: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  medDosis: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  checkDone: { backgroundColor: COLORS.green },
  checkPending: { backgroundColor: COLORS.border },
  checkIcon: { fontSize: 14, color: COLORS.white, fontWeight: '700' },
});
