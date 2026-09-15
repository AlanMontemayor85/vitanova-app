const { documentDirectory, downloadAsync } = require('expo-file-system/legacy');
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSignosVitalesHistorico, loadStoredToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';
const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;
const CHART_HEIGHT = 120;

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  red: '#D94F4F',
  redPale: '#FDEAEA',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  blue: '#2563EB',
  bluePale: '#EFF6FF',
};

// ── UTILIDADES DE PARSEO CLÍNICO ──
function TensorParseFloat(val: any): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (!val || val === '—') return null;
  const num = parseFloat(
    String(val)
      .replace('°C', '')
      .replace('°', '')
      .replace('mg/dL', '')
      .replace('mg', '')
      .replace('bpm', '')
      .replace('%', '')
      .trim()
  );
  return Number.isFinite(num) ? num : null;
}

function leerTemperatura(r: any): number | null {
  const raw = r?.temperatura ?? r?.temperatura_corporal ?? r?.temp;
  if (raw === null || raw === undefined || raw === '—') return null;
  const num = TensorParseFloat(raw);
  return num !== null && num >= 30 && num <= 45 ? num : null;
}

function leerGlucosa(r: any): number | null {
  const raw = r?.glucosa ?? r?.glucosa_mg ?? r?.glicemia ?? r?.glucose;
  if (raw === null || raw === undefined || raw === '—') return null;
  const num = TensorParseFloat(raw);
  return num !== null && num >= 30 && num <= 600 ? Math.round(num) : null;
}

// ── COMPONENTE DE MINIGRÁFICA TENSORIAL ──
function MiniChart({
  datos,
  color,
  min,
  max,
  unidad,
  alerta,
  fechas,
}: {
  datos: number[];
  color: string;
  min: number;
  max: number;
  unidad: string;
  alerta?: number;
  fechas?: string[];
}) {
  if (!datos || datos.length < 2) {
    return (
      <View style={styles.chartEmptyBox}>
        <Text style={styles.chartEmptyText}>
          Esperando datos suficientes para graficar tendencia...
        </Text>
      </View>
    );
  }

  const rango = max - min || 1;
  const puntos = datos.map((v, i) => ({
    x: (i / (datos.length - 1)) * CHART_WIDTH,
    y: CHART_HEIGHT - ((v - min) / rango) * CHART_HEIGHT,
    v,
  }));

  const ultimo = datos[datos.length - 1];
  const anterior = datos[datos.length - 2];
  const tendencia = ultimo > anterior ? '↑' : ultimo < anterior ? '↓' : '→';
  const enAlerta = alerta ? (unidad === '%' ? ultimo < alerta : ultimo > alerta) : false;

  const fechaInicialStr =
    fechas && fechas[0]
      ? new Date(fechas[0]).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Inicio';

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: enAlerta ? COLORS.red : color }}>
          {ultimo}
          {unidad}
        </Text>
        <Text style={{ fontSize: 18, color: enAlerta ? COLORS.red : COLORS.textLight }}>
          {tendencia}
        </Text>
      </View>

      <View style={styles.canvasContainer}>
        {alerta && (
          <View
            style={[
              styles.alertThresholdLine,
              {
                top: Math.max(0, Math.min(CHART_HEIGHT, CHART_HEIGHT - ((alerta - min) / rango) * CHART_HEIGHT)),
              },
            ]}
          />
        )}

        {puntos.map((p, i) => (
          <View key={i}>
            {i > 0 &&
              (() => {
                const prev = puntos[i - 1];
                const dx = p.x - prev.x;
                const dy = p.y - prev.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                return (
                  <View
                    style={{
                      position: 'absolute',
                      left: prev.x,
                      top: prev.y,
                      width: len,
                      height: 1.5,
                      backgroundColor: color,
                      opacity: 0.8,
                      transform: [{ rotate: `${angle}deg` }],
                      transformOrigin: '0 0',
                    }}
                  />
                );
              })()}

            <View
              style={{
                position: 'absolute',
                left: p.x - 2.5,
                top: p.y - 2.5,
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: i === puntos.length - 1 ? color : COLORS.white,
                borderWidth: 1.2,
                borderColor: color,
                zIndex: 2,
              }}
            />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 9, color: COLORS.textLight }}>{fechaInicialStr}</Text>
        <Text style={{ fontSize: 9, color: COLORS.textLight }}>Último registro</Text>
      </View>
    </View>
  );
}

