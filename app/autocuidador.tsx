import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { completarTarea, descompletarTarea, getPacientes, getTareasHoy, loadStoredToken } from '../services/api';

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
};

const ICONOS: Record<string, string> = {
  medicamento: '💊',
  alimentacion: '🍽️',
  higiene: '🛁',
  ejercicio: '🚶',
  cita: '📅',
  rutina: '📋',
  otro: '📝',
};

export default function AutocuidadorScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();

  const [paciente, setPaciente] = useState<any>(null);
  const [tareas, setTareas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [completadas, setCompletadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState<string | null>(null);

  const cargar = async () => {
    try {
      await loadStoredToken();
      const data = await getPacientes();
      if (data.patients && data.patients.length > 0) {
        const p = pacienteIdParam
          ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
          : data.patients[0];
        setPaciente(p);
        const res = await getTareasHoy(p.id);
        if (res.tareas) {
          setTareas(res.tareas);
          setTotal(res.total);
          setCompletadas(res.completadas);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [pacienteIdParam]);

  const toggleTarea = async (tarea: any) => {
    setActualizando(tarea.id);
    try {
      if (tarea.completada) {
        await descompletarTarea({
          paciente_id: paciente.id,
          tarea_id: tarea.tipo === 'rutina' ? tarea.id : undefined,
          medicamento_id: tarea.tipo === 'medicamento' ? tarea.id : undefined,
          tipo: tarea.tipo,
        });
      } else {
        await completarTarea({
          paciente_id: paciente.id,
          tarea_id: tarea.tipo === 'rutina' ? tarea.id : undefined,
          medicamento_id: tarea.tipo === 'medicamento' ? tarea.id : undefined,
          tipo: tarea.tipo,
        });
      }
      await cargar();
    } catch (e) {
      console.error(e);
    } finally {
      setActualizando(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Mi plan de hoy</Text>
          <Text style={styles.headerTitle}>{paciente?.nombre_completo?.split(' ')[0] ?? 'Hola'}</Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{`${completadas}/${total}`}</Text>
          <Text style={styles.progressLabel}>completadas</Text>
        </View>
      </View>

      {/* BARRA DE PROGRESO */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${porcentaje}%` as any }]} />
      </View>
      <Text style={styles.progressPct}>{`${porcentaje}% completado hoy`}</Text>

      {/* LISTA DE TAREAS */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {tareas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🎉</Text>
            <Text style={styles.emptyText}>Sin tareas programadas para hoy</Text>
          </View>
        ) : (
          tareas.map((t, i) => (
            <TouchableOpacity
              key={`${t.id}-${t.hora}-${i}`}
              style={[styles.tareaCard, t.completada && styles.tareaCardCompletada]}
              onPress={() => toggleTarea(t)}
              disabled={actualizando === t.id}
            >
              <View style={styles.tareaIcono}>
                <Text style={{ fontSize: 24 }}>
                  {ICONOS[t.tipo] ?? ICONOS[t.subtitulo] ?? '📋'}
                </Text>
              </View>
              <View style={styles.tareaInfo}>
                <Text style={[styles.tareaTitulo, t.completada && styles.tareaTextoCompletado]}>
                  {t.titulo}
                </Text>
                <Text style={styles.tareaHora}>{`🕐 ${t.hora}`}</Text>
                {t.indicaciones && (
                  <Text style={styles.tareaIndicaciones}>{t.indicaciones}</Text>
                )}
              </View>
              <View style={[styles.checkbox, t.completada && styles.checkboxCompletado]}>
                {actualizando === t.id ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: '800' }}>
                    {t.completada ? '✓' : ''}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#FFFFFF', fontSize: 18 },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  progressBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 },
  progressText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  progressLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
  progressBar: { height: 6, backgroundColor: COLORS.border, marginHorizontal: 20, marginTop: 12, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: COLORS.green, borderRadius: 3 },
  progressPct: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 6, marginBottom: 4 },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
  tareaCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  tareaCardCompletada: { backgroundColor: COLORS.greenPale, borderColor: COLORS.green },
  tareaIcono: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.cream, justifyContent: 'center', alignItems: 'center' },
  tareaInfo: { flex: 1 },
  tareaTitulo: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  tareaTextoCompletado: { textDecorationLine: 'line-through', color: COLORS.textLight },
  tareaHora: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  tareaIndicaciones: { fontSize: 11, color: COLORS.textLight, marginTop: 4, fontStyle: 'italic' },
  checkbox: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  checkboxCompletado: { backgroundColor: COLORS.green, borderColor: COLORS.green },
});