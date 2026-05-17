import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { crearPaciente } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
  red: '#D94F4F',
};

const CONDICIONES = [
  'Diabetes T2', 'Hipertensión', 'EPOC', 'Alzheimer', 'Demencia',
  'Insuficiencia cardíaca', 'Osteoporosis', 'Artritis', 'Parkinson',
  'Depresión', 'Ansiedad', 'Insuficiencia renal', 'Hipotiroidismo',
];

export default function NuevoPacienteScreen() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | 'otro'>('F');
  const [condiciones, setCondiciones] = useState<string[]>([]);
  const [medico, setMedico] = useState('');
  const [poliza, setPoliza] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [talla, setTalla] = useState('');

  const toggleCondicion = (c: string) => {
    setCondiciones(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!fechaNac.trim()) { setError('La fecha de nacimiento es obligatoria'); return; }
    setGuardando(true);
    setError('');
    try {
      const data = await crearPaciente({
        nombre_completo: nombre.trim(),
        fecha_nacimiento: fechaNac.trim(),
        sexo,
        condiciones_medicas: condiciones,
        medico_tratante: medico.trim() || null,
        numero_poliza: poliza.trim() || null,
        aseguradora: aseguradora.trim() || null,
        talla_cm: talla ? parseFloat(talla) : null,
      });
      if (data.status === 'ok') {
        router.replace('/');
      } else {
        setError('Error al crear el paciente');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Nuevo paciente</Text>
          <Text style={styles.userName}>Completa el perfil</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          placeholder="María Guadalupe Torres"
          placeholderTextColor={COLORS.textLight}
          value={nombre}
          onChangeText={setNombre}
        />

        <Text style={styles.label}>Fecha de nacimiento * (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="1945-03-12"
          placeholderTextColor={COLORS.textLight}
          value={fechaNac}
          onChangeText={setFechaNac}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Sexo</Text>
        <View style={styles.sexoRow}>
          {(['F', 'M', 'otro'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sexoBtn, sexo === s && styles.sexoBtnActive]}
              onPress={() => setSexo(s)}
            >
              <Text style={[styles.sexoBtnText, sexo === s && styles.sexoBtnTextActive]}>
                {s === 'F' ? '👩 Femenino' : s === 'M' ? '👨 Masculino' : '⚧ Otro'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Talla (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="165"
          placeholderTextColor={COLORS.textLight}
          value={talla}
          onChangeText={setTalla}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Condiciones médicas</Text>
        <View style={styles.condicionesGrid}>
          {CONDICIONES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.condicionBtn, condiciones.includes(c) && styles.condicionBtnActive]}
              onPress={() => toggleCondicion(c)}
            >
              <Text style={[styles.condicionBtnText, condiciones.includes(c) && styles.condicionBtnTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Médico tratante</Text>
        <TextInput
          style={styles.input}
          placeholder="Dr. Hernández — Neumología"
          placeholderTextColor={COLORS.textLight}
          value={medico}
          onChangeText={setMedico}
        />

        <Text style={styles.label}>Aseguradora</Text>
        <TextInput
          style={styles.input}
          placeholder="Banorte Seguros"
          placeholderTextColor={COLORS.textLight}
          value={aseguradora}
          onChangeText={setAseguradora}
        />

        <Text style={styles.label}>Número de póliza</Text>
        <TextInput
          style={styles.input}
          placeholder="POL-123456"
          placeholderTextColor={COLORS.textLight}
          value={poliza}
          onChangeText={setPoliza}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, guardando && { opacity: 0.7 }]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Crear paciente</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
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
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textDark, marginBottom: 12 },
  sexoRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sexoBtn: { flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  sexoBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  sexoBtnText: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  sexoBtnTextActive: { color: COLORS.gold },
  condicionesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  condicionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  condicionBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  condicionBtnText: { fontSize: 12, color: COLORS.textLight },
  condicionBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});