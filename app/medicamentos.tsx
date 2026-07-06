import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { crearMedicamento, crearTareaRecurrente, desactivarMedicamento, desactivarTareaRecurrente, getMedicamentos, getPacientes, getTareasRecurrentes, loadStoredToken } from '../services/api';

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
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

const VIAS = ['oral', 'sublingual', 'inhalada', 'topica', 'inyectable', 'otro'];
const FRECUENCIAS = ['cada 8 horas', 'cada 12 horas', 'cada 24 horas', 'dos veces al día', 'tres veces al día', 'una vez al día', 'según necesidad'];
const TIPOS_RUTINA = ['alimentacion', 'higiene', 'ejercicio', 'cita', 'otro'];
const ICONOS_RUTINA: Record<string, string> = {
  alimentacion: '🍽️', higiene: '🛁', ejercicio: '🚶', cita: '📅', otro: '📝',
};

export default function MedicamentosScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [tareasRec, setTareasRec] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'medicamentos' | 'rutinas'>('medicamentos');

  // Modal medicamento
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [dosis, setDosis] = useState('');
  const [frecuencia, setFrecuencia] = useState('cada 12 horas');
  const [via, setVia] = useState('oral');
  const [indicaciones, setIndicaciones] = useState('');

  // Time picker medicamento
  const [horariosArray, setHorariosArray] = useState<string[]>(['08:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [horarioIndex, setHorarioIndex] = useState(0);

  // Modal rutina
  const [modalRutinaOpen, setModalRutinaOpen] = useState(false);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const [rutinaDesc, setRutinaDesc] = useState('');
  const [rutinaTipo, setRutinaTipo] = useState('higiene');
  const [rutinaHora, setRutinaHora] = useState('09:00');
  const [showRutinaTimePicker, setShowRutinaTimePicker] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const token = await loadStoredToken();
        if (!token) {
          router.replace('/login');
          return;
        }
        const data = await getPacientes();
        if (data.patients && data.patients.length > 0) {
          const p = pacienteIdParam
            ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
            : data.patients[0];
          setPaciente(p);
          const meds = await getMedicamentos(p.id);
          if (meds.medicamentos) setMedicamentos(meds.medicamentos);
          const rutinas = await getTareasRecurrentes(p.id);
          if (rutinas.tareas) setTareasRec(rutinas.tareas);
        }
      } catch (e) {
        console.error('ERROR CARGANDO DATOS:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteIdParam]);

  const guardarMedicamento = async () => {
    if (!nombre.trim() || !dosis.trim() || !paciente?.id) return;
    setGuardando(true);
    try {
      await crearMedicamento(paciente.id, {
        nombre: nombre.trim(),
        dosis: dosis.trim(),
        frecuencia,
        via_administracion: via,
        horarios: horariosArray,
        indicaciones: indicaciones.trim() || null,
      });
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      setModalOpen(false);
      setNombre(''); setDosis(''); setFrecuencia('cada 12 horas');
      setVia('oral'); setIndicaciones('');
      setHorariosArray(['08:00']);
    } catch (e) {
      console.error('ERROR GUARDANDO MEDICAMENTO:', e);
      Alert.alert('⚠️ Error', 'No se pudo guardar el medicamento.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarRutina = async () => {
    if (!rutinaDesc.trim() || !paciente?.id) return;
    setGuardandoRutina(true);
    try {
      // 🎯 SANEAMIENTO: Alineado al formato de tu API (Pasando un objeto con paciente_id)
      await crearTareaRecurrente({
        paciente_id: paciente.id,
        tipo: rutinaTipo,
        descripcion: rutinaDesc.trim(),
        hora: rutinaHora,
      });
      const rutinas = await getTareasRecurrentes(paciente.id);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);
      setModalRutinaOpen(false);
      setRutinaDesc(''); setRutinaTipo('higiene'); setRutinaHora('09:00');
    } catch (e) {
      console.error('ERROR GUARDANDO RUTINA:', e);
      Alert.alert('⚠️ Error', 'No se pudo guardar la rutina de cuidados.');
    } finally {
      setGuardandoRutina(false);
    }
  };

  const eliminarMedicamento = async (id: string) => {
    if (!paciente?.id) return;
    try {
      await desactivarMedicamento(id);
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
    } catch (e) {
      console.error(e);
    }
  };

  const eliminarRutina = async (id: string) => {
    if (!paciente?.id) return;
    try {
      await desactivarTareaRecurrente(id);
      const rutinas = await getTareasRecurrentes(paciente.id);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);
    } catch (e) {
      console.error(e);
    }
  };

  // ── MANEJADORES DE TIEMPO SANITIZADOS PARA EVITAR CRASHES NATIVOS ──
  const onMedicamentoTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false); // Cierre inmediato en Android
    if (selectedDate) {
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      setHorariosArray(prev => {
        const nuevo = [...prev];
        nuevo[horarioIndex] = `${hh}:${mm}`;
        return nuevo;
      });
    }
  };

  const onRutinaTimeChange = (event: any, selectedDate?: Date) => {
    setShowRutinaTimePicker(false); // Cierre inmediato en Android
    if (selectedDate) {
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      setRutinaHora(`${hh}:${mm}`);
    }
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
          <Text style={styles.headerSub}>Cuidado del Paciente</Text>
          <Text style={styles.headerTitle}>{paciente?.nombre_completo ?? 'Paciente'}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => tab === 'medicamentos' ? setModalOpen(true) : setModalRutinaOpen(true)}
        >
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'medicamentos' && styles.tabActive]} onPress={() => setTab('medicamentos')}>
          <Text style={[styles.tabText, tab === 'medicamentos' && styles.tabTextActive]}>💊 Medicamentos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'rutinas' && styles.tabActive]} onPress={() => setTab('rutinas')}>
          <Text style={[styles.tabText, tab === 'rutinas' && styles.tabTextActive]}>📋 Rutinas</Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {tab === 'medicamentos' ? (
          medicamentos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyText}>Sin medicamentos registrados</Text>
            </View>
          ) : (
            medicamentos.map((med, i) => (
              <View key={med.id || i} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.medIcon}>💊</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{med.nombre} {med.dosis}</Text>
                  <Text style={styles.cardSub}>{med.frecuencia} · {med.via_administracion}</Text>
                  {med.horarios && med.horarios.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {med.horarios.map((h: string, hi: number) => (
                        <View key={hi} style={styles.horarioBadge}>
                          <Text style={styles.horarioBadgeText}>{'⏰ ' + h}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => eliminarMedicamento(med.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : (
          tareasRec.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin rutinas registradas</Text>
            </View>
          ) : (
            tareasRec.map((t, i) => (
              <View key={t.id || i} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.medIcon}>{ICONOS_RUTINA[t.tipo] ?? '📝'}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.descripcion}</Text>
                  <Text style={styles.cardSub}>{t.tipo}</Text>
                  <View style={[styles.horarioBadge, { alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={styles.horarioBadgeText}>{'⏰ ' + t.hora}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => eliminarRutina(t.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL MEDICAMENTO */}
      {modalOpen && (
        <View style={styles.modalOverlay}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nuevo medicamento</Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput style={styles.input} placeholder="Ej: Metformina" placeholderTextColor={COLORS.textLight} value={nombre} onChangeText={setNombre} autoFocus />

              <Text style={styles.label}>Dosis *</Text>
              <TextInput style={styles.input} placeholder="Ej: 500mg" placeholderTextColor={COLORS.textLight} value={dosis} onChangeText={setDosis} />

              <Text style={styles.label}>Frecuencia</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {FRECUENCIAS.map(f => (
                    <TouchableOpacity key={f} style={[styles.chipBtn, frecuencia === f && styles.chipBtnActive]} onPress={() => setFrecuencia(f)}>
                      <Text style={[styles.chipBtnText, frecuencia === f && styles.chipBtnTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Horarios de administración</Text>
              {horariosArray.map((h, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, backgroundColor: COLORS.white, alignItems: 'center' }}
                    onPress={() => { setHorarioIndex(idx); setShowTimePicker(true); }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.cacao }}>{`🕐 ${h}`}</Text>
                  </TouchableOpacity>
                  {horariosArray.length > 1 && (
                    <TouchableOpacity onPress={() => setHorariosArray(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 8 }}>
                      <Text style={{ color: COLORS.red, fontSize: 18 }}>{'✕'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setHorariosArray(prev => [...prev, '12:00'])}
                style={{ borderWidth: 1, borderColor: COLORS.gold, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: COLORS.goldPale, marginBottom: 12 }}
              >
                <Text style={{ color: COLORS.gold, fontWeight: '700' }}>{'+ Agregar horario'}</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const partes = (horariosArray[horarioIndex] || '08:00').split(':').map(Number);
                    const d = new Date();
                    d.setHours(partes[0] || 8, partes[1] || 0, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={onMedicamentoTimeChange}
                />
              )}

              <Text style={styles.label}>Vía de administración</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {VIAS.map(v => (
                  <TouchableOpacity key={v} style={[styles.chipBtn, via === v && styles.chipBtnActive]} onPress={() => setVia(v)}>
                    <Text style={[styles.chipBtnText, via === v && styles.chipBtnTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Indicaciones (opcional)</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Tomar con alimentos..." placeholderTextColor={COLORS.textLight} multiline value={indicaciones} onChangeText={setIndicaciones} />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setModalOpen(false); setHorariosArray(['08:00']); }}>
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]} onPress={guardarMedicamento} disabled={guardando}>
                  <Text style={styles.modalBtnText}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODAL RUTINA */}
      {modalRutinaOpen && (
        <View style={styles.modalOverlay}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nueva rutina</Text>

              <Text style={styles.label}>Descripción *</Text>
              <TextInput style={styles.input} placeholder="Ej: Baño matutino" placeholderTextColor={COLORS.textLight} value={rutinaDesc} onChangeText={setRutinaDesc} autoFocus />

              <Text style={styles.label}>Tipo</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {TIPOS_RUTINA.map(t => (
                  <TouchableOpacity key={t} style={[styles.chipBtn, rutinaTipo === t && styles.chipBtnActive]} onPress={() => setRutinaTipo(t)}>
                    <Text style={[styles.chipBtnText, rutinaTipo === t && styles.chipBtnTextActive]}>{ICONOS_RUTINA[t]} {t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Horario</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, backgroundColor: COLORS.white, alignItems: 'center', marginBottom: 12 }}
                onPress={() => setShowRutinaTimePicker(true)}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.cacao }}>{`🕐 ${rutinaHora}`}</Text>
              </TouchableOpacity>

              {showRutinaTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const partes = (rutinaHora || '09:00').split(':').map(Number);
                    const d = new Date();
                    d.setHours(partes[0] || 9, partes[1] || 0, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={onRutinaTimeChange}
                />
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setModalRutinaOpen(false); setRutinaDesc(''); setRutinaTipo('higiene'); setRutinaHora('09:00'); }}>
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]} onPress={guardarRutina} disabled={guardandoRutina}>
                  <Text style={styles.modalBtnText}>{guardandoRutina ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#FFFFFF', fontSize: 18 },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  addBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: COLORS.textLight },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  cardLeft: { marginRight: 12 },
  medIcon: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  cardSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  horarioBadge: { backgroundColor: COLORS.goldPale, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  horarioBadgeText: { fontSize: 11, color: COLORS.gold, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: COLORS.red, fontSize: 16 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20, zIndex: 10 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, marginTop: 40 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10, fontSize: 15, color: COLORS.textDark, marginBottom: 16 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipBtnText: { fontSize: 12, color: COLORS.textLight },
  chipBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});