// ── PANTALLA PRINCIPAL ──
export default function GraficaSignosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pacienteId = params.pacienteId as string;
  const pacienteNombre = params.pacienteNombre as string;

  const [registros, setRegistros] = useState<any[]>([]);
  const [registrosTemp, setRegistrosTemp] = useState<any[]>([]);
  const [pesoData, setPesoData] = useState<number[]>([]);
  const [pesoFechas, setPesoFechas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoFiltro, setPeriodoFiltro] = useState<'todos' | 'hoy' | 'semana'>('todos');

  const handleExportarCSV = async () => {
    try {
      const url = `${BASE_URL}/pacientes/${pacienteId}/exportar-bitacora-analitica`;
      const nombreLimpio = (pacienteNombre || pacienteId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetPath = `${documentDirectory}auditoria_clinica_${nombreLimpio}.csv`;

      const token = await loadStoredToken();
      if (!token) {
        Alert.alert('Sesión Expirada', 'Inicia sesión nuevamente.');
        return;
      }

      const downloadResult = await downloadAsync(url, targetPath, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/csv',
        },
      });

      if (downloadResult.status === 403) {
        Alert.alert(
          '🔒 Exportación Restringida',
          'No cuentas con autorización activa del Administrador Familiar para exportar este expediente.'
        );
        return;
      }

      if (downloadResult.status === 404) {
        Alert.alert('Sin Registros', 'No hay muestras suficientes para generar la bitácora.');
        return;
      }

      if (downloadResult.status !== 200) {
        Alert.alert('Aviso', `El servidor no pudo procesar la solicitud (${downloadResult.status}).`);
        return;
      }

      const puedeCompartir = await Sharing.isAvailableAsync();
      if (puedeCompartir) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Reporte de Auditoría Analítica — Vitanova',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Descarga Completa', 'El archivo se guardó localmente en el dispositivo.');
      }
    } catch (error: any) {
      console.log('⚠️ Excepción al exportar:', error);
      Alert.alert('Error de Conexión', 'No se pudo establecer comunicación con el servidor.');
    }
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getSignosVitalesHistorico(pacienteId, 14);
        if (data.registros) setRegistros(data.registros);
        if (data.registros_temperatura) setRegistrosTemp(data.registros_temperatura);
        if (data.registros_peso) {
          setPesoData(data.registros_peso.map((r: any) => r.peso_kg));
          setPesoFechas(data.registros_peso.map((r: any) => r.created_at));
        }
      } catch (e) {
        console.error('Error cargando histórico clínico:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteId]);

  // 🛡️ Filtro estricto: descartar clones de inicio de turno
const registrosConSignosReales = registros.filter((r) => {
  // Descartar registros automáticos del sistema que duplican el inicio de turno sin toma completa
  const esAutoInicio = r.origen === 'inicio_turno' || r.metodo === 'sistema_inicio';
  if (esAutoInicio && !r.frecuencia_cardiaca && !r.spo2) return false;

  const tieneSpo2 = typeof r.spo2 === 'number' && r.spo2 > 0;
  const tieneFc = typeof r.frecuencia_cardiaca === 'number' && r.frecuencia_cardiaca > 0;
  const tieneTemp = leerTemperatura(r) !== null;
  const tieneGlu = leerGlucosa(r) !== null;
  const tienePresion = Boolean(r.presion_sistolica && r.presion_diastolica);

  // Regla de integridad: si solo trae presión y peso pero nada más (el clásico clon), descartar
  const soloPresionYPeso = tienePresion && !tieneSpo2 && !tieneFc && !tieneTemp && !tieneGlu;
  if (soloPresionYPeso && r.fuente === 'cuidador') return false;

  return tieneSpo2 || tieneFc || tieneTemp || tieneGlu || tienePresion;
});

  // 2. Filtrado por periodo para la BITÁCORA (Más reciente arriba)
  const registrosBitacoraFiltrados = registrosConSignosReales.filter((r) => {
    if (periodoFiltro === 'todos') return true;
    const fechaRegistro = new Date(r.created_at);
    const ahora = new Date();
    if (periodoFiltro === 'hoy') return fechaRegistro.toDateString() === ahora.toDateString();
    if (periodoFiltro === 'semana') {
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(ahora.getDate() - 7);
      return fechaRegistro >= haceUnaSemana;
    }
    return true;
  });

  // 3. Inversión Cronológica para las GRÁFICAS (Pasado ➔ Presente)
  const registrosGraficas = [...registrosBitacoraFiltrados].reverse();

  // SpO2
  const registrosSpo2 = registrosGraficas.filter((r) => r.spo2 !== null && r.spo2 > 0);
  const spo2Data = registrosSpo2.map((r) => r.spo2);
  const spo2Fechas = registrosSpo2.map((r) => r.created_at);

  // Presión Arterial
  const registrosPresion = registrosGraficas.filter((r) => r.presion_sistolica && r.presion_diastolica);
  const sstolicaData = registrosPresion.map((r) => Math.round(r.presion_sistolica));
  const dstolicaData = registrosPresion.map((r) => Math.round(r.presion_diastolica));
  const presionFechas = registrosPresion.map((r) => r.created_at);

  // Frecuencia Cardíaca
  const registrosFc = registrosGraficas.filter((r) => r.frecuencia_cardiaca !== null && r.frecuencia_cardiaca > 0);
  const fcData = registrosFc.map((r) => r.frecuencia_cardiaca);
  const fcFechas = registrosFc.map((r) => r.created_at);

  // Temperatura
  const registrosTempValidos = [...registrosTemp].reverse().filter((r) => leerTemperatura(r) !== null);
  const temperaturaData = registrosTempValidos.map((r) => leerTemperatura(r) as number);
  const tempFechas = registrosTempValidos.map((r) => r.created_at);

  // 🩸 Glucosa Capilar
  const registrosGluValidos = registrosGraficas.filter((r) => leerGlucosa(r) !== null);
  const glucosaData = registrosGluValidos.map((r) => leerGlucosa(r) as number);
  const glucosaFechas = registrosGluValidos.map((r) => r.created_at);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Historial Clínico</Text>
          <Text style={styles.userName} numberOfLines={1}>{pacienteNombre}</Text>
        </View>
        <View style={styles.periodoPill}>
          <Text style={styles.periodoText}>Tendencias 24h</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {registrosConSignosReales.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
            <Text style={styles.emptyTitle}>Sin registros clínicos confirmados</Text>
            <Text style={styles.emptySub}>
              Las tomas de teleasistencia o registros manuales con signos vitales aparecerán aquí.
            </Text>
          </View>
        ) : (
          <>
            {/* GRÁFICA SPO2 */}
            {spo2Data.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Saturación de Oxígeno (SpO₂)</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.goldPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.gold }]}>Alerta: 92%</Text>
                  </View>
                </View>
                <MiniChart
                  datos={spo2Data}
                  fechas={spo2Fechas}
                  color={COLORS.gold}
                  min={Math.min(...spo2Data) - 1 < 88 ? Math.min(...spo2Data) - 1 : 88}
                  max={100}
                  unidad="%"
                  alerta={92}
                />
                {spo2Data[spo2Data.length - 1] < 92 && (
                  <View style={[styles.alertaBanner, { backgroundColor: COLORS.redPale }]}>
                    <Text style={styles.alertaBannerText}>
                      ⚠️ SpO₂ bajo detectado en la última consolidación.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* GRÁFICA PRESIÓN ARTERIAL */}
            {sstolicaData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Presión Arterial</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.greenPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.green }]}>Tendencia Hemodinámica</Text>
                  </View>
                </View>
                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={styles.chartSubtitle}>Sistólica</Text>
                    <MiniChart
                      datos={sstolicaData}
                      fechas={presionFechas}
                      color={COLORS.red}
                      min={Math.min(...sstolicaData) - 5}
                      max={Math.max(...sstolicaData) + 5}
                      unidad=" mmHg"
                      alerta={140}
                    />
                  </View>
                  <View>
                    <Text style={styles.chartSubtitle}>Diastólica</Text>
                    <MiniChart
                      datos={dstolicaData}
                      fechas={presionFechas}
                      color={COLORS.amber}
                      min={Math.min(...dstolicaData) - 5}
                      max={Math.max(...dstolicaData) + 5}
                      unidad=" mmHg"
                      alerta={90}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* GRÁFICA FRECUENCIA CARDÍACA */}
            {fcData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Frecuencia Cardíaca (Pulso)</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.redPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.red }]}>Alerta: 100 bpm</Text>
                  </View>
                </View>
                <MiniChart
                  datos={fcData}
                  fechas={fcFechas}
                  color={COLORS.red}
                  min={Math.min(...fcData) - 10 < 50 ? Math.min(...fcData) - 10 : 50}
                  max={Math.max(...fcData) + 10 > 120 ? Math.max(...fcData) + 10 : 120}
                  unidad=" bpm"
                  alerta={100}
                />
              </View>
            )}

            {/* GRÁFICA GLUCOSA CAPILAR */}
            {glucosaData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Glucosa Capilar</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.bluePale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.blue }]}>Postprandial: &lt;140</Text>
                  </View>
                </View>
                <MiniChart
                  datos={glucosaData}
                  fechas={glucosaFechas}
                  color={COLORS.blue}
                  min={Math.min(...glucosaData) - 15 < 60 ? Math.min(...glucosaData) - 15 : 60}
                  max={Math.max(...glucosaData) + 20 > 180 ? Math.max(...glucosaData) + 20 : 180}
                  unidad=" mg/dL"
                  alerta={140}
                />
                {glucosaData[glucosaData.length - 1] > 140 && (
                  <View style={[styles.alertaBanner, { backgroundColor: COLORS.amberPale }]}>
                    <Text style={[styles.alertaBannerText, { color: COLORS.amber }]}>
                      ⚠️ Valor de glucemia elevado respecto al umbral basal.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* GRÁFICA TEMPERATURA CORPORAL */}
            {temperaturaData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Temperatura Corporal</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.amberPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.amber }]}>Umbral Febril: 37.8°</Text>
                  </View>
                </View>
                <MiniChart
                  datos={temperaturaData}
                  fechas={tempFechas}
                  color={COLORS.amber}
                  min={Math.min(...temperaturaData) - 0.3}
                  max={Math.max(...temperaturaData) + 0.3 > 38.5 ? Math.max(...temperaturaData) + 0.3 : 38.5}
                  unidad="°C"
                  alerta={37.8}
                />
                <Text style={styles.chartNote}>
                  ⏱️ Medición de grado clínico sincronizada por eventos.
                </Text>
              </View>
            )}

            {/* GRÁFICA PESO */}
            {pesoData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Evolución de Peso</Text>
                </View>
                <MiniChart
                  datos={pesoData}
                  fechas={pesoFechas}
                  color={COLORS.cacao}
                  min={Math.min(...pesoData) - 2}
                  max={Math.max(...pesoData) + 2}
                  unidad=" kg"
                />
              </View>
            )}

            {/* BITÁCORA GENERAL DE MONITOREO */}
            <View style={styles.chartCard}>
              <View style={styles.bitacoraHeaderRow}>
                <Text style={styles.chartTitle}>Bitácora de Monitoreo General</Text>

                {/* Filtro de periodos */}
                <View style={styles.filterPillsContainer}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'semana', label: '7 Días' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.7}
                      onPress={() => setPeriodoFiltro(p.id as any)}
                      style={[
                        styles.filterPill,
                        { backgroundColor: periodoFiltro === p.id ? COLORS.gold : 'transparent' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: periodoFiltro === p.id ? COLORS.white : COLORS.textLight },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botón Exportar CSV */}
              <TouchableOpacity
                onPress={handleExportarCSV}
                activeOpacity={0.8}
                style={styles.exportBtn}
              >
                <Text style={{ fontSize: 13 }}>📥</Text>
                <Text style={styles.exportBtnText}>Exportar Bitácora (Excel/CSV)</Text>
              </TouchableOpacity>

              {/* ENCABEZADOS DE COLUMNA */}
<View style={styles.tableHeaderRow}>
  <View style={styles.colFecha}>
    <Text style={styles.tableHeadColLeft}>Fecha/Hora</Text>
  </View>
  <View style={styles.colMetric}><Text style={styles.tableHeadCol}>SpO₂</Text></View>
  <View style={styles.colPresion}><Text style={styles.tableHeadCol}>P. Art</Text></View>
  <View style={styles.colMetric}><Text style={styles.tableHeadCol}>FC</Text></View>
  <View style={styles.colMetric}><Text style={styles.tableHeadCol}>Temp</Text></View>
  <View style={styles.colMetric}><Text style={styles.tableHeadCol}>Glu</Text></View>
  <View style={styles.colMetric}><Text style={styles.tableHeadCol}>Peso</Text></View>
</View>

{/* CUERPO DE LA TABLA */}
<View style={{ marginTop: 2 }}>
  {registrosBitacoraFiltrados.length === 0 ? (
    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' }}>
        No hay registros clínicos en el periodo seleccionado.
      </Text>
    </View>
  ) : (
    registrosBitacoraFiltrados.map((r, i) => {
      const temp = leerTemperatura(r);
      const glu = leerGlucosa(r);
      const esReloj = r.fuente === 'reloj';
      const esManual = r.fuente === 'manual';
      const esCuidador = r.fuente === 'cuidador';
      const nombreOperador = (
        r.nombre_cuidador ||
        r.usuarios?.nombre_completo ||
        'Personal'
      ).split(' ')[0];

      return (
        <View key={r.id || i} style={styles.tableRow}>
          {/* 1. Fecha y Operador */}
          <View style={styles.colFecha}>
            <Text style={styles.historialFecha}>
              {new Date(r.created_at).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.historialCuidador,
                !esReloj && {
                  color: esManual ? COLORS.amber : COLORS.green,
                  fontWeight: '700',
                },
              ]}
            >
              {esCuidador
                ? `👤 ${nombreOperador}`
                : esManual
                ? `🩺 ${nombreOperador}`
                : '⌚ Reloj'}
            </Text>
          </View>

          {/* 2. SpO2 */}
          <View style={styles.colMetric}>
            <Text style={[styles.historialVal, !r.spo2 && styles.valVacio]}>
              {r.spo2 ? `${r.spo2}%` : '—'}
            </Text>
          </View>

          {/* 3. Presión Arterial */}
          <View style={styles.colPresion}>
            <Text style={[styles.historialVal, !(r.presion_sistolica && r.presion_diastolica) && styles.valVacio]}>
              {r.presion_sistolica && r.presion_diastolica
                ? `${Math.round(r.presion_sistolica)}/${Math.round(r.presion_diastolica)}`
                : '—'}
            </Text>
          </View>

          {/* 4. FC */}
          <View style={styles.colMetric}>
            <Text style={[styles.historialVal, !r.frecuencia_cardiaca && styles.valVacio]}>
              {r.frecuencia_cardiaca ? `${r.frecuencia_cardiaca}` : '—'}
            </Text>
          </View>

          {/* 5. Temperatura */}
          <View style={styles.colMetric}>
            <Text style={[styles.historialVal, temp === null && styles.valVacio]}>
              {temp !== null ? `${temp.toFixed(1)}°` : '—'}
            </Text>
          </View>

          {/* 6. Glucosa */}
          <View style={styles.colMetric}>
            <Text
              style={[
                styles.historialVal,
                glu === null && styles.valVacio,
                glu !== null && glu > 140 && { color: COLORS.red, fontWeight: '800' },
              ]}
            >
              {glu !== null ? `${glu}` : '—'}
            </Text>
          </View>

          {/* 7. Peso */}
          <View style={styles.colMetric}>
            <Text style={[styles.historialVal, !r.peso_kg && styles.valVacio]}>
              {r.peso_kg ? `${r.peso_kg}k` : '—'}
            </Text>
          </View>
        </View>
      );
    })
  )}
