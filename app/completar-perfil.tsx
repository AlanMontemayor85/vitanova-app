import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

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

const ROLES = [
  { 
    valor: 'familiar', 
    etiqueta: '👑 Familiar (Administrador / Co-Admin)', 
    desc: 'Registro un paciente nuevo o me uno como Co-Admin ingresando mi código abajo' 
  },
  { valor: 'cuidador', etiqueta: '🤲 Cuidador', desc: 'Asistencia directa (requiere asignación de turno por el Admin)' },
  { valor: 'autonomo', etiqueta: '🧓 Autónomo', desc: 'Quiero gestionar mis medicamentos y rutinas' },
  { valor: 'medico', etiqueta: '🩺 Médico', desc: 'Superviso médicamente los signos del paciente' },
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
    setModalVisible(true);
  };

  const handleGuardarDefinitivo = async () => {
    setModalVisible(false);
    setLoading(true);
    setError('');
    
    try {
      const token = await getToken();

      if (!token) {
        throw new Error('No se encontró una sesión activa o el token expiró');
      }

      console.log("📡 Enviando perfil a Railway con Token verificado...");

      // 1. Guardar Perfil de Usuario en Supabase
      const res = await fetch(`${BASE_URL}/auth/completar-perfil`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre, telefono, cedula, tipo: rol }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al guardar el perfil en el servidor');
      }

      // 2. Si trae TOKEN DE INVITACIÓN -> Procesar aceptación y redirigir
      if (tokenInvitacion.trim()) {
        console.log(`🔗 Aceptando código de invitación [${tokenInvitacion.trim()}]...`);
        try {
          const invRes = await fetch(`${BASE_URL}/invitaciones/${tokenInvitacion.trim()}/aceptar`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!invRes.ok) {
            const invErr = await invRes.json().catch(() => ({}));
            console.warn("⚠️ No se pudo procesar la invitación:", invErr.detail || "Código no válido");
          } else {
            console.log("✅ Invitación aceptada. Redirigiendo a red del paciente...");
          }
        } catch (invException) {
          console.error("⚠️ Error ejecutando invitación:", invException);
        }

        // Redirección directa tras aceptar invitación
        if (rol === 'cuidador') {
          router.replace('/cuidador');
        } else if (rol === 'medico') {
          router.replace('/medico');
        } else {
          // Si es familiar invitado, va al dashboard principal del paciente existente
          router.replace('/');
        }
        return;
      }

      // 3. Setup automático para autocuidador
      if (rol === 'autonomo') {
        await fetch(`${BASE_URL}/autocuidador/setup`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ nombre }),
        });
      }

      // 4. Redirección cuando NO HAY invitación
      switch (rol) {
        case 'familiar':
          console.log("👑 Familiar Administrador (Sin invitación). Iniciando alta de paciente...");
          router.replace('/perfil-paciente'); // Único caso que crea paciente nuevo
          break;
        case 'medico': 
          router.replace('/medico'); 
          break;
        case 'cuidador': 
          router.replace('/cuidador'); 
          break;
        case 'autonomo':
          router.replace('/autocuidador');
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
  }; // 👈 Aquí estaba la llave faltante

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

      {/* MODAL DE CONFIRMACIÓN CRÍTICA */}
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
  scroll: { padding: 20, paddingBottom: 40 },
  headerBar: { marginTop: 20, marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.textDark },
  headerSub: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  form: { marginTop: 10 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textDark, marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textDark,
  },
  rolesContainer: { gap: 10, marginVertical: 8 },
  rolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  rolCardActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldPale,
  },
  rolIcon: { fontSize: 24 },
  rolLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  rolLabelActive: { color: COLORS.gold },
  rolDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  consentBox: { marginVertical: 16, paddingHorizontal: 4 },
  consentText: { fontSize: 11, color: COLORS.textLight, lineHeight: 16 },
  consentLink: { color: COLORS.gold, fontWeight: '600' },
  error: { color: COLORS.red, fontSize: 14, marginVertical: 8, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 12 },
  modalBody: { fontSize: 14, color: COLORS.textMid, lineHeight: 20 },
  modalRolText: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalBtnCancelText: { color: COLORS.textMid, fontWeight: '600', fontSize: 13 },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnConfirmText: { color: COLORS.white, fontWeight: 'bold', fontSize: 13 },
});