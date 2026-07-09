const { documentDirectory, downloadAsync } = require('expo-file-system/legacy');
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSignosVitalesHistorico, loadStoredToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';
const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;
const CHART_HEIGHT = 120;

const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', greenPale: '#EAF5E8',
  red: '#D94F4F', redPale: '#FDEAEA', amber: '#D4860A',
  amberPale: '#FFF4E0'
};

// 🟢 Helper ultra robusto para leer la temperatura de cualquier origen de datos (Cierres o Registros de Salud)
function leerTemperatura(r: any): number | null {
  // Evaluamos todas las llaves posibles que el backend de FastAPI o Supabase puedan escupir
  const raw = r?.temperatura ?? r?.temperatura_corporal ?? r?.temp;
  if (raw === null || raw === undefined || raw === '—') return null;
  
  const num = TensorParseFloat(raw);
  return num !== null && num >= 30 && num <= 45 ? num : null;
}

// Auxiliar para limpiar y parsear strings con caracteres médicos (°C, °)
function TensorParseFloat(val: any): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const num = parseFloat(String(val).replace('°C', '').replace('°', '').trim());
  return Number.isFinite(num) ? num : null;
}

function MiniChart({
  datos, color, min, max, unidad, alerta, fechas
}: {
  datos: number[], color: string, min: number, max: number, unidad: string, alerta?: number, fechas?: string[]
}) {
  if (!datos || datos.length < 2) return (
    <View style={{ height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 8 }}>
      <Text style={{ color: COLORS.textLight, fontSize: 11, fontWeight: '600' }}>Esperando datos suficientes para graficar...</Text>
    </View>
  );

  const rango = max - min || 1;
  const puntos = datos.map((v, i) => ({
    x: (i / (datos.length - 1)) * CHART_WIDTH,
    y: CHART_HEIGHT - ((v - min) / rango) * CHART_HEIGHT,
    v,
  }));

  const ultimo = datos[datos.length - 1];
  const anterior = datos[datos.length - 2];
  const tendencia = ultimo > anterior ? '↑' : ultimo < anterior ? '↓' : '→';
  const enAlerta = alerta ? (unidad === "%" ? ultimo < alerta : ultimo > alerta) : false;

  const fechaInicialStr = fechas && fechas[0]
    ? new Date(fechas[0]).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    : 'Inicio';

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: enAlerta ? COLORS.red : color }}>
          {ultimo}{unidad}
        </Text>
        <Text style={{ fontSize: 18, color: enAlerta ? COLORS.red : COLORS.textLight }}>{tendencia}</Text>
      </View>
      
      <View style={{ height: CHART_HEIGHT, position: 'relative', backgroundColor: 'rgba(0,0,0,0.01)', borderRadius: 6, overflow: 'hidden' }}>
        {/* Línea de Alerta Médica */}
        {alerta && (
          <View style={{
            position: 'absolute',
            left: 0, right: 0,
            top: CHART_HEIGHT - ((alerta - min) / rango) * CHART_HEIGHT,
            height: 1,
            backgroundColor: COLORS.red,
            opacity: 0.3,
            zIndex: 1
          }} />
        )}

        {puntos.map((p, i) => (
          <View key={i}>
            {/* Renderizado de Línea Conectora */}
            {i > 0 && (() => {
              const prev = puntos[i - 1];
              const dx = p.x - prev.x;
              const dy = p.y - prev.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              return (
                <View style={{
                  position: 'absolute',
                  left: prev.x,
                  top: prev.y,
                  width: len,
                  height: 1.5, // 👑 Línea más delgada y estilizada de grado ejecutivo
                  backgroundColor: color,
                  opacity: 0.8,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: '0 0',
                }} />
              );
            })()}

            {/* 👑 NODOS MINIMALISTAS: Puntos ultra pequeños (4x4) para evitar plastas gruesas */}
            <View style={{
              position: 'absolute',
              left: p.x - 2,
              top: p.y - 2,
              width: 4, 
              height: 4,
              borderRadius: 2,
              backgroundColor: i === puntos.length - 1 ? color : COLORS.white,
              borderWidth: 1,
              borderColor: color,
              zIndex: 2
            }} />
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
      
      // Ahora se leen de la API de legado de Expo v54 de forma transparente
      const targetPath = `${documentDirectory}analitica_signos_${pacienteId}.csv`;
      const token = await loadStoredToken(); 
      
      if (!token) {
        Alert.alert("Sesión Expirada", "No se encontró un token válido. Por favor, inicia sesión nuevamente.");
        return;
      }

      console.log("📥 Descargando bitácora cifrada a:", targetPath);

      const downloadResult = await downloadAsync(url, targetPath, {
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Error en servidor. Código: ${downloadResult.status}`);
      }

      const puedeCompartir = await Sharing.isAvailableAsync();
      if (!puedeCompartir) {
        Alert.alert("Error", "Compartir archivos no está habilitado en este dispositivo.");
        return;
      }

      await Sharing.shareAsync(downloadResult.uri, { 
        mimeType: 'text/csv', 
        dialogTitle: 'Reporte de Auditoría Analítica — Vitanova' 
      });

    } catch (error) {
      console.error("❌ Error en el proceso de exportación:", error);
      Alert.alert("Falla de Descarga", "Hubo un problema al intentar conectarse al servidor de Railway.");
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
        console.error("Error cargando histórico clínico:", e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteId]);

  const registrosFiltrados = [...registros].reverse();

  const registrosSpo2 = registrosFiltrados.filter(r => r.spo2 !== null && r.spo2 !== undefined);
  const spo2Data = registrosSpo2.map(r => r.spo2);
  const spo2Fechas = registrosSpo2.map(r => r.created_at);

  const registrosPresion = registrosFiltrados.filter(r => r.presion_sistolica !== null && r.presion_diastolica !== null);
  const sstolicaData = registrosPresion.map(r => r.presion_sistolica);
  const dstolicaData = registrosPresion.map(r => r.presion_diastolica ?? 0);
  const presionFechas = registrosPresion.map(r => r.created_at);

  const registrosFc = registrosFiltrados.filter(r => r.frecuencia_cardiaca !== null && r.frecuencia_cardiaca !== undefined);
  const fcData = registrosFc.map(r => r.frecuencia_cardiaca);
  const fcFechas = registrosFc.map(r => r.created_at);

  const temperaturaData = registrosTemp.map(r => r.temperatura) as number[];
  const tempFechas = registrosTemp.map(r => r.created_at);

  const registrosBitacoraFiltrados = registros.filter(r => {
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Historial Clínico</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
        <View style={styles.periodoPill}>
          <Text style={styles.periodoText}>Últimos 14 registros</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {registros.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 }}>Sin registros aún</Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>Los signos vitales aparecerán aquí después de cerrar turnos o capturar telemetría.</Text>
          </View>
        ) : (
          <>
            {/* GRÁFICA SPO2 (ZOOM PARA DETECTAR CAÍDAS SUTILES) */}
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
                    <Text style={{ fontSize: 11, color: COLORS.red, fontWeight: '700' }}>
                      ⚠️ SpO₂ bajo detectado en el último informe.
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

            {/* 👑 GRÁFICA TEMPERATURA CORPORAL RE-CALIBRADA DE GRADO CLÍNICO */}
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
                  // 🎯 EL TRUCO DEL ZOOM: El eje Y se estira dinámicamente según las décimas reales del paciente
                  min={Math.min(...temperaturaData) - 0.3}
                  max={Math.max(...temperaturaData) + 0.3 > 38.5 ? Math.max(...temperaturaData) + 0.3 : 38.5}
                  unidad="°C"
                  alerta={37.8}
                />
                <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 8, fontStyle: 'italic' }}>
                  ⏱️ Temperatura medida bajo demanda cada ~30 min. Los valores intermedios no son interpolados.
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

            {/* TABLA HISTÓRICA COMPLETA DE REGISTROS (CON FILTROS DINÁMICOS) */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <Text style={styles.chartTitle}>Bitácora de Monitoreo General</Text>
                
                {/* Selector de Periodo Estilizado (Pills) */}
                <View style={{ flexDirection: 'row', backgroundColor: COLORS.cream, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: COLORS.border }}>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'semana', label: '7 Días' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setPeriodoFiltro(p.id as any)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: periodoFiltro === p.id ? COLORS.gold : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: periodoFiltro === p.id ? COLORS.white : COLORS.textLight }}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botón de Exportación Analítica */}
              <TouchableOpacity 
                onPress={handleExportarCSV}
                style={{
                  backgroundColor: COLORS.cream,
                  borderWidth: 1,
                  borderColor: COLORS.gold,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginBottom: 16,
                  width: '100%'
                }}
              >
                <Text style={{ fontSize: 12 }}>📥</Text>
                <Text style={{ color: COLORS.gold, fontSize: 11, fontWeight: '700' }}>
                  Exportar Excel
                </Text>
              </TouchableOpacity>

              {/* 👑 ENCABEZADOS DE COLUMNA */}
              <View style={{ 
                flexDirection: 'row', 
                borderBottomWidth: 1, 
                borderBottomColor: COLORS.border, 
                paddingBottom: 6, 
                marginBottom: 8 
              }}>
                <Text style={{ flex: 1.2, fontSize: 10, fontWeight: '700', color: COLORS.textLight }}>Fecha/Hora</Text>
                <Text style={{ flex: 0.8, fontSize: 10, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' }}>SpO₂</Text>
                <Text style={{ flex: 1.1, fontSize: 10, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' }}>Presión A.</Text>
                <Text style={{ flex: 0.7, fontSize: 10, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' }}>FC</Text>
                <Text style={{ flex: 0.8, fontSize: 10, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' }}>Temp</Text>
                <Text style={{ flex: 0.8, fontSize: 10, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' }}>Peso</Text>
              </View>

              {/* Cuerpo de la Tabla Dinámica */}
              <View style={{ marginTop: 4 }}>
                {registrosBitacoraFiltrados.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' }}>
                      No hay registros en el periodo seleccionado.
                    </Text>
                  </View>
                ) : (
                  registrosBitacoraFiltrados.map((r, i) => {
                    const temp = r.temperatura !== null && r.temperatura !== undefined ? r.temperatura : null;
                    
                    // Flags de honestidad clínica del backend
                    const esReloj = r.fuente === 'reloj';
                    const spo2Heredado = esReloj && r.spo2_heredado;
                    const presionHeredada = esReloj && r.presion_heredado;
                    const fcHeredado = esReloj && r.fc_heredado;
                    const tempHeredada = esReloj && r.temp_heredado;

                    return (
                      <View key={i} style={styles.historialRow}>
                        {/* Fecha y Operador */}
                        <View style={{ flex: 1.5 }}>
                          <Text style={styles.historialFecha}>
                            {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={[styles.historialCuidador, !esReloj && { color: COLORS.green, fontWeight: '700' }]}>
                            {r.fuente === 'cuidador' 
                              ? `👤 ${r.usuarios?.nombre_completo?.split(' ')[0] ?? 'Personal'}`
                              : '⌚ Reloj'}
                          </Text>
                        </View> 

                        {/* SpO2 - Mismo estilo, solo añade el asterisco si es heredado */}
                        <Text style={styles.historialVal}>
                          {r.spo2 ? `${r.spo2}%${spo2Heredado ? '*' : ''}` : '—'}
                        </Text>

                        {/* Presión Arterial */}
                        <Text style={styles.historialVal}>
                          {r.presion_sistolica && r.presion_diastolica 
                            ? `${Math.round(r.presion_sistolica)}/${Math.round(r.presion_diastolica)}${presionHeredada ? '*' : ''}` 
                            : '—'}
                        </Text>

                        {/* Frecuencia Cardíaca */}
                        <Text style={styles.historialVal}>
                          {r.frecuencia_cardiaca ? `${r.frecuencia_cardiaca}${fcHeredado ? '*' : ''}` : '—'}
                        </Text>

                        {/* Temperatura */}
                        <Text style={styles.historialVal}>
                          {temp !== null ? `${temp.toFixed(1)}°${tempHeredada ? '*' : ''}` : '—'}
                        </Text>

                        {/* Peso */}
                        <Text style={styles.historialVal}>{r.peso_kg ? `${r.peso_kg}k` : '—'}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Nota de Deslinde Regulativo y Metodología */}
              <Text style={{ fontSize: 9, color: COLORS.textLight, fontStyle: 'italic', marginTop: 12, paddingHorizontal: 4, lineHeight: 12 }}>
                * Los valores con asterisco (*) denotan arrastre del Último Valor Conocido (LOCF) para fines de continuidad hemodinámica.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ── EL MAPA DE ESTILOS (styles = StyleSheet.create) SIGUE ABAJO EXACTAMENTE IGUAL...

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  periodoPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  periodoText: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  chartCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textDark },
  chartSubtitle: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  chartBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chartBadgeText: { fontSize: 9, fontWeight: '700' },
  alertaBanner: { borderRadius: 8, padding: 10, marginTop: 10 },
  historialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historialFecha: { fontSize: 10, fontWeight: '600', color: COLORS.textDark },
  historialCuidador: { fontSize: 9, color: COLORS.textLight, marginTop: 1 },
  historialVal: { fontSize: 10, fontWeight: '700', color: COLORS.gold, width: 45, textAlign: 'right' },
  historialHeaders: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 6, marginTop: 4 },
  historialHeaderText: { fontSize: 9, color: COLORS.textLight, width: 45, textAlign: 'right', fontWeight: '700', textTransform: 'uppercase' },
});