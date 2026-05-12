import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { login } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = 'https://kywafcpnhnetetpsrtjx.supabase.co';
const GOOGLE_CLIENT_ID = '630533307649-46m1oi78o6ecmbbkjddfqq91ocjubvgf.apps.googleusercontent.com'; // el que copiaste de Google Cloud

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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Login con email ──────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Ingresa tu email y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await login(email.trim(), password);
      if (data.access_token) {
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

  // ── Login con Google ─────────────────────
  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const redirectUri = makeRedirectUri({ scheme: 'vitanovaapp' });
      const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === 'success') {
        router.replace('/completar-perfil');
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

      <View style={styles.form}>
        <Text style={styles.title}>Iniciar sesión</Text>

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Entrar</Text>
          }
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cacao },
  header: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  logoImg: { width: 240, height: 180 },
  form: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 32, paddingBottom: 48,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 24 },
  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.textLight,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: COLORS.textDark, marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16, paddingHorizontal: 16,
  },
  eyeBtn: { paddingLeft: 8 },
  eyeIcon: { fontSize: 18 },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 20, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textLight, fontSize: 12 },
  btnGoogle: {
    backgroundColor: COLORS.white, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  googleIcon: { fontSize: 16, fontWeight: '900', color: '#4285F4' },
  btnGoogleText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
});