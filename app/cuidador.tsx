import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getUserNombre } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
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
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

const tareas = [
  { icon: '🍳', nombre: 'Desayuno preparado', hora: '8:30 AM', estado: 'done' },
  { icon: '💊', nombre: 'Metformina + Losartán', hora: '8:00 AM · Dado y confirmado', estado: 'done' },
  { icon: '🚶', nombre: 'Caminata 20 min', hora: '11:00 AM', estado: 'pendiente' },
  { icon: '💊', nombre: 'Metformina tarde', hora: '3:00 PM · Próximo', estado: 'proximo' },
  { icon: '🌙', nombre: 'Rutina nocturna', hora: '9:00 PM', estado: 'proximo' },
];

const equipo = [
  { iniciales: 'RL', nombre: 'Rosa López', rol: 'Cuidadora', horario: '8 AM — 6 PM', activo: true },
  { iniciales: 'CL', nombre: 'Carlos Leal', rol: 'Hijo', horario: '6 PM — 10 PM', activo: false },
  { iniciales: 'AL', nombre: 'Ana Leal', rol: 'Hija', horario: 'Fines de semana', activo: false },
];

export default function CuidadoresScreen() {
  const router = useRouter();
  const nombre = getUserNombre() ?? 'Cuidador';
  const [vista, setVista] = useState('normal');
  const [spo2, setSpo2] = useState(98);
  const [sistolica, setSistolica] = useState(120);
  const [diastolica, setDiastolica] = useState(80);
  const [fc, setFc] = useState(72);

  // ── VISTA CIERRE ──
  if (vista === 'cierre') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVista('normal')} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Cerrar turno</Text>
            <Text style={styles.subtitle}>Rosa López · 8:00 AM — 6:00 PM</Text>
          </View>
        </View>
        <ScrollView style={styles.body}>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>¿Cómo queda María Guadalupe?</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {['😊 Bien', '😐 Regular', '😟 Preocupante'].map((e) => (
              <TouchableOpacity key={e} style={[styles.equipoCard, { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 14 }]}>
                <Text style={{ fontSize: 22, marginBottom: 4 }}>{e.split(' ')[0]}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight }}>{e.split(' ')[1]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Signos vitales</Text>
          <View style={styles.equipoCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tareaNombre}>SpO₂</Text>
              <Text style={styles.tareaHora}>Oximetría · Manual</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.max(80, v - 1))}>
                <Text style={styles.signoBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.signoVal}>{spo2}%</Text>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.min(100, v + 1))}>
                <Text style={styles.signoBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.equipoCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tareaNombre}>Presión arterial</Text>
              <Text style={styles.tareaHora}>mmHg · Manual</Text>
            </View>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 9, color: COLORS.textLight, width: 20 }}>SIS</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setSistolica(v => Math.max(80, v - 1))}>
                  <Text style={styles.signoBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.signoVal}>{sistolica}</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setSistolica(v => Math.min(200, v + 1))}>
                  <Text style={styles.signoBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 9, color: COLORS.textLight, width: 20 }}>DIA</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setDiastolica(v => Math.max(40, v - 1))}>
                  <Text style={styles.signoBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.signoVal}>{diastolica}</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setDiastolica(v => Math.min(130, v + 1))}>
                  <Text style={styles.signoBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.equipoCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tareaNombre}>Frecuencia cardíaca</Text>
              <Text style={styles.tareaHora}>bpm · Wearable / Manual</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setFc(v => Math.max(40, v - 1))}>
                <Text style={styles.signoBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.signoVal}>{fc}</Text>
              <TouchableOpacity style={styles.signoBtn} onPress={() => setFc(v => Math.min(180, v + 1))}>
                <Text style={styles.signoBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.cerrarTurnoBtn} onPress={() => setVista('inicio')}>
            <Text style={styles.cerrarTurnoBtnText}>Confirmar y cerrar turno</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── VISTA INICIO ──
  if (vista === 'inicio') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.gold, marginBottom: 4 }}>Tu turno empieza ahora</Text>
            <Text style={styles.title}>Hola, Carlos 👋</Text>
            <Text style={styles.subtitle}>Turno noche · 6:00 PM — 10:00 PM</Text>
          </View>
        </View>
        <ScrollView style={styles.body}>

          <Text style={styles.sectionTitle}>Estado del paciente</Text>
          <View style={[styles.equipoCard, { marginBottom: 20 }]}>
            <Text style={{ fontSize: 28 }}>😊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tareaNombre}>Bien — Rosa López</Text>
              <Text style={styles.tareaHora}>Turno 8:00 AM — 6:00 PM · Cerrado</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Signos vitales registrados</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <View style={[styles.progresoCard, { flex: 1, alignItems: 'center', marginBottom: 0 }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.gold }}>{spo2}%</Text>
              <Text style={styles.tareaHora}>SpO₂</Text>
            </View>
            <View style={[styles.progresoCard, { flex: 1, alignItems: 'center', marginBottom: 0 }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.gold }}>{sistolica}/{diastolica}</Text>
              <Text style={styles.tareaHora}>Presión</Text>
            </View>
            <View style={[styles.progresoCard, { flex: 1, alignItems: 'center', marginBottom: 0 }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.gold }}>{fc}</Text>
              <Text style={styles.tareaHora}>FC bpm</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Medicamentos del día</Text>
          {tareas.filter(t => t.icon === '💊').map((med, i) => (
            <View key={i} style={[
              { backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
              med.estado === 'done' && { backgroundColor: COLORS.greenPale, borderColor: 'rgba(61,170,106,0.2)' },
              med.estado === 'pendiente' && { backgroundColor: COLORS.amberPale, borderColor: 'rgba(212,134,10,0.2)' },
            ]}>
              <Text style={{ fontSize: 20 }}>{med.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textDark }}>{med.nombre}</Text>
                <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2 }}>{med.hora}</Text>
              </View>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: med.estado === 'done' ? COLORS.green : med.estado === 'pendiente' ? COLORS.amber : COLORS.border
              }}>
                <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '800' }}>
                  {med.estado === 'done' ? '✓' : med.estado === 'pendiente' ? '!' : '○'}
                </Text>
              </View>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Nota de Rosa</Text>
          <View style={styles.notaCard}>
            <View style={styles.notaHeader}>
              <Text style={styles.notaIcon}>📝</Text>
              <Text style={styles.notaAutor}>Rosa López · Hoy 6:00 PM</Text>
            </View>
            <Text style={styles.notaTexto}>Se quejó de la rodilla derecha. Le puse hielo 15 min. Recomendar revisar con el doctor.</Text>
          </View>

          <TouchableOpacity style={[styles.cerrarTurnoBtn, { backgroundColor: COLORS.gold, marginTop: 16 }]} onPress={() => setVista('normal')}>
            <Text style={styles.cerrarTurnoBtnText}>Iniciar mi turno</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── VISTA NORMAL ──
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cuidadores</Text>
          <Text style={styles.subtitle}>María Guadalupe · Hoy</Text>
        </View>
      </View>

      <View style={styles.turnoActivo}>
        <View style={styles.turnoActivoLeft}>
          <View style={styles.turnoAvatar}>
            <Text style={styles.turnoAvatarText}>RL</Text>
          </View>
          <View>
            <Text style={styles.turnoNombre}>Rosa López</Text>
            <Text style={styles.turnoHorario}>Turno activo · 8:00 AM — 6:00 PM</Text>
          </View>
        </View>
        <View style={styles.activoPill}>
          <View style={styles.activoDot} />
          <Text style={styles.activoText}>Activa</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.progresoCard}>
          <View style={styles.progresoHeader}>
            <Text style={styles.progresoLabel}>Progreso del turno</Text>
            <Text style={styles.progresoVal}>2 de 5 tareas</Text>
          </View>
          <View style={styles.progresoBar}>
            <View style={[styles.progresoFill, { width: '40%' }]} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tareas del turno</Text>
        {tareas.map((tarea, i) => (
          <View key={i} style={[
            styles.tareaCard,
            tarea.estado === 'done' && styles.tareaCardDone,
            tarea.estado === 'pendiente' && styles.tareaCardPendiente,
          ]}>
            <Text style={styles.tareaIcon}>{tarea.icon}</Text>
            <View style={styles.tareaInfo}>
              <Text style={styles.tareaNombre}>{tarea.nombre}</Text>
              <Text style={styles.tareaHora}>{tarea.hora}</Text>
            </View>
            <View style={[
              styles.tareaCheck,
              tarea.estado === 'done' && { backgroundColor: COLORS.green },
              tarea.estado === 'pendiente' && { backgroundColor: COLORS.amber },
              tarea.estado === 'proximo' && { backgroundColor: COLORS.border },
            ]}>
              <Text style={styles.tareaCheckIcon}>
                {tarea.estado === 'done' ? '✓' : tarea.estado === 'pendiente' ? '!' : '○'}
              </Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.reportarBtn}>
          <Text style={styles.reportarIcon}>🚨</Text>
          <Text style={styles.reportarText}>Reportar incidente</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Equipo de cuidado</Text>
        {equipo.map((persona, i) => (
          <View key={i} style={styles.equipoCard}>
            <View style={[styles.equipoAvatar, persona.activo && styles.equipoAvatarActivo]}>
              <Text style={styles.equipoAvatarText}>{persona.iniciales}</Text>
            </View>
            <View style={styles.equipoInfo}>
              <Text style={styles.equipoNombre}>{persona.nombre}</Text>
              <Text style={styles.equipoRol}>{persona.rol} · {persona.horario}</Text>
            </View>
            {persona.activo ? (
              <View style={styles.equipoActivoPill}>
                <View style={styles.activoDot} />
                <Text style={styles.activoText}>Ahora</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.equipoContactoBtn}>
                <Text style={styles.equipoContactoText}>💬</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Última nota</Text>
        <View style={styles.notaCard}>
          <View style={styles.notaHeader}>
            <Text style={styles.notaIcon}>📝</Text>
            <Text style={styles.notaAutor}>Rosa López · Ayer 6:00 PM</Text>
          </View>
          <Text style={styles.notaTexto}>
            Se quejó de la rodilla derecha en la tarde. Le puse hielo 15 min. Recomendar revisar con el doctor.
          </Text>
        </View>

        <TouchableOpacity style={styles.cerrarTurnoBtn} onPress={() => setVista('cierre')}>
          <Text style={styles.cerrarTurnoBtnText}>Cerrar turno · Rosa López</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  turnoActivo: {
    backgroundColor: COLORS.cacao, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  turnoActivoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  turnoAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold,
  },
  turnoAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.gold },
  turnoNombre: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  turnoHorario: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  activoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(61,170,106,0.2)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)',
  },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  activoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  body: { flex: 1, padding: 16 },
  progresoCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  progresoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progresoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  progresoVal: { fontSize: 11, fontWeight: '700', color: COLORS.gold },
  progresoBar: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progresoFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 3 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10,
  },
  tareaCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  tareaCardDone: { backgroundColor: COLORS.greenPale, borderColor: 'rgba(61,170,106,0.2)' },
  tareaCardPendiente: { backgroundColor: COLORS.amberPale, borderColor: 'rgba(212,134,10,0.2)' },
  tareaIcon: { fontSize: 20 },
  tareaInfo: { flex: 1 },
  tareaNombre: { fontSize: 12, fontWeight: '700', color: COLORS.textDark },
  tareaHora: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  tareaCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tareaCheckIcon: { fontSize: 12, color: COLORS.white, fontWeight: '800' },
  signoBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  signoBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  signoVal: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, minWidth: 60, textAlign: 'center' },
  reportarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.redPale, borderRadius: 12, padding: 13,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)',
  },
  reportarIcon: { fontSize: 16 },
  reportarText: { fontSize: 12, fontWeight: '700', color: COLORS.red, letterSpacing: 1, textTransform: 'uppercase' },
  equipoCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  equipoAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
  },
  equipoAvatarActivo: { borderWidth: 2, borderColor: COLORS.gold },
  equipoAvatarText: { fontSize: 13, fontWeight: '800', color: COLORS.gold },
  equipoInfo: { flex: 1 },
  equipoNombre: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  equipoRol: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  equipoActivoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.greenPale, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  equipoContactoBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center',
  },
  equipoContactoText: { fontSize: 16 },
  cerrarTurnoBtn: {
    backgroundColor: COLORS.cacao, borderRadius: 12, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  cerrarTurnoBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white, letterSpacing: 1, textTransform: 'uppercase' },
  notaCard: {
    backgroundColor: COLORS.amberPale, borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: COLORS.amber, marginBottom: 8,
  },
  notaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  notaIcon: { fontSize: 14 },
  notaAutor: { fontSize: 10, fontWeight: '700', color: COLORS.amber },
  notaTexto: { fontSize: 12, color: COLORS.textDark, lineHeight: 18 },
});
