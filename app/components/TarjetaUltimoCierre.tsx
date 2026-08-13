import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getHistorialCierres, getUltimoCierre } from '../../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078', border: '#E0D8CC',
  green: '#2E7D32', greenPale: '#EAF5E8', amber: '#D4860A', amberPale: '#FFF4E0',
  red: '#D94F4F', redPale: '#FDEAEA'
};

const EMOJIS_ANIMO: Record<string, string> = {
  bien: '😊 Bien / Estable',
  tranquilo: '😌 Tranquilo',
  alegre: '😊 Alegre',
  ansioso: '😰 Ansioso',
  triste: '😢 Triste',
  agitado: '😤 Agitado',
  confundido: '😵 Confundido',
  somnoliento: '😴 Somnoliento',
  regular: '😐 Regular',
  malo: '😟 Con Malestar'
};

interface Props {
  pacienteId: string;
}

export const TarjetaUltimoCierre: React.FC<Props> = ({ pacienteId }) => {
  const [cierre, setCierre] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useFocusEffect(
    useCallback(() => {
      if (pacienteId) {
        cargarCierre();
      }
    }, [pacienteId])
  );

  const cargarCierre = async () => {
    try {
      setLoading(true);
      
      // 1. Intentamos obtener el último cierre
      let res = await getUltimoCierre(pacienteId);
      
      // 🎯 EXTRAER EL REGISTRO INDIVIDUAL
      let registro = desempaquetarRegistro(res);

      // 🛡️ FALLBACK DE SEGURIDAD:
      // Si getUltimoCierre no devolvió un objeto válido con datos clínicos,
      // consultamos el historial de cierres (que ya sabemos que sí funciona).
      if (!registro || (registro.dolor_eva === undefined && !registro.created_at && !registro.id)) {
        const resHistorial = await getHistorialCierres(pacienteId);
        const listaHistorial = Array.isArray(resHistorial) 
          ? resHistorial 
          : (resHistorial?.cierres || resHistorial?.data || []);
          
        if (listaHistorial.length > 0) {
          registro = listaHistorial[0]; // El primer elemento es el más reciente
        }
      }

      setCierre(registro);
    } catch (e) {
      console.error('Error cargando el último cierre:', e);
      setCierre(null);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 FUNCIÓN AUXILIAR PARA ABRIR CUALQUIER ENVOLTURA DE API
  const desempaquetarRegistro = (res: any) => {
    if (!res || res.error) return null;
    
    // Si viene como Array directo [...]
    if (Array.isArray(res)) return res[0] || null;
    
    // Si viene envuelto en { cierres: [...] }
    if (Array.isArray(res.cierres) && res.cierres.length > 0) return res.cierres[0];
    
    // Si viene envuelto en { data: [...] } o { data: {...} }
    if (Array.isArray(res.data) && res.data.length > 0) return res.data[0];
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data;
    
    // Si viene envuelto en { cierre: {...} }
    if (res.cierre && typeof res.cierre === 'object') return res.cierre;
    
    // Si es el objeto directo del registro (contiene alguna clave del registro)
    if (res.dolor_eva !== undefined || res.estado_animo !== undefined || res.created_at || res.id) {
      return res;
    }
    
    return null;
  };

  if (loading) {
    return (
      <View style={[styles.card, { justifyContent: 'center', height: 100 }]}>
        <ActivityIndicator size="small" color={COLORS.gold} />
      </View>
    );
  }

  if (!cierre) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Estado del Último Relevo</Text>
        <Text style={styles.emptyText}>Sin registros de cierre de turno recientes.</Text>
      </View>
    );
  }

  // 🎯 PARSEO TOLERANTE DE CAMPOS REALES DE SUPABASE
  const dolorVal = cierre.dolor_eva ?? cierre.dolorEva ?? 0;
  
  // Ánimo
  const animoRaw = (cierre.estado_animo || cierre.estadoAnimo || cierre.estado_paciente || '').toString().toLowerCase().trim();
  const animoTexto = EMOJIS_ANIMO[animoRaw] || (animoRaw ? `😊 ${animoRaw.charAt(0).toUpperCase() + animoRaw.slice(1)}` : 'No especificado');

  // Hidratación
  const hidratacionVal = cierre.hidratacion_vasos ?? cierre.hidratacionVasos ?? cierre.hidratacion ?? 0;

  // Alimentación
  const alimentacionRaw = (cierre.alimentacion || '').toString().toLowerCase().trim();
  let alimentacionTexto = 'No especificada';
  if (alimentacionRaw === 'completa' || alimentacionRaw === 'bien' || alimentacionRaw === 'buena') {
    alimentacionTexto = '🍽️ Completa / Buena';
  } else if (alimentacionRaw === 'parcial' || alimentacionRaw === 'regular') {
    alimentacionTexto = '🥣 Parcial (25-75%)';
  } else if (alimentacionRaw === 'ninguna' || alimentacionRaw === 'mala' || alimentacionRaw === 'nula') {
    alimentacionTexto = '❌ Nula (<25%)';
  } else if (alimentacionRaw) {
    alimentacionTexto = `🥣 ${alimentacionRaw}`;
  }

  // Semáforo de Dolor EVA
  let dolorBg = COLORS.greenPale;
  let dolorColor = COLORS.green;
  let dolorLabel = 'Leve/Sin dolor';

  if (dolorVal >= 4 && dolorVal <= 6) {
    dolorBg = COLORS.amberPale;
    dolorColor = COLORS.amber;
    dolorLabel = 'Moderado';
  } else if (dolorVal >= 7) {
    dolorBg = COLORS.redPale;
    dolorColor = COLORS.red;
    dolorLabel = 'Severo';
  }

  return (
  <View style={styles.card}>
    <View style={styles.headerRow}>
      
      {/* 📊 Título + 👤 Nombre del Cuidador/Especialista */}
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>📊 Estado del Último Relevo</Text>
        
        {/* Muestra quién envió el reporte con fallbacks de nombre */}
        {(cierre.cuidador_nombre || cierre.usuario_nombre || cierre.cuidador) && (
          <Text style={{ fontSize: 11, color: '#8A8078', fontWeight: '600', marginTop: 2 }}>
            Por: {cierre.cuidador_nombre || cierre.usuario_nombre || cierre.cuidador}
          </Text>
        )}
      </View>

      {/* 📅 Fecha y 🕒 Hora Exacta del Cierre */}
      {(cierre.created_at || cierre.fecha) && (
        <View style={{ alignItems: 'flex-end' }}>
          {/* Badge de Fecha */}
          <Text style={styles.fechaBadge}>
            {new Date(cierre.created_at || cierre.fecha).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short'
            })}
          </Text>

          {/* Hora formateada a 12 horas (ej. 03:15 p.m.) */}
          <Text style={{ fontSize: 10, color: '#8A8078', fontWeight: '700', marginTop: 3 }}>
            🕒 {new Date(cierre.created_at || cierre.fecha).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}
          </Text>
        </View>
      )}

    </View>

      <View style={styles.grid}>
        {/* 🔴 DOLOR EVA */}
        <View style={[styles.pill, { backgroundColor: dolorBg, borderColor: dolorColor }]}>
          <Text style={styles.pillLabel}>Intensidad Dolor (EVA)</Text>
          <Text style={[styles.pillValue, { color: dolorColor }]}>
            {`${dolorVal}/10 (${dolorLabel})`}
          </Text>
        </View>

        {/* 🧠 ESTADO DE ÁNIMO */}
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Ánimo / Conducta</Text>
          <Text style={styles.pillValue}>{animoTexto}</Text>
        </View>

        {/* 💧 HIDRATACIÓN */}
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Hidratación</Text>
          <Text style={styles.pillValue}>
            {`💧 ${hidratacionVal} de 8 vasos (${hidratacionVal * 250} ml)`}
          </Text>
        </View>

        {/* 🥗 ALIMENTACIÓN */}
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>Ingesta Nutricional</Text>
          <Text style={styles.pillValue}>{alimentacionTexto}</Text>
        </View>
      </View>

      {/* 📝 NOTAS DE OBSERVACIÓN */}
      {(cierre.notas || cierre.observaciones) && (
        <View style={styles.notasBox}>
          <Text style={styles.notasTitle}>📝 Observaciones del Cuidador:</Text>
          <Text style={styles.notasText}>{cierre.notas || cierre.observaciones}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // ── 1. TARJETA CONTENEDORA PRINCIPAL ──
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // ── 2. CABECERA Y BADGE DE FECHA ──
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.cacao,
    textTransform: 'uppercase',
    letterSpacing: 0.5 
  },
  fechaBadge: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: COLORS.gold, 
    backgroundColor: COLORS.goldPale, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 10 
  },

  // ── 3. REJILLA Y PILLS DE REGISTRO ──
  grid: { 
    gap: 8 
  },
  pill: { 
    backgroundColor: COLORS.cream, 
    borderRadius: 10, 
    padding: 10, 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  pillLabel: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: COLORS.textLight, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  pillValue: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.textDark, 
    marginTop: 2 
  },

  // ── 4. NOTAS Y ESTADOS VACÍOS ──
  notasBox: { 
    marginTop: 10, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border 
  },
  notasTitle: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: COLORS.textLight, 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4 
  },
  notasText: { 
    fontSize: 12, 
    color: COLORS.textDark, 
    lineHeight: 16,
    fontWeight: '600' 
  },
  emptyText: { 
    fontSize: 12, 
    color: COLORS.textLight, 
    marginTop: 6,
    fontWeight: '600' 
  },
});