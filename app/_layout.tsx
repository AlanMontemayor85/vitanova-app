import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { vaciarColaOffline } from '../services/offlineQueue';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

export default function RootLayout() {
  useEffect(() => {
    // 1. Al montar la app
    vaciarColaOffline();

    // 2. Al regresar a la app o cambiar de estado
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        vaciarColaOffline();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
  

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