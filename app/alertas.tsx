import { useRouter } from 'expo-router';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const alertas = [
  {
    tipo: 'red',
    icon: '🆘',
    titulo: 'Botón SOS presionado',
    tiempo: 'Hace 2 días · 4:32 PM',
    estado: 'Resuelta',
    desc: 'Se presionó el botón de emergencia. Rosa confirmó que fue accidental.',
    ubicacion: 'Col. Del Valle, MTY',
  },
  {
    tipo: 'amber',
    icon: '⏰',
    titulo: 'Medicamento no tomado',
    tiempo: 'Hace 3 días · 8:00 PM',
    estado: 'Ver',
    desc: 'Losartán 50mg no fue confirmado en el horario programado.',
    ubicacion: null,
  },
  {
    tipo: 'green',
    icon: '✅',
    titulo: 'Dispositivo reconectado',
    tiempo: 'Hace 4 días · 9:15 AM',
    estado: null,
    desc: 'El dispositivo SOS estuvo offline 2 horas. Batería cargada.',
    ubicacion: null,
  },
  {
    tipo: 'amber',
    icon: '🚶',
    titulo: 'Salió de zona segura',
    tiempo: 'Hace 5 días · 11:30 AM',
    estado: 'Resuelta',
    desc: 'María Guadalupe salió del perímetro configurado. Regresó 20 min después.',
    ubicacion: 'Av. Garza Sada, MTY',
  },
];

const tabColors: Record<string, string> = { red: COLORS.red, amber: COLORS.amber, green: COLORS.green };
const tabBg: Record<string, string> = { red: COLORS.redPale, amber: COLORS.amberPale, green: COLORS.greenPale };

export default function AlertasScreen() {
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
          <Text style={styles.title}>Alertas</Text>
          <Text style={styles.subtitle}>María Guadalupe · Últimos 7 días</Text>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          {['Hoy', 'Semana', 'Mes'].map((tab, i) => (
            <View key={tab} style={[styles.tab, i === 1 && styles.tabActive]}>
              <Text style={[styles.tabText, i === 1 && styles.tabTextActive]}>{tab}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* RESUMEN */}
      <View style={styles.resumenRow}>
        <View style={styles.resumenCard}>
          <Text style={[styles.resumenNum, { color: COLORS.red }]}>1</Text>
          <Text style={styles.resumenLabel}>SOS</Text>
        </View>
        <View style={styles.resumenCard}>
          <Text style={[styles.resumenNum, { color: COLORS.amber }]}>2</Text>
          <Text style={styles.resumenLabel}>Medicam.</Text>
        </View>
        <View style={styles.resumenCard}>
          <Text style={[styles.resumenNum, { color: COLORS.green }]}>1</Text>
          <Text style={styles.resumenLabel}>Info</Text>
        </View>
        <View style={styles.resumenCard}>
          <Text style={[styles.resumenNum, { color: COLORS.gold }]}>4</Text>
          <Text style={styles.resumenLabel}>Total</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {alertas.map((alerta, i) => (
          <View key={i} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.alertBadge, { backgroundColor: tabBg[alerta.tipo] }]}>
                <Text style={styles.alertBadgeIcon}>{alerta.icon}</Text>
              </View>
              <View style={styles.alertHeaderInfo}>
                <Text style={styles.alertTitulo}>{alerta.titulo}</Text>
                <Text style={styles.alertTiempo}>{alerta.tiempo}</Text>
              </View>
              {alerta.estado && (
                <View style={[styles.estadoPill, { backgroundColor: tabBg[alerta.tipo] }]}>
                  <Text style={[styles.estadoText, { color: tabColors[alerta.tipo] }]}>
                    {alerta.estado}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.alertDesc}>{alerta.desc}</Text>
            {alerta.ubicacion && (
              <View style={styles.ubicacionWrap}>
                <Text style={styles.ubicacionIcon}>📍</Text>
                <Text style={styles.ubicacionText}>{alerta.ubicacion}</Text>
              </View>
            )}
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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  tabsWrap: {
    backgroundColor: COLORS.cacao,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 3,
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.gold },
  tabText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#fff' },
  resumenRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  resumenCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12, padding: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  resumenNum: { fontSize: 22, fontWeight: '800' },
  resumenLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textLight, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: 16 },
  alertCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  alertHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 8,
  },
  alertBadge: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  alertBadgeIcon: { fontSize: 18 },
  alertHeaderInfo: { flex: 1 },
  alertTitulo: { fontSize: 12, fontWeight: '700', color: COLORS.textDark },
  alertTiempo: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  estadoPill: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  estadoText: { fontSize: 9, fontWeight: '700' },
  alertDesc: {
    fontSize: 11, color: COLORS.textLight, lineHeight: 16,
  },
  ubicacionWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  ubicacionIcon: { fontSize: 12 },
  ubicacionText: { fontSize: 10, color: COLORS.textLight, fontWeight: '600' },
});
