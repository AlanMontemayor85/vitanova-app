import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    etiqueta: '👑 Familiar Principal', 
    desc: 'Registraré a un paciente nuevo desde cero' 
  },
  { 
    valor: 'familiar_co_admin', 
    etiqueta: '⭐ Familiar Co-Administrador', 
    desc: 'Me uniré a la red de un paciente existente (requiere código abajo)' 
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

      // 🛡️ Validación previa para Familiar Co-Administrador
      if (rol === 'familiar_co_admin' && !tokenInvitacion.trim()) {
        throw new Error('Debes ingresar un código de invitación para unirte como Co-Administrador');
      }

      console.log("📡 Enviando perfil a Railway con Token verificado...");

      // Mapeo de perfil genérico para backend auth ('familiar')
      const tipoPerfilBackend = (rol === 'familiar_co_admin' || rol === 'familiar') ? 'familiar' : rol;

      // 1. Guardar Perfil de Usuario en Supabase / Backend
      const res = await fetch(`${BASE_URL}/auth/completar-perfil`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre, telefono, cedula, tipo: tipoPerfilBackend }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const rawMsg = errorData.detail || errorData.message || errorData.error || 'Error al guardar el perfil en el servidor';
        throw new Error(typeof rawMsg === 'object' ? JSON.stringify(rawMsg) : rawMsg);
      }

      // 2. Si trae TOKEN DE INVITACIÓN (Co-Admin / Cuidador / Médico invitado)
      if (tokenInvitacion.trim()) {
        console.log(`🔗 Aceptando código de invitación [${tokenInvitacion.trim()}]...`);
        
        const invRes = await fetch(`${BASE_URL}/invitaciones/${tokenInvitacion.trim()}/aceptar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!invRes.ok) {
          const invErr = await invRes.json().catch(() => ({}));
          const rawInvMsg = invErr.detail || invErr.message || invErr.error || 'El código de invitación no es válido o ya fue utilizado';
          throw new Error(typeof rawInvMsg === 'object' ? JSON.stringify(rawInvMsg) : rawInvMsg);
        }

        console.log("✅ Invitación aceptada. Redirigiendo a la red asignada...");

        if (rol === 'cuidador') {
          router.replace('/cuidador');
        } else if (rol === 'medico') {
          router.replace('/medico');
        } else {
          // Co-Admin / Familiar invitado entra directo al Dashboard principal '/'
          router.replace('/');
        }
        return;
      }

      // 3. Setup automático para autocuidador
      if (rol === 'autonomo') {
        const autoRes = await fetch(`${BASE_URL}/autocuidador/setup`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ nombre }),
        });

        if (!autoRes.ok) {
          const autoErr = await autoRes.json().catch(() => ({}));
          console.warn("⚠️ No se pudo completar el setup de autocuidador:", autoErr);
        }
      }

      // 4. Redirección cuando NO hay invitación (Creación de paciente o vista principal)
      switch (rol) {
        case 'familiar':
          console.log("👑 Familiar Principal. Iniciando alta de paciente...");
          router.replace('/perfil-paciente'); // Va a dar de alta al paciente
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
      console.error("❌ Error en handleGuardarDefinitivo:", e);

      // 🧼 Extracción limpia para prevenir [object Object] en pantalla
      let mensajeError = 'Error al procesar la solicitud';

      if (typeof e === 'string') {
        mensajeError = e;
      } else if (e?.message) {
        mensajeError = typeof e.message === 'object' ? JSON.stringify(e.message) : e.message;
      } else if (e?.detail) {
        mensajeError = typeof e.detail === 'object' ? JSON.stringify(e.detail) : e.detail;
      } else if (typeof e === 'object') {
        mensajeError = JSON.stringify(e);
      }

      setError(mensajeError);
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
  // ── 1. ESTRUCTURA Y CONTENEDOR PRINCIPAL ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  scroll: { 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52,
    paddingBottom: 40 
  },

  // ── 2. ENCABEZADO Y TÍTULOS ──
  headerBar: { 
    marginTop: 8, 
    marginBottom: 20 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: COLORS.cacao,
    letterSpacing: 0.3 
  },
  headerSub: { 
    fontSize: 13, 
    color: COLORS.textLight, 
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500' 
  },

  // ── 3. FORMULARIOS E INPUTS ──
  form: { 
    marginTop: 4 
  },
  label: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: COLORS.cacao, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase', 
    marginTop: 14, 
    marginBottom: 6 
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },

  // ── 4. TARJETAS DE SELECCIÓN DE ROL ──
  rolesContainer: { 
    gap: 10, 
    marginVertical: 8 
  },
  rolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  rolCardActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldPale,
  },
  rolIcon: { 
    fontSize: 24 
  },
  rolLabel: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.textDark 
  },
  rolLabelActive: { 
    color: COLORS.gold 
  },
  rolDesc: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    marginTop: 2,
    lineHeight: 15 
  },

  // ── 5. CONSENTIMIENTO, ALERTAS Y BOTÓN PRINCIPAL ──
  consentBox: { 
    marginVertical: 16, 
    paddingHorizontal: 4 
  },
  consentText: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    lineHeight: 16,
    fontWeight: '500' 
  },
  consentLink: { 
    color: COLORS.gold, 
    fontWeight: '800' 
  },
  error: { 
    color: COLORS.red, 
    fontSize: 12, 
    marginVertical: 8, 
    textAlign: 'center',
    fontWeight: '700' 
  },
  btn: {
    backgroundColor: COLORS.cacao,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
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

  // ── 6. MODAL DE CONFIRMACIÓN ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 5,
  },
  modalTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: COLORS.cacao, 
    marginBottom: 10,
    textTransform: 'uppercase' 
  },
  modalBody: { 
    fontSize: 13, 
    color: COLORS.textDark, 
    lineHeight: 18,
    fontWeight: '500' 
  },
  modalRolText: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.gold 
  },
  modalActions: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 20 
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
  },
  modalBtnCancelText: { 
    color: COLORS.textDark, 
    fontWeight: '700', 
    fontSize: 12 
  },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: COLORS.cacao,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnConfirmText: { 
    color: COLORS.white, 
    fontWeight: '800', 
    fontSize: 12 
  },
});