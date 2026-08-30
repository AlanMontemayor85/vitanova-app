import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { crearGeocerca, eliminarGeocerca, getGeocercas, getPacientes, getUbicacion, loadStoredToken } from '../services/api';
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
  greenPale: 'rgba(61, 170, 106, 0.15)',
};

const DEFAULT_LAT = 25.6866;
const DEFAULT_LNG = -100.3161;

// 🧮 Cálculo de distancia Haversine en metros
const calcularDistanciaMetros = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export default function MapaScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [paciente, setPaciente] = useState<any>(null);
  const [ubicacion, setUbicacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [geocercas, setGeocercas] = useState<any[]>([]);
  const [solicitandoGps, setSolicitandoGps] = useState<boolean>(false);
  const [rolUsuario, setRolUsuario] = useState<string>('');
  
  // 📱 Estado de la ubicación del celular del usuario
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const rolDetectado = (
    params.miRol ||
    paciente?.mi_rol ||
    paciente?.rol ||
    paciente?.tipo_usuario ||
    paciente?.parentesco ||
    ''
  ).toString().toLowerCase().trim();

  const esCuidador = rolDetectado === 'cuidador' || rolDetectado === 'enfermero';
  const esFamiliarOAdmin = !esCuidador;

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

  const rawLat = ubicacion?.lat ?? ubicacion?.latitud;
  const rawLng = ubicacion?.lng ?? ubicacion?.longitud;

  const tieneCoordenadasValidas = esValida(rawLat, rawLng);
  const currentLat = tieneCoordenadasValidas ? parsearCoord(rawLat)! : DEFAULT_LAT;
  const currentLng = tieneCoordenadasValidas ? parsearCoord(rawLng)! : DEFAULT_LNG;

  // 📍 1. Solicitar permisos y monitorear la ubicación del celular en tiempo real
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const initialPos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({
            lat: initialPos.coords.latitude,
            lng: initialPos.coords.longitude,
          });

          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 5000,
              distanceInterval: 5,
            },
            (pos) => {
              setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            }
          );
        }
      } catch (err) {
        console.log('ℹ️ Permisos de ubicación o GPS de teléfono omitido:', err);
      }
    })();

    return () => {
      locationSubscription?.remove();
    };
  }, []);

  // 🔄 2. Carga inicial de datos
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const token = await Promise.resolve(loadStoredToken());
        if (token) setAuthToken(token);

        const data = await getPacientes('mapa-ubicacion');

        if (data?.rol_usuario) {
          setRolUsuario(data.rol_usuario);
        }

        if (data.patients && data.patients.length > 0) {
          const p = pacienteIdParam
            ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
            : data.patients[0];
          
          setPaciente(p);

          if (p.mi_rol || p.rol || p.tipo_usuario) {
            setRolUsuario(p.mi_rol || p.rol || p.tipo_usuario);
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

  // ⏱️ 3. Polling periódico de ubicación del paciente
  useEffect(() => {
    if (!paciente?.id) return;

    const interval = setInterval(async () => {
      try {
        const ubData = await getUbicacion(paciente.id);
        if (ubData.ubicacion) {
          setUbicacion(ubData.ubicacion);
        }
      } catch (e) {
        console.log("ℹ️ Error al actualizar ubicación en segundo plano:", e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [paciente?.id]);

  const distanciaMetros = (tieneCoordenadasValidas && userLocation)
    ? calcularDistanciaMetros(userLocation.lat, userLocation.lng, currentLat, currentLng)
    : null;

  const crearYCargar = async (radio: number) => {
    if (!tieneCoordenadasValidas) {
      Alert.alert('Ubicación requerida', 'Se necesita una coordenada válida del dispositivo para fijar el centro de la zona segura.');
      return;
    }

    if (!paciente?.id) {
      Alert.alert('Error', 'No se encontró el identificador del paciente.');
      return;
    }

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
      if (data?.geocercas) {
        setGeocercas(data.geocercas);
      }

      Alert.alert('Zona segura activada', `Se delimitó el perímetro de ${radio}m para ${paciente.nombre_completo || 'el paciente'}.`);
    } catch (e: any) {
      console.error("❌ Error al crear geocerca:", e);
      Alert.alert('Error', e?.message || 'No se pudo guardar la zona segura en el servidor.');
    }
  };

  const centrarAmbosPuntos = () => {
    if (tieneCoordenadasValidas && userLocation && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: currentLat, longitude: currentLng },
          { latitude: userLocation.lat, longitude: userLocation.lng },
        ],
        {
          edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
          animated: true,
        }
      );
    } else {
      mapRef.current?.animateToRegion({
        latitude: currentLat,
        longitude: currentLng,
        latitudeDelta: 0.0122,
        longitudeDelta: 0.0121,
      });
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

      {/* CUADRANTE DEL MAPA */}
      {tieneCoordenadasValidas ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.mapa}
            provider={PROVIDER_GOOGLE}
            showsUserLocation={true}          // 🔵 Punto azul nativo de tu celular
            showsMyLocationButton={true}      // 🎯 Botón nativo para centrar en tu celular
            region={{
              latitude: currentLat,
              longitude: currentLng,
              latitudeDelta: 0.0122,
              longitudeDelta: 0.0121,
            }}
          >
            {/* 📍 Marcador del paciente / reloj */}
            <Marker
              coordinate={{ 
                latitude: currentLat, 
                longitude: currentLng 
              }}
              title={paciente?.nombre_completo ?? "Paciente"}
              description={`Batería: ${ubicacion?.bateria_pct ?? 0}%`}
            />

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

      {/* INFO CARD CON DETECCIÓN DE DISTANCIA */}
      {tieneCoordenadasValidas && (
        <ScrollView 
          style={styles.infoCard} 
          contentContainerStyle={styles.infoCardContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* DISTANCIA RELATIVA AL CELULAR */}
          {distanciaMetros !== null && (
            <View style={[styles.infoRow, { backgroundColor: '#F3EFE6', paddingHorizontal: 12, borderRadius: 8, marginVertical: 4 }]}>
              <Text style={[styles.infoLabel, { color: COLORS.cacao }]}>Distancia a ti</Text>
              <Text style={[styles.infoVal, { color: COLORS.gold, fontSize: 13 }]}>
                {distanciaMetros < 1000 ? `${distanciaMetros} metros` : `${(distanciaMetros / 1000).toFixed(2)} km`}
              </Text>
            </View>
          )}

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

          {/* FILA DE BATERÍA */}
          {ubicacion?.bateria_pct !== undefined && (() => {
            const bat = Number(ubicacion.bateria_pct);
            const ultimaConexionStr = ubicacion?.ultima_conexion ?? ubicacion?.updated_at ?? null;

            let diffMinutos = 0;
            if (ultimaConexionStr) {
              try {
                const fechaNorm = String(ultimaConexionStr).includes('Z') || String(ultimaConexionStr).includes('+')
                  ? String(ultimaConexionStr)
                  : `${String(ultimaConexionStr).replace(' ', 'T')}Z`;
                diffMinutos = Math.floor((new Date().getTime() - new Date(fechaNorm).getTime()) / (1000 * 60));
              } catch {
                diffMinutos = 0;
              }
            }

            const estaFueraDeLinea = diffMinutos > 10;
            const esAgotada = bat <= 3 || (bat <= 5 && estaFueraDeLinea);
            const esBaja = bat > 3 && bat < 20;

            let textoBateria = `${bat}%`;
            let colorBateria = COLORS?.green ?? '#2E7D32';
            let iconoBateria: string | null = null;

            if (esAgotada) {
              textoBateria = `${bat}% (Reloj apagado)`;
              colorBateria = COLORS?.red ?? '#DC2626';
              iconoBateria = '⚠️';
            } else if (estaFueraDeLinea) {
              const tiempoTexto = diffMinutos > 60 
                ? `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m` 
                : `${diffMinutos}m`;
              textoBateria = `${bat}% (Fuera de línea hace ${tiempoTexto})`;
              colorBateria = '#D97706';
              iconoBateria = '📡';
            } else if (esBaja) {
              colorBateria = COLORS?.red ?? '#DC2626';
              iconoBateria = '🪫';
            }

            return (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Batería</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {iconoBateria && <Text style={{ fontSize: 13 }}>{iconoBateria}</Text>}
                  <Text style={[styles.infoVal, { color: colorBateria, fontWeight: esAgotada || estaFueraDeLinea ? '800' : '600' }]}>
                    {textoBateria}
                  </Text>
                </View>
              </View>
            );
          })()}
          
          {/* BOTÓN DE EMERGENCIA */}
          {paciente?.id && (
            <BotonEmergenciaGPS
              pacienteId={paciente.id}
              onPosicionFijada={(coords: { lat: number; lng: number }) => {
                setUbicacion((prev: any) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
                mapRef.current?.animateToRegion({
                  latitude: coords.lat,
                  longitude: coords.lng,
                  latitudeDelta: 0.006,
                  longitudeDelta: 0.006,
                });
              }}
            />
          )}

          {/* BOTONES DE CENTRADO */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.centrarBtn, { flex: 1, marginTop: 0 }]}
              onPress={() => {
                mapRef.current?.animateToRegion({
                  latitude: currentLat,
                  longitude: currentLng,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                });
              }}
            >
              <Text style={styles.centrarBtnText}>📍 Paciente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.centrarBtn, { flex: 1, marginTop: 0, backgroundColor: COLORS.gold }]}
              onPress={centrarAmbosPuntos}
            >
              <Text style={styles.centrarBtnText}>🔍 Ver Ambos</Text>
            </TouchableOpacity>
          </View>
           
          <Text style={[styles.infoLabel, { marginTop: 16, marginBottom: 8 }]}>Zona segura</Text>

          {geocercas.length === 0 ? (
            esFamiliarOAdmin ? (
              <TouchableOpacity
                style={styles.zonaSeguraBtn}
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

          <View style={{ height: Platform.OS === 'android' ? 60 : 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  infoCard: {
    backgroundColor: COLORS.white, 
    maxHeight: 320,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1, 
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  infoCardContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'android' ? 40 : 20,
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
    shadowColor: COLORS.cacao,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  zonaSeguraBtn: {
    backgroundColor: COLORS.gold, 
    borderRadius: 12, 
    paddingVertical: 14,
    alignItems: 'center', 
    marginTop: 8,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
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