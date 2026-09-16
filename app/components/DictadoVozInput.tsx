import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { transcribirAudioNota } from '../../services/api';


interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  minHeight?: number;
}

export const DictadoVozInput: React.FC<Props> = ({
  label = 'Observaciones de Relevo',
  placeholder = 'Describe incidencias, conducta, cambios en la marcha o detalles del relevo...',
  value,
  onChangeText,
  minHeight = 90,
}) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [grabando, setGrabando] = useState<boolean>(false);
  const [transcribiendo, setTranscribiendo] = useState<boolean>(false);

  const iniciarGrabacion = async () => {
    try {
      const permiso = await Audio.requestPermissionsAsync();
      if (permiso.status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requiere acceso al micrófono para dictar notas.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: nuevaGrabacion } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(nuevaGrabacion);
      setGrabando(true);
    } catch (err) {
      console.error('Error al iniciar grabación:', err);
      Alert.alert('Error', 'No se pudo activar el micrófono.');
    }
  };

  const detenerYTranscribir = async () => {
    if (!recording) return;

    setGrabando(false);
    setTranscribiendo(true);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // api.ts ya inyecta el token automáticamente
        const res = await transcribirAudioNota(uri);
        if (res?.texto) {
          const textoLimpio = value?.trim() || '';
          onChangeText(textoLimpio ? `${textoLimpio}\n${res.texto}` : res.texto);
        }
      }
    } catch (error: any) {
      console.error('Error procesando transcripción:', error);
      Alert.alert('Error de audio', error.message || 'No fue posible transcribir la nota.');
    } finally {
      setTranscribiendo(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={transcribiendo}
          onPress={grabando ? detenerYTranscribir : iniciarGrabacion}
          style={[styles.btnVoz, grabando && styles.btnVozActivo]}
        >
          {transcribiendo ? (
            <ActivityIndicator size="small" color="#BF9A40" />
          ) : (
            <Ionicons
              name={grabando ? 'stop-circle' : 'mic'}
              size={14}
              color={grabando ? '#EF4444' : '#BF9A40'}
            />
          )}
          <Text style={[styles.btnVozText, grabando && styles.btnVozTextActivo]}>
            {transcribiendo ? 'Transcribiendo...' : grabando ? 'Detener audio' : 'Dictar por voz'}
          </Text>
        </TouchableOpacity>
      </View>

      {grabando && (
        <View style={styles.grabandoBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.grabandoText}>
            Escuchando reporte... presiona "Detener audio" al terminar.
          </Text>
        </View>
      )}

      <TextInput
        multiline
        numberOfLines={4}
        placeholder={placeholder}
        placeholderTextColor="#998E84"
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, { minHeight }, grabando && styles.inputActivo]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#3E3832',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  btnVoz: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBF7EE',
    borderWidth: 1,
    borderColor: '#E8DCC4',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
  },
  btnVozActivo: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  btnVozText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#BF9A40',
  },
  btnVozTextActivo: {
    color: '#EF4444',
  },
  grabandoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  grabandoText: {
    fontSize: 10.5,
    color: '#EF4444',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECE7DF',
    padding: 12,
    fontSize: 12.5,
    color: '#1E1B18',
    textAlignVertical: 'top',
  },
  inputActivo: {
    borderColor: '#EF4444',
  },
});