</View>

              <Text style={styles.footerNote}>
                * Valores consolidados por eventos telemétricos y capturas clínicas del personal asistencial.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
// ── ESTILOS COMPATIBLES CON PALETA CORPORATIVA ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
  },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38)
        : 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backIcon: {
    fontSize: 18,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.gold,
    marginBottom: 2,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },
  periodoPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  periodoText: {
    fontSize: 9,
    color: COLORS.gold,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 17,
  },
  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1.5,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.cacao,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chartBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chartBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  chartEmptyBox: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartEmptyText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  canvasContainer: {
    height: CHART_HEIGHT,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  alertThresholdLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.red,
    opacity: 0.35,
    zIndex: 1,
  },
  alertaBanner: {
    borderRadius: 8,
    padding: 9,
    marginTop: 10,
  },
  alertaBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
  },
  chartNote: {
    fontSize: 9.5,
    color: COLORS.textLight,
    marginTop: 8,
    fontStyle: 'italic',
  },
  bitacoraHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cream,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  exportBtn: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
    width: '100%',
  },
  exportBtnText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
  },

  // ── CABECERA Y FILAS DE LA TABLA ──
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D8',
    paddingBottom: 7,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3EF',
  },

  // ── COLUMNAS CON CELDAS INDIVIDUALES ──
  colFecha: {
    flex: 2.8,
    paddingRight: 2,
  },
  colPresion: {
    flex: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colMetric: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── TEXTOS DE TABLA ──
  tableHeadColLeft: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#948B80',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableHeadCol: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#948B80',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  historialFecha: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  historialCuidador: {
    fontSize: 9,
    color: COLORS.textLight,
    marginTop: 1,
    fontWeight: '600',
  },
  historialVal: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  valVacio: {
    color: '#CBD5E1',
    fontWeight: '400',
  },
  footerNote: {
    fontSize: 9,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 2,
    lineHeight: 12,
  },
});