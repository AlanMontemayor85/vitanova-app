import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAlertas, getPacientes, loadStoredToken } from '../services/api';

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
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

const TIPO_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  SOS: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' },
  sos: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' }, // 🛡️ Blindado
  CAIDA: { icon: '⚠️', color: '#D4860A', bg: '#FFF4E0' }, // 🛡️ Blindado
  caida: { icon: '⚠️', color: '#D4860A', bg: '#FFF4E0' },
  geocerca: { icon: '📍', color: '#D4860A', bg: '#FFF4E0' },
  medicamento: { icon: '💊', color: '#BF9A40', bg: '#F5EDD8' },
  dispositivo: { icon: '📱', color: '#8A8078', bg: '#F1EFE8' },
  signo_vital: { icon: '🩺', color: '#D94F4F', bg: '#FDEAEA' },
  otro: { icon: '🔔', color: '#8A8078', bg: '#F1EFE8' },
};

export default function AlertasScreen() {

  
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState<string>('familiar');

  useEffect(() => {
  const cargar = async () => {
    try {
      await loadStoredToken();
      
      // 🎯 Aquí obtenemos el rol. 
      // Si tu función 'loadStoredToken' o algún servicio te da el usuario actual, haz algo como:
      // const session = await getSessionData(); 
      // setUserRol(session.rol); 
      
      const data = await getPacientes();
      if (data.patients && data.patients.length > 0) {
        const p = pacienteIdParam 
          ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
          : data.patients[0];
        setPaciente(p);
        const alertasData = await getAlertas(p.id);
        if (alertasData.alertas) setAlertas(alertasData.alertas);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  cargar();
}, [pacienteIdParam]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // 🎯 1. FILTRADO: Excluimos los turnos del personal si entra un cuidador
  // (Asegúrate de definir 'userRol' arriba mediante un estado o constante fija)
  

  // 🎯 FILTRADO OPERATIVO: Ocultamos la auditoría (batería + 🔐) y turnos (retiro + ⏳) si es cuidador

  const alertasVisibles = userRol === 'familiar'
    ? alertas // El familiar ve la bitácora completa
    : alertas.filter(a => !a.descripcion?.includes('🔐') && !a.descripcion?.includes('⏳')); // Cualquiera que no sea familiar queda bloqueado

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Alertas</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* 🎯 2. CORRECCIÓN: Validamos usando el arreglo filtrado */}
       {alertasVisibles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Sin alertas</Text>
            <Text style={styles.emptyText}>Todo está en orden</Text>
          </View>
        ) : (
          alertasVisibles.map((a) => {
            const tipoNormalizado = a.tipo?.toLowerCase();
            let config = TIPO_CONFIG[tipoNormalizado] ?? TIPO_CONFIG.otro;

            /* 🎯 INTERCEPTOR VISUAL: Si viene disfrazado de 'bateria' pero trae el candado, 
                    le ponemos la identidad gráfica gris/cacao de Auditoría de Vitanova */
            if (tipoNormalizado === 'bateria' && a.descripcion?.includes('🔐')) {
              config = { icon: '🔐', color: '#4A4540', bg: '#F2F1ED' };
            }

            return (
              <View key={a.id} style={[styles.alertaCard, { backgroundColor: config.bg, borderColor: config.color + '40' }]}>
                <View style={[styles.alertaIconWrap, { backgroundColor: config.color + '20' }]}>
                  <Text style={styles.alertaIcon}>{config.icon}</Text>
                </View>
                <View style={styles.alertaContent}>
                  <View style={styles.alertaHeader}>
                    {/* Si es el log de auditoría forzamos el título limpio, sino el tipo original */}
                    <Text style={[styles.alertaTipo, { color: config.color }]}>
                      {a.descripcion?.includes('🔐') ? 'AUDITORÍA' : a.tipo.toUpperCase()}
                    </Text>
                    <View style={[styles.severidadPill, {
                      backgroundColor: a.severidad === 'alta' ? COLORS.redPale :
                        a.severidad === 'media' ? COLORS.amberPale : COLORS.greenPale
                    }]}>
                      <Text style={[styles.severidadText, {
                        color: a.severidad === 'alta' ? COLORS.red :
                          a.severidad === 'media' ? COLORS.amber : COLORS.green
                      }]}>{a.severidad}</Text>
                    </View>
                  </View>
                  
                  {a.descripcion && (
                    <Text style={styles.alertaDesc}>{a.descripcion}</Text>
                  )}
                  
                  <Text style={styles.alertaFecha}>
                    {new Date(a.created_at).toLocaleString('es-MX', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  emptyText: { fontSize: 13, color: COLORS.textLight },
  alertaCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, flexDirection: 'row', gap: 12 },
  alertaIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  alertaIcon: { fontSize: 22 },
  alertaContent: { flex: 1 },
  alertaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertaTipo: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  severidadPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  severidadText: { fontSize: 9, fontWeight: '700' },
  alertaDesc: { fontSize: 13, color: COLORS.textDark, marginBottom: 4 },
  alertaFecha: { fontSize: 10, color: COLORS.textLight, marginBottom: 8 },
  resolverBtn: { backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  resolverBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textDark },
  resueltaText: { fontSize: 11, color: COLORS.green, fontWeight: '600' },
});