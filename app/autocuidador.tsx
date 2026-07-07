import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearToken, completarTarea, descompletarTarea, getPacientes, getTareasHoy, loadStoredToken } from '../services/api';

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
      console.log("🔍 pacienteIdParam en autocuidador:", pacienteIdParam);
      console.log("🔍 Pacientes disponibles:", data.patients?.map((p: any) => ({id: p.id, nombre: p.nombre_completo})));
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
    setActualizando(`${tarea.id}-${tarea.hora}`);
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

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await clearToken();
            router.replace('/login');
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>{hoy}</Text>
          <Text style={styles.headerTitle}>
            {`Hola, ${paciente?.nombre_completo?.split(' ')[0] ?? 'bienvenido'} 👋`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{'🚪 Salir'}</Text>
        </TouchableOpacity>
      </View>
    {/* MI TARJETA DE PERFIL */}
    <View style={{
    backgroundColor: COLORS.cacao,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
    }}>
    <TouchableOpacity
        onPress={() => router.push({
        pathname: '/perfil-paciente' as any,
        params: { paciente: JSON.stringify(paciente) }
        })}
        style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: COLORS.gold,
        justifyContent: 'center', alignItems: 'center'
        }}
    >
        <Text style={{ color: COLORS.white, fontSize: 18, fontWeight: '800' }}>
        {paciente?.nombre_completo?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'}
        </Text>
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
        {'Mi perfil'}
        </Text>
        <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: '800' }}>
        {paciente?.nombre_completo ?? ''}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
        {paciente?.condiciones_medicas?.join(', ') ?? 'Sin condiciones registradas'}
        </Text>
    </View>
    <View style={{
        backgroundColor: 'rgba(61,170,106,0.2)',
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
        flexDirection: 'row', alignItems: 'center', gap: 4
    }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green }} />
        <Text style={{ color: COLORS.green, fontSize: 10, fontWeight: '700' }}>{'Activo'}</Text>
    </View>
    </View>
      {/* BARRA DE PROGRESO */}
      <View style={{ backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 12, color: COLORS.textLight }}>{'Progreso de hoy'}</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.cacao }}>{`${completadas}/${total} tareas`}</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${porcentaje}%` as any }]} />
        </View>
        <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'right' }}>
          {`${porcentaje}% completado`}
        </Text>
      </View>

      {/* LISTA DE TAREAS */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {tareas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
            <Text style={styles.emptyText}>{'Sin tareas programadas para hoy'}</Text>
            <TouchableOpacity
              style={[styles.accionBtn, { marginTop: 16 }]}
              onPress={() => router.push({
                pathname: '/medicamentos' as any,
                params: { pacienteId: paciente?.id }
              })}
            >
              <Text style={styles.accionBtnText}>{'+ Agregar medicamentos y rutinas'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tareas.map((t, i) => (
            <TouchableOpacity
              key={`${t.id}-${t.hora}-${i}`}
              style={[styles.tareaCard, t.completada && styles.tareaCardCompletada]}
              onPress={() => toggleTarea(t)}
              disabled={actualizando === `${t.id}-${t.hora}`}
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
                {actualizando === `${t.id}-${t.hora}` ? (
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
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push({
            pathname: '/medicamentos' as any,
            params: { pacienteId: paciente?.id }
          })}
        >
          <Text style={styles.navIcon}>💊</Text>
          <Text style={styles.navLabel}>{'Medicamentos'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem]}
          onPress={() => Alert.alert(
            '🚨 SOS',
            '¿Necesitas ayuda de emergencia?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Llamar SOS', style: 'destructive', onPress: () => console.log('SOS activado') }
            ]
          )}
        >
          <Text style={{ fontSize: 28 }}>🆘</Text>
          <Text style={[styles.navLabel, { color: COLORS.red, fontWeight: '800' }]}>{'SOS'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push({
            pathname: '/alertas' as any,
            params: { pacienteId: paciente?.id }
          })}
        >
          <Text style={styles.navIcon}>🔔</Text>
          <Text style={styles.navLabel}>{'Alertas'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'capitalize' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  progressBar: { height: 8, backgroundColor: COLORS.border, borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: COLORS.green, borderRadius: 4 },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
  accionBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  accionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
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
  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 8, paddingHorizontal: 20, justifyContent: 'space-around', alignItems: 'center' },
  navItem: { alignItems: 'center', flex: 1 },
  navIcon: { fontSize: 22, marginBottom: 2 },
  navLabel: { fontSize: 10, color: COLORS.textLight },
});