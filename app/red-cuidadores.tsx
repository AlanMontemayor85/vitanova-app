import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text,
    TextInput, TouchableOpacity, View
} from 'react-native';
import { actualizarHorarioCuidador, crearInvitacion, getEquipoPaciente } from '../services/api';

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

  // Editar horario
  const [editando, setEditando] = useState<any>(null);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([]);
  const [guardandoHorario, setGuardandoHorario] = useState(false);

  // Invitar
  const [invitandoOpen, setInvitandoOpen] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invRol, setInvRol] = useState<'cuidador_contratado' | 'medico' | 'familiar'>('cuidador_contratado');
  const [invMensaje, setInvMensaje] = useState('');
  const [enviandoInv, setEnviandoInv] = useState(false);
  const [invExito, setInvExito] = useState(false);

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

  const familiares = equipo.filter(m => m.rol === 'familiar_principal' || m.rol === 'familiar');
  const cuidadores = equipo.filter(m => m.rol === 'cuidador_contratado');
  const medicos = equipo.filter(m => m.rol === 'medico');

  const guardarHorario = async () => {
    if (!editando || !horaInicio || !horaFin) return;
    setGuardandoHorario(true);
    try {
      await actualizarHorarioCuidador(pacienteId, editando.usuario_id, {
        horario_inicio: horaInicio + ':00',
        horario_fin: horaFin + ':00',
        dias_semana: diasSeleccionados,
      });
      setEquipo(prev => prev.map(m =>
        m.usuario_id === editando.usuario_id
          ? { ...m, horario_inicio: horaInicio + ':00', horario_fin: horaFin + ':00', dias_semana: diasSeleccionados }
          : m
      ));
      setEditando(null);
    } catch (e) {
      console.error(e);
    } finally {
      setGuardandoHorario(false);
    }
  };

  const enviarInvitacion = async () => {
    if (!invEmail.trim()) return;
    setEnviandoInv(true);
    try {
      const res = await crearInvitacion({
        paciente_id: pacienteId,
        email_invitado: invEmail.trim(),
        rol: invRol,
        mensaje: invMensaje.trim() || null,
      });
      if (res.status === 'ok') {
        setInvExito(true);
        setTimeout(() => {
          setInvitandoOpen(false);
          setInvEmail('');
          setInvMensaje('');
          setInvExito(false);
        }, 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEnviandoInv(false);
    }
  };

  const renderMiembro = (m: any) => {
    const iniciales = m.nombre?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
    const colores = ROL_COLOR[m.rol] ?? ROL_COLOR.familiar;
    const horario = formatHorario(m.horario_inicio, m.horario_fin);
    const dias = m.dias_semana ?? [];

    return (
      <View key={m.usuario_id} style={styles.miembroCard}>
        <View style={styles.miembroTop}>
          <View style={styles.miembroLeft}>
            <View style={[styles.avatar, { backgroundColor: colores.bg, borderColor: colores.border }]}>
              <Text style={[styles.avatarText, { color: colores.text }]}>{iniciales}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miembroNombre}>{m.nombre}</Text>
              <Text style={styles.miembroEmail}>{m.email}</Text>
              {horario && (
                <View style={styles.horarioRow}>
                  <Text style={styles.horarioIcon}>🕐</Text>
                  <Text style={styles.horarioText}>{horario}</Text>
                </View>
              )}
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

        {m.rol === 'cuidador_contratado' && (
          <TouchableOpacity
            style={styles.editarBtn}
            onPress={() => {
              setEditando(m);
              setHoraInicio(m.horario_inicio?.slice(0, 5) ?? '08:00');
              setHoraFin(m.horario_fin?.slice(0, 5) ?? '18:00');
              setDiasSeleccionados(m.dias_semana ?? []);
            }}
          >
            <Text style={styles.editarBtnText}>✏️ Editar horario</Text>
          </TouchableOpacity>
        )}
      </View>
    );
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

      {/* HEADER */}
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
        <TouchableOpacity style={styles.invitarBtn} onPress={() => setInvitandoOpen(true)}>
          <Text style={styles.invitarBtnText}>+ Invitar</Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {equipo.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 }}>
              Sin equipo registrado
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
              Toca "+ Invitar" para agregar miembros al equipo
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

      {/* MODAL EDITAR HORARIO */}
      {editando && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Horario de {editando.nombre}</Text>

            <Text style={styles.modalLabel}>Hora inicio (HH:MM)</Text>
            <TextInput
              style={styles.modalInput}
              value={horaInicio}
              onChangeText={setHoraInicio}
              placeholder="08:00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.modalLabel}>Hora fin (HH:MM)</Text>
            <TextInput
              style={styles.modalInput}
              value={horaFin}
              onChangeText={setHoraFin}
              placeholder="18:00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.modalLabel}>Días de la semana</Text>
            <View style={styles.diasModalRow}>
              {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.diaModalChip, diasSeleccionados.includes(d) && styles.diaModalChipActive]}
                  onPress={() => setDiasSeleccionados(prev =>
                    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                  )}
                >
                  <Text style={[styles.diaModalChipText, diasSeleccionados.includes(d) && styles.diaModalChipTextActive]}>
                    {DIAS_CORTO[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.cream, flex: 1 }]}
                onPress={() => setEditando(null)}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]}
                onPress={guardarHorario}
                disabled={guardandoHorario}
              >
                <Text style={styles.modalBtnText}>
                  {guardandoHorario ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* MODAL INVITAR */}
      {invitandoOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invitar al equipo</Text>

            <Text style={styles.modalLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={invEmail}
              onChangeText={setInvEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.modalLabel}>Rol</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {([
                { val: 'cuidador_contratado', label: '🧑‍⚕️ Cuidador' },
                { val: 'medico', label: '👨‍⚕️ Médico' },
                { val: 'familiar', label: '👨‍👩‍👧 Familiar' },
              ] as const).map(r => (
                <TouchableOpacity
                  key={r.val}
                  style={[styles.rolBtn, invRol === r.val && styles.rolBtnActive]}
                  onPress={() => setInvRol(r.val)}
                >
                  <Text style={[styles.rolBtnText, invRol === r.val && styles.rolBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Mensaje (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
              value={invMensaje}
              onChangeText={setInvMensaje}
              placeholder="Te invito a cuidar a María..."
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            {invExito && (
              <Text style={{ color: COLORS.green, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                ✅ Invitación enviada
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.cream, flex: 1 }]}
                onPress={() => { setInvitandoOpen(false); setInvEmail(''); setInvMensaje(''); }}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]}
                onPress={enviarInvitacion}
                disabled={enviandoInv}
              >
                <Text style={styles.modalBtnText}>
                  {enviandoInv ? 'Enviando...' : 'Enviar invitación'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  invitarBtn: { backgroundColor: COLORS.gold, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8 },
  invitarBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 4 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  miembroCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  miembroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
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
  editarBtn: { marginTop: 10, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.goldPale, borderWidth: 1, borderColor: COLORS.gold },
  editarBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.gold },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 16 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  modalInput: { backgroundColor: COLORS.cream, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textDark, marginBottom: 4 },
  diasModalRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  diaModalChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  diaModalChipActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  diaModalChipText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  diaModalChipTextActive: { color: COLORS.gold, fontWeight: '800' },
  rolBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream, alignItems: 'center' },
  rolBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  rolBtnText: { fontSize: 10, fontWeight: '600', color: COLORS.textLight },
  rolBtnTextActive: { color: COLORS.gold, fontWeight: '800' },
  modalBtn: { borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});
