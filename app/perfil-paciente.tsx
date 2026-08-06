import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { actualizarPaciente, clearToken, configurarReloj, getPacientes, getToken, reiniciarRegistroServidor } from '../services/api'; // 📡 Asegúrate de exportar configurarReloj de tu services/api.ts

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
  red: '#D94F4F',
  redPale: '#FDEAEA',
  green: '#3DAA6A',
  goldLight: '#D4B060',
  textMid: '#4A4540',
  amber: '#D4860A',       
  amberPale: '#FFF4E0',   
};

const CONDICIONES = [
  'Diabetes T2', 'Hipertensión', 'EPOC', 'Alzheimer', 'Demencia',
  'Insuficiencia cardíaca', 'Osteoporosis', 'Artritis', 'Parkinson',
  'Depresión', 'Ansiedad', 'Insuficiencia renal', 'Hipotiroidismo',
];

export default function PerfilPacienteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paciente = params.paciente ? JSON.parse(params.paciente as string) : null;

  const [guardando, setGuardando] = useState(false);
  const [sincronizandoHardware, setSincronizandoHardware] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [telefonoMedico, setTelefonoMedico] = useState(paciente?.telefono_medico ?? '');
  
  // Estados Base Existentes
  const [nombre, setNombre] = useState(paciente?.nombre_completo ?? '');
  const [medico, setMedico] = useState(paciente?.medico_tratante ?? '');
  const [talla, setTalla] = useState(paciente?.talla_cm?.toString() ?? '');
  const [pesoInput, setPesoInput] = useState(paciente?.peso_kg?.toString() ?? '');
  const [condiciones, setCondiciones] = useState<string[]>(paciente?.condiciones_medicas ?? []);
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(paciente?.telefono_emergencia ?? '');
  const [nombreAseguradora, setNombreAseguradora] = useState(paciente?.nombre_aseguradora ?? '');
  const [telefonoAseguradora, setTelefonoAseguradora] = useState(paciente?.telefono_aseguradora ?? '');
  const [telefonoAmbulancia, setTelefonoAmbulancia] = useState(paciente?.telefono_ambulancia ?? '');

  // ⌚ SWITCH MAESTRO DE HARDWARE (Se activa automáticamente si el paciente ya tiene IMEI)
  const [tieneReloj, setTieneReloj] = useState<boolean>(
    Boolean(paciente?.reloj_imei && paciente.reloj_imei.trim() !== '')
  );

  // 📡 Parámetros Estructurales del Reloj GPS
  const [imei, setImei] = useState(paciente?.reloj_imei ?? '');
  const [sos1, setSos1] = useState(paciente?.reloj_sos1 ?? '');
  const [sos2, setSos2] = useState(paciente?.reloj_sos2 ?? '');
  const [sos3, setSos3] = useState(paciente?.reloj_sos3 ?? '');
  const [sensibilidadCaidas, setSensibilidadCaidas] = useState<string>(
    paciente?.sensibilidad_caidas?.toString() ?? '3'
  );
  const [caidaActiva, setCaidaActiva] = useState<boolean>(true);

  const toggleCondicion = (c: string) => {
    setCondiciones(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  // ⚖️ Sincronizador Maestro de la Ficha Clínica
  useEffect(() => {
    const refrescarDatosAlEntrar = async () => {
      if (!paciente?.id) return;
      
      try { 
        console.log("🔍 Rompiendo caché de navegación. Solicitando datos frescos al servidor...");
        
        const data = await getPacientes('perfil-paciente'); 
        if (data && data.patients) {
          const pFresco = data.patients.find((x: any) => x.id === paciente.id);
          if (pFresco && pFresco.peso_kg) {
            setPesoInput(pFresco.peso_kg.toString());
          }
          if (pFresco.telefono_medico !== undefined) {
            setTelefonoMedico(pFresco.telefono_medico ?? '');
          }
          if (pFresco.reloj_imei) {
            setTieneReloj(Boolean(pFresco.reloj_imei.trim()));
            setImei(pFresco.reloj_imei);
          }
        }
      
        const token = await getToken(); 
        const resDisp = await fetch(
          `${BASE_URL}/pacientes/${paciente.id}/config-reloj`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const dataDisp = await resDisp.json();
        if (dataDisp?.sensibilidad_caidas) {
          setSensibilidadCaidas(dataDisp.sensibilidad_caidas.toString());
        }
        if (dataDisp && 'caida_activa' in dataDisp) {
          setCaidaActiva(Boolean(dataDisp.caida_activa));
        }

      } catch (err) {
        console.log("⚠️ Error sincronizando datos en segundo plano:", err);
      }
    };

    refrescarDatosAlEntrar();
  }, [paciente?.id, params?.refresh]);

  // 📡 Disparador del Bus de Comandos por Redis
  const ejecutarSincronizacionReloj = async (targetId: string) => {
    try {
      setSincronizandoHardware(true);
      const res = await configurarReloj(targetId, sensibilidadCaidas);
      const argFalldown = caidaActiva ? '1,1' : '0,0';
      await configurarReloj(targetId, undefined, 'FALLDOWN', argFalldown);
      
      if (res && res.success) {
        Alert.alert(
          '📡 Conexión Establecida',
          `El perfil se guardó y se transmitieron las tramas de control al reloj (IMEI: ${imei.trim()}) de forma exitosa.`
        );
      } else {
        Alert.alert(
          '⚠️ Registro Guardado Localmente',
          res?.detail || 'El reloj no respondió al empuje inicial de comandos por estar fuera de línea.'
        );
      }
    } catch (hwErr) {
      console.log('⚠️ Falla pasiva de bus de comandos de hardware:', hwErr);
    } finally {
      setSincronizandoHardware(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) { 
      setError('El nombre es obligatorio'); 
      return; 
    }
    
    // Validación de IMEI solo si el modo reloj está encendido
    if (tieneReloj && imei.trim() && imei.trim().length < 10) {
      setError('El Device ID del reloj no parece válido (deben ser 10 dígitos)');
      return;
    }

    setGuardando(true);
    setError('');
    setExito(false);

    try {
      console.log("📡 Enviando datos clínicos a Railway...");
      
      // 🎯 SI TIENE RELOJ DESACTIVADO, ENVIAMOS NULLS A LOS CAMPOS DE DISPOSITIVO
      const dataPac = await actualizarPaciente(paciente?.id || 'nuevo', {
        nombre_completo: nombre.trim(),
        condiciones_medicas: condiciones,
        medico_tratante: medico.trim() || null,
        talla_cm: talla ? parseFloat(talla) : null,
        peso_kg: pesoInput ? parseFloat(pesoInput) : null,
        telefono_emergencia: telefonoEmergencia.trim() || null,
        nombre_aseguradora: nombreAseguradora.trim() || null,
        telefono_aseguradora: telefonoAseguradora.trim() || null,
        telefono_ambulancia: telefonoAmbulancia.trim() || null,
        telefono_medico: telefonoMedico.trim() || null,
        // Campos condicionales del Reloj
        reloj_imei: tieneReloj ? (imei.trim() || null) : null,
        reloj_sos1: tieneReloj ? (sos1.trim() || null) : null,
        reloj_sos2: tieneReloj ? (sos2.trim() || null) : null,
        reloj_sos3: tieneReloj ? (sos3.trim() || null) : null,
      });
      
      const idActual = paciente?.id || dataPac?.paciente_id || dataPac?.id || (dataPac?.data && dataPac.data[0]?.id);
      
      console.log(`✅ Registro procesado en base de datos. ID Paciente: ${idActual}`);
      
      // Sincronización Redis solo si tiene reloj activo
      if (tieneReloj && idActual && imei.trim() && (sos1.trim() || sos2.trim())) {
        console.log("⚡ Disparando hilos de red en Redis para sincronización de hardware...");
        await ejecutarSincronizacionReloj(idActual).catch(err => 
          console.log("⚠️ Registro guardado, pero Redis reportó retraso:", err)
        );
      }

      setExito(true);
      
      setTimeout(() => {
        if (!paciente) {
          router.replace('/'); 
        } else {
          router.back();
        }
      }, 1200);

    } catch (e: any) {
      console.error('❌ Fallo crítico en guardar paciente:', e);
      setError(e.message || 'Error al guardar los datos del paciente');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async () => {
    if (!paciente?.id) return;
    setGuardando(true);
    try {
      await actualizarPaciente(paciente.id, { activo: false });
      router.replace({ pathname: '/' as any, params: { refresh: Date.now().toString() } });
    } catch (e) {
      setError('Error al desactivar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Configuración de Paciente</Text>
          <Text style={styles.userName}>{nombre || 'Nuevo Registro'}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* REINICIAR REGISTRO */}
        <TouchableOpacity 
          onPress={async () => {
            Alert.alert(
              '🔄 Reiniciar Registro',
              '¿Quieres borrar este progreso y volver a empezar tu registro desde cero para cambiar de rol?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Sí, reiniciar',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await reiniciarRegistroServidor();
                      await clearToken(); 
                      router.replace('/login'); 
                    } catch (err) {
                      await clearToken();
                      router.replace('/login');
                    }
                  }
                }
              ]
            );
          }} 
          style={{
            backgroundColor: COLORS.amberPale,
            borderWidth: 1,
            borderColor: COLORS.amber,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            marginTop: 10
          }}
        >
          <Text style={{ color: COLORS.amber, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>
            🔄 REINICIAR REGISTRO DESDE EL LOGIN
          </Text>
        </TouchableOpacity>

        {/* FORMULARIO CLÍNICO BASE */}
        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej. María Luisa Guevara"
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={styles.label}>Talla (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="165"
          placeholderTextColor={COLORS.textLight}
          value={talla}
          onChangeText={setTalla}
          keyboardType="numeric"
        />
        
        <View style={{ marginBottom: 16, width: '100%' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#4A4540', marginBottom: 6 }}>
            Peso Actual (kg)
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#E0D8CC',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: '#2C2820',
              backgroundColor: '#FAFAF7'
            }}
            placeholder="Ej: 74.5"
            placeholderTextColor="#8A8078"
            keyboardType="numeric"
            value={pesoInput}
            onChangeText={setPesoInput}
          />
        </View>

        <Text style={styles.label}>Condiciones médicas</Text>
        <View style={styles.condicionesGrid}>
          {CONDICIONES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.condicionBtn, condiciones.includes(c) && styles.condicionBtnActive]}
              onPress={() => toggleCondicion(c)}
            >
              <Text style={[styles.condicionBtnText, condiciones.includes(c) && styles.condicionBtnTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ⌚ CARD SELECTOR: TIPO DE MONITOREO (CON RELOJ / ASISTIDO MANUAL) */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: tieneReloj ? COLORS.goldPale : COLORS.white,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: tieneReloj ? COLORS.gold : COLORS.border,
          padding: 16,
          marginTop: 12,
          marginBottom: 16
        }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.textDark }}>
              ⌚ Monitoreo con Reloj Vitanova
            </Text>
            <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
              {tieneReloj 
                ? 'Reloj vinculado — Telemetría y signos vitales en tiempo real' 
                : 'Modo Asistido Manual — Sin dispositivo wearable configurado'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setTieneReloj(!tieneReloj)}
            style={{
              width: 50,
              height: 28,
              borderRadius: 14,
              backgroundColor: tieneReloj ? COLORS.green : COLORS.border,
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <View style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: COLORS.white,
              alignSelf: tieneReloj ? 'flex-end' : 'flex-start',
            }} />
          </TouchableOpacity>
        </View>

        {/* 📡 SECCIÓN DESPLEGABLE: CONFIGURACIÓN DEL RELOJ (Solo visible si tieneReloj === true) */}
        {tieneReloj && (
          <View style={{
            backgroundColor: '#FAFAF7',
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            marginBottom: 16
          }}>
            <View style={styles.seccionReloj}>
              <Text style={styles.relojTitulo}>⌚ Enlace y Configuración del Reloj Vitanova</Text>
            </View>

            <Text style={styles.label}>Número ID De Dispositivo / ID del Localizador GPS</Text>
            <TextInput
              style={styles.input}
              placeholder="Código de 10 a 15 dígitos grabado en el reloj"
              placeholderTextColor={COLORS.textLight}
              value={imei}
              onChangeText={setImei}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Número SOS Principal (Botón de pánico del Reloj)</Text>
            <TextInput
              style={styles.input}
              placeholder="Celular al que llamará el reloj en una emergencia"
              placeholderTextColor={COLORS.textLight}
              value={sos1}
              onChangeText={setSos1}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Número SOS Secundario (Respaldo)</Text>
            <TextInput
              style={styles.input}
              placeholder="Segundo contacto de emergencia para el hardware"
              placeholderTextColor={COLORS.textLight}
              value={sos2}
              onChangeText={setSos2}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Número SOS 3 (Tercer contacto)</Text>
            <TextInput
              style={styles.input}
              placeholder="Tercer contacto de emergencia"
              placeholderTextColor={COLORS.textLight}
              value={sos3}
              onChangeText={setSos3}
              keyboardType="phone-pad"
            />
          
            {/* SENSOR DE CAÍDAS */}
            <View style={[styles.seccionReloj, { marginTop: 16 }]}>
              <Text style={styles.relojTitulo}>⚙️ Parámetros del Sensor de Caídas</Text>
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: COLORS.white,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
              marginBottom: 16
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textDark }}>
                  🛡️ Detector de caídas
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
                  {caidaActiva ? 'Activo — el reloj detecta caídas' : 'Desactivado — sin alertas de caída'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  const nuevoEstado = !caidaActiva;
                  setCaidaActiva(nuevoEstado);
                  try {
                    const arg = nuevoEstado ? '1,1' : '0,0';
                    await configurarReloj(paciente.id, undefined, 'FALLDOWN', arg);
                  } catch {
                    console.log('⚠️ Toggle guardado localmente, se aplicará al sincronizar');
                  }
                }}
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: caidaActiva ? COLORS.green : COLORS.border,
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}
              >
                <View style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: COLORS.white,
                  alignSelf: caidaActiva ? 'flex-end' : 'flex-start',
                }} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Sensibilidad del detector de caídas</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { val: '1', label: '🔴 Alta', desc: 'Detecta mínimo movimiento' },
                { val: '2', label: '🟠 Media', desc: 'Para adultos muy frágiles' },
                { val: '3', label: '🟡 Estándar', desc: 'Uso normal' },
                { val: '4', label: '🟢 Baja', desc: 'Recomendada ✓' },
              ].map((op) => (
                <TouchableOpacity
                  key={op.val}
                  style={{
                    width: '48%',
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: sensibilidadCaidas === op.val ? COLORS.gold : COLORS.border,
                    backgroundColor: sensibilidadCaidas === op.val ? COLORS.goldPale : COLORS.white,
                    alignItems: 'center',
                  }}
                  onPress={() => setSensibilidadCaidas(op.val)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: sensibilidadCaidas === op.val ? COLORS.gold : COLORS.textLight }}>
                    {op.label}
                  </Text>
                  <Text style={{ fontSize: 9, color: COLORS.textLight, textAlign: 'center', marginTop: 2 }}>
                    {op.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* BOTÓN SINCRONIZAR VÍA REDIS */}
            {paciente?.id && imei.trim() ? (
              <TouchableOpacity
                style={{ 
                  alignSelf: 'center',
                  paddingHorizontal: 16, 
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  marginBottom: 8,
                  opacity: (guardando || sincronizandoHardware) ? 0.5 : 1
                }}
                onPress={() => ejecutarSincronizacionReloj(paciente.id)}
                disabled={guardando || sincronizandoHardware}
              >
                {sincronizandoHardware ? (
                  <ActivityIndicator size="small" color={COLORS.textLight} />
                ) : (
                  <Text style={{ fontSize: 11, color: COLORS.textLight }}>
                    ⚙️ Sincronizar configuración con reloj
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* INFORMACIÓN MÉDICA GENERAL */}
        <View style={styles.seccionClinica}>
          <Text style={styles.clinicaTitulo}>📋 Información Médica General</Text>
        </View>

        <Text style={styles.label}>Médico tratante</Text>
        <TextInput
          style={styles.input}
          placeholder="Dr. Hernández — Neumología"
          placeholderTextColor={COLORS.textLight}
          value={medico}
          onChangeText={setMedico}
        />
        <Text style={styles.label}>Teléfono del médico</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 8112345678"
          placeholderTextColor={COLORS.textLight}
          value={telefonoMedico}
          onChangeText={setTelefonoMedico}
          keyboardType="phone-pad"
        />

        {/* SECCIÓN EMERGENCIAS */}
        <View style={styles.seccionEmergencia}>
          <Text style={styles.seccionTitulo}>🚨 Contactos de asistencia / Ambulancia</Text>
        </View>

        <Text style={styles.label}>Teléfono de emergencia familiar</Text>
        <TextInput
          style={styles.input}
          placeholder="81 1234 5678"
          placeholderTextColor={COLORS.textLight}
          value={telefonoEmergencia}
          onChangeText={setTelefonoEmergencia}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Aseguradora</Text>
        <TextInput
          style={styles.input}
          placeholder="Banorte Seguros"
          placeholderTextColor={COLORS.textLight}
          value={nombreAseguradora}
          onChangeText={setNombreAseguradora}
        />

        <Text style={styles.label}>Teléfono aseguradora</Text>
        <TextInput
          style={styles.input}
          placeholder="800 123 4567"
          placeholderTextColor={COLORS.textLight}
          value={telefonoAseguradora}
          onChangeText={setTelefonoAseguradora}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Teléfono ambulancia</Text>
        <TextInput
          style={styles.input}
          placeholder="065 o número privado"
          placeholderTextColor={COLORS.textLight}
          value={telefonoAmbulancia}
          onChangeText={setTelefonoAmbulancia}
          keyboardType="phone-pad"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {exito ? <Text style={styles.exito}>✅ Registro guardado e hilos de red disparados</Text> : null}

        <TouchableOpacity
          style={[styles.btn, guardando && { opacity: 0.7 }]}
          onPress={guardar}
          disabled={guardando || sincronizandoHardware}
        >
          {guardando
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>{paciente ? 'Guardar cambios' : 'Finalizar Registro Vitanova'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={{ 
            padding: 14, 
            alignItems: 'center', 
            marginTop: 8,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 10,
            backgroundColor: COLORS.white
          }}
          onPress={() => {
            if (paciente) {
              router.back();
            } else {
              router.replace('/login');
            }
          }}
        >
          <Text style={{ color: COLORS.textLight, fontWeight: '600', fontSize: 14 }}>
            Cancelar
          </Text>
        </TouchableOpacity>

        {paciente && (
          <TouchableOpacity
            style={styles.btnDesactivar}
            onPress={() => {
              Alert.alert(
                'Desactivar paciente',
                `¿Estás seguro de que quieres desactivar a ${paciente?.nombre_completo}? El historial se conservará.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Desactivar', style: 'destructive', onPress: desactivar },
                ]
              );
            }}
            disabled={guardando || sincronizandoHardware}
          >
            <Text style={styles.btnDesactivarText}>Desactivar paciente</Text>
          </TouchableOpacity>
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
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textDark, marginBottom: 12 },
  condicionesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: 4 },
  condicionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  condicionBtnActive: { backgroundColor: COLORS.goldPale, borderColor: COLORS.gold },
  condicionBtnText: { fontSize: 12, color: COLORS.textLight },
  condicionBtnTextActive: { color: COLORS.gold, fontWeight: '700' },
  
  // SECCIÓN RELOJEADO HARDWARE UX
  seccionReloj: { backgroundColor: COLORS.goldPale, borderRadius: 10, padding: 12, marginBottom: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(191,154,64,0.3)' },
  relojTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.gold },
  
  // Estilo del botón táctico de Redis
  btnSincronizar: { backgroundColor: COLORS.cacao, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  btnSincronizarText: { color: COLORS.white, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  seccionClinica: { backgroundColor: '#EBEAE6', borderRadius: 10, padding: 12, marginBottom: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  clinicaTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.textMid },
  formGroup: {
    marginBottom: 16, // Le da espacio hacia abajo para que no se pegue con el siguiente input
    width: '100%',
  },
  seccionEmergencia: { backgroundColor: COLORS.redPale, borderRadius: 10, padding: 12, marginBottom: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(217,79,79,0.2)' },
  seccionTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.red },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  exito: { color: COLORS.green, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  btnDesactivar: { backgroundColor: COLORS.redPale, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)' },
  btnDesactivarText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
});