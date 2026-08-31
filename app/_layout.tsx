import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox } from 'react-native';
import { clearToken, getToken, loadStoredToken, registerOnSessionExpired } from '../services/api';
import { vaciarColaOffline } from '../services/offlineQueue';

// 🛡️ Mantener la pantalla de bienvenida mientras se cargan los assets/fuentes
SplashScreen.preventAutoHideAsync().catch(() => {});

if (__DEV__) {
  LogBox.ignoreLogs([
    'Network request failed',
    'Fallo de red o servidor inalcanzable',
    'Call to function',
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

  // 🔤 1. Precarga segura de las fuentes vectoriales (Ionicons)
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  // 🚪 2. Función centralizada para expulsar al usuario
  const cerrarSesionForzada = async () => {
    if (timerExpiracionRef.current) {
      clearTimeout(timerExpiracionRef.current);
    }
    await clearToken();

    const primerSegmento = (segments?.[0] as string) || '';
    const enPantallaAuth = ['login', 'index', 'onboarding'].includes(primerSegmento);
    if (!enPantallaAuth) {
      router.replace('/login');
    }
  };

  // 🛡️ 3. Evalúa si el token JWT sigue vivo o ya expiró
  const evaluarExpiracionToken = async () => {
    try {
      let token = getToken();
      if (!token) {
        token = await loadStoredToken();
      }
      if (!token) return;

      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return;

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

      if (tiempoRestanteMs <= 0) {
        console.warn('⏱️ [AUTO-LOGOUT] Token expirado en reposo. Expulsando...');
        await cerrarSesionForzada();
        return;
      }

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

  // 🎨 4. Ocultar splash screen cuando las fuentes estén listas
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // ⚡ 5. Manejo de ciclo de vida, sesión y colas offline
  useEffect(() => {
    registerOnSessionExpired(() => {
      cerrarSesionForzada();
    });

    evaluarExpiracionToken();
    vaciarColaOffline().catch(() => {});

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

  // Evitar renderizar el árbol de componentes hasta que las fuentes estén resueltas
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="alertas" />
      <Stack.Screen name="mapa" />
      <Stack.Screen name="cuidador" />
      <Stack.Screen name="medico" />
      <Stack.Screen name="medicamentos" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="registro-salud" />
      <Stack.Screen name="nuevo-paciente" />
      <Stack.Screen name="perfil-paciente" />
      <Stack.Screen name="completar-perfil" />
      <Stack.Screen name="evaluacion-hogar" />
      <Stack.Screen name="red-cuidadores" />
      <Stack.Screen name="aceptar-invitacion" />
      <Stack.Screen name="grafica-signos" />
      <Stack.Screen name="autocuidador" />
    </Stack>
  );
}