import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getPacientes, login } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
  goldLight: '#D4B060',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cacaoDark: '#2C2820',
  cream: '#FAFAF7',
  sage: '#E8F0E4',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textMid: '#4A4540',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

export default function HomeScreen() {
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await login('admin@vitanova.mx', 'Vitanova2026!');
        const data = await getPacientes();
        if (data.patients && data.patients.length > 0) {
          setPaciente(data.patients[0]);
        }
      } catch (e) {
        console.error('Error init:', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF7' }}>
        <ActivityIndicator size="large" color="#BF9A40" />
        <Text style={{ marginTop: 12, color: '#8A8078', fontSize: 12 }}>Cargando...</Text>
      </View>
    );
  }

  const nombre = paciente?.nombre_completo?.split(' ')[0] ?? 'Paciente';
  const condiciones = paciente?.condiciones_medicas?.join(' · ') ?? '—';
  const iniciales = paciente?.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') ?? 'VN';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Buenos días</Text>
          <Text style={styles.userName}>Ana Leal</Text>
        </View>
        <View style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
        </View>
      </View>

      {/* PATIENT CARD */}
      <View style={styles.patientCard}>
        <View style={styles.patientAvatar}>
          <Text style={styles.patientAvatarText}>{iniciales}</Text>
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{nombre}</Text>
          <Text style={styles.patientAge}>{condiciones}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Bien</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* VITALS */}
        <View style={styles.vitalsRow}>
          <View style={styles.vitalCard}>
            <Text style={styles.vitalVal}>98</Text>
            <Text style={styles.vitalUnit}>%</Text>
            <Text style={styles.vitalLabel}>SpO₂</Text>
          </View>
          <View style={styles.vitalCard}>
            <Text style={styles.vitalVal}>120<Text style={styles.vitalValSmall}>/80</Text></Text>
            <Text style={styles.vitalLabel}>Presión</Text>
          </View>
          <View style={styles.vitalCard}>
            <Text style={[styles.vitalVal, { color: COLORS.red }]}>72</Text>
            <Text style={styles.vitalUnit}>bpm</Text>
            <Text style={styles.vitalLabel}>F. Card.</Text>
          </View>
          <View style={styles.vitalCard}>
            <Text style={[styles.vitalVal, { color: COLORS.green }]}>3/4</Text>
            <Text style={styles.vitalLabel}>Medicam.</Text>
          </View>
        </View>

        {/* ACTIVIDAD RECIENTE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.alertCard, { backgroundColor: COLORS.greenPale, borderColor: '#C5E8D4' }]}>
          <Text style={styles.alertIcon}>✅</Text>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Medicamento tomado</Text>
            <Text style={styles.alertSub}>Metformina 500mg · Confirmado por Rosa</Text>
          </View>
          <Text style={styles.alertTime}>8:30</Text>
        </View>

        <View style={[styles.alertCard, { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0' }]}>
          <Text style={styles.alertIcon}>⏰</Text>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Medicamento pendiente</Text>
            <Text style={styles.alertSub}>Losartán 50mg · Programado 3:00 PM</Text>
          </View>
          <Text style={styles.alertTime}>Hoy</Text>
        </View>

        
        {/* ACCESOS RÁPIDOS */}
        <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 12 }]}>Accesos rápidos</Text>
        <View style={styles.quickActions}>
          {[
            { icon: '📍', label: 'Ubicación', ruta: '/mapa' },
            { icon: '💊', label: 'Medicam.', ruta: '/medicamentos' },
            { icon: '🔔', label: 'Alertas', ruta: '/alertas' },
            { icon: '💬', label: 'Cuidadores', ruta: '/cuidadora' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.qaBtn}
              onPress={() => item.ruta && router.push(item.ruta as any)}
            >
              <Text style={styles.qaIcon}>{item.icon}</Text>
              <Text style={styles.qaLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* TURNO ACTIVO */}
        <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 12 }]}>Turno activo</Text>
        <View style={styles.turnoCard}>
          <View style={styles.turnoLeft}>
            <View style={styles.turnoAvatar}>
              <Text style={styles.turnoAvatarText}>RL</Text>
            </View>
            <View>
              <Text style={styles.turnoName}>Rosa López</Text>
              <Text style={styles.turnoHora}>8:00 AM — 6:00 PM</Text>
            </View>
          </View>
          <View style={styles.turnoProgress}>
            <Text style={styles.turnoProgressText}>3/5</Text>
            <Text style={styles.turnoProgressLabel}>tareas</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
<View style={styles.bottomNav}>
  {[
    { icon: '🏠', label: 'Inicio', ruta: '/', active: true },
    { icon: '📍', label: 'Mapa', ruta: '/mapa', active: false },
    { icon: '🔔', label: 'Alertas', ruta: '/alertas' },
    { icon: '📋', label: 'Medicam.', ruta: '/medicamentos', active: false },
    
  ].map((item) => (
    <TouchableOpacity
      key={item.label}
      style={styles.navItem}
      onPress={() => item.ruta && router.push(item.ruta as any)}
    >
      <Text style={styles.navIcon}>{item.icon}</Text>
      <Text style={[styles.navLabel, item.active && { color: COLORS.gold }]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  ))}
</View>
    </View>
        
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  notifBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifIcon: { fontSize: 18 },
  patientCard: {
    backgroundColor: COLORS.cacao,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  patientAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold,
  },
  patientAvatarText: {
    fontSize: 14, fontWeight: '800', color: COLORS.gold,
  },
  patientInfo: { flex: 1 },
  patientName: {
    fontSize: 13, fontWeight: '700', color: COLORS.white,
  },
  patientAge: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(61,170,106,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)',
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green,
  },
  statusText: {
    fontSize: 9, fontWeight: '700', color: COLORS.green, letterSpacing: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vitalVal: {
    fontSize: 16, fontWeight: '800', color: COLORS.gold, lineHeight: 20,
  },
  vitalValSmall: {
    fontSize: 10,
  },
  vitalUnit: {
    fontSize: 8, color: COLORS.textLight, marginTop: 1,
  },
  vitalLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textMid, marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.textLight,
  },
  sectionLink: {
    fontSize: 10, fontWeight: '700', color: COLORS.gold,
  },
  alertCard: {
    borderRadius: 12, padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
  },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textDark,
  },
  alertSub: {
    fontSize: 10, color: COLORS.textLight, marginTop: 2, lineHeight: 14,
  },
  alertTime: {
    fontSize: 9, color: COLORS.textLight,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  qaBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qaIcon: { fontSize: 20, marginBottom: 4 },
  qaLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textMid, textAlign: 'center',
  },
  turnoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14, padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 8,
  },
  turnoLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  turnoAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.goldPale,
    alignItems: 'center', justifyContent: 'center',
  },
  turnoAvatarText: {
    fontSize: 12, fontWeight: '800', color: COLORS.gold,
  },
  turnoName: {
    fontSize: 13, fontWeight: '700', color: COLORS.textDark,
  },
  turnoHora: {
    fontSize: 10, color: COLORS.textLight, marginTop: 1,
  },
  turnoProgress: {
    alignItems: 'center',
    backgroundColor: COLORS.goldPale,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  turnoProgressText: {
    fontSize: 16, fontWeight: '800', color: COLORS.gold,
  },
  turnoProgressLabel: {
    fontSize: 9, color: COLORS.gold, fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 24,
    paddingTop: 10,
  },
  navItem: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  navIcon: { fontSize: 20 },
  navLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textLight,
  },
});
