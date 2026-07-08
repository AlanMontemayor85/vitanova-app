import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { loadStoredToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';
const COLORS = {
  gold: '#BF9A40', goldPale: '#F5EDD8', cacao: '#4A4540', cream: '#FAFAF7',
  white: '#FFFFFF', textDark: '#2C2820', textLight: '#8A8078',
  border: '#E0D8CC', green: '#3DAA6A', greenPale: '#EAF5E8',
  amber: '#D4860A', amberPale: '#FFF4E0', red: '#D94F4F', redPale: '#FDEAEA',
};

const ICONOS_TIPO: Record<string, string> = {
  medicamento: '💊', alimentacion: '🍽️', ejercicio: '🚶', higiene: '🛁', cita: '📅', otro: '📝',
};

function formatFecha(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatHora(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistorialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pacienteId = params.pacienteId as string;
  const pacienteNombre = params.pacienteNombre as string;

  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrosConfort, setRegistrosConfort] = useState<any[]>([]);

  useEffect(() => {
  const cargar = async () => {
    try {
      const token = await loadStoredToken();
      if (!token) { router.replace('/login'); return; }

      const [cierresRes, confortRes] = await Promise.all([
        fetch(`${BASE_URL}/pacientes/${pacienteId}/historial-cierres?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/pacientes/${pacienteId}/registros-confort?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const cierresData = await cierresRes.json();
      const confortData = await confortRes.json();

      if (cierresData.cierres) setCierres(cierresData.cierres);
      if (confortData.registros) setRegistrosConfort(confortData.registros);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  cargar();
}, [pacienteId]);

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
          <Text style={styles.greeting}>Historial de turnos</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {cierres.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 }}>Sin historial aún</Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, textAlign: 'center' }}>Los cierres de turno aparecerán aquí</Text>
          </View>
        ) : (
          cierres.map((c) => {
            // 🟢 TU BLOQUE CORREGIDO CLÍNICA Y MATEMÁTICAMENTE
            // 1. Tareas Normales: Tienen hora_programada (no es null) y no empiezan con el emoji de nota
            const tareasNormales     = c.tareas?.filter((t: any) => t.hora_programada !== null && !t.descripcion?.startsWith('📝')) ?? [];
            
            // 2. Tareas Incidentales: No tienen hora_programada (son null) O tienen la bandera en true, y no son notas
            const tareasIncidentales = c.tareas?.filter((t: any) => (t.hora_programada === null || t.es_incidental) && !t.descripcion?.startsWith('📝')) ?? [];
            
            // 3. Notas de Evolución: Se quedan igual, filtrando por el prefijo del emoji
            const notasTareas        = c.tareas?.filter((t: any) => t.descripcion?.startsWith('📝')) ?? [];
            
            // ── Tus constantes de control y renderizado se quedan exactamente idénticas ──
            const completadasNormales = tareasNormales.filter((t: any) => t.completada).length;
            const tieneNotaNativa = c.notes && c.notas.trim() !== '' && !c.notas.includes('Sin notas incidentales');

            const displaySPO2 = c.spo2 !== null && c.spo2 !== undefined ? `${c.spo2}%` : '—';
            let displayPresion = '—';
            if (c.presion_sistolica !== null && c.presion_diastolica !== null) {
              displayPresion = `${c.presion_sistolica}/${c.presion_diastolica}`;
            }
            const displayFC = c.frecuencia_cardiaca !== null && c.frecuencia_cardiaca !== undefined ? `${c.frecuencia_cardiaca}` : '—';
            const displayTemp = c.temperatura !== null && c.temperatura !== undefined ? `${c.temperatura}°C` : '—';
            const displayPeso = c.peso_kg !== null && c.peso_kg !== undefined ? `${c.peso_kg} kg` : '—';
            const displayEstado = c.estado_paciente ? String(c.estado_paciente).toUpperCase() : 'REGULAR';

            return (
              <View key={c.id} style={styles.cierreCard}>

                {/* HEADER */}
                <View style={styles.cierreHeader}>
                  <Text style={{ fontSize: 28 }}>
                    {c.estado_paciente === 'bien' ? '😊' : c.estado_paciente === 'preocupante' ? '😟' : '😐'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cierreNombreCuidador}>
                      {c.usuarios?.nombre_completo ?? 'Personal Vitanova'}
                    </Text>
                    <Text style={styles.cierreFecha}>{formatFecha(c.created_at)}</Text>
                  </View>
                  <View style={[styles.estadoPill, {
                    backgroundColor: c.estado_paciente === 'bien' ? COLORS.greenPale :
                      c.estado_paciente === 'preocupante' ? COLORS.redPale : COLORS.amberPale
                  }]}>
                    <Text style={[styles.estadoPillText, {
                      color: c.estado_paciente === 'bien' ? COLORS.green :
                        c.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber
                    }]}>{displayEstado}</Text>
                  </View>
                </View>

                {/* SIGNOS VITALES */}
                <View style={styles.signosRow}>
                  <View style={styles.signoItem}>
                    <Text style={styles.signoVal}>{displaySPO2}</Text>
                    <Text style={styles.signoLabel}>SpO₂</Text>
                  </View>
                  <View style={styles.signoItem}>
                    <Text style={styles.signoVal}>{displayPresion}</Text>
                    <Text style={styles.signoLabel}>Presión</Text>
                  </View>
                  <View style={styles.signoItem}>
                    <Text style={styles.signoVal}>{displayFC}</Text>
                    <Text style={styles.signoLabel}>FC bpm</Text>
                  </View>
                  <View style={styles.signoItem}>
                    <Text style={[styles.signoVal, { color: COLORS.cacao }]}>{displayTemp}</Text>
                    <Text style={styles.signoLabel}>Temp</Text>
                  </View>
                  <View style={styles.signoItem}>
                    <Text style={[styles.signoVal, { color: COLORS.textDark }]}>{displayPeso}</Text>
                    <Text style={styles.signoLabel}>Peso</Text>
                  </View>
                </View>

                {/* 📋 SECCIÓN 1: ACTIVIDADES PLANIFICADAS */}
                {tareasNormales.length > 0 && (
                  <View style={styles.tareasSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.tareasSectionTitle}>Actividades Planificadas</Text>
                      <Text style={{ fontSize: 10, color: COLORS.textLight }}>
                        {completadasNormales}/{tareasNormales.length} completadas
                      </Text>
                    </View>
                    {tareasNormales.map((t: any, j: number) => (
                      <View key={`normal-${j}`} style={styles.tareaItem}>
                        <Text style={styles.tareaItemIcon}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>
                        <Text style={[
                          styles.tareaItemText,
                          t.completada && { textDecorationLine: 'line-through', color: COLORS.textLight }
                        ]}>
                          {t.descripcion}
                        </Text>
                        <Text style={styles.tareaItemHora}>
                          {t.hora_completada ? formatHora(t.hora_completada) : '—'}
                        </Text>
                        <Text style={{ fontSize: 12 }}>{t.completada ? '✅' : '⬜'}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* ⚡ SECCIÓN 2: EVENTOS INCIDENTALES EJECUTADOS */}
                {tareasIncidentales.length > 0 && (
                  <View style={[styles.tareasSection, { borderTopColor: 'rgba(0,0,0,0.05)', marginTop: 10 }]}>
                    <Text style={[styles.tareasSectionTitle, { color: COLORS.amber }]}>Rutinas Ejecutadas</Text>
                    {tareasIncidentales.map((t: any, j: number) => (
                      <View key={`incidental-${j}`} style={styles.tareaItem}>
                        {/* Si ICONOS_TIPO tiene mapeado el tipo de incidental lo usa, si no, clava el rayito por defecto */}
                        <Text style={styles.tareaItemIcon}>{(typeof ICONOS_TIPO !== 'undefined' && ICONOS_TIPO[t.tipo]) ?? '⚡'}</Text>
                        <Text style={styles.tareaItemText}>
                          {t.descripcion?.replace('📝 ', '')}
                        </Text>
                        <Text style={styles.tareaItemHora}>
                          {t.hora_completada ? formatHora(t.hora_completada) : '—'}
                        </Text>
                        <Text style={{ fontSize: 12 }}>✅</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 📝 SECCIÓN 3: NOTAS DE EVOLUCIÓN (BITÁCORA Y COMENTARIOS) */}
                {(notasTareas.length > 0 || tieneNotaNativa) && (
                  <View style={styles.notasSection}>
                    <Text style={styles.tareasSectionTitle}>Notas de Evolución del Turno</Text>

                    {notasTareas.length > 0 ? (
                      notasTareas.map((t: any, j: number) => (
                        <View key={`task-nota-${j}`} style={styles.notaItem}>
                          <Text style={{ flex: 1, fontSize: 12, color: COLORS.textDark, lineHeight: 16 }}>
                            {t.descripcion?.replace('📝 ', '')}
                          </Text>
                          <Text style={styles.tareaItemHora}>
                            {t.hora_completada ? formatHora(t.hora_completada) : '—'}
                          </Text>
                        </View>
                      ))
                    ) : tieneNotaNativa ? (
                      <View style={styles.notaItem}>
                        <Text style={{ flex: 1, fontSize: 12, color: COLORS.textDark, lineHeight: 16, fontWeight: '500' }}>
                          {String(c.notas).replace('📝 ', '')}
                        </Text>
                        <Text style={styles.tareaItemHora}>Consolidado</Text>
                      </View>
                    ) : null}
                  </View>
                )}
                {registrosConfort.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 8, marginTop: 8 }}>
                      {'Registros de Confort'}
                    </Text>
                    {registrosConfort.map((r, i) => (
                      <View key={r.id || i} style={styles.cierreCard}>
                        <Text style={styles.cierreNombreCuidador}>
                          {`🩺 ${r.usuarios?.nombre_completo ?? 'Cuidador'}`}
                        </Text>
                        <Text style={styles.cierreFecha}>
                          {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <View style={[styles.signosRow, { marginTop: 10 }]}>
                          {r.dolor_eva !== null && r.dolor_eva !== undefined && (
                            <View style={styles.signoItem}>
                              <Text style={styles.signoVal}>{`${r.dolor_eva}/10`}</Text>
                              <Text style={styles.signoLabel}>Dolor</Text>
                            </View>
                          )}
                          {r.spo2 && (
                            <View style={styles.signoItem}>
                              <Text style={styles.signoVal}>{`${r.spo2}%`}</Text>
                              <Text style={styles.signoLabel}>SpO₂</Text>
                            </View>
                          )}
                          {r.presion_sistolica && r.presion_diastolica && (
                            <View style={styles.signoItem}>
                              <Text style={styles.signoVal}>{`${r.presion_sistolica}/${r.presion_diastolica}`}</Text>
                              <Text style={styles.signoLabel}>Presión</Text>
                            </View>
                          )}
                          {r.frecuencia_cardiaca && (
                            <View style={styles.signoItem}>
                              <Text style={styles.signoVal}>{`${r.frecuencia_cardiaca}`}</Text>
                              <Text style={styles.signoLabel}>FC</Text>
                            </View>
                          )}
                          {r.temperatura && (
                            <View style={styles.signoItem}>
                              <Text style={styles.signoVal}>{`${r.temperatura}°`}</Text>
                              <Text style={styles.signoLabel}>Temp</Text>
                            </View>
                          )}
                          {r.glucosa && (
                            <View style={styles.signoItem}>
                              <Text style={styles.signoVal}>{`${r.glucosa}`}</Text>
                              <Text style={styles.signoLabel}>Glucosa</Text>
                            </View>
                          )}
                        </View>
                        {r.estado_animo && (
                          <Text style={[styles.cierreFecha, { marginTop: 4 }]}>{`Estado: ${r.estado_animo}`}</Text>
                        )}
                        {r.observaciones && (
                          <View style={styles.notaItem}>
                            <Text style={{ fontSize: 11, color: COLORS.textDark }}>{r.observaciones}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}
                {/* ESCALAS CLÍNICAS */}
                {(c.barthel_total !== null || c.morse_total !== null || c.mna_total !== null) && (
                  <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 8, gap: 6 }}>
                    {c.barthel_total !== null && (
                      <View style={styles.escalaRow}>
                        <Text style={styles.escalaLabel}>📋 Barthel</Text>
                        <Text style={styles.escalaVal}>{c.barthel_total}/100 — {c.barthel_label}</Text>
                      </View>
                    )}
                    {c.morse_total !== null && (
                      <View style={styles.escalaRow}>
                        <Text style={styles.escalaLabel}>⚠️ Morse</Text>
                        <Text style={styles.escalaVal}>{c.morse_total} pts — {c.morse_label}</Text>
                      </View>
                    )}
                    {c.mna_total !== null && (
                      <View style={styles.escalaRow}>
                        <Text style={styles.escalaLabel}>🍽️ MNA</Text>
                        <Text style={styles.escalaVal}>{c.mna_total} pts — {c.mna_label}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
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
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cierreCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cierreHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cierreNombreCuidador: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  cierreFecha: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  estadoPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoPillText: { fontSize: 10, fontWeight: '700' },
  signosRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  signoItem: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  signoVal: { fontSize: 11, fontWeight: '800', color: COLORS.gold, textAlign: 'center' },
  signoLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 2 },
  tareasSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 8 },
  notasSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 },
  tareasSectionTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 8 },
  tareaItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tareaItemIcon: { fontSize: 14 },
  tareaItemText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textDark },
  tareaItemHora: { fontSize: 10, color: COLORS.textLight },
  notaItem: { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 4 },
  escalaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  escalaLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textDark, minWidth: 80 },
  escalaVal: { fontSize: 11, color: COLORS.textLight, flex: 1 },
});