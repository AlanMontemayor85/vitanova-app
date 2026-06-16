import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { actualizarPaciente, clearToken, configurarReloj, reiniciarRegistroServidor } from '../services/api'; // 📡 Asegúrate de exportar configurarReloj de tu services/api.ts

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

  // Estados Base Existentes
  const [nombre, setNombre] = useState(paciente?.nombre_completo ?? '');
  const [medico, setMedico] = useState(paciente?.medico_tratante ?? '');
  const [talla, setTalla] = useState(paciente?.talla_cm?.toString() ?? '');
  const [condiciones, setCondiciones] = useState<string[]>(paciente?.condiciones_medicas ?? []);
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(paciente?.telefono_emergencia ?? '');
  const [nombreAseguradora, setNombreAseguradora] = useState(paciente?.nombre_aseguradora ?? '');
  const [telefonoAseguradora, setTelefonoAseguradora] = useState(paciente?.telefono_aseguradora ?? '');
  const [telefonoAmbulancia, setTelefonoAmbulancia] = useState(paciente?.telefono_ambulancia ?? '');

  // 📡 Parámetros Estructurales del Reloj GPS
  const [imei, setImei] = useState(paciente?.reloj_imei ?? '');
  const [sos1, setSos1] = useState(paciente?.reloj_sos1 ?? '');
  const [sos2, setSos2] = useState(paciente?.reloj_sos2 ?? '');

  const toggleCondicion = (c: string) => {
    setCondiciones(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  // 📡 FUNCIÓN TÁCTICA: Disparador del Bus de Comandos por Redis
  const ejecutarSincronizacionReloj = async (targetId: string) => {
    try {
      setSincronizandoHardware(true);
      const res = await configurarReloj(targetId);
      
      if (res && res.success) {
        Alert.alert(
          '📡 Conexión Establecida',
          `El perfil se guardó y se transmitieron las tramas de control (CENTER/SOS) al reloj (IMEI: ${imei.trim()}) de forma exitosa.`
        );
      } else {
        Alert.alert(
          '⚠️ Registro Guardado Localmente',
          res?.detail || 'El reloj no respondió al empuje inicial de comandos por estar fuera de línea. Podrás reintentar la sincronización desde su panel de control una vez que se encienda.'
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
    
    if (imei.trim() && imei.trim().length < 10) {
      setError('El número de serie IMEI o ID de GPS no parece válido');
      return;
    }

    setGuardando(true);
    setError('');
    setExito(false);

    try {
      console.log("📡 Enviando datos clínicos y de hardware a Railway...");
      
      // 1. Guardamos o actualizamos la entidad en Supabase mediante Railway
      const dataPac = await actualizarPaciente(paciente?.id || 'nuevo', {
        nombre_completo: nombre.trim(),
        condiciones_medicas: condiciones,
        medico_tratante: medico.trim() || null,
        talla_cm: talla ? parseFloat(talla) : null,
        telefono_emergencia: telefonoEmergencia.trim() || null,
        nombre_aseguradora: nombreAseguradora.trim() || null,
        telefono_ura: telefonoAseguradora.trim() || null, // Valida si en tu API es telefono_aseguradora o telefono_ura
        telefono_ambulancia: telefonoAmbulancia.trim() || null,
        reloj_imei: imei.trim() || null,
        reloj_sos1: sos1.trim() || null,
        reloj_sos2: sos2.trim() || null,
      });

      // 2. Extracción segura del ID generado por Postgres
      // Soportamos si tu API mapea el id directo, en .paciente_id o en un arreglo .data
      const idActual = paciente?.id || dataPac?.paciente_id || dataPac?.id || (dataPac?.data && dataPac.data[0]?.id);
      
      console.log(`✅ Registro procesado en base de datos. ID Paciente: ${idActual}`);

      // 3. 🚀 ENLACE EN CALIENTE VÍA REDIS
      if (idActual && imei.trim() && (sos1.trim() || sos2.trim())) {
        console.log("⚡ Disparando hilos de red en Redis para sincronización de hardware...");
        await ejecutarSincronizacionReloj(idActual).catch(err => 
          console.log("⚠️ Registro guardado, pero Redis reportó retraso:", err)
        );
      }

      // Activamos el estado visual de éxito para tus componentes de la interfaz
      setExito(true);
      
      // 4. REDIRECCIÓN CENTRALIZADA CON RETARDO (UX limpia)
      setTimeout(() => {
        if (!paciente) {
          console.log("🏁 Onboarding inicial completado. Catapultando a Home...");
          router.replace('/'); 
        } else {
          console.log("🔄 Edición finalizada. Retornando en la pila...");
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
      
      {/* HEADER ORIGINAL (Dejado limpio para evitar colisiones visuales) */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Configuración de Paciente</Text>
          <Text style={styles.userName}>{nombre || 'Nuevo Registro'}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* 🔄 REINICIAR REGISTRO DESDE EL LOGIN (BARRIDO DE SUPABASE) */}
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
                    console.log("📡 Solicitando purga de perfil a Railway...");
                    try {
                      // 1. Le avisamos al backend que destruya nuestro rol trunco
                      await reiniciarRegistroServidor();
                      
                      // 2. Esterilizamos el almacenamiento local del cel
                      await clearToken(); 
                      
                      console.log("🧼 Redirección limpia al Login efectuada.");
                      router.replace('/login'); 
                    } catch (err) {
                      console.error("Fallo operativo en reset, forzando salida:", err);
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

        {/* INICIO DE TU FORMULARIO DE HARDWARE Y CLÍNICA */}
        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej. María Luisa Guevara"
          placeholderTextColor={COLORS.textLight}
        />

        {/* 📡 SECCIÓN TÁCTICA: CONFIGURACIÓN DE DISPOSITIVO VITANOVA (RELOJ GPS) */}
        <View style={styles.seccionReloj}>
          <Text style={styles.relojTitulo}>⌚ Enlace y Configuración del Reloj Vitanova</Text>
        </View>

        <Text style={styles.label}>Número IMEI / ID del Localizador GPS</Text>
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

        {/* 🚀 BOTÓN DE FORZADO MANUAL DE REDIS (Mantiene tu funcionalidad previa para edición) */}
        {paciente?.id && imei.trim() ? (
          <TouchableOpacity
            style={[styles.btnSincronizar, (guardando || sincronizandoHardware) && { opacity: 0.7 }]}
            onPress={() => ejecutarSincronizacionReloj(paciente.id)}
            disabled={guardando || sincronizandoHardware}
          >
            {sincronizandoHardware ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnSincronizarText}>📡 Forzar Sincronización Remota (Redis)</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {/* CLÍNICA BASE */}
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

        <Text style={styles.label}>Talla (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="165"
          placeholderTextColor={COLORS.textLight}
          value={talla}
          onChangeText={setTalla}
          keyboardType="numeric"
        />

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

  seccionEmergencia: { backgroundColor: COLORS.redPale, borderRadius: 10, padding: 12, marginBottom: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(217,79,79,0.2)' },
  seccionTitulo: { fontSize: 12, fontWeight: '800', color: COLORS.red },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  exito: { color: COLORS.green, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  btnDesactivar: { backgroundColor: COLORS.redPale, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(217,79,79,0.3)' },
  btnDesactivarText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
});