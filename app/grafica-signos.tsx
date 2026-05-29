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
};

function MiniChart({
  datos, color, min, max, unidad, alerta
}: {
  datos: number[], color: string, min: number, max: number, unidad: string, alerta?: number
}) {
  if (datos.length < 2) return (
    <View style={{ height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textLight, fontSize: 12 }}>Sin datos suficientes</Text>
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
  const enAlerta = alerta ? ultimo < alerta : false;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: enAlerta ? COLORS.red : color }}>
          {ultimo}{unidad}
        </Text>
        <Text style={{ fontSize: 18, color: enAlerta ? COLORS.red : COLORS.textLight }}>{tendencia}</Text>
      </View>
      <View style={{ height: CHART_HEIGHT, position: 'relative' }}>
        {/* Línea de alerta */}
        {alerta && (
          <View style={{
            position: 'absolute',
            left: 0, right: 0,
            top: CHART_HEIGHT - ((alerta - min) / rango) * CHART_HEIGHT,
            height: 1,
            backgroundColor: COLORS.red,
            opacity: 0.4,
          }} />
        )}
        {/* Puntos y líneas */}
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
            }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: COLORS.textLight }}>
          {new Date(Date.now() - (datos.length - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.textLight }}>Hoy</Text>
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
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const spo2Data = registros.map(r => r.spo2).filter(Boolean);
  const sistolicaData = registros.map(r => r.presion_sistolica).filter(Boolean);
  const diastolicaData = registros.map(r => r.presion_diastolica).filter(Boolean);
  const fcData = registros.map(r => r.frecuencia_cardiaca).filter(Boolean);
  const pesoData = registros.map(r => r.peso_kg).filter(Boolean);

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
          <Text style={styles.greeting}>Signos vitales</Text>
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
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 }}>
              Sin registros aún
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>
              Los signos vitales aparecerán aquí después de cerrar turnos
            </Text>
          </View>
        ) : (
          <>
            {/* SPO2 */}
            {spo2Data.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>SpO₂</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.goldPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.gold }]}>Normal: 95-100%</Text>
                  </View>
                </View>
                <MiniChart
                  datos={spo2Data}
                  color={COLORS.gold}
                  min={85} max={100}
                  unidad="%"
                  alerta={92}
                />
                {spo2Data[spo2Data.length - 1] < 92 && (
                  <View style={[styles.alertaBanner, { backgroundColor: COLORS.redPale }]}>
                    <Text style={{ fontSize: 12, color: COLORS.red, fontWeight: '700' }}>
                      ⚠️ SpO₂ bajo — consulta con el médico
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* PRESIÓN */}
                {sistolicaData.length > 0 && (
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>Presión arterial</Text>
                    <View style={[styles.chartBadge, { backgroundColor: COLORS.greenPale }]}>
                        <Text style={[styles.chartBadgeText, { color: COLORS.green }]}>Normal: 120/80</Text>
                    </View>
                    </View>
                    <View style={{ gap: 16 }}>
                    <View>
                        <Text style={styles.chartSubtitle}>Sistólica</Text>
                        <MiniChart
                        datos={sistolicaData}
                        color={COLORS.red}
                        min={Math.min(...sistolicaData) - 10} 
                        max={Math.max(...sistolicaData) + 10}
                        unidad=" mmHg"
                        alerta={180}
                        />
                    </View>
                    <View>
                        <Text style={styles.chartSubtitle}>Diastólica</Text>
                        <MiniChart
                        datos={diastolicaData}
                        color={COLORS.amber}
                        min={40} max={130}
                        unidad=" mmHg"
                        />
                    </View>
                    </View>
                </View>
                )}
            {/* FC */}
            {fcData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Frecuencia cardíaca</Text>
                  <View style={[styles.chartBadge, { backgroundColor: COLORS.redPale }]}>
                    <Text style={[styles.chartBadgeText, { color: COLORS.red }]}>Normal: 60-100 bpm</Text>
                  </View>
                </View>
                <MiniChart
                  datos={fcData}
                  color={COLORS.red}
                  min={40} max={150}
                  unidad=" bpm"
                />
              </View>
            )}

            {/* PESO */}
            {pesoData.length > 0 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Peso</Text>
                </View>
                <MiniChart
                  datos={pesoData}
                  color={COLORS.cacao}
                  min={Math.min(...pesoData) - 5}
                  max={Math.max(...pesoData) + 5}
                  unidad=" kg"
                />
              </View>
            )}

            {/* TABLA HISTORICO */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Historial de registros</Text>
              <View style={{ marginTop: 12 }}>
                {[...registros].reverse().slice(0, 7).map((r, i) => (
                  <View key={i} style={styles.historialRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historialFecha}>
                        {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={styles.historialCuidador}>
                        {r.usuarios?.nombre_completo ?? 'Cuidador'}
                      </Text>
                    </View>
                    <Text style={styles.historialVal}>{r.spo2 ?? '—'}%</Text>
                    <Text style={styles.historialVal}>{r.presion_sistolica ?? '—'}/{r.presion_diastolica ?? '—'}</Text>
                    <Text style={styles.historialVal}>{r.frecuencia_cardiaca ?? '—'}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.historialHeaders}>
                <View style={{ flex: 1 }} />
                <Text style={styles.historialHeaderText}>SpO₂</Text>
                <Text style={styles.historialHeaderText}>Presión</Text>
                <Text style={styles.historialHeaderText}>FC</Text>
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
  chartTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textDark },
  chartSubtitle: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  chartBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chartBadgeText: { fontSize: 9, fontWeight: '700' },
  alertaBanner: { borderRadius: 8, padding: 10, marginTop: 10 },
  historialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historialFecha: { fontSize: 11, fontWeight: '600', color: COLORS.textDark },
  historialCuidador: { fontSize: 9, color: COLORS.textLight, marginTop: 2 },
  historialVal: { fontSize: 11, fontWeight: '700', color: COLORS.gold, minWidth: 50, textAlign: 'right' },
  historialHeaders: { flexDirection: 'row', marginTop: 4 },
  historialHeaderText: { fontSize: 9, color: COLORS.textLight, minWidth: 50, textAlign: 'right', fontWeight: '700' },
});
