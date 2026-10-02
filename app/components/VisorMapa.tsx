import { Platform } from 'react-native';
import { VisorMapa as VisorMapaNative } from './VisorMapa.native';
import { VisorMapa as VisorMapaWeb } from './VisorMapa.web';

export const VisorMapa = Platform.OS === 'web' ? VisorMapaWeb : VisorMapaNative;