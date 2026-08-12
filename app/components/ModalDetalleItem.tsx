import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';



export const COLORS = {
  // 🎨 Núcleo e Identidad Institucional
  cacao: '#2C2820',
  gold: '#BF9A40',
  goldPale: 'rgba(191, 154, 64, 0.15)',
  cream: '#F5F4F0',
  white: '#FFFFFF',
  border: '#E2DFD7',

  // 🩺 Semáforo y Notificaciones Tácticas
  green: '#3DAA6A',
  greenPale: 'rgba(61, 170, 106, 0.15)',
  amber: '#E6A028',
  amberPale: 'rgba(230, 160, 40, 0.15)',
  red: '#D94F4F',
  redPale: 'rgba(217, 79, 79, 0.15)',

  // 📝 Tipografía y Neutrales
  textDark: '#2C2820',
  textMid: '#5C554E',
  textLight: '#8A8078',
};

interface ModalDetalleProps {
  visible: boolean;
  item: any;
  onClose: () => void;
}

// 🎯 Helper mejorado para transformar "19:00" o "19:00:00" a "7:00 p.m."
const formatearHoraBonita = (horaRaw: string | null | undefined): string => {
  if (!horaRaw || horaRaw === 'Incidental') return 'Sin hora';
  
  let soloHora = horaRaw.includes('T') ? horaRaw.split('T')[1] : horaRaw;
  soloHora = soloHora.split('.')[0].split('-')[0].split('+')[0].trim();

  const partes = soloHora.split(':');
  if (partes.length < 1) return horaRaw;

  let horas = parseInt(partes[0], 10);
  const minutos = partes[1] ? partes[1].padStart(2, '0') : '00';

  if (isNaN(horas)) return horaRaw;

  const ampm = horas >= 12 ? 'p.m.' : 'a.m.';
  horas = horas % 12;
  horas = horas ? horas : 12; // El 0 se convierte en 12

  return `${horas}:${minutos} ${ampm}`;
};

export const ModalDetalleItem: React.FC<ModalDetalleProps> = ({ visible, item, onClose }) => {
  if (!item) return null;

  const nombre = item.descripcion || item.nombre || 'Detalle del elemento';
  
  // 🎯 1. Evaluamos todos los campos donde la BD guarda la hora
  const horaRaw = item.hora_programada || item.hora || item.horarios?.[0];
  const hora = horaRaw ? `⏰ Horario: ${formatearHoraBonita(horaRaw)}` : null;
  
  const indicaciones = item.indicaciones || item.instrucciones || item.modo_uso;
  
  // 🎯 2. Evitamos duplicar en "Notas" si trae exactamente el mismo texto de "Indicaciones"
  const notasRaw = item.notas || item.observaciones;
  const notas = (notasRaw && notasRaw.trim() !== indicaciones?.trim()) ? notasRaw : null;

  const ubicacion = item.ubicacion || item.lugar_almacenaje || item.almacen;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <Text style={styles.titulo}>{nombre}</Text>
              {hora && <Text style={styles.horaTxt}>{hora}</Text>}

              {/* 📍 Ubicación en Casa */}
              <View style={styles.seccion}>
                <Text style={styles.subtitulo}>📍 Ubicación en Casa:</Text>
                <Text style={styles.texto}>
                  {ubicacion || 'Botiquín principal / Almacén general.'}
                </Text>
              </View>

              {/* 💡 Indicaciones y Modo de Uso */}
              {indicaciones && (
                <View style={styles.seccion}>
                  <Text style={styles.subtitulo}>💡 Indicaciones / Modo de Uso:</Text>
                  <Text style={styles.texto}>{indicaciones}</Text>
                </View>
              )}

              {/* 📌 Notas adicionales (Solo si es un texto diferente) */}
              {notas && (
                <View style={styles.seccion}>
                  <Text style={styles.subtitulo}>📌 Notas Adicionales:</Text>
                  <Text style={styles.texto}>{notas}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.btnCerrar} onPress={onClose}>
                <Text style={styles.btnTexto}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ── 1. OVERLAY Y CONTENEDOR DEL MODAL ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },

  // ── 2. CABECERA Y HORARIOS ──
  titulo: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.cacao,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  horaTxt: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: 0.5,
  },

  // ── 3. SECCIONES Y CONTENIDO ──
  seccion: {
    marginBottom: 12,
  },
  subtitulo: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  texto: {
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
    fontWeight: '600',
  },

  // ── 4. BOTÓN DE CIERRE ──
  btnCerrar: {
    marginTop: 10,
    backgroundColor: COLORS.cacao,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: COLORS.cacao,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  btnTexto: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});