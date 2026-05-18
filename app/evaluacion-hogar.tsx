import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { crearEvaluacion, crearLead, getEvaluaciones, getPacientes, loadStoredToken } from '../services/api';


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

type Paso = 'perfil' | 'entrada' | 'bano' | 'sala' | 'recamara' | 'escaleras' | 'demencia' | 'respiratorio' | 'resultado';


export default function EvaluacionHogarScreen() {

  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('perfil');
  const [paciente, setPaciente] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [ultimaEvaluacion, setUltimaEvaluacion] = useState<any>(null);
  const [loadingEval, setLoadingEval] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        await loadStoredToken();
        const data = await getPacientes();
        if (data.patients && data.patients.length > 0) {
          const p = data.patients[0];
          setPaciente(p);
          const evals = await getEvaluaciones(p.id);
          if (evals.evaluaciones && evals.evaluaciones.length > 0) {
            setUltimaEvaluacion(evals.evaluaciones[0]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingEval(false);
      }
    };
    cargar();
  }, []);

  // PERFIL
  const [tieneDemencia, setTieneDemencia] = useState(false);
  const [tieneRespiratorio, setTieneRespiratorio] = useState(false);
  const [tieneDiabetes, setTieneDiabetes] = useState(false);
  const [historialCaidas, setHistorialCaidas] = useState(false);
  const [usaMovilidad, setUsaMovilidad] = useState(false);

  // RESPUESTAS
  const [r, setR] = useState<Record<string, boolean>>({});
  const resp = (key: string, val: boolean) => setR(prev => ({ ...prev, [key]: val }));

  // Calcular pasos según perfil
  const pasos: Paso[] = ['perfil', 'entrada', 'bano', 'sala', 'recamara', 'escaleras'];
  if (tieneDemencia) pasos.push('demencia');
  if (tieneRespiratorio) pasos.push('respiratorio');
  pasos.push('resultado');

  const pasoActual = pasos.indexOf(paso);
  const totalPasos = pasos.length;

  const siguiente = async () => {
    const idx = pasos.indexOf(paso);
    if (idx < pasos.length - 2) {
      setPaso(pasos[idx + 1]);
    } else {
      await enviar();
    }
  };

  const anterior = () => {
    const idx = pasos.indexOf(paso);
    if (idx > 0) setPaso(pasos[idx - 1]);
  };

  const enviar = async () => {
    setGuardando(true);
    try {
      await loadStoredToken();
      const data = await getPacientes();
      const p = data.patients?.[0];
      const res = await crearEvaluacion({
        paciente_id: p?.id,
        tiene_demencia: tieneDemencia,
        tiene_respiratorio: tieneRespiratorio,
        tiene_diabetes: tieneDiabetes,
        historial_caidas: historialCaidas,
        usa_movilidad: usaMovilidad,
        respuestas: r,
      });
      setResultado(res);
      setPaso('resultado');
    } catch (e) {
      console.error(e);
    } finally {
      setGuardando(false);
    }
  };

  const PreguntaSiNo = ({ label, keyName }: { label: string; keyName: string }) => (
    <View style={styles.pregunta}>
      <Text style={styles.preguntaLabel}>{label}</Text>
      <View style={styles.siNoRow}>
        <TouchableOpacity
          style={[styles.siNoBtn, r[keyName] === true && styles.siNoBtnSi]}
          onPress={() => resp(keyName, true)}
        >
          <Text style={[styles.siNoBtnText, r[keyName] === true && { color: COLORS.green }]}>✓ Sí</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.siNoBtn, r[keyName] === false && styles.siNoBtnNo]}
          onPress={() => resp(keyName, false)}
        >
          <Text style={[styles.siNoBtnText, r[keyName] === false && { color: COLORS.red }]}>✗ No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const PerfilToggle = ({ label, val, set }: { label: string; val: boolean; set: (v: boolean) => void }) => (
    <TouchableOpacity
      style={[styles.perfilBtn, val && styles.perfilBtnActive]}
      onPress={() => set(!val)}
    >
      <Text style={[styles.perfilBtnText, val && styles.perfilBtnTextActive]}>{label}</Text>
      {val && <Text style={{ color: COLORS.gold, fontWeight: '800' }}>✓</Text>}
    </TouchableOpacity>
  );

  // ── RESULTADO ──
  if (paso === 'resultado' && resultado) {
    const color = resultado.nivel_riesgo === 'alto' ? COLORS.red :
      resultado.nivel_riesgo === 'moderado' ? COLORS.amber : COLORS.green;
    const bg = resultado.nivel_riesgo === 'alto' ? COLORS.redPale :
      resultado.nivel_riesgo === 'moderado' ? COLORS.amberPale : COLORS.greenPale;
    const emoji = resultado.nivel_riesgo === 'alto' ? '🔴' :
      resultado.nivel_riesgo === 'moderado' ? '🟡' : '🟢';

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Evaluación completa</Text>
            <Text style={styles.userName}>Resultado</Text>
          </View>
        </View>

        <ScrollView style={styles.body}>
          <View style={[styles.resultadoCard, { backgroundColor: bg, borderColor: color + '40' }]}>
            <Text style={styles.resultadoEmoji}>{emoji}</Text>
            <Text style={[styles.resultadoNivel, { color }]}>
              Riesgo {resultado.nivel_riesgo.toUpperCase()}
            </Text>
            <Text style={styles.resultadoScore}>Score: {resultado.score_total} pts</Text>
          </View>

          <Text style={styles.sectionTitle}>
            {resultado.total_recomendaciones} recomendaciones encontradas
          </Text>

          {resultado.recomendaciones?.map((rec: any, i: number) => (
            <View key={i} style={styles.recCard}>
              <View style={styles.recHeader}>
                <View style={[styles.recPrioridadDot, {
                  backgroundColor: rec.prioridad === 'alta' ? COLORS.red : COLORS.amber
                }]} />
                <Text style={styles.recCategoria}>{rec.categoria}</Text>
              </View>
              <Text style={styles.recItem}>{rec.item}</Text>
              {rec.producto && (
                <View style={styles.recProducto}>
                  <Text style={styles.recProductoText}>🛍️ {rec.producto}</Text>
                </View>
              )}
            </View>
          ))}

          {resultado.nivel_riesgo !== 'bajo' && (
            <TouchableOpacity 
            style={styles.solicitarBtn}
            onPress={async () => {
                console.log('SOLICITAR PRESSED');
                try {
                await crearLead({
                    nombre: paciente?.nombre_completo ?? 'Familiar',
                    telefono: '—',
                    motivo: 'adaptacion_hogar',
                    mensaje: `Solicitud de evaluación profesional del hogar. Nivel de riesgo: ${resultado?.nivel_riesgo ?? ultimaEvaluacion?.nivel_riesgo}. Score: ${resultado?.score_total ?? ultimaEvaluacion?.score_total} pts.`,
                });
                Alert.alert('¡Solicitud enviada! Te contactaremos pronto.');
                } catch (e) {
                console.error(e);
                }
            }}
            >
            <Text style={styles.solicitarBtnText}>📋 Solicitar evaluación profesional</Text>
            <Text style={styles.solicitarBtnSub}>Un especialista certificado visitará el hogar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cerrarBtn} onPress={() => router.back()}>
            <Text style={styles.cerrarBtnText}>Finalizar</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    );
  }
