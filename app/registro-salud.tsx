import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getSignosRecientes, getToken, iniciarTurno } from '../services/api';

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

const COLORS = {
  gold: '#BF9A40',
  goldPale: '#F5EDD8',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textMid: '#4A4540',
  textLight: '#8A8078',
  border: '#E0D8CC',
  green: '#3DAA6A',
  greenPale: '#EAF5E8',
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  red: '#D94F4F',
  redPale: '#FDEAEA',
  blue: '#3A91FF',
  bluePale: '#EBF3FF',
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

  // Generales Básicos & Telemetría del Reloj
  const [spo2, setSpo2] = useState(98);
  const [sistolica, setSistolica] = useState(120);
  const [diastolica, setDiastolica] = useState(80);
  const [fc, setFc] = useState(72);
  const [fr, setFr] = useState(16);
  const [temperatura, setTemperatura] = useState(36.5); // 🌡️ Nuevo: Sensor Térmico del Hardware

  // Confort y Conducta
  const [dolorEva, setDolorEva] = useState(0);
  const [estadoAnimo, setEstadoAnimo] = useState('bien');
  const [hidratacion, setHidratacion] = useState(0);
  const [alimentacion, setAlimentacion] = useState('bien');
  const [deposicion, setDeposicion] = useState<boolean | null>(null);
  const [horas_sueno, setHorasSueno] = useState(7.0);

  // Módulos de Especialidad Patológica
  const [glucosa, setGlucosa] = useState(100);
  const [glucosaMomento, setGlucosaMomento] = useState('ayunas');
  const [revisionPie, setRevisionPie] = useState<boolean | null>(null);
  const [usoInhalador, setUsoInhalador] = useState(false);
  const [edema, setEdema] = useState<boolean | null>(null);

  // Demencia y Caídas
  const [orientacionPersona, setOrientacionPersona] = useState<boolean | null>(null);
  const [orientacionLugar, setOrientacionLugar] = useState<boolean | null>(null);
  const [orientacionTiempo, setOrientacionTiempo] = useState<boolean | null>(null);
  const [agitacion, setAgitacion] = useState(0);
  const [episodioConfusion, setEpisodioConfusion] = useState(false);
  const [testigoCaida, setTestigoCaida] = useState(false); // 🚨 Nuevo: Flag de Detección de Caídas

  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);

  // 📡 Sincronización pasiva de hardware al arrancar el formulario
  useEffect(() => {
    const precargarSignosReloj = async () => {
      if (!paciente?.id || momento !== 'inicio_turno') return;
      try {
        const res = await getSignosRecientes(paciente.id);
        if (res && res.success) {
          if (res.spo2 !== '—') setSpo2(Number(res.spo2));
          if (res.fc !== '—') setFc(Number(res.fc));
          if (res.temperatura && res.temperatura !== '—') setTemperatura(Number(res.temperatura));
          if (res.presion !== '—') {
            const [sis, dia] = res.presion.split('/');
            setSistolica(Number(sis));
            setDiastolica(Number(dia));
          }
        }
      } catch (e) {
        console.error('❌ Error precargando telemetría en registro-salud:', e);
      }
    };
    precargarSignosReloj();
  }, [paciente?.id, momento]);

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
          frecuencia_cardiaca: fc, frecuencia_respiratoria: fr, temperatura,
          dolor_eva: dolorEva, estado_animo: estadoAnimo,
          hidratacion_vasos: hidratacion, alimentacion,
          deposicion, horas_sueno, testigo_caida: testigoCaida,
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
        await avanzarAlTurno();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const avanzarAlTurno = async () => {
    try {
      if (momento === 'inicio_turno') {
        await iniciarTurno(paciente.id);
      }
      router.replace({
        pathname: '/cuidador' as any,
        params: { 
          vistaInicial: 'turno', 
          paciente: typeof params.paciente === 'string' ? params.paciente : JSON.stringify(paciente) 
        }
      });
    } catch (err) {
      console.error("Error al arrancar el bloque del turno:", err);
    }
  };

  const momentoLabel: Record<string, string> = {
    inicio_turno: 'Inicio de turno',
    cierre_turno: 'Cierre de turno',
    post_medicamento: 'Post medicamento',
    post_comida: 'Post comida',
    espontaneo: 'Registro espontáneo',
  };

  const getEvaEmoji = (val: number) => {
    if (val === 0) return '😊';
    if (val <= 3) return '😐';
    if (val <= 6) return '😔';
    if (val <= 8) return '😟';
    return '😭';
  };

  // 🚨 UI: Interceptación y Pantalla de Alertas Críticas
  if (alertas.length > 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />
        <View style={[styles.header, { backgroundColor: COLORS.red }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>⚠️ Alertas críticas del paciente</Text>
            <Text style={styles.userName}>{paciente?.nombre_completo}</Text>
          </View>
        </View>
        <ScrollView style={styles.body}>
          <Text style={[styles.sectionTitle, { color: COLORS.textDark, marginTop: 8 }]}>ATENCIÓN CLÍNICA REQUERIDA</Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 16, lineHeight: 18 }}>
            El sistema detectó los siguientes valores fuera de rango de seguridad. El familiar principal ya fue notificado automáticamente por correo y canal push:
          </Text>
          {alertas.map((a, i) => (
            <View key={i} style={styles.alertaCard}>
              <Text style={styles.alertaText}>{a}</Text>
            </View>
          ))}
          <TouchableOpacity style={[styles.confirmarBtn, { backgroundColor: COLORS.cacao }]} onPress={avanzarAlTurno}>
            <Text style={styles.confirmarBtnText}>Entendido — Abrir agenda de turno →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Semáforo dinámico de la tarjeta Cardio-Pulmonar
  const esCriticoBucle = spo2 < 92 || sistolica > 160 || fc > 110 || temperatura > 38.0;

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

        {/* 🏥 SECCIÓN 1: MONITOR DE SIGNOS VITALES HÍBRIDO */}
        <Text style={styles.sectionTitle}>Monitor Vital Principal</Text>
        <View style={[styles.monitorCard, esCriticoBucle && { borderColor: COLORS.red, backgroundColor: '#FFF5F5' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={styles.monitorCardTitle}>📊 RÁFAGAS RECIENTES (RELOJ + MANUAL)</Text>
            {esCriticoBucle && <Text style={styles.badgeAlertaCritica}>🚨 DESCOMPENSADO</Text>}
          </View>

          {/* Fila 1: SpO2 y Frecuencia Cardíaca */}
          <View style={styles.monitorGrid}>
            <View style={styles.monitorItem}>
              <Text style={styles.monitorLabel}>Oxigenación (SpO₂)</Text>
              <View style={styles.controlesRow}>
                <TouchableOpacity style={styles.btnControl} onPress={() => setSpo2(v => Math.max(80, v - 1))}><Text style={styles.btnControlText}>−</Text></TouchableOpacity>
                <Text style={[styles.monitorVal, spo2 < 92 && { color: COLORS.red }]}>{spo2}%</Text>
                <TouchableOpacity style={styles.btnControl} onPress={() => setSpo2(v => Math.min(100, v + 1))}><Text style={styles.btnControlText}>+</Text></TouchableOpacity>
              </View>
            </View>

            <View style={styles.monitorItem}>
              <Text style={styles.monitorLabel}>Pulso (FC)</Text>
              <View style={styles.controlesRow}>
                <TouchableOpacity style={styles.btnControl} onPress={() => setFc(v => Math.max(40, v - 1))}><Text style={styles.btnControlText}>−</Text></TouchableOpacity>
                <Text style={[styles.monitorVal, (fc > 100 || fc < 60) && { color: COLORS.amber }]}>{fc}<Text style={{ fontSize: 10 }}>bpm</Text></Text>
                <TouchableOpacity style={styles.btnControl} onPress={() => setFc(v => Math.min(180, v + 1))}><Text style={styles.btnControlText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Fila 2: Presión Arterial S/D */}
          <View style={[styles.monitorItem, { marginTop: 14, width: '100%' }]}>
            <Text style={styles.monitorLabel}>Presión Arterial (Sistólica / Diastólica)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
              <View style={styles.controlesRow}>
                <TouchableOpacity style={styles.btnControl} onPress={() => setSistolica(v => Math.max(80, v - 1))}><Text style={styles.btnControlText}>−</Text></TouchableOpacity>
                <Text style={styles.monitorVal}>{sistolica}</Text>
                <TouchableOpacity style={styles.btnControl} onPress={() => setSistolica(v => Math.min(200, v + 1))}><Text style={styles.btnControlText}>+</Text></TouchableOpacity>
              </View>
              <Text style={{ fontSize: 24, color: COLORS.textLight, fontWeight: '300' }}>/</Text>
              <View style={styles.controlesRow}>
                <TouchableOpacity style={styles.btnControl} onPress={() => setDiastolica(v => Math.max(40, v - 1))}><Text style={styles.btnControlText}>−</Text></TouchableOpacity>
                <Text style={styles.monitorVal}>{diastolica}</Text>
                <TouchableOpacity style={styles.btnControl} onPress={() => setDiastolica(v => Math.min(130, v + 1))}><Text style={styles.btnControlText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Fila 3: Frecuencia Respiratoria & Temperatura Corporal */}
          <View style={[styles.monitorGrid, { marginTop: 14 }]}>
            <View style={styles.monitorItem}>
              <Text style={styles.monitorLabel}>Respiración (FR)</Text>
              <View style={styles.controlesRow}>
                <TouchableOpacity style={styles.btnControl} onPress={() => setFr(v => Math.max(8, v - 1))}><Text style={styles.btnControlText}>−</Text></TouchableOpacity>
                <Text style={styles.monitorVal}>{fr}<Text style={{ fontSize: 10 }}>rpm</Text></Text>
                <TouchableOpacity style={styles.btnControl} onPress={() => setFr(v => Math.min(40, v + 1))}><Text style={styles.btnControlText}>+</Text></TouchableOpacity>
              </View>
            </View>

            <View style={styles.monitorItem}>
              <Text style={styles.monitorLabel}>Temperatura 🌡️</Text>
              <View style={styles.controlesRow}>
                <TouchableOpacity style={styles.btnControl} onPress={() => setTemperatura(v => parseFloat((v - 0.1).toFixed(1)))}><Text style={styles.btnControlText}>−</Text></TouchableOpacity>
                <Text style={[styles.monitorVal, temperatura > 37.5 && { color: COLORS.red }]}>{temperatura}°</Text>
                <TouchableOpacity style={styles.btnControl} onPress={() => setTemperatura(v => parseFloat((v + 0.1).toFixed(1)))}><Text style={styles.btnControlText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* 🎭 SECCIÓN 2: BIENESTAR, SUEÑO Y CONFORT HUMANO */}
        <Text style={styles.sectionTitle}>Escala de Confort y Dolor</Text>
        
        {/* Dolor EVA Dinámico */}
        <View style={styles.moduloCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={styles.signoLabel}>Intensidad del Dolor (EVA)</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: dolorEva >= 7 ? COLORS.red : COLORS.gold }}>
              {getEvaEmoji(dolorEva)} Grado {dolorEva}/10
            </Text>
          </View>
          <View style={styles.evaContainer}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.evaBtn, 
                  dolorEva === n && styles.evaBtnActive,
                  n >= 7 && dolorEva === n && { backgroundColor: COLORS.red, borderColor: COLORS.red }
                ]}
                onPress={() => setDolorEva(n)}
              >
                <Text style={[styles.evaBtnText, dolorEva === n && styles.evaBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hidratación Interactiva por Vasos */}
        <View style={styles.moduloCard}>
          <Text style={[styles.signoLabel, { marginBottom: 10 }]}>Hidratación del paciente</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(v => (
                <TouchableOpacity 
                  key={v} 
                  onPress={() => setHidratacion(v)}
                  style={[styles.vasoBtn, hidratacion >= v && { backgroundColor: COLORS.bluePale, borderColor: COLORS.blue }]}
                >
                  <Text style={{ fontSize: 16, opacity: hidratacion >= v ? 1 : 0.25 }}>💧</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.blue }}>{hidratacion} Vasos</Text>
          </View>
        </View>

        {/* Estado de Ánimo */}
        <View style={styles.estadoRow}>
          {[{ val: 'bien', icon: '😊', txt: 'Estable' }, { val: 'regular', icon: '😐', txt: 'Regular' }, { val: 'bajo', icon: '😔', txt: 'Decaído' }].map(e => (
            <TouchableOpacity
              key={e.val}
              style={[styles.estadoCard, estadoAnimo === e.val && styles.estadoCardActive]}
              onPress={() => setEstadoAnimo(e.val)}
            >
              <Text style={{ fontSize: 26 }}>{e.icon}</Text>
              <Text style={[styles.estadoLabel, estadoAnimo === e.val && { color: COLORS.gold }]}>{e.txt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alimentación y Sueño */}
        <View style={styles.moduloCard}>
          <Text style={[styles.signoLabel, { marginBottom: 10 }]}>Alimentación en el periodo</Text>
          <View style={styles.estadoRow}>
            {[{ val: 'bien', label: '🍽️ Completó' }, { val: 'regular', label: '😐 Parcial' }, { val: 'poco', label: '😕 Rechazó' }].map(a => (
              <TouchableOpacity
                key={a.val}
                style={[styles.estadoCard, { padding: 10 }, alimentacion === a.val && styles.estadoCardActive]}
                onPress={() => setAlimentacion(a.val)}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: alimentacion === a.val ? COLORS.gold : COLORS.textLight }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 🛏️ INCIDENTE DE CAÍDA ACTIVO */}
        <Text style={styles.sectionTitle}>Seguridad del Entorno</Text>
        <View style={styles.boolCard}>
          <Text style={styles.signoLabel}>¿El paciente sufrió alguna caída o impacto?</Text>
          <View style={styles.boolBtns}>
            <TouchableOpacity style={[styles.boolBtn, testigoCaida === true && { backgroundColor: COLORS.redPale, borderColor: COLORS.red }]} onPress={() => setTestigoCaida(true)}>
              <Text style={[styles.boolBtnText, testigoCaida === true && { color: COLORS.red }]}>⚠️ Sí, reportar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.boolBtn, testigoCaida === false && styles.boolBtnSi]} onPress={() => setTestigoCaida(false)}>
              <Text style={[styles.boolBtnText, testigoCaida === false && { color: COLORS.green }]}>✓ No, a salvo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 👑 SECCIÓN 3: PROTOCOLOS CLÍNICOS DE ALTA ESPECIALIDAD (DORADOS) */}
        {esDiabetico && (
          <View style={styles.especialidadContainer}>
            <Text style={styles.especialidadTitle}>✨ PROTOCOLO VITA-DIABETES</Text>
            <View style={styles.signoCard}>
              <Text style={styles.signoLabel}>Glucosa Capilar (mg/dL)</Text>
              <View style={styles.signoControles}>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setGlucosa(v => Math.max(40, v - 5))}><Text style={styles.signoBtnText}>−</Text></TouchableOpacity>
                <Text style={[styles.signoVal, (glucosa > 140 || glucosa < 70) && { color: COLORS.red }]}>{glucosa}</Text>
                <TouchableOpacity style={styles.signoBtn} onPress={() => setGlucosa(v => Math.min(500, v + 5))}><Text style={styles.signoBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>
            <View style={styles.opcionesRow}>
              {['ayunas', 'pre_comida', 'post_comida', 'antes_dormir'].map(m => (
                <TouchableOpacity key={m} style={[styles.opcionBtn, glucosaMomento === m && styles.opcionBtnActive]} onPress={() => setGlucosaMomento(m)}>
                  <Text style={[styles.opcionBtnText, glucosaMomento === m && styles.opcionBtnTextActive]}>{m.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {tieneDemencia && (
          <View style={styles.especialidadContainer}>
            <Text style={styles.especialidadTitle}>🧠 PROTOCOLO COGNITIVO / NEUROLÓGICO</Text>
            {[
              { label: 'Orientado en persona', val: orientacionPersona, set: setOrientacionPersona },
              { label: 'Orientado en lugar', val: orientacionLugar, set: setOrientacionLugar },
              { label: 'Orientado en tiempo', val: orientacionTiempo, set: setOrientacionTiempo },
              { label: 'Sufrió episodios de agitación', val: episodioConfusion, set: setEpisodioConfusion },
            ].map((item, i) => (
              <View key={i} style={styles.boolCard}>
                <Text style={styles.signoLabel}>{item.label}</Text>
                <View style={styles.boolBtns}>
                  <TouchableOpacity style={[styles.boolBtn, item.val === true && styles.boolBtnSi]} onPress={() => item.set(true as any)}><Text style={[styles.boolBtnText, item.val === true && { color: COLORS.green }]}>✓ Sí</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.boolBtn, item.val === false && styles.boolBtnNo]} onPress={() => item.set(false as any)}><Text style={[styles.boolBtnText, item.val === false && { color: COLORS.red }]}>✗ No</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[styles.confirmarBtn, loading && { opacity: 0.7 }]} onPress={guardar} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmarBtnText}>Guardar Registro Clínico →</Text>}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
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
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 8, marginTop: 14 },
  
  // Estilos del Monitor Médico
  monitorCard: { backgroundColor: COLORS.cacao, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#33302D', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  monitorCardTitle: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  badgeAlertaCritica: { fontSize: 9, fontWeight: '800', color: COLORS.white, backgroundColor: COLORS.red, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  monitorGrid: { flexDirection: 'row', gap: 12 },
  monitorItem: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  monitorLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  controlesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 2 },
  btnControl: { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  btnControlText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  monitorVal: { fontSize: 18, fontWeight: '800', textAlign: 'center', flex: 1, color: '#3DAA6A' },

  moduloCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  signoCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  signoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  signoControles: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signoBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.goldPale, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  signoBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  signoVal: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, minWidth: 60, textAlign: 'center' },
  
  // Eva Interactiva
  evaContainer: { flexDirection: 'row', gap: 3 },
  evaBtn: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 6, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  evaBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  evaBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  evaBtnTextActive: { color: COLORS.gold },
  
  // Vasos de Agua
  vasoBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },

  estadoRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  estadoCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  estadoCardActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldPale },
  estadoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginTop: 4, textTransform: 'capitalize' },
  
  // Tarjetas Booleanas
  boolCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  boolBtns: { flexDirection: 'row', gap: 8 },
  boolBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cream },
  boolBtnSi: { backgroundColor: COLORS.greenPale, borderColor: COLORS.green },
  boolBtnNo: { backgroundColor: COLORS.redPale, borderColor: COLORS.red },
  boolBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  
  // Bloques de Especialidad
  especialidadContainer: { borderLeftWidth: 4, borderLeftColor: COLORS.gold, backgroundColor: '#FAF6ED', padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  especialidadTitle: { fontSize: 10, fontWeight: '800', color: COLORS.gold, marginBottom: 10, letterSpacing: 1 },
  opcionesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  opcionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  opcionBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  opcionBtnText: { fontSize: 11, color: COLORS.textLight },
  opcionBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
  
  alertaCard: { backgroundColor: COLORS.redPale, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)', borderLeftWidth: 4, borderLeftColor: COLORS.red },
  alertaText: { fontSize: 13, color: COLORS.red, fontWeight: '600', lineHeight: 18 },
  confirmarBtn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  confirmarBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
});