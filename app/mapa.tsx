import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { crearGeocerca, eliminarGeocerca, getGeocercas, getPacientes, getUbicacion, loadStoredToken, solicitarGpsVivo } from '../services/api';

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
  greenPale: 'rgba(61, 170, 106, 0.15)',
};

// 📍 Coordenadas de Respaldo Seguro (Monterrey / Default)
const DEFAULT_LAT = 25.6866;
const DEFAULT_LNG = -100.3161;

export default function MapaScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [ubicacion, setUbicacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [geocercas, setGeocercas] = useState<any[]>([]);
  const [solicitandoGps, setSolicitandoGps] = useState<boolean>(false);

  // 1. Estado para almacenar el rol del usuario conectado
  const [rolUsuario, setRolUsuario] = useState<string>('cuidador');
  const esFamiliarOAdmin = rolUsuario === 'familiar_principal' || rolUsuario === 'familiar_co_admin';
  // 🛡️ HELPER DE SANITIZACIÓN ROBUSTO
  const parsearCoord = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? null : num;
  };

  const esValida = (latVal: any, lngVal: any): boolean => {
    const lat = parsearCoord(latVal);
    const lng = parsearCoord(lngVal);
    return (
      lat !== null &&
      lng !== null &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0)
    );
  };

  // Extraemos las coordenadas dinámicas soportando cualquier nomenclatura de tu API
  const rawLat = ubicacion?.lat ?? ubicacion?.latitud;
  const rawLng = ubicacion?.lng ?? ubicacion?.longitud;

  const tieneCoordenadasValidas = esValida(rawLat, rawLng);
  const currentLat = tieneCoordenadasValidas ? parsearCoord(rawLat)! : DEFAULT_LAT;
  const currentLng = tieneCoordenadasValidas ? parsearCoord(rawLng)! : DEFAULT_LNG;

  // 1. EFECTO INICIAL: Carga datos base y determina el rol del usuario conectado
useEffect(() => {
  const cargarDatosIniciales = async () => {
    try {
      await loadStoredToken();
      const data = await getPacientes('mapa-ubicacion');

      // Extraer rol si viene a nivel raíz o en el payload del usuario
      if (data?.rol_usuario) {
        setRolUsuario(data.rol_usuario);
      }

      if (data.patients && data.patients.length > 0) {
        const p = pacienteIdParam
          ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
          : data.patients[0];
        
        setPaciente(p);

        // Si el rol viene anidado dentro de la relación con el paciente
        if (p.rol_en_paciente || p.rol) {
          setRolUsuario(p.rol_en_paciente || p.rol);
        }
        
        const ubData = await getUbicacion(p.id);
        if (ubData.ubicacion) setUbicacion(ubData.ubicacion);
        
        const geocercaData = await getGeocercas(p.id);
        if (geocercaData.geocercas) setGeocercas(geocercaData.geocercas);
      }
    } catch (e) {
      console.error("❌ Error en la carga inicial del mapa:", e);
    } finally {
      setLoading(false);
    }
  };

  cargarDatosIniciales();
}, [pacienteIdParam]);

// 2. EFECTO SECUNDARIO: Monitorea y actualiza la ubicación en tiempo real cada 30 segundos
useEffect(() => {
  if (!paciente?.id) return;

  const interval = setInterval(async () => {
    try {
      const ubData = await getUbicacion(paciente.id);
      if (ubData.ubicacion) {
        setUbicacion(ubData.ubicacion);
      }
    } catch (e) {
      console.error("❌ Error al actualizar ubicación en segundo plano:", e);
    }
  }, 30000);

  return () => clearInterval(interval);
}, [paciente?.id]);

// 3. CREACIÓN DE GEOCERCA PROTEGIDA POR ROL
const crearYCargar = async (radio: number) => {
  if (!tieneCoordenadasValidas) return;

  if (!esFamiliarOAdmin) {
    Alert.alert('Acceso Restringido', 'Solo el familiar titular puede configurar la zona segura.');
    return;
  }
  
  try {
    await crearGeocerca({
      paciente_id: paciente.id,
      nombre: 'Casa',
      lat: currentLat,
      lng: currentLng, 
      radio_metros: radio,
    });
    const data = await getGeocercas(paciente.id);
    if (data.geocercas) setGeocercas(data.geocercas);
  } catch (e) {
    console.error("❌ Error al crear geocerca:", e);
    Alert.alert('Error', 'No se pudo guardar la zona segura.');
  }
};

