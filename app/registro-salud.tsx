import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getToken } from '../services/api';

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
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
};

export default function RegistroSaludScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paciente = params.paciente ? JSON.parse(params.paciente as string) : null;
  const momento = (params.momento as string) ?? 'inicio_turno';
  const condiciones: string[] = paciente?.condiciones_medicas ?? [];

  const tieneCondicion = (keywords: string[]) =>
    condiciones.some(c => keywords.some(k => c.toLowerCase().includes(k.toLowerCase())));

  const esDiabetico = tieneCondicion(['diabetes', 'dm', 'glucosa']);
  const tieneEPOC = tieneCondicion(['epoc', 'asma', 'respirat', 'pulmonar']);
  const tieneHipertension = tieneCondicion(['hipertension', 'hta', 'presion']);
  const tieneCardiaco = tieneCondicion(['cardiaco', 'cardiaca', 'insuficiencia', 'arritmia']);
  const tieneDemencia = tieneCondicion(['alzheimer', 'demencia', 'deterioro cognitivo']);

  // Generales
  const [spo2, setSpo2] = useState(98);
  const [sistolica, setSistolica] = useState(120);
  const [diastolica, setDiastolica] = useState(80);
  const [fc, setFc] = useState(72);
  const [fr, setFr] = useState(16);
  const [dolorEva, setDolorEva] = useState(0);
  const [estadoAnimo, setEstadoAnimo] = useState('bien');
  const [hidratacion, setHidratacion] = useState(0);
  const [alimentacion, setAlimentacion] = useState('bien');
  const [deposicion, setDeposicion] = useState<boolean | null>(null);
  const [horas_sueno, setHorasSueno] = useState(7.0);

  // Diabetes
  const [glucosa, setGlucosa] = useState(100);
  const [glucosaMomento, setGlucosaMomento] = useState('ayunas');
  const [revisionPie, setRevisionPie] = useState<boolean | null>(null);

  // EPOC
  const [usoInhalador, setUsoInhalador] = useState(false);

  // Cardiaco
  const [edema, setEdema] = useState<boolean | null>(null);

  // Demencia
  const [orientacionPersona, setOrientacionPersona] = useState<boolean | null>(null);
  const [orientacionLugar, setOrientacionLugar] = useState<boolean | null>(null);
  const [orientacionTiempo, setOrientacionTiempo] = useState<boolean | null>(null);
  const [agitacion, setAgitacion] = useState(0);
  const [episodioConfusion, setEpisodioConfusion] = useState(false);

  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);

  const guardar = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/registros/salud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paciente_id: paciente.id,
          momento,
          spo2, presion_sistolica: sistolica, presion_diastolica: diastolica,
          frecuencia_cardiaca: fc, frecuencia_respiratoria: fr,
          dolor_eva: dolorEva, estado_animo: estadoAnimo,
          hidratacion_vasos: hidratacion, alimentacion,
          deposicion, horas_sueno,
          ...(esDiabetico && { glucosa, glucosa_momento: glucosaMomento, revision_pie: revisionPie }),
          ...(tieneEPOC && { uso_inhalador: usoInhalador }),
          ...(tieneCardiaco && { edema_piernas: edema }),
          ...(tieneDemencia && {
            orientacion_persona: orientacionPersona,
            orientacion_lugar: orientacionLugar,
            orientacion_tiempo: orientacionTiempo,
            agitacion, episodio_confusion: episodioConfusion,
          }),
        }),
      });
      const data = await res.json();
      if (data.alertas?.length > 0) {
        setAlertas(data.alertas);
      } else {
        router.replace({
          pathname: '/cuidador' as any,
          params: { vistaInicial: 'turno', paciente: params.paciente }
});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const momentoLabel: Record<string, string> = {
    inicio_turno: 'Inicio de turno',
    cierre_turno: 'Cierre de turno',
    post_medicamento: 'Post medicamento',
    post_comida: 'Post comida',
    espontaneo: 'Registro espontáneo',
  };

  if (alertas.length > 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#D94F4F" />
        <View style={[styles.header, { backgroundColor: '#D94F4F' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>⚠️ Alertas detectadas</Text>
            <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
          </View>
        </View>
        <ScrollView style={styles.body}>
          {alertas.map((a, i) => (
            <View key={i} style={styles.alertaCard}>
              <Text style={styles.alertaText}>{a}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.confirmarBtn} onPress={() => router.back()}>
            <Text style={styles.confirmarBtnText}>Entendido — continuar</Text>
          </TouchableOpacity>
        </ScrollView>
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
          <Text style={styles.greeting}>{momentoLabel[momento]}</Text>
          <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* SIGNOS BÁSICOS */}
        <Text style={styles.sectionTitle}>Signos vitales</Text>

        <View style={styles.signoCard}>
          <Text style={styles.signoLabel}>SpO₂</Text>
          <View style={styles.signoControles}>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.max(80, v - 1))}>
              <Text style={styles.signoBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.signoVal}>{spo2}%</Text>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setSpo2(v => Math.min(100, v + 1))}>
              <Text style={styles.signoBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.signoCard, { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
          <Text style={styles.signoLabel}>Presión arterial</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: COLORS.textLight, marginBottom: 4 }}>SIS</Text>
              <View style={styles.signoControles}>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setSistolica(v => Math.max(80, v - 1))}>
                  <Text style={styles.signoBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.signoVal}>{sistolica}</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setSistolica(v => Math.min(200, v + 1))}>
                  <Text style={styles.signoBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ fontSize: 20, color: COLORS.textLight }}>/</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: COLORS.textLight, marginBottom: 4 }}>DIA</Text>
              <View style={styles.signoControles}>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setDiastolica(v => Math.max(40, v - 1))}>
                  <Text style={styles.signoBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.signoVal}>{diastolica}</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setDiastolica(v => Math.min(130, v + 1))}>
                  <Text style={styles.signoBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.signoCard}>
          <Text style={styles.signoLabel}>Frec. cardíaca</Text>
          <View style={styles.signoControles}>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setFc(v => Math.max(40, v - 1))}>
              <Text style={styles.signoBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.signoVal}>{fc} bpm</Text>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setFc(v => Math.min(180, v + 1))}>
              <Text style={styles.signoBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.signoCard}>
          <Text style={styles.signoLabel}>Frec. respiratoria</Text>
          <View style={styles.signoControles}>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setFr(v => Math.max(8, v - 1))}>
              <Text style={styles.signoBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.signoVal}>{fr} rpm</Text>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setFr(v => Math.min(40, v + 1))}>
              <Text style={styles.signoBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DOLOR EVA */}
        <Text style={styles.sectionTitle}>Dolor (EVA 0-10)</Text>
        <View style={styles.evaContainer}>
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.evaBtn, dolorEva === n && styles.evaBtnActive,
                n >= 7 && dolorEva === n && { backgroundColor: COLORS.red, borderColor: COLORS.red }]}
              onPress={() => setDolorEva(n)}
            >
              <Text style={[styles.evaBtnText, dolorEva === n && styles.evaBtnTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ESTADO DE ÁNIMO */}
        <Text style={styles.sectionTitle}>Estado de ánimo</Text>
        <View style={styles.estadoRow}>
          {[{ val: 'bien', icon: '😊' }, { val: 'regular', icon: '😐' }, { val: 'bajo', icon: '😔' }].map(e => (
            <TouchableOpacity
              key={e.val}
              style={[styles.estadoCard, estadoAnimo === e.val && styles.estadoCardActive]}
              onPress={() => setEstadoAnimo(e.val)}
            >
              <Text style={{ fontSize: 28 }}>{e.icon}</Text>
              <Text style={[styles.estadoLabel, estadoAnimo === e.val && { color: COLORS.gold }]}>{e.val}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* HIDRATACIÓN */}
        <Text style={styles.sectionTitle}>Hidratación</Text>
        <View style={styles.signoCard}>
          <Text style={styles.signoLabel}>Vasos de agua</Text>
          <View style={styles.signoControles}>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setHidratacion(v => Math.max(0, v - 1))}>
              <Text style={styles.signoBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.signoVal}>{hidratacion} 💧</Text>
            <TouchableOpacity style={styles.signoBtn} onPress={() => setHidratacion(v => v + 1)}>
              <Text style={styles.signoBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ALIMENTACIÓN */}
        <Text style={styles.sectionTitle}>Alimentación</Text>
        <View style={styles.estadoRow}>
          {[{ val: 'bien', label: '🍽️ Bien' }, { val: 'regular', label: '😐 Regular' }, { val: 'poco', label: '😕 Poco' }, { val: 'nada', label: '❌ Nada' }].map(a => (
            <TouchableOpacity
              key={a.val}
              style={[styles.estadoCard, { padding: 8 }, alimentacion === a.val && styles.estadoCardActive]}
              onPress={() => setAlimentacion(a.val)}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: alimentacion === a.val ? COLORS.gold : COLORS.textLight, textAlign: 'center' }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DIABETES */}
        {esDiabetico && (
          <>
            <Text style={styles.sectionTitle}>🩸 Diabetes</Text>
            <View style={styles.signoCard}>
              <Text style={styles.signoLabel}>Glucosa (mg/dL)</Text>
              <View style={styles.signoControles}>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setGlucosa(v => Math.max(40, v - 5))}>
                  <Text style={styles.signoBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.signoVal}>{glucosa}</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setGlucosa(v => Math.min(500, v + 5))}>
                  <Text style={styles.signoBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.opcionesRow}>
              {['ayunas', 'pre_comida', 'post_comida', 'antes_dormir'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.opcionBtn, glucosaMomento === m && styles.opcionBtnActive]}
                  onPress={() => setGlucosaMomento(m)}
                >
                  <Text style={[styles.opcionBtnText, glucosaMomento === m && styles.opcionBtnTextActive]}>
                    {m.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.boolCard}>
              <Text style={styles.signoLabel}>Revisión de pie diabético</Text>
              <View style={styles.boolBtns}>
                <TouchableOpacity style={[styles.boolBtn, revisionPie === true && styles.boolBtnSi]} onPress={() => setRevisionPie(true)}>
                  <Text style={[styles.boolBtnText, revisionPie === true && { color: COLORS.green }]}>✓ Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.boolBtn, revisionPie === false && styles.boolBtnNo]} onPress={() => setRevisionPie(false)}>
                  <Text style={[styles.boolBtnText, revisionPie === false && { color: COLORS.red }]}>✗ No</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* EPOC */}
        {tieneEPOC && (
          <>
            <Text style={styles.sectionTitle}>🫁 EPOC / Respiratorio</Text>
            <View style={styles.boolCard}>
              <Text style={styles.signoLabel}>Uso de inhalador</Text>
              <View style={styles.boolBtns}>
                <TouchableOpacity style={[styles.boolBtn, usoInhalador === true && styles.boolBtnSi]} onPress={() => setUsoInhalador(true)}>
                  <Text style={[styles.boolBtnText, usoInhalador === true && { color: COLORS.green }]}>✓ Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.boolBtn, usoInhalador === false && styles.boolBtnNo]} onPress={() => setUsoInhalador(false)}>
                  <Text style={[styles.boolBtnText, usoInhalador === false && { color: COLORS.red }]}>✗ No</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* DEMENCIA */}
        {tieneDemencia && (
          <>
            <Text style={styles.sectionTitle}>🧠 Alzheimer / Demencia</Text>
            {[
              { label: 'Orientado en persona', val: orientacionPersona, set: setOrientacionPersona },
              { label: 'Orientado en lugar', val: orientacionLugar, set: setOrientacionLugar },
              { label: 'Orientado en tiempo', val: orientacionTiempo, set: setOrientacionTiempo },
              { label: 'Episodio de confusión', val: episodioConfusion, set: setEpisodioConfusion },
            ].map((item, i) => (
              <View key={i} style={styles.boolCard}>
                <Text style={styles.signoLabel}>{item.label}</Text>
                <View style={styles.boolBtns}>
                  <TouchableOpacity style={[styles.boolBtn, item.val === true && styles.boolBtnSi]} onPress={() => item.set(true as any)}>
                    <Text style={[styles.boolBtnText, item.val === true && { color: COLORS.green }]}>✓ Sí</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.boolBtn, item.val === false && styles.boolBtnNo]} onPress={() => item.set(false as any)}>
                    <Text style={[styles.boolBtnText, item.val === false && { color: COLORS.red }]}>✗ No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.sectionTitle}>Agitación (0-3)</Text>
            <View style={styles.evaContainer}>
              {[0,1,2,3].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.evaBtn, { flex: 1 }, agitacion === n && styles.evaBtnActive]}
                  onPress={() => setAgitacion(n)}
                >
                  <Text style={[styles.evaBtnText, agitacion === n && styles.evaBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={[styles.confirmarBtn, loading && { opacity: 0.7 }]} onPress={guardar} disabled={loading}>
          <Text style={styles.confirmarBtnText}>{loading ? 'Guardando...' : 'Guardar registro'}</Text>
        </TouchableOpacity>

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
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 10, marginTop: 8 },
  signoCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  signoControles: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  signoBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  signoVal: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, minWidth: 60, textAlign: 'center' },
  evaContainer: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  evaBtn: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  evaBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  evaBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  evaBtnTextActive: { color: COLORS.gold },
  estadoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginTop: 4 },
  boolCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  boolBtns: { flexDirection: 'row', gap: 8 },
  boolBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  boolBtnSi: { backgroundColor: COLORS.greenPale, borderColor: COLORS.green },
  boolBtnNo: { backgroundColor: COLORS.redPale, borderColor: COLORS.red },
  boolBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  opcionesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  opcionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  opcionBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  opcionBtnText: { fontSize: 11, color: COLORS.textLight },
  opcionBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
  alertaCard: { backgroundColor: COLORS.redPale, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)', borderLeftWidth: 4, borderLeftColor: COLORS.red },
  alertaText: { fontSize: 13, color: COLORS.red, fontWeight: '600' },
  confirmarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  textDark: { color: COLORS.textDark },
});