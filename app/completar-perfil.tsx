import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

// 🎨 PALETA CORREGIDA: Agregamos textMid con su sintaxis limpia
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
  red: '#D94F4F',
  green: '#3DAA6A',
};

// 🎛️ ROLES ACTUALIZADOS: Separación explícita según tu visión de negocio
// 🎛️ ROLES ALINEADOS CON EL CONSTRAIN DEL BACKEND (FastAPI / Supabase)
const ROLES = [
  { valor: 'familiar', etiqueta: '👑 Familiar Administrador', desc: 'Registro al paciente, configuro el reloj y controlo la red' },
  { valor: 'cuidador', etiqueta: '🤲 Cuidador', desc: 'Asistencia directa (requiere asignación de turno por el Admin)' },
  { valor: 'medico', etiqueta: '🩺 Médico', desc: 'Superviso médicamente los signos del paciente' },
];

export default function CompletarPerfilScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [rol, setRol] = useState('admin'); // Inicializamos en admin por defecto
  const [tokenInvitacion, setTokenInvitacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 🛡️ CONTROL DEL MODAL DE CONFIRMACIÓN CRÍTICA
  const [modalVisible, setModalVisible] = useState(false);

  const preGuardarValidacion = () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (rol === 'medico' && !cedula.trim()) {
      setError('La cédula profesional es obligatoria para médicos');
      return;
    }
    setError('');
    // Desplegamos el pop-up de confirmación de marketing de experiencia de usuario
    setModalVisible(true);
  };

  const handleGuardarDefinitivo = async () => {
    setModalVisible(false);
    setLoading(true);
    setError('');
    
    try {
      // 🚨 BYPASS DE SEGURIDAD ASÍNCRONO:
      // En lugar de usar getToken() síncrono que puede venir vacío por el reset, 
      // mandamos llamar la lectura directa del almacenamiento (así aseguramos el token de Google fresco)
      // Nota: Si usas una función asíncrona en tu api.ts, impórtala arriba (ej: loadStoredToken o leer de AsyncStorage)
      const token = await getToken(); // Asegúrate de meterle el 'await' si tu API lee de SecureStore/AsyncStorage

      if (!token) {
        throw new Error('No se encontró una sesión activa o el token expiró tras el reinicio');
      }

      console.log("📡 Enviando perfil a Railway con Token verificado...");

      // Guardar perfil en tu backend de Railway
      const res = await fetch(`${BASE_URL}/auth/completar-perfil`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // El Bearer token que FastAPI va a recibir en get_current_user
        },
        body: JSON.stringify({ nombre, telefono, cedula, tipo: rol }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al guardar el perfil en el servidor');
      }

      // Si viene con token de invitación (como el cuidador), aceptarla
      if (tokenInvitacion.trim()) {
        await fetch(`${BASE_URL}/invitaciones/${tokenInvitacion.trim()}/aceptar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      // 🚨 REDIRECCIÓN INTELIGENTE BASADA EN ROLES
      switch (rol) {
        case 'familiar':
          console.log("Acceso concedido como Administrador/Familiar - Redirigiendo a Dashboard.");
          // 🛡️ ¡OJO AQUÍ! Como ya corregimos el index.tsx, ya puedes mandarlo directo a la Home ('/') 
          // o a tu panel '/admin'. No lo mandes a la fuerza a perfil-paciente para que no se vuelva a bclear.
          router.replace('/'); 
          break;
        case 'medico': 
          router.replace('/medico'); 
          break;
        case 'cuidador': 
          router.replace('/cuidador'); 
          break;
        default: 
          router.replace('/'); 
      }
    } catch (e: any) {
      console.error("❌ Error en handleGuardar:", e);
      setError(e.message || 'Error guardando perfil');
    } finally {
      setLoading(false);
    }
  };

  const getRolTextoMensaje = () => {
    const rFound = ROLES.find(r => r.valor === rol);
    return rFound ? rFound.etiqueta : rol;
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
          <Text style={styles.label}>Selecciona tu rol en Vitanova *</Text>
          <View style={styles.rolesContainer}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.valor}
                style={[styles.rolCard, rol === r.valor && styles.rolCardActive]}
                onPress={() => setRol(r.valor)}
              >
                <Text style={styles.rolIcon}>{r.etiqueta.split(' ')[0]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rolLabel, rol === r.valor && styles.rolLabelActive]}>
                    {r.etiqueta.split(' ').slice(1).join(' ')}
                  </Text>
                  <Text style={styles.rolDesc}>{r.desc}</Text>
                </View>
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
            onPress={preGuardarValidacion}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>Comenzar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 👑 MODAL DE CONFIRMACIÓN CRÍTICA (UX CANDADO) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Confirmación de Rol Obligatoria</Text>
            <Text style={styles.modalBody}>
              Has seleccionado registrarte como:{'\n'}
              <Text style={styles.modalRolText}>{getRolTextoMensaje()}</Text>
              {'\n'}{' \n'}
              Para mantener la integridad y seguridad médica del ecosistema Vitanova, este rol define los accesos de privacidad de datos de salud. Una vez guardado, no podrás cambiarlo desde este panel sin contactar soporte.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Revisar de nuevo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleGuardarDefinitivo}
              >
                <Text style={styles.modalBtnConfirmText}>Estoy seguro</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: COLORS.textDark, marginBottom: 8,
  },
  rolesContainer: { gap: 8, marginBottom: 8, marginTop: 4 },
  rolCard: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rolCardActive: {
    borderColor: COLORS.gold, backgroundColor: COLORS.goldPale,
  },
  rolIcon: { fontSize: 22 },
  rolLabel: {
    fontSize: 14, fontWeight: '700', color: COLORS.textDark,
  },
  rolLabelActive: { color: COLORS.gold },
  rolDesc: {
    fontSize: 11, color: COLORS.textLight, marginTop: 2,
  },
  consentBox: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginTop: 12, marginBottom: 16,
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
  
  // ESTILOS DEL CANDADO UX (MODAL CRÍTICO)
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(44, 40, 32, 0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24
  },
  modalContent: {
    backgroundColor: COLORS.cream, borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.cacao, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8
  },
  modalTitle: {
    fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 14
  },
  modalBody: {
    fontSize: 13, color: COLORS.textMid, lineHeight: 20, marginBottom: 20
  },
  modalRolText: {
    color: COLORS.gold, fontWeight: '800', fontSize: 14  
  },
  modalActions: {
    flexDirection: 'row', gap: 10, justifyContent: 'flex-end'
  },
  modalBtnCancel: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white
  },
  modalBtnCancelText: {
    color: COLORS.textLight, fontSize: 13, fontWeight: '600'
  },
  modalBtnConfirm: {
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: COLORS.gold
  },
  modalBtnConfirmText: {
    color: COLORS.white, fontSize: 13, fontWeight: '700'
  }
});