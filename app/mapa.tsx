import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getPacientes, getUbicacion, loadStoredToken } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  red: '#D94F4F',
};

export default function MapaScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [ubicacion, setUbicacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getPacientes();
        if (data.patients && data.patients.length > 0) {
          const p = data.patients[0];
          setPaciente(p);
          const ubData = await getUbicacion(p.id);
          if (ubData.ubicacion) setUbicacion(ubData.ubicacion);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();

    // Actualizar ubicación cada 30 segundos
    const interval = setInterval(async () => {
      if (paciente?.id) {
        const ubData = await getUbicacion(paciente.id);
        if (ubData.ubicacion) setUbicacion(ubData.ubicacion);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Ubicación</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
        {ubicacion && (
          <View style={styles.activoPill}>
            <View style={styles.activoDot} />
            <Text style={styles.activoText}>En línea</Text>
          </View>
        )}
      </View>

      {/* MAPA */}
      {ubicacion ? (
        <MapView
          ref={mapRef}
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: ubicacion.lat,
            longitude: ubicacion.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{ latitude: ubicacion.lat, longitude: ubicacion.lng }}
            title={paciente?.nombre_completo}
            description={`Última actualización: ${ubicacion.ultima_conexion ? new Date(ubicacion.ultima_conexion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'}`}
          />
        </MapView>
      ) : (
        <View style={styles.sinUbicacion}>
          <Text style={styles.sinUbicacionIcon}>📍</Text>
          <Text style={styles.sinUbicacionTitle}>Sin ubicación disponible</Text>
          <Text style={styles.sinUbicacionText}>El dispositivo GPS no está activo</Text>
        </View>
      )}

      {/* INFO CARD */}
      {ubicacion && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dispositivo</Text>
            <Text style={styles.infoVal}>{ubicacion.modelo ?? ubicacion.device_id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Última actualización</Text>
            <Text style={styles.infoVal}>
              {ubicacion.ultima_conexion
                ? new Date(ubicacion.ultima_conexion).toLocaleString('es-MX', {
                    day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit'
                  })
                : '—'}
            </Text>
          </View>
          {ubicacion.bateria_pct && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Batería</Text>
              <Text style={[styles.infoVal, { color: ubicacion.bateria_pct < 20 ? COLORS.red : COLORS.green }]}>
                {ubicacion.bateria_pct}%
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.centrarBtn}
            onPress={() => mapRef.current?.animateToRegion({
              latitude: ubicacion.lat,
              longitude: ubicacion.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            })}
          >
            <Text style={styles.centrarBtnText}>📍 Centrar en el mapa</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.white },
  activoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(61,170,106,0.2)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)',
  },
  activoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  activoText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  mapa: { flex: 1 },
  sinUbicacion: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  sinUbicacionIcon: { fontSize: 48, marginBottom: 16 },
  sinUbicacionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  sinUbicacionText: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },
  infoCard: {
    backgroundColor: COLORS.white, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  infoVal: { fontSize: 12, color: COLORS.textDark, fontWeight: '700' },
  centrarBtn: {
    backgroundColor: COLORS.cacao, borderRadius: 10, padding: 12,
    alignItems: 'center', marginTop: 12,
  },
  centrarBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});