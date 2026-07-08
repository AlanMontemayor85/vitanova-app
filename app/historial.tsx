import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { loadStoredToken } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

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
  blue: '#2D6BE4',
  bluePale: '#EEF3FC',
};

const formatFecha = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatHora = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export default function HistorialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pacienteId = params.pacienteId as string;
  const pacienteNombre = params.pacienteNombre as string;

  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [indice, setIndice] = useState(0);

  // Mapeo estático de íconos para evitar colisiones de contexto
  const ICONOS_TIPO: Record<string, string> = {
    medicamento: '💊',
    rutina: '🚶',
    control: '📋'
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const token = await loadStoredToken();
        if (!token) { router.replace('/login'); return; }
        const res = await fetch(
          `${BASE_URL}/pacientes/${pacienteId}/historial-cierres?limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.cierres) setCierres(data.cierres);
      } catch (e) {
        console.error("❌ Error recuperando historial:", e);
      } finally {
        
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteId]);

  const generarPDF = async (c: any) => {
    const html = `
      <html>
      <body style="font-family: Arial; padding: 20px; color: #2C2820;">
        <h2 style="color: #BF9A40;">Reporte de Turno — ${pacienteNombre}</h2>
        <p><strong>Cuidador:</strong> ${c.usuarios?.nombre_completo ?? 'Personal Vitanova'}</p>
        <p><strong>Fecha:</strong> ${formatFecha(c.created_at)}</p>
        <p><strong>Estado:</strong> ${c.estado_paciente}</p>
        <hr/>
        <h3>Signos Vitales</h3>
        <p>SpO₂: ${c.spo2 ?? '—'}% | Presión: ${c.presion_sistolica ?? '—'}/${c.presion_diastolica ?? '—'} mmHg | FC: ${c.frecuencia_cardiaca ?? '—'} bpm | Temp: ${c.temperatura ?? '—'}°C | Peso: ${c.peso_kg ?? '—'} kg</p>
        ${c.dolor_eva !== null && c.dolor_eva !== undefined ? `
          <h3>Registro de Confort</h3>
          <p>Dolor EVA: ${c.dolor_eva}/10 | Ánimo: ${c.estado_animo ?? '—'} | Hidratación: ${c.hidratacion_vasos ?? '—'} vasos | Alimentación: ${c.alimentacion ?? '—'}</p>
        ` : ''}
        ${c.observaciones ? `<p><strong>Observaciones:</strong> ${c.observaciones}</p>` : ''}
        ${c.notas ? `<h3>Notas del turno</h3><p>${c.notas}</p>` : ''}
        ${c.barthel_total !== null ? `<h3>Escalas Clínicas</h3><p>Barthel: ${c.barthel_total}/100 — ${c.barthel_label}</p>` : ''}
        ${c.morse_total !== null ? `<p>Morse: ${c.morse_total} pts — ${c.morse_label}</p>` : ''}
      </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e) {
      console.error(e);
    }
  };

  const compartirPorWhatsApp = (c: any) => {
    const texto = `📋 *Reporte de Turno — ${pacienteNombre}*\n\n` +
      `👤 Cuidador: ${c.usuarios?.nombre_completo ?? 'Personal Vitanova'}\n` +
      `📅 Fecha: ${formatFecha(c.created_at)}\n` +
      `😊 Estado: ${c.estado_paciente}\n\n` +
      `*Signos Vitales:*\n` +
      `SpO₂: ${c.spo2 ?? '—'}% | PA: ${c.presion_sistolica ?? '—'}/${c.presion_diastolica ?? '—'} | FC: ${c.frecuencia_cardiaca ?? '—'} bpm\n` +
      `Temp: ${c.temperatura ?? '—'}°C | Peso: ${c.peso_kg ?? '—'} kg\n\n` +
      (c.dolor_eva !== null && c.dolor_eva !== undefined ? `*Confort:*\nDolor: ${c.dolor_eva}/10 | Ánimo: ${c.estado_animo ?? '—'} | Hidratación: ${c.hidratacion_vasos ?? '—'} vasos\n\n` : '') +
      (c.observaciones ? `*Observaciones:* ${c.observaciones}\n` : '') +
      (c.notas ? `*Notas:* ${c.notas}\n` : '');
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(texto)}`);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // Extracción controlada del registro activo bajo el índice asignado
  const tieneRegistros = cierres.length > 0;
  const c = tieneRegistros ? cierres[indice] : null;
  const displayEstado = c ? (c.estado_paciente === 'bien' ? 'BIEN' : c.estado_paciente === 'preocupante' ? 'CRÍTICO' : 'REGULAR') : '';

  // Filtrado controlado de subtareas de forma segura
  const tareasTrabajo = c?.tareas ? c.tareas.filter((t: any) => !(t.descripcion || '').startsWith('📝')) : [];
  const notasTurno = c?.tareas ? c.tareas.filter((t: any) => (t.descripcion || '').startsWith('📝')) : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>HISTORIAL DE TURNOS</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {!tieneRegistros ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center' }}>
              {'Sin registros de turnos anteriores'}
            </Text>
          </View>
        ) : (
          <View>
            {/* NAVEGADOR MULTI-TURNO */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setIndice(Math.min(indice + 1, cierres.length - 1))}
                disabled={indice >= cierres.length - 1}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 28, color: indice >= cierres.length - 1 ? COLORS.border : COLORS.gold }}>{'‹'}</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textDark }}>
                  {`Turno ${indice + 1} de ${cierres.length}`}
                </Text>
                <Text style={{ fontSize: 10, color: COLORS.textLight }}>
                  {new Date(c.created_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIndice(Math.max(indice - 1, 0))}
                disabled={indice <= 0}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 28, color: indice <= 0 ? COLORS.border : COLORS.gold }}>{'›'}</Text>
              </TouchableOpacity>
            </View>

            {/* ACCIONES COMPARTIR */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: COLORS.greenPale, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.green }}
                onPress={() => generarPDF(c)}
              >
                <Text style={{ fontSize: 11, color: COLORS.green, fontWeight: '700' }}>{'📄 PDF'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#25D366' }}
                onPress={() => compartirPorWhatsApp(c)}
              >
                <Text style={{ fontSize: 11, color: '#25D366', fontWeight: '700' }}>{'📲 WhatsApp'}</Text>
              </TouchableOpacity>
            </View>

            {/* TARJETA DE REPORTE VITAL VITANOVA */}
            <View style={styles.cierreCard}>
              <View style={styles.cierreHeader}>
                <Text style={{ fontSize: 28 }}>
                  {c.estado_paciente === 'bien' ? '😊' : c.estado_paciente === 'preocupante' ? '😟' : '😐'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cierreNombreCuidador}>{c.usuarios?.nombre_completo ?? 'Personal Vitanova'}</Text>
                  <Text style={styles.cierreFecha}>{formatFecha(c.created_at)}</Text>
                </View>
                <View style={[styles.estadoPill, {
                  backgroundColor: c.estado_paciente === 'bien' ? COLORS.greenPale :
                    c.estado_paciente === 'preocupante' ? COLORS.redPale : COLORS.amberPale
                }]}>
                  {/* 🎯 FIX: 'displayEstado' ahora lee correctamente la variable calculada en el scope */}
                  <Text style={[styles.estadoPillText, {
                    color: c.estado_paciente === 'bien' ? COLORS.green :
                      c.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber
                  }]}>{displayEstado}</Text>
                </View>
              </View>

              {/* MATRIZ DE SIGNOS VITALES */}
              <View style={styles.signosRow}>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{c.spo2 ? `${c.spo2}%` : '—'}</Text><Text style={styles.signoLabel}>SpO₂</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{c.presion_sistolica && c.presion_diastolica ? `${Math.round(c.presion_sistolica)}/${Math.round(c.presion_diastolica)}` : '—'}</Text><Text style={styles.signoLabel}>Presión</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{c.frecuencia_cardiaca ? `${c.frecuencia_cardiaca}` : '—'}</Text><Text style={styles.signoLabel}>FC bpm</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{c.temperatura ? `${c.temperatura}°C` : '—'}</Text><Text style={styles.signoLabel}>Temp</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{c.peso_kg ? `${c.peso_kg} kg` : '—'}</Text><Text style={styles.signoLabel}>Peso</Text></View>
              </View>

              {/* PARÁMETROS DE CONFORT LOGÍSTICO */}
              {(c.dolor_eva !== null && c.dolor_eva !== undefined || c.estado_animo || c.hidratacion_vasos || c.alimentacion || c.observaciones) && (
                <View style={styles.tareasSection}>
                  <Text style={styles.tareasSectionTitle}>{'REGISTRO DE CONFORT'}</Text>
                  <View style={styles.signosRow}>
                    {c.dolor_eva !== null && c.dolor_eva !== undefined && (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{`${c.dolor_eva}/10`}</Text>
                        <Text style={styles.signoLabel}>Dolor EVA</Text>
                      </View>
                    )}
                    {c.hidratacion_vasos !== null && c.hidratacion_vasos !== undefined && (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{`${c.hidratacion_vasos} 💧`}</Text>
                        <Text style={styles.signoLabel}>Hidratación</Text>
                      </View>
                    )}
                    {c.alimentacion && (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{c.alimentacion}</Text>
                        <Text style={styles.signoLabel}>Alimentación</Text>
                      </View>
                    )}
                    {c.estado_animo && (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{c.estado_animo}</Text>
                        <Text style={styles.signoLabel}>Ánimo</Text>
                      </View>
                    )}
                  </View>
                  {c.observaciones && (
                    <View style={styles.notaItem}>
                      <Text style={{ fontSize: 11, color: COLORS.textDark }}>{c.observaciones}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* BLOQUE DE TAREAS PLANIFICADAS */}
              {tareasTrabajo.length > 0 && (
                <View style={styles.tareasSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.tareasSectionTitle}>ACTIVIDADES PLANIFICADAS</Text>
                    <Text style={[styles.tareasSectionTitle, { color: COLORS.green }]}>
                      {`${tareasTrabajo.filter((t: any) => t.completada).length}/${tareasTrabajo.length} completadas`}
                    </Text>
                  </View>
                  {tareasTrabajo.map((t: any, ti: number) => (
                    <View key={`trabajo-${ti}`} style={styles.tareaItem}>
                      <Text style={styles.tareaItemIcon}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>
                      <Text style={[styles.tareaItemText, t.completada && { textDecorationLine: 'line-through', color: COLORS.textLight }]}>
                        {t.descripcion}
                      </Text>
                      {/* 🎯 FIX: 'formatHora' encapsula de forma segura los hilos de formateo */}
                      {t.hora_completada && <Text style={styles.tareaItemHora}>{formatHora(t.hora_completada)}</Text>}
                      {t.completada && <Text style={{ color: COLORS.green, fontSize: 16 }}>{'✅'}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* SECCIÓN NOTAS EVOLUTIVAS */}
              {notasTurno.length > 0 && (
                <View style={styles.notasSection}>
                  <Text style={[styles.tareasSectionTitle, { color: COLORS.amber }]}>NOTAS DEL TURNO</Text>
                  {notasTurno.map((n: any, ni: number) => (
                    <View key={`nota-${ni}`} style={styles.notaItem}>
                      <Text style={{ fontSize: 11, color: COLORS.textDark }}>
                        {String(n.descripcion || '').replace('📝 ', '')}
                      </Text>
                      {n.hora_completada && (
                        <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 4 }}>
                          {formatHora(n.hora_completada)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* EVALUACIONES DE ESCALAS MÉDICAS */}
              {(c.barthel_total !== null || c.morse_total !== null) && (
                <View style={[styles.tareasSection, { marginTop: 8 }]}>
                  <Text style={styles.tareasSectionTitle}>ESCALAS CLÍNICAS</Text>
                  {c.barthel_total !== null && (
                    <View style={styles.escalaRow}>
                      <Text style={styles.escalaLabel}>Barthel:</Text>
                      <Text style={styles.escalaVal}>{`${c.barthel_total}/100 — ${c.barthel_label}`}</Text>
                    </View>
                  )}
                  {c.morse_total !== null && (
                    <View style={styles.escalaRow}>
                      <Text style={styles.escalaLabel}>Morse:</Text>
                      <Text style={styles.escalaVal}>{`${c.morse_total} pts — ${c.morse_label}`}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
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