import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { crearMedicamento, desactivarMedicamento, getMedicamentos, getPacientes, loadStoredToken } from '../services/api';

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

export default function MedicamentosScreen() {
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [dosis, setDosis] = useState('');
  const [frecuencia, setFrecuencia] = useState('cada 12 horas');
  const [via, setVia] = useState('oral');
  const [horarios, setHorarios] = useState('08:00, 20:00');
  const [indicaciones, setIndicaciones] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getPacientes();
        if (data.patients && data.patients.length > 0) {
          const p = data.patients[0];
          setPaciente(p);
          const meds = await getMedicamentos(p.id);
          if (meds.medicamentos) setMedicamentos(meds.medicamentos);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const guardarMedicamento = async () => {
    if (!nombre.trim() || !dosis.trim()) return;
    setGuardando(true);
    try {
      const horariosArr = horarios.split(',').map(h => h.trim()).filter(h => h);
      await crearMedicamento({
        paciente_id: paciente.id,
        nombre: nombre.trim(),
        dosis: dosis.trim(),
        frecuencia,
        via_administracion: via,
        horarios: horariosArr,
        indicaciones: indicaciones.trim() || null,
      });
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      setNombre(''); setDosis(''); setFrecuencia('cada 12 horas');
      setVia('oral'); setHorarios('08:00, 20:00'); setIndicaciones('');
      setModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (id: string) => {
    await desactivarMedicamento(id);
    setMedicamentos(prev => prev.filter(m => m.id !== id));
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Medicamentos</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {medicamentos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={styles.emptyTitle}>Sin medicamentos</Text>
            <Text style={styles.emptyText}>Agrega los medicamentos del paciente</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalOpen(true)}>
              <Text style={styles.emptyBtnText}>+ Agregar medicamento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          medicamentos.map((m) => (
            <View key={m.id} style={styles.medCard}>
              <View style={styles.medHeader}>
                <Text style={styles.medIcon}>💊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medNombre}>{m.nombre}</Text>
                  <Text style={styles.medDosis}>{m.dosis} · {m.via_administracion}</Text>
                </View>
                <TouchableOpacity onPress={() => desactivar(m.id)} style={styles.medDeleteBtn}>
                  <Text style={styles.medDeleteIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.medDetalles}>
                <View style={styles.medPill}>
                  <Text style={styles.medPillText}>🕐 {m.frecuencia}</Text>
                </View>
                {m.horarios?.length > 0 && (
                  <View style={styles.medPill}>
                    <Text style={styles.medPillText}>⏰ {m.horarios.join(' · ')}</Text>
                  </View>
                )}
              </View>
              {m.indicaciones && (
                <Text style={styles.medIndicaciones}>{m.indicaciones}</Text>
              )}
            </View>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {modalOpen && (
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nuevo medicamento</Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Metformina"
                placeholderTextColor={COLORS.textLight}
                value={nombre}
                onChangeText={setNombre}
                autoFocus
              />

              <Text style={styles.label}>Dosis *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 500mg"
                placeholderTextColor={COLORS.textLight}
                value={dosis}
                onChangeText={setDosis}
              />

              <Text style={styles.label}>Frecuencia</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {FRECUENCIAS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.chipBtn, frecuencia === f && styles.chipBtnActive]}
                      onPress={() => setFrecuencia(f)}
                    >
                      <Text style={[styles.chipBtnText, frecuencia === f && styles.chipBtnTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Horarios (separados por coma)</Text>
              <TextInput
                style={styles.input}
                placeholder="08:00, 20:00"
                placeholderTextColor={COLORS.textLight}
                value={horarios}
                onChangeText={setHorarios}
              />

              <Text style={styles.label}>Vía de administración</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {VIAS.map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chipBtn, via === v && styles.chipBtnActive]}
                    onPress={() => setVia(v)}
                  >
                    <Text style={[styles.chipBtnText, via === v && styles.chipBtnTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Indicaciones (opcional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Tomar con alimentos..."
                placeholderTextColor={COLORS.textLight}
                multiline
                value={indicaciones}
                onChangeText={setIndicaciones}
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: COLORS.cream }]}
                  onPress={() => setModalOpen(false)}
                >
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]}
                  onPress={guardarMedicamento}
                  disabled={guardando}
                >
                  <Text style={styles.modalBtnText}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
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
  header: {
    backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.white },
  addBtn: { backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  emptyText: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  medCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  medIcon: { fontSize: 24 },
  medNombre: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  medDosis: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  medDeleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.redPale, alignItems: 'center', justifyContent: 'center' },
  medDeleteIcon: { fontSize: 12, color: COLORS.red, fontWeight: '700' },
  medDetalles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  medPill: { backgroundColor: COLORS.goldPale, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  medPillText: { fontSize: 10, color: COLORS.gold, fontWeight: '600' },
  medIndicaciones: { fontSize: 11, color: COLORS.textLight, marginTop: 8, fontStyle: 'italic' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 16, paddingTop: 60 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: COLORS.cream, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textDark, marginBottom: 12 },
  chipBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  chipBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  chipBtnText: { fontSize: 11, color: COLORS.textLight },
  chipBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
  modalBtn: { borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});