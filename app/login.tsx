import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { login, register, setToken } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = 'https://kywafcpnhnetetpsrtjx.supabase.co';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078',
  border: '#E0D8CC', red: '#D94F4F',
};

export default function LoginScreen() {
  const router = useRouter();
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
 const [modalAvisoVisible, setModalAvisoVisible] = useState(false);

  const intentarRegistroPush = async () => {
    try {
      const { registrarNotificaciones } = await import('../services/notifications');
      await registrarNotificaciones();
    } catch (pushError) {
      console.log('⚠️ Push ignorado de forma segura en Login:', pushError);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) { setError('Ingresa tu email y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const data = await login(email.trim(), password);
      if (data.access_token) {
        await setToken(data.access_token);
        await intentarRegistroPush();

        // 🟢 VALIDACIÓN DE LA BD: Si la cuenta ya cuenta con un tipo/rol asignado
        if (data.tipo && data.tipo.trim() !== '') {
          switch (data.tipo) {
            case 'medico': 
              router.replace('/medico'); 
              break;
            case 'cuidador': 
            case 'cuidador_contratado':
              router.replace('/cuidador'); 
              break;
            case 'autonomo':
              router.replace('/autocuidador');
              break;
            default: 
              // 'familiar' o 'admin': Deriva al index.tsx sin alterar su inicialización
              router.replace('/'); 
          }
        } else {
          // Si el valor del rol en la BD es NULL, deriva a completar el perfil
          console.log("⚠️ Usuario sin rol asignado en la BD. Redirigiendo a /completar-perfil");
          router.replace('/completar-perfil' as any);
        }
      } else {
        setError('Email o contraseña incorrectos');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistro = async () => {
    if (!email || !password) { setError('Ingresa tu email y contraseña'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    
    setLoading(true); 
    setError('');
    
    try {
      // Pasamos la bandera de consentimiento legal requerida por Pydantic
      const data = await register(email.trim(), password, {
        acepta_aviso: true,
        version_aviso: 'v1.0'
      });
      
      if (data.access_token) {
        await setToken(data.access_token);
        await intentarRegistroPush();
        
        // Canaliza a completar perfil para capturar nombre, teléfono y rol
        router.replace('/completar-perfil' as any);
      } else {
        setError(data.error ?? 'Error al crear cuenta');
      }
    } catch (e) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };
   
  const handleGoogle = async () => {
    setLoadingGoogle(true);
    setError('');
    try {
      const redirectUri = makeRedirectUri({ scheme: 'vitanovaintegralis' });
      const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = result.url;
        const accessToken = url.match(/access_token=([^&]+)/)?.[1];
        const code = url.match(/[?&]code=([^&]+)/)?.[1];

        if (accessToken) {
          const decodedToken = decodeURIComponent(accessToken);
          await setToken(decodedToken);

          intentarRegistroPush().catch(err => 
            console.log('⚠️ Registro Push en background ignorado:', err)
          );

          // 🟢 Redirección a la raíz '/' para que el index.tsx verifique las credenciales contra la BD
          router.replace('/' as any);
        } else if (code) {
          setError('OAuth devolvió un code (PKCE) — hay que intercambiarlo');
        } else {
          setError('No se pudo obtener el token de Google');
        }
      }
    } catch (e) {
      setError('Error con Google');
    } finally {
      setLoadingGoogle(false);
    }
  };
  
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logoImg}
          resizeMode="contain"
        />
      </View>

      <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 48 }}>
        <Text style={styles.title}>
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </Text>

        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          placeholderTextColor={COLORS.textLight}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {modo === 'registro' && (
        <>
          <Text style={styles.label}>Confirmar contraseña</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          {/* AVISO LEGAL LFPDPPP */}
          <View style={{ marginVertical: 10, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, color: COLORS.textLight, lineHeight: 16 }}>
              Al registrarte, confirmas que aceptas el{' '}
              <Text style={{ color: COLORS.gold, fontWeight: '700' }}>
                Aviso de Privacidad y Tratamiento de Datos de Salud
              </Text>{' '}
              conforme a la LFPDPPP.
            </Text>
          </View>
        </>
      )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={modo === 'login' ? handleLogin : handleRegistro}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>
                {modo === 'login' ? 'Entrar' : 'Crear cuenta'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => { 
            setModo(modo === 'login' ? 'registro' : 'login'); 
            setError(''); 
            setConfirmPassword(''); 
          }}
        >
          <Text style={styles.toggleBtnText}>
            {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.btnGoogle, loadingGoogle && { opacity: 0.7 }]}
          onPress={handleGoogle}
          disabled={loadingGoogle}
        >
          {loadingGoogle
            ? <ActivityIndicator color={COLORS.textDark} />
            : <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.btnGoogleText}>Continuar con Google</Text>
              </>
          }
        </TouchableOpacity>

        
      </ScrollView>
      {/* MODAL DE AVISO DE PRIVACIDAD SIMPLIFICADO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalAvisoVisible}
        onRequestClose={() => setModalAvisoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%', paddingBottom: 16 }]}>
            <Text style={styles.modalTitle}>📄 Aviso de Privacidad y Consentimiento</Text>
            
            <ScrollView style={{ marginVertical: 12 }} showsVerticalScrollIndicator={true}>
              <Text style={styles.legalParrafo}>
                <Text style={{ fontWeight: 'bold' }}>Vitanova Integralis</Text>, con domicilio en Monterrey, N.L., es responsable del tratamiento de sus datos conforme a la LFPDPPP.
              </Text>

              <Text style={styles.legalSub}>1. Datos Sensibles que Recabamos</Text>
              <Text style={styles.legalParrafo}>
                Para prestar nuestros servicios de asistencia y cuidado, recabamos datos de salud (frecuencia cardíaca, SpO2, presión arterial, registro de caídas) y coordenadas GPS en tiempo real provenientes de los dispositivos vinculados.
              </Text>

              <Text style={styles.legalSub}>2. Finalidad del Tratamiento</Text>
              <Text style={styles.legalParrafo}>
                Los datos serán utilizados exclusivamente para:
                {'\n'}• Monitoreo de bienestar y asistencia en emergencias.
                {'\n'}• Delimitación y alertas de zonas seguras (geocercas).
                {'\n'}• Coordinación entre familiares, cuidadores y personal de salud autorizados.
              </Text>

              <Text style={styles.legalSub}>3. Transferencia y Seguridad</Text>
              <Text style={styles.legalParrafo}>
                Sus datos de salud no serán compartidos ni comercializados con terceros ajenos a la red de cuidado autorizada por el titular. Se almacenan bajo cifrado y estrictos protocolos de control de acceso.
              </Text>

              <Text style={styles.legalSub}>4. Derechos ARCO</Text>
              <Text style={styles.legalParrafo}>
                Usted o su representante legal pueden revocar el consentimiento o ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición escribiendo a soporte@vitanova.com.
              </Text>
            </ScrollView>

            <TouchableOpacity
                    style={[styles.modalBtnConfirm, { width: '100%' }]}
                    onPress={() => setModalAvisoVisible(false)}
                  >
                    <Text style={styles.modalBtnConfirmText}>Entendido y Acepto</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cacao },
  header: { height: 260, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  logoImg: { width: 240, height: 180 },
  form: { backgroundColor: COLORS.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 32 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textDark, marginBottom: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, paddingHorizontal: 16 },
  eyeBtn: { paddingLeft: 8 },
  eyeIcon: { fontSize: 18 },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  toggleBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  toggleBtnText: { color: COLORS.gold, fontSize: 13, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textLight, fontSize: 12 },
  btnGoogle: { backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  googleIcon: { fontSize: 16, fontWeight: '900', color: '#4285F4' },
  btnGoogleText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  invitacionBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  invitacionBtnText: { color: COLORS.textLight, fontSize: 13, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.cacao,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalBtnConfirm: {
    backgroundColor: COLORS.cacao,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  legalSub: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.cacao,
    marginTop: 10,
    marginBottom: 4,
  },
  legalParrafo: {
    fontSize: 12,
    color: COLORS.textDark,
    lineHeight: 17,
    marginBottom: 8,
  },
});