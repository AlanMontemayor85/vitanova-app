import { useRouter } from 'expo-router';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
};

// Coordenadas de ejemplo — Col. Del Valle, Monterrey
const PACIENTE = {
  latitude: 25.6450,
  longitude: -100.3180,
};

const GEOCERCA_RADIO = 300; // metros

export default function MapaScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Ubicación</Text>
          <Text style={styles.subtitle}>María Guadalupe · Tiempo real</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>En casa</Text>
        </View>
      </View>

      {/* MAPA */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: PACIENTE.latitude,
          longitude: PACIENTE.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
      >
        {/* Geocerca */}
        <Circle
          center={PACIENTE}
          radius={GEOCERCA_RADIO}
          fillColor="rgba(191,154,64,0.08)"
          strokeColor="rgba(191,154,64,0.4)"
          strokeWidth={2}
        />

        {/* Marcador paciente */}
        <Marker
          coordinate={PACIENTE}
          title="María Guadalupe"
          description="Última actualización: hace 3 min"
        />
      </MapView>

      {/* INFO CARD */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Última ubicación</Text>
            <Text style={styles.infoVal}>Col. Del Valle, MTY</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Actualizado</Text>
            <Text style={styles.infoVal}>Hace 3 min</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Batería GPS</Text>
            <Text style={[styles.infoVal, { color: COLORS.green }]}>72%</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.geocercaRow}>
          <View style={styles.geocercaInfo}>
            <Text style={styles.geocercaIcon}>🏠</Text>
            <View>
              <Text style={styles.geocercaLabel}>Geocerca activa</Text>
              <Text style={styles.geocercaSub}>Radio de 300m desde el hogar</Text>
            </View>
          </View>
          <View style={styles.geocercaStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.geocercaStatusText}>Dentro</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.historialBtn}>
          <Text style={styles.historialBtnText}>Ver historial de ubicaciones</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', flex: 1 },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(61,170,106,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(61,170,106,0.3)',
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green,
  },
  statusText: { fontSize: 9, fontWeight: '700', color: COLORS.green },
  map: { flex: 1 },
  infoCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: { alignItems: 'center' },
  infoLabel: {
    fontSize: 9, fontWeight: '600', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  infoVal: { fontSize: 12, fontWeight: '700', color: COLORS.textDark },
  divider: {
    height: 1, backgroundColor: COLORS.border, marginBottom: 16,
  },
  geocercaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  geocercaInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  geocercaIcon: { fontSize: 24 },
  geocercaLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  geocercaSub: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  geocercaStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.greenPale,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  geocercaStatusText: { fontSize: 10, fontWeight: '700', color: COLORS.green },
  historialBtn: {
    backgroundColor: COLORS.goldPale,
    borderRadius: 10, padding: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(191,154,64,0.3)',
  },
  historialBtnText: {
    fontSize: 12, fontWeight: '700', color: COLORS.gold,
  },
});
