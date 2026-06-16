import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registrarPushToken } from './api';

let pushYaRegistrado = false;

export async function registrarNotificaciones() {
  // 🔒 Si ya se registró con sesión en esta sesión de app, no repetir
  if (pushYaRegistrado) return null;

  try {
    if (!Device.isDevice) {
      console.log('Push notifications solo funcionan en dispositivo físico');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '2bbd9090-096b-4b4b-ac01-bf15826b2876',
    })).data;

    console.log('Push token:', token);

    const resultado = await registrarPushToken(token, Platform.OS);

    // ✅ Solo marcamos como registrado si de verdad había sesión y se guardó.
    //    Si no había sesión, registrarPushToken regresa null → no lo marcamos
    //    y se volverá a intentar después del login.
    if (resultado) {
      pushYaRegistrado = true;
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('vitanova', {
        name: 'Vitanova Alertas',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#BF9A40',
      });
    }

    return token;
  } catch (e) {
    console.log('⚠️ Push notifications no disponibles:', e);
    return null;
  }
}