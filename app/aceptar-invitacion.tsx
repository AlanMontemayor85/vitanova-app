import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { aceptarInvitacion, buscarInvitacion } from '../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', red: '#D94F4F',
};

export default function AceptarInvitacionScreen() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [invitacion, setInvitacion] = useState<any>(null);

  const handleBuscar = async () => {
    if (!codigo.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await buscarInvitacion(codigo.trim());
      if (data.error) {
        setError('Código no encontrado o expirado');
      } else {
        setInvitacion(data);
      }
    } catch (e) {
      setError('Error al buscar la invitación');
    } finally {
      setLoading(false);
    }
  };

  const handleAceptar = async () => {
  if (!invitacion) return;
  setLoading(true);
  try {
    const data = await aceptarInvitacion(invitacion.token);
    if (data.status === 'ok') {
      setExito(true);
      setTimeout(() => {
        // Redirigir según el rol de la invitación
        if (invitacion.rol === 'cuidador_contratado' || invitacion.rol === 'cuidador') {
          router.replace('/cuidador');
        } else if (invitacion.rol === 'medico') {
          router.replace('/medico');
        } else {
          router.replace('/');
        }
      }, 2000);
    } else {
      setError(data.error ?? 'Error al aceptar');
    }
  } catch (e) {
    setError('Error al aceptar la invitación');
  } finally {
    setLoading(false);
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
          <Text style={styles.greeting}>Unirse al equipo</Text>
          <Text style={styles.userName}>Aceptar invitación</Text>
        </View>
      </View>

      <View style={styles.body}>
        {!invitacion && !exito && (
          <>
            <Text style={styles.label}>Código de invitación</Text>
            <Text style={styles.hint}>Ingresa el código de 8 caracteres que recibiste por email</Text>
            <TextInput
              style={styles.input}
              value={codigo}
              onChangeText={t => setCodigo(t.toUpperCase())}
              placeholder="EE6F388A"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              maxLength={64}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.btn} onPress={handleBuscar} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>Buscar invitación</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {invitacion && !exito && (
          <View style={styles.invCard}>
            <Text style={styles.invTitle}>Invitación encontrada</Text>
            <View style={styles.invRow}>
              <Text style={styles.invLabel}>Paciente</Text>
              <Text style={styles.invVal}>{invitacion.paciente}</Text>
            </View>
            <View style={styles.invRow}>
              <Text style={styles.invLabel}>Rol</Text>
              <Text style={styles.invVal}>{invitacion.rol}</Text>
            </View>
            <View style={styles.invRow}>
              <Text style={styles.invLabel}>Invitado por</Text>
              <Text style={styles.invVal}>{invitacion.invitado_por}</Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.btn} onPress={handleAceptar} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnText}>Aceptar y unirme</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setInvitacion(null)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {exito && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textDark }}>
              ¡Bienvenido al equipo!
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textLight, marginTop: 8 }}>
              Redirigiendo...
            </Text>
          </View>
        )}
      </View>
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
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.textLight, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '800',
    color: COLORS.textDark, letterSpacing: 4, marginBottom: 12, textAlign: 'center',
  },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  btnCancel: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnCancelText: { color: COLORS.textLight, fontSize: 13 },
  invCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  invTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 16 },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  invLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '700' },
  invVal: { fontSize: 12, color: COLORS.textDark, fontWeight: '600' },
});
