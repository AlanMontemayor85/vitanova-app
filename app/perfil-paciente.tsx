import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { actualizarPaciente } from '../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078',
  border: '#E0D8CC', red: '#D94F4F', redPale: '#FDEAEA', green: '#3DAA6A',
};

const CONDICIONES = [
  'Diabetes T2', 'Hipertensión', 'EPOC', 'Alzheimer', 'Demencia',
  'Insuficiencia cardíaca', 'Osteoporosis', 'Artritis', 'Parkinson',
  'Depresión', 'Ansiedad', 'Insuficiencia renal', 'Hipotiroidismo',
];

export default function PerfilPacienteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paciente = params.paciente ? JSON.parse(params.paciente as string) : null;

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const [nombre, setNombre] = useState(paciente?.nombre_completo ?? '');
  const [medico, setMedico] = useState(paciente?.medico_tratante ?? '');
  const [talla, setTalla] = useState(paciente?.talla_cm?.toString() ?? '');
  const [condiciones, setCondiciones] = useState<string[]>(paciente?.condiciones_medicas ?? []);
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(paciente?.telefono_emergencia ?? '');
  const [nombreAseguradora, setNombreAseguradora] = useState(paciente?.nombre_aseguradora ?? '');
  const [telefonoAseguradora, setTelefonoAseguradora] = useState(paciente?.telefono_aseguradora ?? '');
  const [telefonoAmbulancia, setTelefonoAmbulancia] = useState(paciente?.telefono_ambulancia ?? '');

  const toggleCondicion = (c: string) => {
    setCondiciones(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true);
    setError('');
    try {
      await actualizarPaciente(paciente.id, {
        nombre_completo: nombre.trim(),
        condiciones_medicas: condiciones,
        medico_tratante: medico.trim() || null,
        talla_cm: talla ? parseFloat(talla) : null,
        telefono_emergencia: telefonoEmergencia.trim() || null,
        nombre_aseguradora: nombreAseguradora.trim() || null,
        telefono_aseguradora: telefonoAseguradora.trim() || null,
        telefono_ambulancia: telefonoAmbulancia.trim() || null,
      });
      setExito(true);
      setTimeout(() => router.back(), 1000);
    } catch (e) {
      setError('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async () => {
    setGuardando(true);
    try {
      await actualizarPaciente(paciente.id, { activo: false });
      router.replace({ pathname: '/' as any, params: { refresh: Date.now().toString() } });
    } catch (e) {
      setError('Error al desactivar');
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
          <Text style={styles.greeting}>Perfil del paciente</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholderTextColor={COLORS.textLight}
        />

        <Text style={styles.label}>Médico tratante</Text>
        <TextInput
          style={styles.input}
          placeholder="Dr. Hernández — Neumología"
          placeholderTextColor={COLORS.textLight}
          value={medico}
          onChangeText={setMedico}
        />

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

        {/* SECCIÓN EMERGENCIAS */}
        <View style={styles.seccionEmergencia}>
          <Text style={styles.seccionTitulo}>🚨 Contactos de emergencia</Text>
        </View>

        <Text style={styles.label}>Teléfono de emergencia</Text>
        <TextInput
          style={styles.input}
          placeholder="81 1234 5678"
          placeholderTextColor={COLORS.textLight}
          value={telefonoEmergencia}
          onChangeText={setTelefonoEmergencia}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Aseguradora</Text>
        <TextInput
          style={styles.input}
          placeholder="Banorte Seguros"
          placeholderTextColor={COLORS.textLight}
          value={nombreAseguradora}
          onChangeText={setNombreAseguradora}
        />

        <Text style={styles.label}>Teléfono aseguradora</Text>
        <TextInput
          style={styles.input}
          placeholder="800 123 4567"
          placeholderTextColor={COLORS.textLight}
          value={telefonoAseguradora}
          onChangeText={setTelefonoAseguradora}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Teléfono ambulancia</Text>
        <TextInput
          style={styles.input}
          placeholder="065 o número privado"
          placeholderTextColor={COLORS.textLight}
          value={telefonoAmbulancia}
          onChangeText={setTelefonoAmbulancia}
          keyboardType="phone-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {exito ? <Text style={styles.exito}>✅ Guardado correctamente</Text> : null}

        <TouchableOpacity
          style={[styles.btn, guardando && { opacity: 0.7 }]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Guardar cambios</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnDesactivar}
          onPress={() => {
            Alert.alert(
              'Desactivar paciente',
              `¿Estás seguro de que quieres desactivar a ${paciente?.nombre_completo}? El historial se conservará.`,
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Desactivar', style: 'destructive', onPress: desactivar },
              ]
            );
          }}
          disabled={guardando}
        >
          <Text style={styles.btnDesactivarText}>Desactivar paciente</Text>
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
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textDark, marginBottom: 12 },
  condicionesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  condicionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  condicionBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  condicionBtnText: { fontSize: 12, color: COLORS.textLight },
  condicionBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
  seccionEmergencia: { backgroundColor: COLORS.redPale, borderRadius: 10, padding: 12, marginBottom: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(217,79,79,0.2)' },
  seccionTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.red },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  exito: { color: COLORS.green, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  btnDesactivar: { backgroundColor: COLORS.redPale, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)' },
  btnDesactivarText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
});
