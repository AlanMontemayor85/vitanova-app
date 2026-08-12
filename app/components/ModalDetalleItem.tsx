import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface ModalDetalleProps {
  visible: boolean;
  item: any;
  onClose: () => void;
}

// 🎯 Helper para formatear horas
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
  horas = horas ? horas : 12;

  return `${horas}:${minutos} ${ampm}`;
};

export const ModalDetalleItem: React.FC<ModalDetalleProps> = ({ visible, item, onClose }) => {
  if (!item) return null;

  const nombre = item.descripcion || item.nombre || 'Detalle del elemento';
  const horaRaw = item.hora_programada || item.hora || item.horarios?.[0];
  const hora = horaRaw ? `⏰ Horario: ${formatearHoraBonita(horaRaw)}` : null;
  const indicaciones = item.indicaciones || item.instrucciones || item.modo_uso;
  const notasRaw = item.notas || item.observaciones;
  const notas = (notasRaw && notasRaw.trim() !== indicaciones?.trim()) ? notasRaw : null;
  const ubicacion = item.ubicacion || item.lugar_almacenaje || item.almacen;

  const esRutina = 
    item.esRutina === true ||
    item.es_rutina === true ||
    item.tarearecurrente === true ||
    item.tarea_recurrente === true ||
    item.es_recurrente === true ||
    item.esRecurrente === true ||
    item.tipo?.toLowerCase() === 'rutina' || 
    item.tipo?.toLowerCase() === 'tarea_recurrente' ||
    item.tipo?.toLowerCase() === 'recurrente' ||
    item.categoria?.toLowerCase() === 'rutina' ||
    item.categoria?.toLowerCase() === 'tarea_recurrente' ||
    item.categoria?.toLowerCase() === 'recurrente' ||
    item.tipo_tarea?.toLowerCase() === 'rutina' ||
    item.tipo_tarea?.toLowerCase() === 'recurrente';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>

              {/* 🔍 CÓDIGO DE DIAGNÓSTICO TEMPORAL */}
              <View style={{ backgroundColor: '#FFF0F0', padding: 8, borderRadius: 6, marginBottom: 10, borderWidth: 1, borderColor: 'red' }}>
                <Text style={{ fontSize: 9, color: 'red', fontWeight: 'bold' }}>DATOS REALES RECIBIDOS:</Text>
                <Text style={{ fontSize: 9, color: '#333', fontFamily: 'monospace' }}>
                  {JSON.stringify(item, null, 2)}
                </Text>
              </View>

              <Text style={styles.titulo}>{nombre}</Text>
              {hora && <Text style={styles.horaTxt}>{hora}</Text>}

              {/* 📍 Ubicación en Casa */}
              {!esRutina && (
                <View style={styles.seccion}>
                  <Text style={styles.subtitulo}>📍 Ubicación en Casa:</Text>
                  <Text style={styles.texto}>
                    {ubicacion || 'Botiquín principal / Almacén general.'}
                  </Text>
                </View>
              )}

              {/* 💡 Indicaciones */}
              {indicaciones && (
                <View style={styles.seccion}>
                  <Text style={styles.subtitulo}>💡 Indicaciones / Modo de Uso:</Text>
                  <Text style={styles.texto}>{indicaciones}</Text>
                </View>
              )}

              {/* 📌 Notas */}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#E0D8CC',
    elevation: 5,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4A4540',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  horaTxt: {
    fontSize: 12,
    color: '#BF9A40',
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  seccion: {
    marginBottom: 12,
  },
  subtitulo: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8A8078',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  texto: {
    fontSize: 13,
    color: '#2C2820',
    lineHeight: 18,
    fontWeight: '600',
  },
  btnCerrar: {
    marginTop: 10,
    backgroundColor: '#4A4540',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});