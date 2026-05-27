import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getEquipoPaciente } from '../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', greenPale: '#EAF5E8',
  amber: '#D4860A', amberPale: '#FFF4E0', red: '#D94F4F', redPale: '#FDEAEA',
};

const ROL_LABEL: Record<string, string> = {
  familiar_principal: 'Familiar Principal',
  familiar: 'Familiar',
  cuidador_contratado: 'Cuidador',
  medico: 'Médico',
};

const ROL_ICON: Record<string, string> = {
  familiar_principal: '👑',
  familiar: '👨‍👩‍👧',
  cuidador_contratado: '🧑‍⚕️',
  medico: '👨‍⚕️',
};

const ROL_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  familiar_principal: { bg: COLORS.goldPale, text: COLORS.gold, border: COLORS.gold },
  familiar: { bg: COLORS.greenPale, text: COLORS.green, border: COLORS.green },
  cuidador_contratado: { bg: '#EEF0FF', text: '#5B6CF9', border: '#B0B8FF' },
  medico: { bg: '#FFF0F0', text: COLORS.red, border: '#FFB0B0' },
};

const DIAS_CORTO: Record<string, string> = {
  lunes: 'L', martes: 'M', miercoles: 'X', jueves: 'J',
  viernes: 'V', sabado: 'S', domingo: 'D',
};

function formatHorario(inicio?: string, fin?: string) {
  if (!inicio || !fin) return null;
  return `${inicio.slice(0, 5)} — ${fin.slice(0, 5)}`;
}

export default function RedCuidadoresScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pacienteId = params.pacienteId as string;
  const pacienteNombre = params.pacienteNombre as string;

  const [equipo, setEquipo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getEquipoPaciente(pacienteId);
        if (data.equipo) setEquipo(data.equipo);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  // Separar por rol
  const familiares = equipo.filter(m => m.rol === 'familiar_principal' || m.rol === 'familiar');
  const cuidadores = equipo.filter(m => m.rol === 'cuidador_contratado');
  const medicos = equipo.filter(m => m.rol === 'medico');

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  const renderMiembro = (m: any) => {
    const iniciales = m.nombre?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
    const colores = ROL_COLOR[m.rol] ?? ROL_COLOR.familiar;
    const horario = formatHorario(m.horario_inicio, m.horario_fin);
    const dias = m.dias_semana ?? [];

    return (
      <View key={m.usuario_id} style={styles.miembroCard}>
        <View style={styles.miembroLeft}>
          <View style={[styles.avatar, { backgroundColor: colores.bg, borderColor: colores.border }]}>
            <Text style={[styles.avatarText, { color: colores.text }]}>{iniciales}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miembroNombre}>{m.nombre}</Text>
            <Text style={styles.miembroEmail}>{m.email}</Text>

            {/* Horario */}
            {horario && (
              <View style={styles.horarioRow}>
                <Text style={styles.horarioIcon}>🕐</Text>
                <Text style={styles.horarioText}>{horario}</Text>
              </View>
            )}

            {/* Días */}
            {dias.length > 0 && (
              <View style={styles.diasRow}>
                {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(d => (
                  <View
                    key={d}
                    style={[styles.diaChip, dias.includes(d) && { backgroundColor: colores.bg, borderColor: colores.border }]}
                  >
                    <Text style={[styles.diaChipText, dias.includes(d) && { color: colores.text, fontWeight: '700' }]}>
                      {DIAS_CORTO[d]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={[styles.rolPill, { backgroundColor: colores.bg, borderColor: colores.border }]}>
          <Text style={[styles.rolPillText, { color: colores.text }]}>
            {ROL_ICON[m.rol]} {ROL_LABEL[m.rol] ?? m.rol}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Red de cuidado</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>{equipo.length} miembros</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {equipo.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 }}>
              Sin equipo registrado
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
              Invita cuidadores y familiares desde la configuración
            </Text>
          </View>
        ) : (
          <>
            {familiares.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Familia</Text>
                {familiares.map(renderMiembro)}
              </>
            )}

            {cuidadores.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Cuidadores</Text>
                {cuidadores.map(renderMiembro)}
              </>
            )}

            {medicos.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Médicos</Text>
                {medicos.map(renderMiembro)}
              </>
            )}
          </>
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
  totalPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  totalText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 4 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  miembroCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
  },
  miembroLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { fontSize: 16, fontWeight: '800' },
  miembroNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  miembroEmail: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  horarioRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  horarioIcon: { fontSize: 11 },
  horarioText: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  diasRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  diaChip: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  diaChipText: { fontSize: 9, color: COLORS.textLight },
  rolPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, alignSelf: 'flex-start' },
  rolPillText: { fontSize: 10, fontWeight: '700' },
});
