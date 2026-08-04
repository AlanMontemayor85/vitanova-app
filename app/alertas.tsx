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
  blue: '#2B70C9',
  bluePale: '#EBF3FC',
};

const TIPO_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  SOS: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' },
  sos: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' },
  CAIDA: { icon: '⚠️', color: '#D4860A', bg: '#FFF4E0' },
  caida: { icon: '⚠️', color: '#D4860A', bg: '#FFF4E0' },
  geocerca: { icon: '📍', color: '#D4860A', bg: '#FFF4E0' },
  medicamento: { icon: '💊', color: '#BF9A40', bg: '#F5EDD8' },
  dispositivo: { icon: '📱', color: '#8A8078', bg: '#F1EFE8' },
  
  // 🩸 ALERTAS CLÍNICAS Y DE SIGNOS VITALES
  signo_vital: { icon: '🩺', color: '#D94F4F', bg: '#FDEAEA' },
  vitales: { icon: '🩺', color: '#D94F4F', bg: '#FDEAEA' },
  spo2: { icon: '🫁', color: '#2B70C9', bg: '#EBF3FC' },
  presion: { icon: '🩸', color: '#D94F4F', bg: '#FDEAEA' },
  temperatura: { icon: '🌡️', color: '#D4860A', bg: '#FFF4E0' },
  salud: { icon: '🏥', color: '#D94F4F', bg: '#FDEAEA' },
  
  otro: { icon: '🔔', color: '#8A8078', bg: '#F1EFE8' },
};

export default function AlertasScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userRol = (params.rol as string) || 'familiar';

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
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

  // 🎯 FILTRADO POR ROL
  // Si es cuidador, únicamente filtramos notas internas de auditoría '🔐'
  // pero PERMITIMOS ver todas las alertas clínicas (SpO2, Presión, Temperatura) e inicios/cierres de turno.
  const alertasVisibles = (userRol?.toLowerCase() === 'cuidador')
    ? alertas.filter(a => !a.descripcion?.includes('🔐'))
    : alertas;

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
            const desc = a.descripcion || '';

            /* 🎯 INTERCEPTORES POR CONTENIDO / EMOJIS EN LA DESCRIPCIÓN */
            
            // 1. Auditoría
            if (desc.includes('🔐')) {
              config = { icon: '🔐', color: '#4A4540', bg: '#F2F1ED' };
            }
            // 2. Cierre de turno
            else if (desc.includes('🏁') || desc.includes('🔒')) {
              config = { icon: '🏁', color: COLORS.green, bg: COLORS.greenPale };
            }
            // 3. Inicio de turno
            else if (desc.includes('⏳')) {
              config = { icon: '⏳', color: COLORS.gold, bg: COLORS.goldPale };
            }
            // 🫁 4. Oxígeno / SpO2 Bajo
            else if (desc.toLowerCase().includes('spo2') || desc.toLowerCase().includes('saturaci') || desc.includes('🫁')) {
              config = { icon: '🫁', color: COLORS.blue, bg: COLORS.bluePale };
            }
            // 🩸 5. Presión Arterial (Alta o Baja)
            else if (desc.toLowerCase().includes('presi') || desc.toLowerCase().includes('sistolica') || desc.includes('🩸')) {
              config = { icon: '🩸', color: COLORS.red, bg: COLORS.redPale };
            }
            // 🌡️ 6. Temperatura / Fiebre / Febrícula / Hipotermia
            else if (desc.toLowerCase().includes('temperatura') || desc.toLowerCase().includes('fiebre') || desc.toLowerCase().includes('febrícula') || desc.includes('🌡️') || desc.includes('🥶')) {
              config = { icon: '🌡️', color: COLORS.amber, bg: COLORS.amberPale };
            }

            // Etiqueta dinámica de cabecera
            const tituloTipo = desc.includes('🔐') ? 'AUDITORÍA' :
              (desc.includes('🏁') || desc.includes('🔒')) ? 'TURNO CONCLUIDO' :
              desc.includes('⏳') ? 'INICIO TURNO' :
              (desc.toLowerCase().includes('spo2') || desc.toLowerCase().includes('saturaci')) ? 'SATURACIÓN SPO2' :
              desc.toLowerCase().includes('presi') ? 'PRESIÓN ARTERIAL' :
              (desc.toLowerCase().includes('temperatura') || desc.toLowerCase().includes('fiebre') || desc.toLowerCase().includes('febrícula')) ? 'TEMPERATURA' :
              (a.tipo ? a.tipo.toUpperCase() : 'ALERTA');

            return (
              <View key={a.id} style={[styles.alertaCard, { backgroundColor: config.bg, borderColor: config.color + '40' }]}>
                <View style={[styles.alertaIconWrap, { backgroundColor: config.color + '20' }]}>
                  <Text style={styles.alertaIcon}>{config.icon}</Text>
                </View>
                <View style={styles.alertaContent}>
                  <View style={styles.alertaHeader}>
                    <Text style={[styles.alertaTipo, { color: config.color }]}>
                      {tituloTipo}
                    </Text>
                    <View style={[styles.severidadPill, {
                      backgroundColor: a.severidad === 'alta' ? COLORS.redPale :
                        a.severidad === 'media' ? COLORS.amberPale : COLORS.greenPale
                    }]}>
                      <Text style={[styles.severidadText, {
                        color: a.severidad === 'alta' ? COLORS.red :
                          a.severidad === 'media' ? COLORS.amber : COLORS.green
                      }]}>{a.severidad || 'media'}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cacao,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: { marginRight: 15, padding: 5 },
  backIcon: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' },
  greeting: { color: COLORS.gold, fontSize: 14, fontWeight: '600' },
  userName: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  body: { flex: 1, padding: 20 },
  emptyCard: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 40,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark },
  emptyText: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  alertaCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  alertaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center', // 👈 ¡Listo!
    alignItems: 'center',
    marginRight: 12,
  },
  alertaIcon: { fontSize: 20 },
  alertaContent: { flex: 1 },
  alertaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertaTipo: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  severidadPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  severidadText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  alertaDesc: { fontSize: 14, color: COLORS.textDark, marginBottom: 6, lineHeight: 20 },
  alertaFecha: { fontSize: 11, color: COLORS.textLight },
});