// 4. SOLICITUD DE GPS EN VIVO
const solicitarUbicacionEnVivo = async () => {
  const idPaciente = paciente?.id;
  if (!idPaciente || solicitandoGps) return;

  try {
    setSolicitandoGps(true);
    await solicitarGpsVivo(idPaciente);

    setTimeout(async () => {
      try {
        const data = await getUbicacion(idPaciente);
        if (data?.ubicacion) {
          setUbicacion(data.ubicacion);
        }
      } catch (err) {
        console.error('Error refrescando mapa tras GPS en vivo:', err);
      } finally {
        setSolicitandoGps(false);
      }
    }, 5000);

  } catch (error) {
    console.error('❌ Error solicitando GPS en vivo:', error);
    Alert.alert('Aviso', 'No se pudo forzar la señal GPS en este momento.');
    setSolicitandoGps(false);
  }
};
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
          <Text style={styles.userName}>{paciente?.nombre_completo ?? 'No asignado'}</Text>
        </View>
        {tieneCoordenadasValidas && (
          <View style={styles.activoPill}>
            <View style={styles.activoDot} />
            <Text style={styles.activoText}>En línea</Text>
          </View>
        )}
      </View>

      {/* CUADRANTE DEL MAPA SANITIZADO */}
      {tieneCoordenadasValidas ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.mapa}
            provider={PROVIDER_GOOGLE}
            region={{
              latitude: currentLat,
              longitude: currentLng,
              latitudeDelta: 0.0122,
              longitudeDelta: 0.0121,
            }}
          >
            {/* Marcador del Paciente */}
            <Marker
              coordinate={{ 
                latitude: currentLat, 
                longitude: currentLng 
              }}
              title={paciente?.nombre_completo ?? "Paciente"}
              description={`Batería: ${ubicacion?.bateria_pct ?? 0}%`}
            />

            {/* Mapeo de Geocercas Sanitizado */}
            {Array.isArray(geocercas) && geocercas.map((g, idx) => {
              if (!g || !g.activa) return null;
              
              const gLat = parsearCoord(g.lat ?? g.latitud);
              const gLng = parsearCoord(g.lng ?? g.longitud);

              if (gLat === null || gLng === null || !esValida(gLat, gLng)) return null;

              return (
                <Circle
                  key={g.id ? String(g.id) : `geo-${idx}`}
                  center={{ 
                    latitude: gLat, 
                    longitude: gLng 
                  }}
                  radius={Number(g.radio_metros) || 30}
                  strokeColor="rgba(191,154,64,0.8)"
                  fillColor="rgba(191,154,64,0.1)"
                  strokeWidth={2}
                />
              );
            })}
          </MapView>
        </View>
      ) : (
        <View style={styles.sinUbicacion}>
          <Text style={styles.sinUbicacionIcon}>📍</Text>
          <Text style={styles.sinUbicacionTitle}>Sin ubicación disponible</Text>
          <Text style={styles.sinUbicacionText}>El dispositivo GPS de {paciente?.nombre_completo || 'este paciente'} no está enviando señal válida en este momento.</Text>
        </View>
      )}

      {/* INFO CARD */}
      {tieneCoordenadasValidas && (
        <ScrollView style={styles.infoCard} showsVerticalScrollIndicator={false}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dispositivo</Text>
            <Text style={styles.infoVal}>{ubicacion?.modelo ?? ubicacion?.device_id ?? 'ReachFar GPS'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Última actualización</Text>
            <Text style={styles.infoVal}>
              {ubicacion?.ultima_conexion
                ? new Date(ubicacion.ultima_conexion).toLocaleString('es-MX', {
                    day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit'
                  })
                : '—'}
            </Text>
          </View>
          {ubicacion?.bateria_pct !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Batería</Text>
              <Text style={[styles.infoVal, { color: ubicacion.bateria_pct < 20 ? COLORS.red : COLORS.green }]}>
                {ubicacion.bateria_pct}%
              </Text>
            </View>
          )}
          
          {/* 📍 BOTÓN DUAL: CENTRAR Y ACTUALIZAR GPS EN VIVO */}
          <TouchableOpacity
            style={[
              styles.centrarBtn, 
              solicitandoGps && { opacity: 0.8, backgroundColor: '#4A423A' }
            ]}
            disabled={solicitandoGps}
            onPress={async () => {
              // 1. Centramos la cámara del mapa de inmediato en la posición actual
              mapRef.current?.animateToRegion({
                latitude: currentLat,
                longitude: currentLng,
                latitudeDelta: 0.0122,
                longitudeDelta: 0.0121,
              });

              // 2. Disparamos la solicitud satelital al reloj
              await solicitarUbicacionEnVivo();
            }}
          >
            {solicitandoGps ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#BF9A40" />
                <Text style={styles.centrarBtnText}>Triangulando satélites...</Text>
              </View>
            ) : (
              <Text style={styles.centrarBtnText}>📍 Centrar y actualizar GPS</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.infoLabel, { marginTop: 16, marginBottom: 8 }]}>Zona segura</Text>

            {geocercas.length === 0 ? (
              esFamiliarOAdmin ? (
                <TouchableOpacity
                  style={styles.centrarBtn}
                  onPress={() => {
                    Alert.alert(
                      'Crear zona segura',
                      '¿Qué radio quieres para la zona segura?',
                      [
                        { text: '24m (casa)', onPress: async () => await crearYCargar(24) },
                        { text: '30m (jardín/patio)', onPress: async () => await crearYCargar(30) },
                        { text: '40m (condominio)', onPress: async () => await crearYCargar(40) },
                        { text: 'Cancelar', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <Text style={styles.centrarBtnText}>+ Crear zona segura</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#6B7280', fontSize: 13, fontStyle: 'italic', paddingVertical: 4 }}>
                  Sin zona segura configurada por el familiar.
                </Text>
              )
          ) : (
            geocercas.map((g) => (
              <View 
                key={g.id} 
                style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: 8, 
                  marginTop: 4 
                }}
              >
                <Text style={styles.infoVal}>
                  📍 {g.nombre} — {g.radio_metros}m {g.activa ? '(Activa)' : '(Apagada)'}
                </Text>
                
                {esFamiliarOAdmin && (
                  <TouchableOpacity
                    style={{ backgroundColor: '#FDEAEA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                    onPress={() => {
                      Alert.alert('Eliminar zona', '¿Eliminar esta zona segura?', [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar', 
                          style: 'destructive', 
                          onPress: async () => {
                            try {
                              await eliminarGeocerca(g.id);
                              const data = await getGeocercas(paciente.id);
                              if (data.geocercas) setGeocercas(data.geocercas);
                            } catch (err) {
                              console.error('Error al eliminar geocerca:', err);
                            }
                          }
                        }
                      ]);
                    }}
                  >
                    <Text style={{ color: '#D94F4F', fontSize: 12, fontWeight: '700' }}>✕ Eliminar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {/* Espaciador final para librar la barra de gestos */}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── 1. ESTRUCTURA Y CONTENEDOR DEL MAPA ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.cream, 
  },
  mapa: { 
    ...StyleSheet.absoluteFillObject 
  },

  // ── 2. ENCABEZADO ESTANDARIZADO (CACAO + DORADOS) ──
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  greeting: { 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1, 
    textTransform: 'uppercase', 
    color: COLORS.gold, 
    marginBottom: 2 
  },
  userName: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.white 
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 10 
  },
  backIcon: { 
    fontSize: 18, 
    color: COLORS.white,
    fontWeight: 'bold' 
  },

  // ── 3. PILL DE ESTADO GPS ACTIVO ──
  activoPill: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5,
    backgroundColor: COLORS.greenPale, 
    borderRadius: 20,
    paddingHorizontal: 10, 
    paddingVertical: 4,
    borderWidth: 1, 
    borderColor: COLORS.green + '40',
  },
  activoDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: COLORS.green 
  },
  activoText: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: COLORS.green,
    letterSpacing: 0.5 
  },

  // ── 4. ESTADO SIN UBICACIÓN / SIN SEÑAL ──
  sinUbicacion: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32 
  },
  sinUbicacionIcon: { 
    fontSize: 48, 
    marginBottom: 16 
  },
  sinUbicacionTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: COLORS.cacao, 
    marginBottom: 6,
    textTransform: 'uppercase' 
  },
  sinUbicacionText: { 
    fontSize: 12, 
    color: COLORS.textLight, 
    textAlign: 'center',
    lineHeight: 18 
  },

  // ── 5. PANEL INFORMATIVO INFERIOR (INFO CARD FLOTANTE) ──
  infoCard: {
    backgroundColor: COLORS.white, 
    padding: 16,
    maxHeight: 280,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1, 
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  infoLabel: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    fontWeight: '700',
    textTransform: 'uppercase' 
  },
  infoVal: { 
    fontSize: 12, 
    color: COLORS.textDark, 
    fontWeight: '800' 
  },
  centrarBtn: {
    backgroundColor: COLORS.cacao, 
    borderRadius: 12, 
    paddingVertical: 14,
    alignItems: 'center', 
    marginTop: 12,
    shadowColor: COLORS.cacao,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  centrarBtnText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.white,
    letterSpacing: 0.5 
  },
});