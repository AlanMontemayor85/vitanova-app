import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearToken, getDashboardMedico, loadStoredToken } from '../services/api';

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

const TIPO_ALERTA: Record<string, { icon: string; color: string }> = {
  SOS: { icon: '🚨', color: '#D94F4F' },
  caida: { icon: '⚠️', color: '#D4860A' },
  signo_vital: { icon: '🩺', color: '#D94F4F' },
  medicamento: { icon: '💊', color: '#BF9A40' },
  otro: { icon: '🔔', color: '#8A8078' },
};

export default function MedicoScreen() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<any>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getDashboardMedico();
        if (data.pacientes) setDashboard(data);
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

  // ── VISTA DETALLE PACIENTE ──
  if (pacienteSeleccionado) {
    const p = pacienteSeleccionado;
    const cierre = p.ultimo_cierre;
    const escalas = p.escalas_recientes ?? [];

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPacienteSeleccionado(null)} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Expediente clínico</Text>
            <Text style={styles.userName}>{p.nombre_completo}</Text>
          </View>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

          {/* CONDICIONES */}
          <Text style={styles.sectionTitle}>Diagnósticos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {p.condiciones_medicas?.map((c: string, i: number) => (
              <View key={i} style={styles.condicionPill}>
                <Text style={styles.condicionPillText}>{c}</Text>
              </View>
            ))}
          </View>

          {/* ÚLTIMOS SIGNOS VITALES */}
          {cierre && (
            <>
              <Text style={styles.sectionTitle}>Últimos signos vitales</Text>
              <View style={styles.signosGrid}>
                <View style={styles.signoCard}>
                  <Text style={styles.signoVal}>{cierre.spo2 ?? '—'}%</Text>
                  <Text style={styles.signoLabel}>SpO₂</Text>
                </View>
                <View style={styles.signoCard}>
                  <Text style={styles.signoVal}>{cierre.presion_sistolica ?? '—'}/{cierre.presion_diastolica ?? '—'}</Text>
                  <Text style={styles.signoLabel}>Presión</Text>
                </View>
                <View style={styles.signoCard}>
                  <Text style={styles.signoVal}>{cierre.frecuencia_cardiaca ?? '—'}</Text>
                  <Text style={styles.signoLabel}>FC bpm</Text>
                </View>
                <View style={styles.signoCard}>
                  <Text style={[styles.signoVal, {
                    color: cierre.estado_paciente === 'bien' ? COLORS.green :
                      cierre.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber
                  }]}>
                    {cierre.estado_paciente === 'bien' ? '😊' : cierre.estado_paciente === 'preocupante' ? '😟' : '😐'}
                  </Text>
                  <Text style={styles.signoLabel}>Estado</Text>
                </View>
              </View>
              <Text style={{ fontSize: 10, color: COLORS.textLight, marginBottom: 16 }}>
                Último registro: {new Date(cierre.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </>
          )}

          {/* ESCALAS CLÍNICAS */}
          <Text style={styles.sectionTitle}>Escalas clínicas recientes</Text>
          {escalas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Sin escalas registradas aún</Text>
            </View>
          ) : (
            escalas.map((e: any, i: number) => {
              const iconos: Record<string, string> = { barthel: '📋', morse: '⚠️', mna: '🍽️' };
              return (
                <View key={i} style={styles.escalaCard}>
                  <Text style={styles.escalaIcon}>{iconos[e.tipo] ?? '📊'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.escalaNombre}>
                      {e.tipo === 'barthel' ? 'Índice de Barthel' : e.tipo === 'morse' ? 'Escala de Morse' : 'Nutrición MNA'}
                    </Text>
                    <Text style={styles.escalaLabel}>{e.label}</Text>
                    <Text style={styles.escalaFecha}>
                      {new Date(e.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={styles.escalaTotal}>{e.total}</Text>
                </View>
              );
            })
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    );
  }

  // ── VISTA PRINCIPAL ──
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Panel médico</Text>
          <Text style={styles.userName}>{dashboard?.medico?.nombre_completo ?? 'Dr.'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={async () => {
            await clearToken();
            router.replace('/login');
          }}
        >
          <Text style={styles.notifIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* RESUMEN */}
        <View style={styles.resumenRow}>
          <View style={styles.resumenCard}>
            <Text style={styles.resumenVal}>{dashboard?.total_pacientes ?? 0}</Text>
            <Text style={styles.resumenLabel}>Pacientes</Text>
          </View>
          <View style={styles.resumenCard}>
            <Text style={[styles.resumenVal, { color: dashboard?.total_alertas > 0 ? COLORS.red : COLORS.green }]}>
              {dashboard?.total_alertas ?? 0}
            </Text>
            <Text style={styles.resumenLabel}>Alertas activas</Text>
          </View>
          <View style={styles.resumenCard}>
            <Text style={[styles.resumenVal, { color: COLORS.amber }]}>
              {dashboard?.pacientes?.filter((p: any) => p.ultimo_cierre?.estado_paciente === 'preocupante').length ?? 0}
            </Text>
            <Text style={styles.resumenLabel}>Preocupantes</Text>
          </View>
        </View>

        {/* ALERTAS ACTIVAS */}
        {dashboard?.alertas?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Alertas activas</Text>
            {dashboard.alertas.map((a: any, i: number) => {
              const config = TIPO_ALERTA[a.tipo] ?? TIPO_ALERTA.otro;
              return (
                <View key={i} style={[styles.alertaCard, { borderColor: config.color + '40' }]}>
                  <Text style={styles.alertaIcon}>{config.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertaDesc}>{a.descripcion}</Text>
                    <Text style={styles.alertaFecha}>
                      {new Date(a.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.severidadPill, { backgroundColor: a.severidad === 'alta' ? COLORS.redPale : COLORS.amberPale }]}>
                    <Text style={[styles.severidadText, { color: a.severidad === 'alta' ? COLORS.red : COLORS.amber }]}>{a.severidad}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* PACIENTES */}
        <Text style={styles.sectionTitle}>Mis pacientes</Text>
        {dashboard?.pacientes?.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tienes pacientes asignados aún</Text>
          </View>
        ) : (
          dashboard?.pacientes?.map((p: any) => {
            const cierre = p.ultimo_cierre;
            const iniciales = p.nombre_completo?.split(' ').map((n: string) => n[0]).slice(0, 2).join('');
            const estadoColor = cierre?.estado_paciente === 'bien' ? COLORS.green :
              cierre?.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber;
            const estadoBg = cierre?.estado_paciente === 'bien' ? COLORS.greenPale :
              cierre?.estado_paciente === 'preocupante' ? COLORS.redPale : COLORS.amberPale;

            return (
              <TouchableOpacity
                key={p.id}
                style={styles.pacienteCard}
                onPress={() => setPacienteSeleccionado(p)}
              >
                <View style={styles.pacienteAvatar}>
                  <Text style={styles.pacienteAvatarText}>{iniciales}</Text>
                </View>
                <View style={styles.pacienteInfo}>
                  <Text style={styles.pacienteNombre}>{p.nombre_completo}</Text>
                  <Text style={styles.pacienteCondiciones}>
                    {p.condiciones_medicas?.join(' · ') ?? '—'}
                  </Text>
                  {cierre && (
                    <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>
                      SpO₂ {cierre.spo2}% · {cierre.presion_sistolica}/{cierre.presion_diastolica} mmHg
                    </Text>
                  )}
                </View>
                <View style={[styles.pacienteStatus, { backgroundColor: estadoBg }]}>
                  <Text style={[styles.statusText, { color: estadoColor }]}>
                    {cierre?.estado_paciente ?? '—'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  resumenRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  resumenCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  resumenVal: { fontSize: 24, fontWeight: '800', color: COLORS.gold },
  resumenLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 4 },
  alertaCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  alertaIcon: { fontSize: 20 },
  alertaDesc: { fontSize: 12, fontWeight: '600', color: COLORS.textDark },
  alertaFecha: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  severidadPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  severidadText: { fontSize: 9, fontWeight: '700' },
  pacienteCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  pacienteAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.gold },
  pacienteAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  pacienteInfo: { flex: 1 },
  pacienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  pacienteCondiciones: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  pacienteStatus: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 9, fontWeight: '700' },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  emptyText: { fontSize: 13, color: COLORS.textLight },
  signosGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  signoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  signoVal: { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  signoLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 2 },
  condicionPill: { backgroundColor: COLORS.goldPale, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.gold },
  condicionPillText: { fontSize: 11, color: COLORS.gold, fontWeight: '600' },
  escalaCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border },
  escalaIcon: { fontSize: 24 },
  escalaNombre: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  escalaLabel: { fontSize: 11, color: COLORS.textLight },
  escalaFecha: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  escalaTotal: { fontSize: 22, fontWeight: '800', color: COLORS.gold },
});