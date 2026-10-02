import React from 'react';

export interface VisorMapaProps {
  currentLat: number;
  currentLng: number;
  paciente: any;
  ubicacion: any;
  geocercas: any[];
  esValida: (lat: any, lng: any) => boolean;
  parsearCoord: (val: any) => number | null;
}

export declare const VisorMapa: React.ForwardRefExoticComponent<
  VisorMapaProps & React.RefAttributes<any>
>;