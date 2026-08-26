import { registerOnSessionExpired } from '@/services/api'; // 👈 Ajusta la ruta a tu archivo de API
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

export default function RootLayout() {
  useEffect(() => {
    // 🛡️ Guardián: cuando el API reciba un 401 definitivo, redirige a login
    registerOnSessionExpired(() => {
      router.replace('/login');
    });
  }, []);
  useEffect(() => {
    // 🛡️ Guardián: cuando el API reciba un 401 definitivo, redirige a login
    registerOnSessionExpired(() => {
      router.replace('/login');
    });
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