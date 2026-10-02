import React, { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface VisorMapaProps {
  currentLat: number;
  currentLng: number;
  paciente: any;
  ubicacion: any;
  geocercas: any[];
  esValida: (lat: any, lng: any) => boolean;
  parsearCoord: (val: any) => number | null;
}

export const VisorMapa = forwardRef<MapView, VisorMapaProps>(({
  currentLat,
  currentLng,
  paciente,
  ubicacion,
  geocercas,
  esValida,
  parsearCoord
}, ref) => {
  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      showsUserLocation={true}
      showsMyLocationButton={true}
      region={{
        latitude: currentLat,
        longitude: currentLng,
        latitudeDelta: 0.0122,
        longitudeDelta: 0.0121,
      }}
    >
      <Marker
        coordinate={{ latitude: currentLat, longitude: currentLng }}
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
            center={{ latitude: gLat, longitude: gLng }}
            radius={Number(g.radio_metros) || 30}
            strokeColor="rgba(191,154,64,0.8)"
            fillColor="rgba(191,154,64,0.1)"
            strokeWidth={2}
          />
        );
      })}
    </MapView>
  );
});