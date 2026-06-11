import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSignosVitalesHistorico } from '../services/api';

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
      <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
        {alerta && (
          <View style={{
            position: 'absolute',
            left: 0, right: 0,
            top: CHART_HEIGHT - ((alerta - min) / rango) * CHART_HEIGHT,
            height: 1,
            backgroundColor: COLORS.red,
            opacity: 0.4,
            zIndex: 1
          }} />
        )}
        {puntos.map((p, i) => (
          <View key={i}>
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
                  height: 2,
                  backgroundColor: color,
                  opacity: 0.7,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: '0 0',
                }} />
              );
            })()}
            <View style={{
              position: 'absolute',
              left: p.x - 4,
              top: p.y - 4,
              width: 8, height: 8,
              borderRadius: 4,
              backgroundColor: i === puntos.length - 1 ? color : COLORS.white,
              borderWidth: 2,
              borderColor: color,
              zIndex: 2
            }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getSignosVitalesHistorico(pacienteId, 14);
        if (data.registros) setRegistros(data.registros);
      } catch (e) {
        console.error("Error cargando histórico clínico:", e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteId]);

  const registrosFiltrados = [...registros].reverse();
  const fechasData = registrosFiltrados.map(r => r.created_at);
  const spo2Data = registrosFiltrados.map(r => r.spo2).filter(v => v !== null && v !== undefined);
  const sstolicaData = registrosFiltrados.map(r => r.presion_sistolica).filter(v => v !== null && v !== undefined);
  const dstolicaData = registrosFiltrados.map(r => r.presion_diastolica).filter(v => v !== null && v !== undefined);
  const fcData = registrosFiltrados.map(r => r.frecuencia_cardiaca).filter(v => v !== null && v !== undefined);
  const pesoData = registrosFiltrados.map(r => r.peso_kg).filter(v => v !== null && v !== undefined);
  
  // 🟢 Extracción elástica libre de nulos
  const temperaturaData = registrosFiltrados
    .map(leerTemperatura)
    .filter((v): v is number => v !== null);

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
            {/* GRÁFICA SPO2 */}
            {spo2Data.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Saturación de Oxígeno (SpO₂)</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.goldPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.gold }]}>Línea de Alerta: 92%</Text>
                  </View>
                </View>
                <MiniChart
                  datos={spo2Data}
                  fechas={fechasData}
                  color={COLORS.gold}
                  min={85} max={100}
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
                      fechas={fechasData}
                      color={COLORS.red}
                      min={Math.min(...sstolicaData) - 10}
                      max={Math.max(...sstolicaData) + 10}
                      unidad=" mmHg"
                      alerta={140}
                    />
                  </View>
                  <View>
                    <Text style={styles.chartSubtitle}>Diastólica</Text>
                    <MiniChart
                      datos={dstolicaData}
                      fechas={fechasData}
                      color={COLORS.amber}
                      min={Math.min(...dstolicaData) - 10}
                      max={Math.max(...dstolicaData) + 10}
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
                    <Text style={[styles.chartBadgeText, { color: COLORS.red }]}>Umbral de Alerta: 100 bpm</Text>
                  </View>
                </View>
                <MiniChart
                  datos={fcData}
                  fechas={fechasData}
                  color={COLORS.red}
                  min={40} max={140}
                  unidad=" bpm"
                  alerta={100}
                />
              </View>
            )}

            {/* 🟢 GRÁFICA TEMPERATURA CORPORAL (BLINDADA CONTRA OCULTAMIENTO) */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Temperatura Corporal Histórica</Text>
                <View style={[styles.chartBadge, { backgroundColor: COLORS.amberPale }]}>
                  <Text style={[styles.chartBadgeText, { color: COLORS.amber }]}>Umbral Febril: 37.8°</Text>
                </View>
              </View>
              <MiniChart
                datos={temperaturaData}
                fechas={fechasData}
                color={COLORS.amber}
                min={34} max={41}
                unidad="°C"
                alerta={37.8}
              />
            </View>

            {/* GRÁFICA PESO */}
            {pesoData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Evolución de Peso</Text>
                </View>
                <MiniChart
                  datos={pesoData}
                  fechas={fechasData}
                  color={COLORS.cacao}
                  min={Math.min(...pesoData) - 4}
                  max={Math.max(...pesoData) + 4}
                  unidad=" kg"
                />
              </View>
            )}

            {/* TABLA HISTÓRICA COMPLETA DE REGISTROS */}
            <View style={styles.chartCard}>
              <Text style={[styles.chartTitle, { marginBottom: 12 }]}>Bitácora de Monitoreo General</Text>

              <View style={styles.historialHeaders}>
                <Text style={[styles.historialHeaderText, { flex: 1.5, textAlign: 'left' }]}>Fecha/Hora</Text>
                <Text style={styles.historialHeaderText}>SpO₂</Text>
                <Text style={styles.historialHeaderText}>P.A.</Text>
                <Text style={styles.historialHeaderText}>FC</Text>
                <Text style={styles.historialHeaderText}>Temp</Text>
                <Text style={styles.historialHeaderText}>Peso</Text>
              </View>

              <View style={{ marginTop: 4 }}>
                {registros.slice(0, 10).map((r, i) => {
                  const temp = leerTemperatura(r);
                  return (
                    <View key={i} style={styles.historialRow}>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.historialFecha}>
                          {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.historialCuidador}>
                          {r.usuarios?.nombre_completo?.split(' ')[0] ?? 'Personal'}
                        </Text>
                      </View>
                      <Text style={styles.historialVal}>{r.spo2 ? `${r.spo2}%` : '—'}</Text>
                      <Text style={styles.historialVal}>
                        {r.presion_sistolica && r.presion_diastolica ? `${r.presion_sistolica}/${r.presion_diastolica}` : '—'}
                      </Text>
                      <Text style={styles.historialVal}>{r.frecuencia_cardiaca ?? '—'}</Text>
                      <Text style={styles.historialVal}>{temp !== null ? `${temp.toFixed(1)}°` : '—'}</Text>
                      <Text style={styles.historialVal}>{r.peso_kg ? `${r.peso_kg}k` : '—'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

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