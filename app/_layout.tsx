import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox } from 'react-native';
import { clearToken, getToken, loadStoredToken, registerOnSessionExpired } from '../services/api';
import { vaciarColaOffline } from '../services/offlineQueue';

if (__DEV__) {
  LogBox.ignoreLogs([
    'Network request failed',
    'Fallo de red o servidor inalcanzable',
  ]);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldBadge: false,
  } as any),
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const timerExpiracionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🚪 Función centralizada para expulsar al usuario
  const cerrarSesionForzada = async () => {
    if (timerExpiracionRef.current) {
      clearTimeout(timerExpiracionRef.current);
    }
    await clearToken();
    
    // Evita redirigir si el usuario ya está en login o index
    const primerSegmento = (segments?.[0] as string) || '';
    const enPantallaAuth = ['login', 'index', 'onboarding'].includes(primerSegmento);
    if (!enPantallaAuth) {
      router.replace('/login');
    }
  };

  // 🛡️ Evalúa si el token JWT sigue vivo o ya expiró
  const evaluarExpiracionToken = async () => {
    try {
      let token = getToken();
      if (!token) {
        token = await loadStoredToken();
      }
      if (!token) return;

      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return;

      // Decodificación manual de Base64 compatible con React Native
      const decodedPayload = JSON.parse(
        decodeURIComponent(
          atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      );

      const expSegundos = decodedPayload.exp;
      if (!expSegundos) return;

      const ahoraSegundos = Math.floor(Date.now() / 1000);
      const tiempoRestanteMs = (expSegundos - ahoraSegundos) * 1000;

      // 1. Si ya expiró mientras la app estaba cerrada/bloqueada -> Expulsión inmediata
      if (tiempoRestanteMs <= 0) {
        console.warn('⏱️ [AUTO-LOGOUT] Token expirado en reposo. Expulsando...');
        await cerrarSesionForzada();
        return;
      }

      // 2. Si sigue vigente pero la pantalla está encendida -> Programar expulsión exacta
      if (timerExpiracionRef.current) {
        clearTimeout(timerExpiracionRef.current);
      }

      timerExpiracionRef.current = setTimeout(async () => {
        console.warn('🚨 [AUTO-LOGOUT] Temporizador de token cumplido en vivo.');
        await cerrarSesionForzada();
      }, tiempoRestanteMs);

    } catch (err) {
      console.warn('Error validando expiración del token:', err);
    }
  };

  useEffect(() => {
    // 🔗 1. Registrar callback para expulsión reactiva si fetchWithAuth atrapa un 401
    registerOnSessionExpired(() => {
      cerrarSesionForzada();
    });

    // 🚀 2. Verificación proactiva inicial al montar la app
    evaluarExpiracionToken();
    vaciarColaOffline().catch(() => {});

    // 📱 3. Verificación inmediata cada vez que el usuario vuelve a enfocar la app
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        evaluarExpiracionToken();
        vaciarColaOffline().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      if (timerExpiracionRef.current) {
        clearTimeout(timerExpiracionRef.current);
      }
    };
  }, [segments]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="alertas" options={{ headerShown: false }} />
      <Stack.Screen name="mapa" options={{ headerShown: false }} />
      <Stack.Screen name="cuidador" options={{ headerShown: false }} />
      <Stack.Screen name="medico" options={{ headerShown: false }} />
      <Stack.Screen name="medicamentos" options={{ headerShown: false }} />
      <Stack.Screen name="historial" options={{ headerShown: false }} />
      <Stack.Screen name="registro-salud" options={{ headerShown: false }} />
      <Stack.Screen name="nuevo-paciente" options={{ headerShown: false }} />
      <Stack.Screen name="perfil-paciente" options={{ headerShown: false }} />
      <Stack.Screen name="completar-perfil" options={{ headerShown: false }} />
      <Stack.Screen name="evaluacion-hogar" options={{ headerShown: false }} />
      <Stack.Screen name="red-cuidadores" options={{ headerShown: false }} />
      <Stack.Screen name="aceptar-invitacion" options={{ headerShown: false }} />
      <Stack.Screen name="grafica-signos" options={{ headerShown: false }} />
      <Stack.Screen name="autocuidador" options={{ headerShown: false }} />
    </Stack>
  );
}