import React, { forwardRef } from 'react';

interface VisorMapaProps {
  currentLat: number;
  currentLng: number;
  paciente?: any;
  ubicacion?: any;
  geocercas?: any[];
  esValida?: any;
  parsearCoord?: any;
}

export const VisorMapa = forwardRef<any, VisorMapaProps>(({ currentLat, currentLng }, ref) => {
  return (
    <iframe
      title="Ubicación GPS Paciente"
      width="100%"
      height="100%"
      style={{ border: 0 }}
      loading="lazy"
      allowFullScreen
      src={`https://maps.google.com/maps?q=${currentLat},${currentLng}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
    />
  );
});