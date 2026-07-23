import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registrarPushToken } from './api';

let pushYaRegistrado = false;

Notifications.setNotificationHandler({
  handleNotification: async () => 
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as any),
});

export async function registrarNotificaciones() {
  if (pushYaRegistrado) return null;

  try {
    if (!Device.isDevice) {
      console.log('Push notifications solo funcionan en dispositivo físico');
      return null;
    }

    // 📣 CANAL ANDROID: Crear antes de solicitar permisos/tokens
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('vitanova', {
        name: 'Vitanova Alertas y Medicamentos',
        importance: Notifications.AndroidImportance.MAX, // 🚨 Máxima prioridad para sonido y banner
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#BF9A40',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
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

    if (resultado) {
      pushYaRegistrado = true;
    }

    return token;
  } catch (e) {
    console.log('⚠️ Push notifications no disponibles:', e);
    return null;
  }
}

/**
 * ⏰ Programar notificación local para una tarea con hora específica del día de hoy
 */
export async function programarNotificacionTarea(
  title: string,
  body: string,
  horaString: string
) {
  try {
    const [horas, minutos] = horaString.split(':').map(Number);

    const fechaNotificacion = new Date();
    fechaNotificacion.setHours(horas, minutos, 0, 0);

    // Si la hora ya transcurrió el día de hoy, no la programamos
    if (fechaNotificacion.getTime() <= Date.now()) {
      console.log('⏰ La hora programada ya pasó hoy.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${title}`,
        body: body,
        sound: 'default',
        categoryIdentifier: 'vitanova',
        data: { tipo: 'incidental_agendada' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fechaNotificacion,
        channelId: Platform.OS === 'android' ? 'vitanova' : undefined,
      },
    });

    console.log(`🔔 Notificación programada con éxito para las ${horaString} hrs`);
  } catch (error) {
    console.error('❌ Error al programar notificación local:', error);
  }
}