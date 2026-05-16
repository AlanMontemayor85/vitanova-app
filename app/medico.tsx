import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getPacientes, loadStoredToken } from '../services/api';

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

export default function MedicoScreen() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const nombre = 'Dr. Hernández';

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getPacientes();
        if (data.patients) setPacientes(data.patients);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

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

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Panel médico</Text>
          <Text style={styles.userName}>{nombre}</Text>
        </View>
        <View style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* RESUMEN */}
        <View style={styles.resumenRow}>
          <View style={styles.resumenCard}>
            <Text style={styles.resumenVal}>{pacientes.length}</Text>
            <Text style={styles.resumenLabel}>Pacientes</Text>
          </View>
          <View style={styles.resumenCard}>
            <Text style={[styles.resumenVal, { color: COLORS.green }]}>0</Text>
            <Text style={styles.resumenLabel}>Alertas hoy</Text>
          </View>
          <View style={styles.resumenCard}>
            <Text style={[styles.resumenVal, { color: COLORS.amber }]}>0</Text>
            <Text style={styles.resumenLabel}>Pendientes</Text>
          </View>
        </View>

        {/* PACIENTES */}
        <Text style={styles.sectionTitle}>Mis pacientes</Text>
        {pacientes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tienes pacientes asignados aún</Text>
          </View>
        ) : (
          pacientes.map((p) => (
            <TouchableOpacity key={p.id} style={styles.pacienteCard}>
              <View style={styles.pacienteAvatar}>
                <Text style={styles.pacienteAvatarText}>
                  {p.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                </Text>
              </View>
              <View style={styles.pacienteInfo}>
                <Text style={styles.pacienteNombre}>{p.nombre_completo}</Text>
                <Text style={styles.pacienteCondiciones}>
                  {p.condiciones_medicas?.join(' · ') ?? '—'}
                </Text>
                {p.medico_tratante && (
                  <Text style={styles.pacienteMedico}>🩺 {p.medico_tratante}</Text>
                )}
              </View>
              <View style={styles.pacienteStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Bien</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ACCIONES */}
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.accionesGrid}>
          {[
            { icon: '📊', label: 'Ver tendencias\nde signos', color: COLORS.goldPale },
            { icon: '💊', label: 'Revisar\nadherencia', color: COLORS.greenPale },
            { icon: '📄', label: 'Generar reporte\naseguradora', color: COLORS.amberPale },
            { icon: '➕', label: 'Agregar\npaciente', color: COLORS.cream },
          ].map((a) => (
            <TouchableOpacity key={a.label} style={[styles.accionCard, { backgroundColor: a.color }]}>
              <Text style={styles.accionIcon}>{a.icon}</Text>
              <Text style={styles.accionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ALERTAS RECIENTES */}
        <Text style={styles.sectionTitle}>Alertas recientes</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Sin alertas recientes 👍</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        {[
          { icon: '🏠', label: 'Inicio', active: true },
          { icon: '👥', label: 'Pacientes' },
          { icon: '📊', label: 'Reportes' },
          { icon: '⚙️', label: 'Config' },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.navItem}>
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
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2,
  },
  userName: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifIcon: { fontSize: 18 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  resumenRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  resumenCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  resumenVal: { fontSize: 24, fontWeight: '800', color: COLORS.gold },
  resumenLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 4,
  },
  pacienteCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  pacienteAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold,
  },
  pacienteAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  pacienteInfo: { flex: 1 },
  pacienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  pacienteCondiciones: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  pacienteMedico: { fontSize: 10, color: COLORS.gold, marginTop: 2 },
  pacienteStatus: {
    alignItems: 'center', gap: 4,
    backgroundColor: COLORS.greenPale, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  statusText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  accionesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  accionCard: {
    width: '47%', borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  accionIcon: { fontSize: 28, marginBottom: 8 },
  accionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textDark, textAlign: 'center' },
  emptyCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  emptyText: { fontSize: 13, color: COLORS.textLight },
  bottomNav: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: 24, paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textLight },
});