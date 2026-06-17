import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
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

  // 🛡️ FUNCIÓN DE EMERGENCIA: Registra el token push de forma segura
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
        
        // 🚀 Ejecutamos el registro push en segundo plano sin bloquear el flujo principal
        await intentarRegistroPush();

        switch (data.tipo) {
          case 'medico': router.replace('/medico'); break;
          case 'cuidador': router.replace('/cuidador'); break;
          default: router.replace('/');
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
    setLoading(true); setError('');
    try {
      const data = await register(email.trim(), password);
      console.log('login response:', JSON.stringify(data));
      if (data.access_token) {
        await setToken(data.access_token);
        await intentarRegistroPush();
        router.replace('/completar-perfil');
      } else {
        setError(data.error ?? 'Error al crear cuenta');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

 const handleGoogle = async () => {
    setLoadingGoogle(true);
    setError(''); // Limpiamos errores previos antes de arrancar
    try {
      const redirectUri = makeRedirectUri({ scheme: 'vitanovaintegralis' });
      console.log('🔍 redirectUri usado:', redirectUri);

      const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      console.log('🔍 OAuth result:', JSON.stringify(result));

      if (result.type === 'success' && result.url) {
        const url = result.url;

        // El token puede venir en el fragmento (#) o en la query (?)
        const accessToken = url.match(/access_token=([^&]+)/)?.[1];
        const code = url.match(/[?&]code=([^&]+)/)?.[1];

        if (accessToken) {
          const decodedToken = decodeURIComponent(accessToken);
          
          // 1. Guardamos el token de forma prioritaria
          await setToken(decodedToken);
          console.log('✅ Token guardado con éxito.');

          // 2. 🚀 INYECCIÓN TÁCTICA: Registramos el Push en segundo plano sin 'await' 
          // para que un retraso en Railway o Supabase no congele la pantalla del usuario.
          intentarRegistroPush().catch(err => 
            console.log('⚠️ Registro Push en background ignorado:', err)
          );

          // 3. 🎯 REDIRECCIÓN IMPLACABLE: Forzamos el salto a completar-perfil
          // 3. Dejamos que el init del index enrute según perfil/paciente/rol
          console.log('🚀 Login Google OK, enrutando desde el index...');
          router.replace('/' as any);
        } else if (code) {
          console.log('⚠️ Llegó un "code" (PKCE), no un access_token:', code);
          setError('OAuth devolvió un code (PKCE) — hay que intercambiarlo');
        } else {
          console.log('⚠️ URL de regreso sin token ni code:', url);
          setError('No se pudo obtener el token de Google');
        }
      } else {
        console.log('⚠️ OAuth no exitoso, type:', result.type);
      }
    } catch (e) {
      console.log('⚠️ Error con Google:', e);
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

        <TouchableOpacity
          style={styles.invitacionBtn}
          onPress={() => router.push('/aceptar-invitacion' as any)}
        >
          <Text style={styles.invitacionBtnText}>¿Tienes un código de invitación?</Text>
        </TouchableOpacity>
      </ScrollView>
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
});