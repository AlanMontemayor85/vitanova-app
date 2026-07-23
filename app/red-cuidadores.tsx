import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  ScrollView, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import { actualizarHorarioCuidador, crearInvitacion, getEquipoPaciente, removerDelEquipo } from '../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textMid: '#4A4540', textLight: '#8A8078',
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

  const esCuidador = params.usuarioRol === 'cuidador_contratado' || params.isCuidador === 'true';

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
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [showInicioTimePicker, setShowInicioTimePicker] = useState(false);
  const [showFinTimePicker, setShowFinTimePicker] = useState(false);
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
  }, [pacienteId]);

  const familiares = equipo.filter(m => m.rol === 'familiar_principal' || m.rol === 'familiar');
  const cuidadores = equipo.filter(m => m.rol === 'cuidador_contratado');
  const medicos = equipo.filter(m => m.rol === 'medico');
  // Mapeo bidireccional / Estándar de Códigos
  const DIAS_MAPA: Record<string, string> = {
    lunes: 'L',
    martes: 'M',
    miercoles: 'X',
    jueves: 'J',
    viernes: 'V',
    sabado: 'S',
    domingo: 'D',
  };
  const guardarHorario = async () => {
  if (!editando || !horaInicio || !horaFin) return;
  setGuardandoHorario(true);
  try {
    // Normalizamos los días seleccionados para asegurar que se guarden como ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    const diasNormalizados = diasSeleccionados.map(
      d => DIAS_MAPA[d.toLowerCase()] || d
    );

    await actualizarHorarioCuidador(pacienteId, editando.usuario_id, {
      horario_inicio: horaInicio + ':00',
      horario_fin: horaFin + ':00',
      dias_semana: diasNormalizados, // <-- MANDA ['M', 'X', 'J', 'V', 'S', 'D'
    });
    DeviceEventEmitter.emit('RECARGAR_TAREAS');
    DeviceEventEmitter.emit('RECARGAR_CUIDADORES');
    setEquipo(prev => prev.map(m =>
      m.usuario_id === editando.usuario_id
        ? { 
            ...m, 
            horario_inicio: horaInicio + ':00', 
            horario_fin: horaFin + ':00', 
            dias_semana: diasNormalizados 
          }
        : m
    ));
    setEditando(null);
  } catch (e) {
    console.error(e);
    Alert.alert('❌ Error', 'No se pudo actualizar el turno de asistencia.');
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
      
      // Capturamos el token dinámico de tu backend para mostrárselo al Admin
      if (res && (res.status === 'ok' || res.token)) {
        setCodigoGenerado(res.token || 'VITA-REGISTRO');
      } else {
        Alert.alert('⚠️ Aviso', 'La invitación se procesó, revisa el estatus en tu panel.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('❌ Error', 'Ocurrió un fallo al levantar el token de invitación en Railway.');
    } finally {
      setEnviandoInv(false);
    }
  };

  const cerrarModalInvitacion = () => {
    setInvitandoOpen(false);
    setInvEmail('');
    setInvMensaje('');
    setCodigoGenerado(null);
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
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                    <View
                      key={d}
                      style={[styles.diaChip, dias.includes(d) && { backgroundColor: colores.bg, borderColor: colores.border }]}
                    >
                      <Text style={[styles.diaChipText, dias.includes(d) && { color: colores.text, fontWeight: '700' }]}>
                        {d}
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

        {/* Habilitamos la edición de horarios para el Cuidador Contratado y el Familiar Principal */}
        {(m.rol === 'cuidador_contratado' || m.rol === 'familiar_principal') && !esCuidador && (
          <TouchableOpacity
            style={styles.editarBtn}
            onPress={() => {
              setEditando(m);
              setHoraInicio(m.horario_inicio?.slice(0, 5) ?? '08:00');
              setHoraFin(m.horario_fin?.slice(0, 5) ?? '18:00');

              // 🛡️ Normalizamos los días a formato corto ['L','M','X'...] sin importar cómo vengan
              const diasRaw = m.dias_semana ?? [];
              const diasNormalizados = diasRaw.map((d: any) => {
                if (typeof d === 'string') {
                  const lower = d.toLowerCase();
                  // Si ya es corto
                  if (['L','M','X','J','V','S','D'].includes(d)) return d;
                  // Si viene como 'lunes', 'martes'...
                  return DIAS_MAPA[lower] || d;
                }
                // Si viene como número JS (0=Dom, 1=Lun...)
                const mapaNum = ['D','L','M','X','J','V','S'];
                return mapaNum[d] || d;
              });

              setDiasSeleccionados(diasNormalizados);
            }}
          >
            <Text style={styles.editarBtnText}>
              ✏️ {m.rol === 'familiar_principal' ? 'Editar mi horario de apoyo' : 'Editar horario de turno'}
            </Text>
          </TouchableOpacity>
        )}

        {m.rol !== 'familiar_principal' && !esCuidador && (
          <TouchableOpacity
            style={styles.removerBtn}
            onPress={() => {
              Alert.alert(
                'Remover del equipo',
                `¿Seguro que quieres remover a ${m.nombre} del equipo de cuidado?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: async () => {
                      await removerDelEquipo(pacienteId, m.usuario_id);
                      setEquipo(prev => prev.filter(x => x.usuario_id !== m.usuario_id));
                      DeviceEventEmitter.emit('RECARGAR_TAREAS');
                      DeviceEventEmitter.emit('RECARGAR_CUIDADORES');
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.removerBtnText}>🗑️ Remover de la Red</Text>
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
          <Text style={styles.userName}>{pacienteNombre || 'Paciente Vitanova'}</Text>
        </View>
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>{equipo.length} miembros</Text>
        </View>
        
        {!esCuidador && (
          <TouchableOpacity style={styles.invitarBtn} onPress={() => setInvitandoOpen(true)}>
            <Text style={styles.invitarBtnText}>+ Invitar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* LISTA DE INTEGRANTES */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {equipo.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 }}>
              Sin equipo registrado
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
              {!esCuidador ? 'Toca "+ Invitar" para agregar miembros al equipo' : 'No hay miembros asignados a este paciente todavía.'}
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
                <Text style={styles.sectionTitle}>Cuidadores Activos</Text>
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

            {/* HORA INICIO */}
            <Text style={styles.modalLabel}>Hora inicio</Text>
            <TouchableOpacity
              style={styles.modalInput}
              onPress={() => setShowInicioTimePicker(true)}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.cacao }}>
                🕐 {horaInicio || '08:00'}
              </Text>
            </TouchableOpacity>

            {showInicioTimePicker && (
              <DateTimePicker
                value={(() => {
                  const [h, m] = (horaInicio || '08:00').split(':').map(Number);
                  const d = new Date();
                  d.setHours(h || 8, m || 0, 0, 0);
                  return d;
                })()}
                mode="time"
                is24Hour={true}
                display="spinner"
                onChange={(event, selectedDate) => {
                  setShowInicioTimePicker(false);
                  if (selectedDate) {
                    const hh = selectedDate.getHours().toString().padStart(2, '0');
                    const mm = selectedDate.getMinutes().toString().padStart(2, '0');
                    setHoraInicio(`${hh}:${mm}`);
                  }
                }}
              />
            )}

            {/* HORA FIN */}
            <Text style={styles.modalLabel}>Hora fin</Text>
            <TouchableOpacity
              style={styles.modalInput}
              onPress={() => setShowFinTimePicker(true)}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.cacao }}>
                🕐 {horaFin || '20:00'}
              </Text>
            </TouchableOpacity>

            {showFinTimePicker && (
              <DateTimePicker
                value={(() => {
                  const [h, m] = (horaFin || '20:00').split(':').map(Number);
                  const d = new Date();
                  d.setHours(h || 20, m || 0, 0, 0);
                  return d;
                })()}
                mode="time"
                is24Hour={true}
                display="spinner"
                onChange={(event, selectedDate) => {
                  setShowFinTimePicker(false);
                  if (selectedDate) {
                    const hh = selectedDate.getHours().toString().padStart(2, '0');
                    const mm = selectedDate.getMinutes().toString().padStart(2, '0');
                    setHoraFin(`${hh}:${mm}`);
                  }
                }}
              />
            )}
            <Text style={styles.modalLabel}>Días de la semana asignados</Text>
            <View style={styles.diasModalRow}>
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => {
                const seleccionado = diasSeleccionados.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.diaModalChip, 
                      seleccionado && styles.diaModalChipActive
                    ]}
                    onPress={() => setDiasSeleccionados(prev =>
                      prev.includes(d) 
                        ? prev.filter(x => x !== d) 
                        : [...prev, d]
                    )}
                  >
                    <Text style={[
                      styles.diaModalChipText, 
                      seleccionado && styles.diaModalChipTextActive
                    ]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
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

      {/* MODAL INVITAR CON ENTREGA DE TOKEN */}
      {invitandoOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invitar integrante a la red</Text>

            {codigoGenerado ? (
              // 👑 UX PREMIUM: Pantalla de token generado para compartir
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ fontSize: 13, color: COLORS.textDark, textAlign: 'center', marginBottom: 14 }}>
                  Invitación registrada. Comparte este código de vinculación con tu asistente:
                </Text>
                <View style={styles.tokenContainer}>
                  <Text style={styles.tokenText}>{codigoGenerado}</Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
                  Tu cuidador deberá ingresar este código al completar su registro para heredar los horarios asignados.
                </Text>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: COLORS.gold, width: '100%', marginTop: 24 }]}
                  onPress={cerrarModalInvitacion}
                >
                  <Text style={styles.modalBtnText}>Listo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Formulario Estándar de Entrada
              <>
                <Text style={styles.modalLabel}>Correo Electrónico</Text>
                <TextInput
                  style={styles.modalInput}
                  value={invEmail}
                  onChangeText={setInvEmail}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.modalLabel}>Asignar Rol</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8, marginTop: 4 }}>
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

                <Text style={styles.modalLabel}>Indicaciones Iniciales (Opcional)</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={invMensaje}
                  onChangeText={setInvMensaje}
                  placeholder="Instrucciones operativas para el equipo..."
                  placeholderTextColor={COLORS.textLight}
                  multiline
                />

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: COLORS.cream, flex: 1 }]}
                    onPress={cerrarModalInvitacion}
                  >
                    <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]}
                    onPress={enviarInvitacion}
                    disabled={enviandoInv}
                  >
                    {enviandoInv ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.modalBtnText}>Generar Acceso</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  totalPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  totalText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  invitarBtn: { backgroundColor: COLORS.gold, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8 },
  invitarBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 12 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  miembroCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  miembroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  miembroLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  miembroNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  miembroEmail: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
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
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 16 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  modalInput: { backgroundColor: COLORS.cream, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textDark, marginBottom: 4 },
  diasModalRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  diaModalChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  diaModalChipActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  diaModalChipText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  diaModalChipTextActive: { color: COLORS.gold, fontWeight: '800' },
  rolBtn: { flex: 1, minWidth: 90, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream, alignItems: 'center' },
  rolBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  rolBtnText: { fontSize: 10, fontWeight: '600', color: COLORS.textLight },
  rolBtnTextActive: { color: COLORS.gold, fontWeight: '800' },
  removerBtn: { marginTop: 10, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: COLORS.red },
  removerBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.red },
  modalBtn: { borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  
  // CAJA PREMIUM DE TOKEN GENERADO
  tokenContainer: {
    backgroundColor: COLORS.goldPale, borderRadius: 12,
    borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.gold,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 8
  },
  tokenText: {
    fontSize: 22, fontWeight: '900', color: COLORS.gold, letterSpacing: 2
  }
});