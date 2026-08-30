import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getHistorialCierres } from '../../services/api';

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078', border: '#E0D8CC',
  green: '#2E7D32', greenPale: '#EAF5E8', amber: '#D4860A', amberPale: '#FFF4E0',
  red: '#D94F4F', redPale: '#FDEAEA'
};

interface AlertaTamizaje {
  id: string;
  nivel: 'RED' | 'AMBER';
  titulo: string;
  mensaje: string;
  escala: string;
}

interface Props {
  pacienteId: string;
}

export const BannerAlertasPreventivas: React.FC<Props> = ({ pacienteId }) => {
  const [alertas, setAlertas] = useState<AlertaTamizaje[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (pacienteId) {
      analizarHistorial();
    }
  }, [pacienteId]);

  const analizarHistorial = async () => {
    try {
      setLoading(true);
      const res = await getHistorialCierres(pacienteId);
      
      // 🎯 Prioridad 1: turnos_tamizaje (turnos puros individuales sin autocierres)
      // 🎯 Prioridad 2: array directo o res.cierres como fallback
      const historial = res?.turnos_tamizaje || (Array.isArray(res) ? res : res?.cierres || []);

      if (historial.length > 0) {
        const resultadoAlertas = evaluarPatronesPreventivos(historial);
        setAlertas(resultadoAlertas);
      } else {
        setAlertas([]);
      }
    } catch (error) {
      console.error('Error al analizar historial de cierres:', error);
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 MOTOR DE REGLAS DE TAMIZAJE CLÍNICO
  const evaluarPatronesPreventivos = (historial: any[]): AlertaTamizaje[] => {
    const hallazgos: AlertaTamizaje[] = [];
    
    // Tomamos los cierres más recientes (hasta los últimos 7 turnos)
    const ultimosTurnos = historial.slice(0, 7);

    // 1. 🔴 DOLOR PERSISTENTE (Escala EVA)
    const turnosConDolorModeradoOAlto = ultimosTurnos.filter(
      t => t.dolor_eva !== null && t.dolor_eva >= 4
    );

    if (turnosConDolorModeradoOAlto.length >= 2) {
      const hayDolorSevero = turnosConDolorModeradoOAlto.some(t => t.dolor_eva >= 7);
      hallazgos.push({
        id: 'alerta_dolor',
        nivel: hayDolorSevero ? 'RED' : 'AMBER',
        titulo: hayDolorSevero ? '🚨 Dolor Severo Recurrente' : '⚠️ Molestia / Dolor Persistente',
        mensaje: `Se han registrado ${turnosConDolorModeradoOAlto.length} turnos recientes con intensidad de dolor EVA ≥ 4. Se sugiere evaluar la efectividad del esquema analgésico actual.`,
        escala: 'Escala Visual Analógica (EVA)'
      });
    }

    // 2. 🧠 FLUCTUACIÓN CONDUCTUAL / DELIRIUM (Criterios CAM / NPI-Q)
    const turnosAgitadoOConfuso = ultimosTurnos.filter(
      t => t.estado_animo?.toLowerCase() === 'confundido' || t.estado_animo?.toLowerCase() === 'agitado'
    );

    if (turnosAgitadoOConfuso.length >= 2) {
      hallazgos.push({
        id: 'alerta_conducta',
        nivel: 'RED',
        titulo: '⚡ Fluctulación Psicoconductual Detectada',
        mensaje: `Inestabilidad o confusión recurrente en los últimos cierres. Estos cambios suelen asociarse a estados confusionales agudos o malestar físico no expresado.`,
        escala: 'Criterios CAM / Cuestionario NPI-Q'
      });
    }

    // 3. 💧 RIESGO DE DESHIDRATACIÓN (Guías ESPEN Geriatría)
    const turnosBajaHidratacion = ultimosTurnos.filter(
      t => t.hidratacion_vasos !== null && t.hidratacion_vasos < 4
    );

    if (turnosBajaHidratacion.length >= 2) {
      hallazgos.push({
        id: 'alerta_hidratacion',
        nivel: 'AMBER',
        titulo: '💧 Bajo Aporte Hídrico',
        mensaje: `Consumo inferior a 4 vasos (1.0 L) en múltiples turnos. Se recomienda promover la ingesta constante de líquidos para prevenir estreñimiento, hipotensión u oligosintomatología renal.`,
        escala: 'Guías de Nutrición e Hidratación ESPEN'
      });
    }

    // 4. 🥗 RIESGO NUTRICIONAL (Mini Nutritional Assessment - MNA)
    if (ultimosTurnos.length > 0) {
      // A) EVALUACIÓN DEL TURNO MÁS RECIENTE (Actualidad)
      const ultimoCierre = ultimosTurnos[0];
      const valUltimo = ultimoCierre.alimentacion ? String(ultimoCierre.alimentacion).toLowerCase().trim() : '';
      
      const esUltimaIngestaNula = valUltimo === 'ninguna' || valUltimo === 'nula';

      // B) EVALUACIÓN DE TENDENCIA (Últimos 7 turnos)
      const turnosIncompletos = ultimosTurnos.filter(t => {
        if (!t.alimentacion) return false;
        const val = String(t.alimentacion).toLowerCase().trim();
        return val === 'parcial' || val === 'ninguna' || val === 'nula';
      });

      // 🎯 CONDICIONES PARA DISPARAR LA ALERTA:
      // 1. Si el ÚLTIMO turno registrado fue nulo -> Alerta Roja (RED)
      if (esUltimaIngestaNula) {
        hallazgos.push({
          id: 'alerta_alimentacion',
          nivel: 'RED',
          titulo: '🚨 Ingesta Nutricional Nula Registrada',
          mensaje: 'Se ha registrado reporte de ingesta nula de alimentos en el cierre más reciente. Conviene verificar causas como disfagia, náuseas o inapetencia.',
          escala: 'Mini Nutritional Assessment (MNA)'
        });
      
      // 2. Si el último turno comió, pero acumula 3+ turnos con ingesta parcial -> Alerta Ámbar (AMBER)
      } else if (turnosIncompletos.length >= 3) {
        hallazgos.push({
          id: 'alerta_alimentacion',
          nivel: 'AMBER',
          titulo: '🥗 Ingesta Nutricional Incompleta Persistente',
          mensaje: `Se reportan ${turnosIncompletos.length} turnos recientes con ingesta parcial o insuficiente. Se sugiere monitorear la aceptación de la dieta.`,
          escala: 'Mini Nutritional Assessment (MNA)'
        });
      }
    }

    return hallazgos;
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={COLORS.gold} />
        <Text style={styles.loaderText}>Analizando tendencias del paciente...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* SI HAY ALERTAS DETECTADAS */}
      {alertas.length > 0 ? (
        <View style={styles.alertasBox}>
          <Text style={styles.sectionHeaderTitle}>🛡️ Tamizaje de Tendencias Preventivas</Text>
          
          {alertas.map(item => {
            const esRojo = item.nivel === 'RED';
            const bg = esRojo ? COLORS.redPale : COLORS.amberPale;
            const border = esRojo ? COLORS.red : COLORS.amber;
            const textColor = esRojo ? COLORS.red : COLORS.amber;

            return (
              <View key={item.id} style={[styles.alertaCard, { backgroundColor: bg, borderColor: border }]}>
                <Text style={[styles.alertaTitulo, { color: textColor }]}>{item.titulo}</Text>
                <Text style={styles.alertaMensaje}>{item.mensaje}</Text>
                <Text style={styles.alertaEscala}>Base de observación: {item.escala}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        /* SI TODO ESTÁ DENTRO DE PARÁMETROS NORMALES */
        <View style={styles.cardNormal}>
          <Text style={styles.normalTitulo}>🟢 Sin Patrones de Riesgo Detectados</Text>
          <Text style={styles.normalText}>
            Las tendencias de dolor, conducta, hidratación y nutrición se mantienen dentro de márgenes estables en los cierres recientes.
          </Text>
        </View>
      )}

      {/* 📜 DISCLAIMER MÉDICO LEGAL OBLIGATORIO */}
      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerTitle}>📜 Aviso de Tamizaje y Soporte a la Decisión (CDS):</Text>
        <Text style={styles.disclaimerText}>
          Las mediciones y tendencias reflejadas en este módulo son recopiladas por el personal de cuidado como herramientas de observación continua continuada (basadas en estándares de apoyo como EVA, CAM, ESPEN y MNA). Este software no emite diagnósticos médicos ni reemplaza la valoración presencial de un profesional de la salud.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── 1. CONTENEDOR PRINCIPAL Y ESTADOS DE CARGA ──
  container: {
    marginVertical: 10,
  },
  loaderContainer: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  // ── 2. TÍTULOS Y REJILLA DE ALERTAS ──
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.cacao,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertasBox: {
    gap: 8,
    marginBottom: 10,
  },
  alertaCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  alertaTitulo: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  alertaMensaje: {
    fontSize: 12,
    color: COLORS.textDark,
    lineHeight: 16,
    marginBottom: 6,
    fontWeight: '600',
  },
  alertaEscala: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
    fontStyle: 'italic',
  },

  // ── 3. TARJETA DE ESTADO NORMAL (VERDE INSTITUCIONAL) ──
  cardNormal: {
    backgroundColor: COLORS.greenPale,
    borderColor: COLORS.green + '40',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  normalTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.green,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  normalText: {
    fontSize: 11,
    color: COLORS.textDark,
    lineHeight: 15,
    fontWeight: '600',
  },

  // ── 4. NOTA Y DISCLAIMER CLÍNICO ──
  disclaimerBox: {
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  disclaimerTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disclaimerText: {
    fontSize: 10,
    color: COLORS.textLight,
    lineHeight: 14,
    fontWeight: '500',
  },
});