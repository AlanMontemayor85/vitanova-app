import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
  // 🚨 EMERGENCIAS Y SEGURIDAD FÍSICA
  SOS: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' },
  sos: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' },
  CAIDA: { icon: '⚠️', color: '#D4860A', bg: '#FFF4E0' },
  caida: { icon: '⚠️', color: '#D4860A', bg: '#FFF4E0' },
  geocerca: { icon: '📍', color: '#D4860A', bg: '#FFF4E0' },

  // 🩸 ALERTAS CLÍNICAS Y SIGNOS VITALES (RELOJ Y MANUAL)
  signo_vital: { icon: '🩺', color: '#D94F4F', bg: '#FDEAEA' },
  vitales: { icon: '🩺', color: '#D94F4F', bg: '#FDEAEA' },
  vitales_criticos: { icon: '🚨', color: '#D94F4F', bg: '#FDEAEA' },
  spo2: { icon: '🫁', color: '#2B70C9', bg: '#EBF3FC' },
  presion: { icon: '🩸', color: '#D94F4F', bg: '#FDEAEA' },
  temperatura: { icon: '🌡️', color: '#D4860A', bg: '#FFF4E0' },
  glucosa: { icon: '🍬', color: '#D94F4F', bg: '#FDEAEA' },
  frecuencia_cardiaca: { icon: '❤️', color: '#D94F4F', bg: '#FDEAEA' },
  fc: { icon: '❤️', color: '#D94F4F', bg: '#FDEAEA' },
  salud: { icon: '🏥', color: '#D94F4F', bg: '#FDEAEA' },

  // 📝 MEDICAMENTOS Y OPERACIÓN DE TURNO
  medicamento: { icon: '💊', color: '#BF9A40', bg: '#F5EDD8' },
  dispositivo: { icon: '📱', color: '#8A8078', bg: '#F1EFE8' },
  inicio_turno: { icon: '⏳', color: '#BF9A40', bg: '#F5EDD8' },
  cierre_turno: { icon: '🏁', color: '#2E7D32', bg: '#E8F5E9' },
  auditoria: { icon: '🔐', color: '#4A4540', bg: '#F2F1ED' },

  // 🔔 DEFAULT / OTROS
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

  // 🎯 FIX: Usamos useFocusEffect para que SIEMPRE refresque las alertas al abrir la pantalla
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const cargar = async () => {
        try {
          await loadStoredToken();
          const data = await getPacientes('alertas-focus');
          if (data.patients && data.patients.length > 0) {
            const p = pacienteIdParam 
              ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
              : data.patients[0];
            
            if (isMounted) setPaciente(p);

            const alertasData = await getAlertas(p.id);
            if (isMounted && alertasData.alertas) {
              setAlertas(alertasData.alertas);
            }
          }
        } catch (e) {
          console.error("❌ Error al cargar alertas:", e);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      cargar();

      return () => {
        isMounted = false;
      };
    }, [pacienteIdParam])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // 🎯 FILTRADO POR ROL
  const alertasVisibles = (userRol?.toLowerCase() === 'cuidador')
    ? alertas.filter(a => !(a.descripcion || a.mensaje || '')?.includes('🔐'))
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
            const tipoNormalizado = a.tipo?.toLowerCase() || 'otro';
            let config = TIPO_CONFIG[tipoNormalizado] ?? TIPO_CONFIG.otro;

            // 🎯 CONSOLIDACIÓN DE TEXTO: Lee tanto 'descripcion' como 'mensaje' o 'texto'
            const desc = a.descripcion || a.mensaje || a.texto || '';
            const descUpper = desc.toUpperCase();

            /* 🎯 INTERCEPTORES MEJORADOS POR TEXTO O EMOJIS (ESTANDARIZADOS) */

            // 1. Auditoría
            if (desc.includes('🔐')) {
              config = { icon: '🔐', color: '#4A4540', bg: '#F2F1ED' };
            }
            // 2. Cierre de turno
            else if (desc.includes('🏁') || desc.includes('🔒') || descUpper.includes('CIERRE TURNO') || descUpper.includes('CONCLUIDO') || descUpper.includes('FIN TURNO')) {
              config = { icon: '🏁', color: COLORS.green, bg: COLORS.greenPale };
            }
            // 3. Inicio de turno
            else if (desc.includes('⏳') || descUpper.includes('INICIO TURNO')) {
              config = { icon: '⏳', color: COLORS.gold, bg: COLORS.goldPale };
            }
            // 4. Caída
            else if (tipoNormalizado === 'caida' || descUpper.includes('CAÍDA') || descUpper.includes('CAIDA')) {
              config = TIPO_CONFIG.caida;
            }
            // 5. SOS / Pánico
            else if (tipoNormalizado === 'sos' || descUpper.includes('SOS') || descUpper.includes('PÁNICO')) {
              config = TIPO_CONFIG.SOS;
            }
            // 🫁 6. Oxígeno / SpO2
            else if (descUpper.includes('SPO2') || descUpper.includes('SATURACI') || desc.includes('🫁')) {
              config = TIPO_CONFIG.spo2;
            }
            // 🩸 7. Presión Arterial
            else if (descUpper.includes('PRESI') || descUpper.includes('SISTOLICA') || descUpper.includes('DIASTOLICA') || desc.includes('🩸')) {
              config = TIPO_CONFIG.presion;
            }
            // 🌡️ 8. Temperatura / Fiebre
            else if (descUpper.includes('TEMPERATURA') || descUpper.includes('FIEBRE') || descUpper.includes('FEBRÍCULA') || desc.includes('🌡️') || desc.includes('🥶')) {
              config = TIPO_CONFIG.temperatura;
            }
            // 🍬 9. Glucosa / Diabetes
            else if (descUpper.includes('GLUCOSA') || descUpper.includes('HIPOGLUCEMIA') || descUpper.includes('HIPERGLUCEMIA') || desc.includes('🍬')) {
              config = TIPO_CONFIG.glucosa;
            }
            // ❤️ 10. Frecuencia Cardíaca / Pulso
            else if (descUpper.includes('TAQUICARDIA') || descUpper.includes('BRADICARDIA') || descUpper.includes('PULSO') || descUpper.includes('FRECUENCIA CARD') || desc.includes('❤️')) {
              config = TIPO_CONFIG.frecuencia_cardiaca;
            }
            // 🩺 11. Toma Manual Genérica
            else if (descUpper.includes('TOMA MANUAL') || desc.includes('🩺')) {
              config = TIPO_CONFIG.signo_vital;
            }

            // 🏷️ Etiqueta dinámica de cabecera (Limpia y Estandarizada)
            const tituloTipo = desc.includes('🔐') ? 'AUDITORÍA' :
              (desc.includes('🏁') || desc.includes('🔒') || descUpper.includes('CIERRE TURNO') || descUpper.includes('CONCLUIDO') || descUpper.includes('FIN TURNO')) ? 'TURNO CONCLUIDO' :
              (desc.includes('⏳') || descUpper.includes('INICIO TURNO')) ? 'INICIO TURNO' :
              (tipoNormalizado === 'caida' || descUpper.includes('CAÍDA') || descUpper.includes('CAIDA')) ? 'CAÍDA DETECTADA' :
              (tipoNormalizado === 'sos' || descUpper.includes('SOS')) ? 'EMERGENCIA SOS' :
              (descUpper.includes('SPO2') || descUpper.includes('SATURACI')) ? 'SATURACIÓN SPO2' :
              (descUpper.includes('PRESI') || descUpper.includes('SISTOLICA')) ? 'PRESIÓN ARTERIAL' :
              (descUpper.includes('TEMPERATURA') || descUpper.includes('FIEBRE') || descUpper.includes('FEBRÍCULA')) ? 'TEMPERATURA' :
              (descUpper.includes('GLUCOSA') || descUpper.includes('HIPOGLUCEMIA') || descUpper.includes('HIPERGLUCEMIA')) ? 'GLUCOSA' :
              (descUpper.includes('TAQUICARDIA') || descUpper.includes('BRADICARDIA') || descUpper.includes('PULSO') || descUpper.includes('FRECUENCIA CARD')) ? 'FRECUENCIA CARDÍACA' :
              (a.tipo ? a.tipo.toUpperCase().replace('_', ' ') : 'ALERTA MÉDICA');

            return (
              <View key={a.id || Math.random().toString()} style={[styles.alertaCard, { backgroundColor: config.bg, borderColor: config.color }]}>
                <View style={[styles.alertaIconWrap, { backgroundColor: config.bg }]}>
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
                      }]}>{a.severidad || 'baja'}</Text>
                    </View>
                  </View>
                  
                  {desc ? (
                    <Text style={styles.alertaDesc}>{desc}</Text>
                  ) : null}
                  
                  <Text style={styles.alertaFecha}>
                    {a.created_at ? new Date(a.created_at).toLocaleString('es-MX', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    }) : 'Hace un momento'}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cacao,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginRight: 15,
    padding: 5,
  },
  backIcon: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  greeting: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  userName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 40,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertaIcon: {
    fontSize: 20,
  },
  alertaContent: {
    flex: 1,
  },
  alertaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertaTipo: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  severidadPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severidadText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  alertaDesc: {
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 6,
    lineHeight: 20,
  },
  alertaFecha: {
    fontSize: 11,
    color: COLORS.textLight,
  },
});