if (loadingEval) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
      <ActivityIndicator size="large" color={COLORS.gold} />
    </View>
  );
}

if (ultimaEvaluacion && paso === 'perfil' && !resultado) {
  const color = ultimaEvaluacion.nivel_riesgo === 'alto' ? COLORS.red :
    ultimaEvaluacion.nivel_riesgo === 'moderado' ? COLORS.amber : COLORS.green;
  const bg = ultimaEvaluacion.nivel_riesgo === 'alto' ? COLORS.redPale :
    ultimaEvaluacion.nivel_riesgo === 'moderado' ? COLORS.amberPale : COLORS.greenPale;
  const emoji = ultimaEvaluacion.nivel_riesgo === 'alto' ? '🔴' :
    ultimaEvaluacion.nivel_riesgo === 'moderado' ? '🟡' : '🟢';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Evaluación del hogar</Text>
          <Text style={styles.userName}>Última evaluación</Text>
        </View>
      </View>

      <ScrollView style={styles.body}>
        <View style={[styles.resultadoCard, { backgroundColor: bg, borderColor: color + '40' }]}>
          <Text style={styles.resultadoEmoji}>{emoji}</Text>
          <Text style={[styles.resultadoNivel, { color }]}>
            Riesgo {ultimaEvaluacion.nivel_riesgo.toUpperCase()}
          </Text>
          <Text style={styles.resultadoScore}>Score: {ultimaEvaluacion.score_total} pts</Text>
          <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 6 }}>
            {new Date(ultimaEvaluacion.created_at).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          {ultimaEvaluacion.recomendaciones?.length ?? 0} recomendaciones pendientes
        </Text>

        {ultimaEvaluacion.recomendaciones?.map((rec: any, i: number) => (
          <View key={i} style={styles.recCard}>
            <View style={styles.recHeader}>
              <View style={[styles.recPrioridadDot, {
                backgroundColor: rec.prioridad === 'alta' ? COLORS.red : COLORS.amber
              }]} />
              <Text style={styles.recCategoria}>{rec.categoria}</Text>
            </View>
            <Text style={styles.recItem}>{rec.item}</Text>
            {rec.producto && (
              <View style={styles.recProducto}>
                <Text style={styles.recProductoText}>🛍️ {rec.producto}</Text>
              </View>
            )}
          </View>
        ))}

        {ultimaEvaluacion.nivel_riesgo !== 'bajo' && (
          <TouchableOpacity style={styles.solicitarBtn}>
            <Text style={styles.solicitarBtnText}>📋 Solicitar evaluación profesional</Text>
            <Text style={styles.solicitarBtnSub}>Un especialista certificado visitará el hogar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.cerrarBtn, { backgroundColor: COLORS.cacao, marginTop: 8 }]}
          onPress={() => setUltimaEvaluacion(null)}
        >
          <Text style={styles.cerrarBtnText}>🔄 Hacer nueva evaluación</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      <View style={styles.header}>
        {paso !== 'perfil' && (
          <TouchableOpacity onPress={anterior} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        {paso === 'perfil' && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Paso {pasoActual + 1} de {totalPasos}</Text>
          <Text style={styles.userName}>Evaluación del Hogar</Text>
        </View>
      </View>

      {/* BARRA DE PROGRESO */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((pasoActual + 1) / totalPasos) * 100}%` as any }]} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* PERFIL */}
        {paso === 'perfil' && (
          <>
            <Text style={styles.pasoTitulo}>Perfil del paciente</Text>
            <Text style={styles.pasoSubtitulo}>Selecciona todas las condiciones que aplican</Text>
            <PerfilToggle label="🧠 Demencia o Alzheimer" val={tieneDemencia} set={setTieneDemencia} />
            <PerfilToggle label="🫁 Dificultades respiratorias / EPOC" val={tieneRespiratorio} set={setTieneRespiratorio} />
            <PerfilToggle label="🩸 Diabetes" val={tieneDiabetes} set={setTieneDiabetes} />
            <PerfilToggle label="⚠️ Historial de caídas" val={historialCaidas} set={setHistorialCaidas} />
            <PerfilToggle label="🦽 Usa silla de ruedas, andadera o bastón" val={usaMovilidad} set={setUsaMovilidad} />
          </>
        )}

        {/* ENTRADA */}
        {paso === 'entrada' && (
          <>
            <Text style={styles.pasoTitulo}>🚪 Entrada y accesos</Text>
            <PreguntaSiNo label="¿Hay rampa de acceso o entrada al mismo nivel?" keyName="entrada_rampa" />
            <PreguntaSiNo label="¿La iluminación exterior es suficiente?" keyName="entrada_iluminacion" />
            <PreguntaSiNo label="¿La cerradura/timbre es accesible desde silla de ruedas?" keyName="entrada_accesible" />
          </>
        )}

        {/* BAÑO */}
        {paso === 'bano' && (
          <>
            <Text style={styles.pasoTitulo}>🚿 Baño</Text>
            <Text style={styles.pasoSubtitulo}>Zona de mayor riesgo de caídas</Text>
            <PreguntaSiNo label="¿Hay barras de apoyo en regadera o tina?" keyName="bano_barras" />
            <PreguntaSiNo label="¿El piso tiene material antiderrapante?" keyName="bano_antiderrapante" />
            <PreguntaSiNo label="¿El inodoro tiene altura adecuada o barras laterales?" keyName="bano_altura_inodoro" />
            <PreguntaSiNo label="¿La ducha es accesible sin borde de entrada?" keyName="bano_sin_borde" />
          </>
        )}

        {/* SALA */}
        {paso === 'sala' && (
          <>
            <Text style={styles.pasoTitulo}>🛋️ Sala y pasillos</Text>
            <PreguntaSiNo label="¿Hay tapetes o alfombras sueltas?" keyName="sala_tapetes" />
            <PreguntaSiNo label="¿Hay cables eléctricos en el piso?" keyName="sala_cables" />
            <PreguntaSiNo label="¿La iluminación en pasillos es suficiente?" keyName="sala_iluminacion" />
            <PreguntaSiNo label="¿Los pasillos tienen mínimo 90cm de ancho?" keyName="sala_ancho_pasillos" />
          </>
        )}

        {/* RECÁMARA */}
        {paso === 'recamara' && (
          <>
            <Text style={styles.pasoTitulo}>🛏️ Recámara</Text>
            <PreguntaSiNo label="¿Hay iluminación nocturna hacia el baño?" keyName="recamara_iluminacion_nocturna" />
            <PreguntaSiNo label="¿Hay paso libre de 90cm alrededor de la cama?" keyName="recamara_paso_libre" />
            <PreguntaSiNo label="¿La altura de la cama es adecuada (ni muy alta ni muy baja)?" keyName="recamara_altura_cama" />
          </>
        )}

        {/* ESCALERAS */}
        {paso === 'escaleras' && (
          <>
            <Text style={styles.pasoTitulo}>🪜 Escaleras</Text>
            <PreguntaSiNo label="¿El hogar tiene escaleras?" keyName="tiene_escaleras" />
            {r['tiene_escaleras'] && (
              <>
                <PreguntaSiNo label="¿Hay barandal en ambos lados?" keyName="escaleras_barandal" />
                <PreguntaSiNo label="¿Los escalones tienen material antiderrapante?" keyName="escaleras_antiderrapante" />
                <PreguntaSiNo label="¿Los escalones tienen altura uniforme?" keyName="escaleras_altura_uniforme" />
              </>
            )}
          </>
        )}

        {/* DEMENCIA */}
        {paso === 'demencia' && (
          <>
            <Text style={styles.pasoTitulo}>🧠 Seguridad cognitiva</Text>
            <Text style={styles.pasoSubtitulo}>Medidas especiales para Alzheimer/Demencia</Text>
            <PreguntaSiNo label="¿El paciente porta dispositivo GPS activo?" keyName="demencia_gps" />
            <PreguntaSiNo label="¿Las puertas de salida tienen seguro adicional o alarma?" keyName="demencia_seguro_puertas" />
            <PreguntaSiNo label="¿La estufa tiene dispositivo de corte automático?" keyName="demencia_estufa_segura" />
            <PreguntaSiNo label="¿Los medicamentos y productos de limpieza están bajo llave?" keyName="demencia_medicamentos_bajo_llave" />
            <PreguntaSiNo label="¿El paciente porta identificación con datos de contacto?" keyName="demencia_identificacion" />
          </>
        )}

        {/* RESPIRATORIO */}
        {paso === 'respiratorio' && (
          <>
            <Text style={styles.pasoTitulo}>🫁 Oxigenoterapia</Text>
            <Text style={styles.pasoSubtitulo}>Equipo y condiciones para dificultades respiratorias</Text>
            <PreguntaSiNo label="¿El paciente cuenta con concentrador de oxígeno?" keyName="respiratorio_oxigeno" />
            <PreguntaSiNo label="¿Usa o ha evaluado terapia CPAP?" keyName="respiratorio_cpap" />
            <PreguntaSiNo label="¿El cuarto tiene buena ventilación?" keyName="respiratorio_ventilacion" />
            <PreguntaSiNo label="¿El equipo de oxígeno está en buen estado y tiene mantenimiento?" keyName="respiratorio_mantenimiento" />
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* BOTÓN SIGUIENTE */}
      <View style={styles.footerBtn}>
        <TouchableOpacity
          style={[styles.siguienteBtn, guardando && { opacity: 0.7 }]}
          onPress={siguiente}
          disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.siguienteBtnText}>
                {pasoActual === totalPasos - 2 ? 'Ver resultado →' : 'Siguiente →'}
              </Text>
          }
        </TouchableOpacity>
      </View>
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
  progressBar: { height: 4, backgroundColor: COLORS.border },
  progressFill: { height: 4, backgroundColor: COLORS.gold },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  pasoTitulo: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, marginBottom: 6 },
  pasoSubtitulo: { fontSize: 13, color: COLORS.textLight, marginBottom: 20, lineHeight: 18 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 12, marginTop: 8 },
  perfilBtn: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  perfilBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  perfilBtnText: { fontSize: 14, color: COLORS.textDark, fontWeight: '600' },
  perfilBtnTextActive: { color: COLORS.gold },
  pregunta: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  preguntaLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginBottom: 10 },
  siNoRow: { flexDirection: 'row', gap: 8 },
  siNoBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream,
  },
  siNoBtnSi: { backgroundColor: COLORS.greenPale, borderColor: COLORS.green },
  siNoBtnNo: { backgroundColor: COLORS.redPale, borderColor: COLORS.red },
  siNoBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
  footerBtn: { padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  siguienteBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  siguienteBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  resultadoCard: { borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, marginBottom: 20 },
  resultadoEmoji: { fontSize: 48, marginBottom: 8 },
  resultadoNivel: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  resultadoScore: { fontSize: 13, color: COLORS.textLight },
  recCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  recPrioridadDot: { width: 8, height: 8, borderRadius: 4 },
  recCategoria: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1 },
  recItem: { fontSize: 13, color: COLORS.textDark, fontWeight: '600' },
  recProducto: { backgroundColor: COLORS.goldPale, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' },
  recProductoText: { fontSize: 11, color: COLORS.gold, fontWeight: '600' },
  solicitarBtn: { backgroundColor: COLORS.cacao, borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 10, marginTop: 8 },
  solicitarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  solicitarBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  cerrarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  cerrarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
});