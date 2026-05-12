import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

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
  green: '#3DAA6A',
};

const ROLES = [
  { valor: 'familiar', etiqueta: '👨‍👩‍👧 Familiar', desc: 'Visualizo el estado de mi familiar' },
  { valor: 'cuidador', etiqueta: '🤲 Cuidador', desc: 'Cuido directamente al paciente' },
  { valor: 'medico', etiqueta: '🩺 Médico', desc: 'Superviso médicamente al paciente' },
];

export default function CompletarPerfilScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [rol, setRol] = useState('familiar');
  const [tokenInvitacion, setTokenInvitacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (rol === 'medico' && !cedula.trim()) {
      setError('La cédula profesional es obligatoria para médicos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      // Guardar perfil
      const res = await fetch(`${BASE_URL}/auth/completar-perfil`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre, telefono, cedula, tipo: rol }),
      });
      const data = await res.json();

      // Si viene con token de invitación, aceptarla
      if (tokenInvitacion.trim()) {
        await fetch(`${BASE_URL}/invitaciones/${tokenInvitacion.trim()}/aceptar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      // Redirigir según rol
      switch (rol) {
        case 'medico': router.replace('/medico'); break;
        case 'cuidador': router.replace('/cuidador'); break;
        default: router.replace('/');
      }
    } catch (e) {
      setError('Error guardando perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Completa tu perfil</Text>
          <Text style={styles.headerSub}>Solo toma un momento</Text>
        </View>

        <View style={styles.form}>
          {/* Nombre */}
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Dr. Juan García"
            placeholderTextColor={COLORS.textLight}
            value={nombre}
            onChangeText={setNombre}
          />

          {/* Teléfono */}
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            placeholder="81 1234 5678"
            placeholderTextColor={COLORS.textLight}
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
          />

          {/* Rol */}
          <Text style={styles.label}>Soy...</Text>
          <View style={styles.rolesContainer}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.valor}
                style={[styles.rolCard, rol === r.valor && styles.rolCardActive]}
                onPress={() => setRol(r.valor)}
              >
                <Text style={styles.rolIcon}>{r.etiqueta.split(' ')[0]}</Text>
                <Text style={[styles.rolLabel, rol === r.valor && styles.rolLabelActive]}>
                  {r.etiqueta.split(' ').slice(1).join(' ')}
                </Text>
                <Text style={styles.rolDesc}>{r.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cédula — solo médicos */}
          {rol === 'medico' && (
            <>
              <Text style={styles.label}>Cédula profesional *</Text>
              <TextInput
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={cedula}
                onChangeText={setCedula}
              />
            </>
          )}

          {/* Token de invitación opcional */}
          <Text style={styles.label}>Código de invitación (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Si tienes un código de invitación"
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="none"
            value={tokenInvitacion}
            onChangeText={setTokenInvitacion}
          />

          {/* Consentimiento */}
          <View style={styles.consentBox}>
            <Text style={styles.consentText}>
              Al continuar aceptas los <Text style={styles.consentLink}>Términos de Uso</Text> y el <Text style={styles.consentLink}>Aviso de Privacidad</Text> de Vitanova Integralis, incluyendo el tratamiento de datos de salud conforme a la LFPDPPP.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleGuardar}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.btnText}>Comenzar</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flexGrow: 1 },
  headerBar: {
    backgroundColor: COLORS.cacao,
    paddingTop: 60, paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 24, fontWeight: '800', color: COLORS.white,
  },
  headerSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4,
  },
  form: { padding: 24 },
  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.textLight,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: COLORS.textDark, marginBottom: 8,
  },
  rolesContainer: { gap: 8, marginBottom: 8 },
  rolCard: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rolCardActive: {
    borderColor: COLORS.gold, backgroundColor: COLORS.goldPale,
  },
  rolIcon: { fontSize: 24 },
  rolLabel: {
    fontSize: 14, fontWeight: '700', color: COLORS.textDark,
  },
  rolLabelActive: { color: COLORS.gold },
  rolDesc: {
    fontSize: 11, color: COLORS.textLight, flex: 1,
  },
  consentBox: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginTop: 8, marginBottom: 16,
  },
  consentText: {
    fontSize: 11, color: COLORS.textLight, lineHeight: 18,
  },
  consentLink: { color: COLORS.gold, fontWeight: '700' },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});