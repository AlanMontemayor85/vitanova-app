import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getGeocercas, getPacientes, getUbicacion } from '../services/api';
import { BotonEmergenciaGPS } from './components/BotonEmergenciaGPS';

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

export default function MapaWebScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();

  const [paciente, setPaciente] = useState<any>(null);
  const [ubicacion, setUbicacion] = useState<any>(null);
  const [geocercas, setGeocercas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getPacientes('mapa-web');
        if (data.patients && data.patients.length > 0) {
          const p = pacienteIdParam
            ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
            : data.patients[0];
          setPaciente(p);

          const ubData = await getUbicacion(p.id);
          if (ubData.ubicacion) setUbicacion(ubData.ubicacion);

          const geoData = await getGeocercas(p.id);
          if (geoData.geocercas) setGeocercas(geoData.geocercas);
        }
      } catch (e) {
        console.error('Error cargando mapa en web:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteIdParam]);

  const rawLat = ubicacion?.lat ?? ubicacion?.latitud ?? 25.6866;
  const rawLng = ubicacion?.lng ?? ubicacion?.longitud ?? -100.3161;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Ubicación Web (Telemetría)</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo ?? 'No asignado'}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* MAPA EMBEBIDO WEB */}
        <View style={styles.mapContainer}>
          <iframe
            title="Google Maps Web"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://maps.google.com/maps?q=${rawLat},${rawLng}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
          />
        </View>

        {/* PANEL LATERAL DE AUDITORÍA */}
        <ScrollView style={styles.sidePanel}>
          <Text style={styles.panelTitle}>Datos de Telemetría</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dispositivo:</Text>
            <Text style={styles.infoVal}>{ubicacion?.modelo ?? 'ReachFar GPS'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Coordenadas:</Text>
            <Text style={styles.infoVal}>{rawLat}, {rawLng}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Batería:</Text>
            <Text style={[styles.infoVal, { color: COLORS.green }]}>{ubicacion?.bateria_pct ?? 0}%</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Última conexión:</Text>
            <Text style={styles.infoVal}>
              {ubicacion?.ultima_conexion ? new Date(ubicacion.ultima_conexion).toLocaleString('es-MX') : '—'}
            </Text>
          </View>

          {paciente?.id && (
            <View style={{ marginTop: 20 }}>
              <BotonEmergenciaGPS
                pacienteId={paciente.id}
                onPosicionFijada={(coords: { lat: number; lng: number }) => {
                  setUbicacion((prev: any) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
                }}
              />
            </View>
          )}

          <Text style={[styles.panelTitle, { marginTop: 24 }]}>Zonas Seguras</Text>
          {geocercas.length === 0 ? (
            <Text style={styles.emptyText}>Sin zonas seguras registradas.</Text>
          ) : (
            geocercas.map((g) => (
              <View key={g.id} style={styles.infoRow}>
                <Text style={styles.infoVal}>📍 {g.nombre}</Text>
                <Text style={styles.infoLabel}>{g.radio_metros} metros</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: { fontSize: 11, fontWeight: '800', color: COLORS.gold, textTransform: 'uppercase' },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  backBtn: { marginRight: 14, padding: 6 },
  backIcon: { fontSize: 20, color: COLORS.white, fontWeight: 'bold' },
  body: { flex: 1, flexDirection: 'row' },
  mapContainer: { flex: 2, backgroundColor: '#E2E8F0' },
  sidePanel: { flex: 1, backgroundColor: COLORS.white, padding: 20, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  panelTitle: { fontSize: 14, fontWeight: '800', color: COLORS.cacao, textTransform: 'uppercase', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  infoVal: { fontSize: 12, color: COLORS.textDark, fontWeight: '700' },
  emptyText: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },
});