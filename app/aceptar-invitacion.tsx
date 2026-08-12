import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  // ── 1. ESTRUCTURA Y CONTENEDOR PRINCIPAL ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  body: { 
    flex: 1, 
    paddingHorizontal: 20, 
    paddingTop: 24 
  },

  // ── 2. ENCABEZADO ESTANDARIZADO (CACAO + DORADOS) ──
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  greeting: { 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1, 
    textTransform: 'uppercase', 
    color: COLORS.gold, 
    marginBottom: 2 
  },
  userName: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.white 
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  backIcon: { 
    fontSize: 18, 
    color: COLORS.white,
    fontWeight: 'bold' 
  },

  // ── 3. FORMULARIO E INPUT DE CÓDIGO TOKEN ──
  label: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: COLORS.cacao, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase', 
    marginBottom: 6 
  },
  hint: { 
    fontSize: 12, 
    color: COLORS.textLight, 
    marginBottom: 14,
    lineHeight: 16,
    fontWeight: '500' 
  },
  input: {
    backgroundColor: COLORS.white, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 22, 
    fontWeight: '800',
    color: COLORS.gold, 
    letterSpacing: 4, 
    marginBottom: 12, 
    textAlign: 'center',
  },

  // ── 4. TARJETA DE DETALLE DE LA INVITACIÓN ──
  invCard: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 16,
  },
  invTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: COLORS.cacao, 
    marginBottom: 12,
    textTransform: 'uppercase' 
  },
  invRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  invLabel: { 
    fontSize: 12, 
    color: COLORS.textLight, 
    fontWeight: '700',
    textTransform: 'uppercase' 
  },
  invVal: { 
    fontSize: 12, 
    color: COLORS.textDark, 
    fontWeight: '800' 
  },

  // ── 5. ALERTAS Y BOTONES DE ACCIÓN ──
  error: { 
    color: COLORS.red, 
    fontSize: 12, 
    marginBottom: 12, 
    textAlign: 'center',
    fontWeight: '700' 
  },
  btn: { 
    backgroundColor: COLORS.cacao, 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center', 
    marginTop: 8,
    shadowColor: COLORS.cacao,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  btnText: { 
    color: COLORS.white, 
    fontSize: 14, 
    fontWeight: '800',
    letterSpacing: 0.5 
  },
  btnCancel: { 
    paddingVertical: 12, 
    alignItems: 'center', 
    marginTop: 6 
  },
  btnCancelText: { 
    color: COLORS.textLight, 
    fontSize: 13,
    fontWeight: '700' 
  },
});