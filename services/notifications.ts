import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registrarPushToken } from '../services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registrarNotificaciones() {
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

  await registrarPushToken(token, Platform.OS);

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('vitanova', {
      name: 'Vitanova Alertas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#BF9A40',
    });
  }

  return token;
}