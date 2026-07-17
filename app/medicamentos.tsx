import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { actualizarMedicamento, actualizarTareaRecurrente, crearMedicamento, crearTareaRecurrente, desactivarMedicamento, desactivarTareaRecurrente, getMedicamentos, getPacientes, getTareasRecurrentes, loadStoredToken } from '../services/api';

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
  redPale: '#FDEAEA',
};

const VIAS = ['oral', 'sublingual', 'inhalada', 'topica', 'inyectable', 'otro'];
const FRECUENCIAS = ['cada 8 horas', 'cada 12 horas', 'cada 24 horas', 'dos veces al día', 'tres veces al día', 'una vez al día', 'según necesidad'];
const TIPOS_RUTINA = ['alimentacion', 'higiene', 'ejercicio', 'cita', 'otro'];
const ICONOS_RUTINA: Record<string, string> = {
  alimentacion: '🍽️', higiene: '🛁', ejercicio: '🚶', cita: '📅', otro: '📝',
};

export default function MedicamentosScreen() {
  const params = useLocalSearchParams();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();
  const [paciente, setPaciente] = useState<any>(null);
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [tareasRec, setTareasRec] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'medicamentos' | 'rutinas'>('medicamentos');
  const [medicamentoEditando, setMedicamentoEditando] = useState<any>(null);
  // Modal medicamento
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [dosis, setDosis] = useState('');
  const [frecuencia, setFrecuencia] = useState('cada 12 horas');
  const [via, setVia] = useState('oral');
  const [indicaciones, setIndicaciones] = useState('');
  // --- Estados de Temporalidad y Recurrencia Compartidos ---
  const [esPermanente, setEsPermanente] = useState<boolean>(true);
  
  const [fechaInicio, setFechaInicio] = useState<string>(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
  const [fechaFin, setFechaFin] = useState<string>('');
  const [diasSemana, setDiasSemana] = useState<number[]>([]); // Array [0=Dom, 1=Lun, etc.]

  // Modales de control de fecha nativos
  const [showInicioPicker, setShowInicioPicker] = useState<boolean>(false);
  const [showFinPicker, setShowFinPicker] = useState<boolean>(false);
  // Time picker medicamento
  const [horariosArray, setHorariosArray] = useState<string[]>(['08:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [horarioIndex, setHorarioIndex] = useState(0);

  // Modal rutina
  const [modalRutinaOpen, setModalRutinaOpen] = useState(false);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const [rutinaDesc, setRutinaDesc] = useState('');
  const [rutinaTipo, setRutinaTipo] = useState('higiene');
  const [rutinaHora, setRutinaHora] = useState('09:00');
  const [showRutinaTimePicker, setShowRutinaTimePicker] = useState(false);
  const [rutinaEditando, setRutinaEditando] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<{tipo: 'med' | 'rutina', id: string, nombre: string} | null>(null);
  const XLSX = require('xlsx');
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const token = await loadStoredToken();
        if (!token) {
          router.replace('/login');
          return;
        }
        const data = await getPacientes();
        if (data.patients && data.patients.length > 0) {
          const p = pacienteIdParam
            ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
            : data.patients[0];
          setPaciente(p);
          const meds = await getMedicamentos(p.id);
          if (meds.medicamentos) setMedicamentos(meds.medicamentos);
          const rutinas = await getTareasRecurrentes(p.id);
          if (rutinas.tareas) setTareasRec(rutinas.tareas);
        }
      } catch (e) {
        console.error('ERROR CARGANDO DATOS:', e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteIdParam]);

  const guardarMedicamento = async () => {
    if (!nombre.trim() || !dosis.trim()) return;
    setGuardando(true);

    // 📦 Armamos el payload incluyendo las nuevas propiedades del calendario
    const payload = {
      nombre: nombre.trim(),
      dosis: dosis.trim(),
      frecuencia,
      via_administracion: via,
      horarios: horariosArray,
      indicaciones: indicaciones.trim() || null,
      fecha_inicio: fechaInicio,
      fecha_fin: esPermanente ? null : (fechaFin || null),
      dias_semana: diasSemana.length === 0 ? null : diasSemana
    };

    try {
      if (medicamentoEditando) {
        await actualizarMedicamento(medicamentoEditando.id, payload);
      } else {
        await crearMedicamento(paciente.id, payload);
      }
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      
      // Limpieza de estados
      setModalOpen(false);
      setMedicamentoEditando(null);
      setNombre(''); setDosis(''); setFrecuencia('cada 12 horas');
      setVia('oral'); setIndicaciones(''); setHorariosArray(['08:00']);
      resetControlesTiempo();
    } catch (e) {
      console.error("Error al guardar medicamento:", e);
    } finally {
      setGuardando(false);
    }
  };

  const guardarRutina = async () => {
    if (!rutinaDesc.trim()) return;
    setGuardandoRutina(true);

    // 📦 Armamos el payload de la rutina con los días y rango seleccionados
    const payload = {
      descripcion: rutinaDesc.trim(),
      tipo: rutinaTipo,
      hora: rutinaHora,
      fecha_inicio: fechaInicio,
      fecha_fin: esPermanente ? null : (fechaFin || null),
      dias_semana: diasSemana.length === 0 ? null : diasSemana
    };

    try {
      if (rutinaEditando) {
        await actualizarTareaRecurrente(rutinaEditando.id, payload);
      } else {
        await crearTareaRecurrente(paciente.id, payload);
      }
      const rutinas = await getTareasRecurrentes(paciente.id);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);
      
      setModalRutinaOpen(false);
      setRutinaEditando(null);
      setRutinaDesc(''); setRutinaTipo('higiene'); setRutinaHora('09:00');
      resetControlesTiempo();
    } catch (e) {
      console.error("Error al guardar rutina:", e);
    } finally {
      setGuardandoRutina(false);
    }
  };

const importarDesdeExcel = async () => {
    if (!paciente?.id) return;
    
    try {
      // 1. Abrimos el selector de archivos del dispositivo filtrando por hojas de cálculo
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv' // .csv
        ],
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setImportando(true);
      const fileUri = result.assets[0].uri;

      // 2. Leer el archivo binario desde la caché local del dispositivo
      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();
      const dataBuffer = new Uint8Array(arrayBuffer);
      
      // 3. Parsear el libro de trabajo con SheetJS
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertimos la hoja actual a un array de objetos JSON crudos
      const filas: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (filas.length === 0) {
        alert('El archivo Excel está vacío o no tiene el formato correcto.');
        setImportando(false);
        return;
      }

      console.log(`📊 [EXCEL] Detectadas ${filas.length} filas para procesar.`);

      // 4. Mapeo y Sincronización masiva con tu API existente
      for (const fila of filas) {
        const tipo = String(fila.Tipo || '').toLowerCase().trim();
        
        if (tipo === 'medicina' || tipo === 'medicamento') {
          // Sanitizamos horarios: Soporta un solo string ("08:00") o lista separada por comas ("08:00, 20:00")
          const horariosRaw = fila.Horarios ? String(fila.Horarios) : '08:00';
          const horariosArr = horariosRaw.split(',').map(h => h.trim());

          await crearMedicamento(paciente.id, {
            nombre: String(fila.Nombre || 'Medicamento Sin Nombre').trim(),
            dosis: String(fila.Dosis || '1 tableta').trim(),
            frecuencia: String(fila.Frecuencia || 'cada 12 horas').trim(),
            via_administracion: String(fila.Via || 'oral').toLowerCase().trim(),
            horarios: horariosArr,
            indicaciones: fila.Indicaciones ? String(fila.Indicaciones).trim() : null,
          });
        } 
        else if (tipo === 'rutina' || tipo === 'actividad') {
          await crearTareaRecurrente(paciente.id, {
            descripcion: String(fila.Descripcion || 'Rutina sin descripción').trim(),
            tipo: String(fila.Categoria || 'otro').toLowerCase().trim(),
            hora: String(fila.Hora || '09:00').trim(),
          });
        }
      }

      // 5. Refrescar la UI local tirando de tu API
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      const rutinas = await getTareasRecurrentes(paciente.id);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);

      alert('📊 ¡Itinerario importado y consolidado con éxito en Supabase!');

    } catch (error) {
      console.error('❌ Error parseando o subiendo el Excel:', error);
      alert('Ocurrió un error al procesar el archivo Excel. Revisa el formato.');
    } finally {
      setImportando(false);
    }
  };
  const abrirEdicionMedicamento = (med: any) => {
    setMedicamentoEditando(med);
    setNombre(med.nombre);
    setDosis(med.dosis);
    setFrecuencia(med.frecuencia);
    setVia(med.via_administracion);
    setHorariosArray(med.horarios || ['08:00']);
    setIndicaciones(med.indicaciones || '');
    
    // 🎯 FIX EXPLÍCITO: Evaluamos correctamente la existencia de fecha_fin
    const tieneFechaFin = med.fecha_fin && med.fecha_fin !== '' && med.fecha_fin !== null;
    setFechaInicio(med.fecha_inicio || new Date().toLocaleDateString('en-CA'));
    setFechaFin(tieneFechaFin ? med.fecha_fin : '');
    setEsPermanente(!tieneFechaFin);
    setDiasSemana(med.dias_semana || []);
    
    setModalOpen(true);
  };

  const abrirEdicionRutina = (t: any) => {
    setRutinaEditando(t);
    setRutinaDesc(t.descripcion);
    setRutinaTipo(t.tipo);
    setRutinaHora(t.hora || '09:00');
    
    // 🎯 FIX EXPLÍCITO: Evaluamos correctamente la existencia de fecha_fin
    const tieneFechaFin = t.fecha_fin && t.fecha_fin !== '' && t.fecha_fin !== null;
    setFechaInicio(t.fecha_inicio || new Date().toLocaleDateString('en-CA'));
    setFechaFin(tieneFechaFin ? t.fecha_fin : '');
    setEsPermanente(!tieneFechaFin);
    setDiasSemana(t.dias_semana || []);
    
    setModalRutinaOpen(true);
  };

  const resetControlesTiempo = () => {
    setEsPermanente(true);
    setFechaInicio(new Date().toLocaleDateString('en-CA'));
    setFechaFin('');
    setDiasSemana([]);
  };
  const toggleDiaSemana = (diaId: number) => {
    setDiasSemana(prev => 
      prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId].sort()
    );
  };

  
  const eliminarMedicamento = async (id: string) => {
    if (!paciente?.id) return;
    try {
      await desactivarMedicamento(id);
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
    } catch (e) {
      console.error(e);
    }
  };

  const eliminarRutina = async (id: string) => {
    if (!paciente?.id) return;
    try {
      await desactivarTareaRecurrente(id);
      const rutinas = await getTareasRecurrentes(paciente.id);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);
    } catch (e) {
      console.error(e);
    }
  };

  // ── MANEJADORES DE TIEMPO SANITIZADOS PARA EVITAR CRASHES NATIVOS ──
  const onMedicamentoTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false); // Cierre inmediato en Android
    if (selectedDate) {
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      setHorariosArray(prev => {
        const nuevo = [...prev];
        nuevo[horarioIndex] = `${hh}:${mm}`;
        return nuevo;
      });
    }
  };

  const onRutinaTimeChange = (event: any, selectedDate?: Date) => {
    setShowRutinaTimePicker(false); // Cierre inmediato en Android
    if (selectedDate) {
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      setRutinaHora(`${hh}:${mm}`);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Cuidado del Paciente</Text>
          <Text style={styles.headerTitle}>{paciente?.nombre_completo ?? 'Paciente'}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            // 🎯 FIX: Limpieza absoluta de estados temporales y banderas de edición antes de abrir
            resetControlesTiempo();
            if (tab === 'medicamentos') {
              setMedicamentoEditando(null); // Nos aseguramos que no detecte modo edición
              setNombre(''); 
              setDosis(''); 
              setHorariosArray(['08:00']);
              setIndicaciones('');
              setModalOpen(true);
            } else {
              setRutinaEditando(null); // Nos aseguramos que no detecte modo edición
              setRutinaDesc(''); 
              setRutinaHora('09:00');
              setModalRutinaOpen(true);
            }
          }}
        >
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>
      {/* TABS */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'medicamentos' && styles.tabActive]} onPress={() => setTab('medicamentos')}>
          <Text style={[styles.tabText, tab === 'medicamentos' && styles.tabTextActive]}>💊 Medicamentos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'rutinas' && styles.tabActive]} onPress={() => setTab('rutinas')}>
          <Text style={[styles.tabText, tab === 'rutinas' && styles.tabTextActive]}>📋 Rutinas</Text>
        </TouchableOpacity>
      </View>

      {/* 📊 ACCESO EXCEL MASIVO */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 }}>
        <TouchableOpacity 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: COLORS.greenPale, 
            borderWidth: 1, 
            borderColor: COLORS.green, 
            borderRadius: 8, 
            padding: 10,
            gap: 8
          }}
          onPress={importarDesdeExcel}
          disabled={importando}
        >
          <Text style={{ fontSize: 16 }}>{importando ? '⏳' : '📥'}</Text>
          <Text style={{ color: COLORS.green, fontWeight: '700', fontSize: 13 }}>
            {importando ? 'Procesando archivo...' : 'Cargar Itinerario desde Excel (.xlsx)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {tab === 'medicamentos' ? (
          medicamentos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyText}>Sin medicamentos registrados</Text>
            </View>
          ) : (
            medicamentos.map((med, i) => {
              // 🧠 Función helper local para formatear el texto de temporalidad
              const renderTemporalidad = () => {
                if (!med.fecha_fin) {
                  return <Text style={{ fontSize: 11, color: COLORS.gold, fontWeight: '600' }}>♾️ Permanente</Text>;
                }
                if (med.fecha_inicio === med.fecha_fin) {
                  return <Text style={{ fontSize: 11, color: '#777', fontWeight: '600' }}>📍 Programado: {med.fecha_inicio}</Text>;
                }
                return <Text style={{ fontSize: 11, color: '#555', fontWeight: '600' }}>📅 {med.fecha_inicio} al {med.fecha_fin}</Text>;
              };

              return (
                <View key={med.id || i} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.medIcon}>💊</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{med.nombre} {med.dosis}</Text>
                    <Text style={styles.cardSub}>{med.frecuencia} · {med.via_administracion}</Text>
                    
                    {/* Contenedor de Badges con Horario y Temporalidad */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      {med.horarios && med.horarios.length > 0 && (
                        med.horarios.map((h: string, hi: number) => (
                          <View key={hi} style={styles.horarioBadge}>
                            <Text style={styles.horarioBadgeText}>{'⏰ ' + h}</Text>
                          </View>
                        ))
                      )}
                      <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#EAEAEA' }}>
                        {renderTemporalidad()}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => abrirEdicionMedicamento(med)} 
                    style={[styles.deleteBtn, { marginRight: 8 }]}
                  >
                    <Text style={{ color: COLORS.gold, fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setConfirmDelete({ tipo: 'med', id: med.id, nombre: `${med.nombre} ${med.dosis}` })}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )
        ) : (
          tareasRec.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin rutinas registradas</Text>
            </View>
          ) : (
            tareasRec.map((t, i) => {
              // 🧠 Función helper local para formatear el texto de temporalidad
              const renderTemporalidadRutina = () => {
                if (!t.fecha_fin) {
                  return <Text style={{ fontSize: 11, color: COLORS.gold, fontWeight: '600' }}>♾️ Permanente</Text>;
                }
                if (t.fecha_inicio === t.fecha_fin) {
                  return <Text style={{ fontSize: 11, color: '#777', fontWeight: '600' }}>📍 Programado: {t.fecha_inicio}</Text>;
                }
                return <Text style={{ fontSize: 11, color: '#555', fontWeight: '600' }}>📅 {t.fecha_inicio} al {t.fecha_fin}</Text>;
              };

              return (
                <View key={t.id || i} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.medIcon}>{ICONOS_RUTINA[t.tipo] ?? '📝'}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{t.descripcion}</Text>
                    <Text style={styles.cardSub}>{t.tipo}</Text>
                    
                    {/* Contenedor de Badges con Horario y Temporalidad */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <View style={styles.horarioBadge}>
                        <Text style={styles.horarioBadgeText}>{'⏰ ' + t.hora}</Text>
                      </View>
                      <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#EAEAEA' }}>
                        {renderTemporalidadRutina()}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => abrirEdicionRutina(t)} 
                    style={[styles.deleteBtn, { marginRight: 8 }]}
                  >
                    <Text style={{ color: COLORS.gold, fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setConfirmDelete({ tipo: 'rutina', id: t.id, nombre: t.descripcion })}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL MEDICAMENTO */}
      {modalOpen && (
        <View style={styles.modalOverlay}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {medicamentoEditando ? 'Editar medicamento' : 'Nuevo medicamento'}
              </Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput style={styles.input} placeholder="Ej: Metformina" placeholderTextColor={COLORS.textLight} value={nombre} onChangeText={setNombre} autoFocus />

              <Text style={styles.label}>Dosis *</Text>
              <TextInput style={styles.input} placeholder="Ej: 500mg" placeholderTextColor={COLORS.textLight} value={dosis} onChangeText={setDosis} />

              <Text style={styles.label}>Frecuencia</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {FRECUENCIAS.map(f => (
                    <TouchableOpacity key={f} style={[styles.chipBtn, frecuencia === f && styles.chipBtnActive]} onPress={() => setFrecuencia(f)}>
                      <Text style={[styles.chipBtnText, frecuencia === f && styles.chipBtnTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Horarios de administración</Text>
              {horariosArray.map((h, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, backgroundColor: COLORS.white, alignItems: 'center' }}
                    onPress={() => { setHorarioIndex(idx); setShowTimePicker(true); }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.cacao }}>{`🕐 ${h}`}</Text>
                  </TouchableOpacity>
                  {horariosArray.length > 1 && (
                    <TouchableOpacity onPress={() => setHorariosArray(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 8 }}>
                      <Text style={{ color: COLORS.red, fontSize: 18 }}>{'✕'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setHorariosArray(prev => [...prev, '12:00'])}
                style={{ borderWidth: 1, borderColor: COLORS.gold, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: COLORS.goldPale, marginBottom: 12 }}
              >
                <Text style={{ color: COLORS.gold, fontWeight: '700' }}>{'+ Agregar horario'}</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const partes = (horariosArray[horarioIndex] || '08:00').split(':').map(Number);
                    const d = new Date();
                    d.setHours(partes[0] || 8, partes[1] || 0, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={onMedicamentoTimeChange}
                />
              )}

              <Text style={styles.label}>Vía de administración</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {VIAS.map(v => (
                  <TouchableOpacity key={v} style={[styles.chipBtn, via === v && styles.chipBtnActive]} onPress={() => setVia(v)}>
                    <Text style={[styles.chipBtnText, via === v && styles.chipBtnTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Indicaciones (opcional)</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Tomar con alimentos..." placeholderTextColor={COLORS.textLight} multiline value={indicaciones} onChangeText={setIndicaciones} />
              
              {/* 🗓️ SECCIÓN DE RECURRENCIA Y CRONOGRAMA INTELIGENTE */}
              <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#F9F9F9', borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao, marginBottom: 8 }}>🗓️ Duración del Plan</Text>
                
                {/* Selector de Duración de Plan Expandido */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <TouchableOpacity 
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, esPermanente && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => { setEsPermanente(true); setFechaFin(''); }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, esPermanente && { color: '#FFF' }]}>♾️ Permanente</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, 
                      (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }
                    ]}
                    onPress={() => {
                      setEsPermanente(false);
                      // Si venimos de "Fecha Específica", limpiamos la fecha fin para poder poner un periodo
                      if (fechaFin === fechaInicio) {
                        setFechaFin('');
                      }
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, 
                      (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { color: '#FFF' }
                    ]}>📅 Por Periodo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => {
                      setEsPermanente(false);
                      setFechaFin(fechaInicio); // 🎯 Fuerza que termines el mismo día
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { color: '#FFF' }]}>📍 Fecha Específica</Text>
                  </TouchableOpacity>
                </View>

                {/* Pickers de fecha */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Fecha Inicio</Text>
                    <TouchableOpacity 
                      style={{ borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center' }}
                      onPress={() => setShowInicioPicker(true)}
                    >
                      <Text style={{ fontSize: 13, color: COLORS.cacao, fontWeight: '600' }}>{fechaInicio}</Text>
                    </TouchableOpacity>
                  </View>

                  {!esPermanente && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Fecha Término</Text>
                      <TouchableOpacity 
                      style={[{ borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center' }, 
                        (fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: '#EAEAEA' }
                      ]}
                      onPress={() => {
                        if (fechaInicio === fechaFin && fechaFin !== '') {
                          // Si está en modo fecha específica, al tocarlo lo convertimos automáticamente en periodo
                          setFechaFin(''); 
                        } else if (fechaFin === '' || fechaFin === fechaInicio) {
                          setShowFinPicker(true);
                        } else {
                          setShowFinPicker(true);
                        }
                      }}
                      disabled={false}   // quitamos el disabled para que siempre sea interactivo
                    >
                      <Text style={{ fontSize: 13, color: COLORS.cacao, fontWeight: '600' }}>
                        {fechaFin || 'Seleccionar fecha de término'}
                      </Text>
                    </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Renderizado de DateTimePickers Nativos */}
                {showInicioPicker && (
                  <DateTimePicker
                    value={new Date(fechaInicio + 'T12:00:00')}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowInicioPicker(false);
                      if (date) {
                        const nuevaFecha = date.toLocaleDateString('en-CA');
                        setFechaInicio(nuevaFecha);
                        // 🎯 Si estamos en modo Fecha Específica, arrastra de forma automática la fecha de fin
                        if (!esPermanente && fechaFin !== '' && fechaFin === fechaInicio) {
                          setFechaFin(nuevaFecha);
                        }
                      }
                    }}
                  />
                )}
                {showFinPicker && (
                  <DateTimePicker
                    value={fechaFin ? new Date(fechaFin + 'T12:00:00') : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowFinPicker(false);
                      if (date) setFechaFin(date.toLocaleDateString('en-CA'));
                    }}
                  />
                )}

                {/* 📆 Días de la semana */}
                <Text style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>Días de ejecución (Vacío aplica diario)</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
                  {[
                    { id: 0, label: 'D' }, { id: 1, label: 'L' }, { id: 2, label: 'M' },
                    { id: 3, label: 'M' }, { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' }
                  ].map(d => {
                    const seleccionado = diasSemana.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={{
                          width: 32, height: 32, borderRadius: 16, borderWidth: 1,
                          borderColor: seleccionado ? COLORS.cacao : COLORS.border,
                          backgroundColor: seleccionado ? COLORS.cacao : '#FFF',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                        onPress={() => toggleDiaSemana(d.id)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: seleccionado ? '#FFF' : '#555' }}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setModalOpen(false); setMedicamentoEditando(null); setNombre(''); setDosis(''); setHorariosArray(['08:00']); setIndicaciones(''); resetControlesTiempo(); }}>
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]} onPress={guardarMedicamento} disabled={guardando}>
                  <Text style={styles.modalBtnText}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODAL RUTINA */}
      {modalRutinaOpen && (
        <View style={styles.modalOverlay}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {rutinaEditando ? 'Editar rutina' : 'Nueva rutina'}
              </Text>

              <Text style={styles.label}>Descripción *</Text>
              <TextInput style={styles.input} placeholder="Ej: Baño matutino" placeholderTextColor={COLORS.textLight} value={rutinaDesc} onChangeText={setRutinaDesc} autoFocus />

              <Text style={styles.label}>Tipo</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {TIPOS_RUTINA.map(t => (
                  <TouchableOpacity key={t} style={[styles.chipBtn, rutinaTipo === t && styles.chipBtnActive]} onPress={() => setRutinaTipo(t)}>
                    <Text style={[styles.chipBtnText, rutinaTipo === t && styles.chipBtnTextActive]}>{ICONOS_RUTINA[t]} {t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Horario</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, backgroundColor: COLORS.white, alignItems: 'center', marginBottom: 12 }}
                onPress={() => setShowRutinaTimePicker(true)}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.cacao }}>{`🕐 ${rutinaHora}`}</Text>
              </TouchableOpacity>

              {showRutinaTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const partes = (rutinaHora || '09:00').split(':').map(Number);
                    const d = new Date();
                    d.setHours(partes[0] || 9, partes[1] || 0, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={onRutinaTimeChange}
                />
              )}
              
              {/* 🗓️ SECCIÓN DE RECURRENCIA Y CRONOGRAMA INTELIGENTE */}
              <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#F9F9F9', borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao, marginBottom: 8 }}>🗓️ Duración del Plan</Text>
                
                {/* Selector de Duración de Plan Expandido */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <TouchableOpacity 
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, esPermanente && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => { setEsPermanente(true); setFechaFin(''); }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, esPermanente && { color: '#FFF' }]}>♾️ Permanente</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                  style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, 
                    (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }
                  ]}
                  onPress={() => {
                    setEsPermanente(false);
                    // Si venimos de "Fecha Específica", limpiamos la fecha fin para poder poner un periodo
                    if (fechaFin === fechaInicio) {
                      setFechaFin('');
                    }
                  }}
                >
                  <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, 
                    (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { color: '#FFF' }
                  ]}>📅 Por Periodo</Text>
                </TouchableOpacity>

                  <TouchableOpacity 
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => {
                      setEsPermanente(false);
                      setFechaFin(fechaInicio); // 🎯 Fuerza que termines el mismo día
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { color: '#FFF' }]}>📍 Fecha Específica</Text>
                  </TouchableOpacity>
                </View>

                {/* Pickers de fecha */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Fecha Inicio</Text>
                    <TouchableOpacity 
                      style={{ borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center' }}
                      onPress={() => setShowInicioPicker(true)}
                    >
                      <Text style={{ fontSize: 13, color: COLORS.cacao, fontWeight: '600' }}>{fechaInicio}</Text>
                    </TouchableOpacity>
                  </View>

                  {!esPermanente && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Fecha Término</Text>
                      <TouchableOpacity 
                      style={[{ borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center' }, 
                        (fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: '#EAEAEA' }
                      ]}
                      onPress={() => {
                        if (fechaInicio === fechaFin && fechaFin !== '') {
                          // Si está en modo fecha específica, al tocarlo lo convertimos automáticamente en periodo
                          setFechaFin(''); 
                        } else if (fechaFin === '' || fechaFin === fechaInicio) {
                          setShowFinPicker(true);
                        } else {
                          setShowFinPicker(true);
                        }
                      }}
                      disabled={false}   // quitamos el disabled para que siempre sea interactivo
                    >
                      <Text style={{ fontSize: 13, color: COLORS.cacao, fontWeight: '600' }}>
                        {fechaFin || 'Seleccionar fecha de término'}
                      </Text>
                    </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Renderizado de DateTimePickers Nativos */}
                {showInicioPicker && (
                  <DateTimePicker
                    value={new Date(fechaInicio + 'T12:00:00')}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowInicioPicker(false);
                      if (date) {
                        const nuevaFecha = date.toLocaleDateString('en-CA');
                        setFechaInicio(nuevaFecha);
                        if (!esPermanente && fechaFin !== '' && fechaFin === fechaInicio) {
                          setFechaFin(nuevaFecha);
                        }
                      }
                    }}
                  />
                )}
                {showFinPicker && (
                  <DateTimePicker
                    value={fechaFin ? new Date(fechaFin + 'T12:00:00') : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowFinPicker(false);
                      if (date) setFechaFin(date.toLocaleDateString('en-CA'));
                    }}
                  />
                )}

                {/* 📆 Días de la semana */}
                <Text style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>Días de ejecución (Vacío aplica diario)</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
                  {[
                    { id: 0, label: 'D' }, { id: 1, label: 'L' }, { id: 2, label: 'M' },
                    { id: 3, label: 'M' }, { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' }
                  ].map(d => {
                    const seleccionado = diasSemana.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={{
                          width: 32, height: 32, borderRadius: 16, borderWidth: 1,
                          borderColor: seleccionado ? COLORS.cacao : COLORS.border,
                          backgroundColor: seleccionado ? COLORS.cacao : '#FFF',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                        onPress={() => toggleDiaSemana(d.id)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: seleccionado ? '#FFF' : '#555' }}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setModalRutinaOpen(false); setRutinaEditando(null); setRutinaDesc(''); setRutinaTipo('higiene'); setRutinaHora('09:00'); resetControlesTiempo(); }}>
                  <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]} onPress={guardarRutina} disabled={guardandoRutina}>
                  <Text style={styles.modalBtnText}>{guardandoRutina ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      {confirmDelete && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { gap: 16 }]}>
            <Text style={{ fontSize: 32, textAlign: 'center' }}>🗑️</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' }}>
              {'¿Eliminar registro?'}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: 'center' }}>
              {`"${confirmDelete.nombre}" será desactivado y no aparecerá en la lista.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: COLORS.cream, flex: 1 }]} 
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: COLORS.red, flex: 1 }]} 
                onPress={async () => {
                  if (confirmDelete.tipo === 'med') {
                    await eliminarMedicamento(confirmDelete.id);
                  } else {
                    await eliminarRutina(confirmDelete.id);
                  }
                  setConfirmDelete(null);
                }}
              >
                <Text style={styles.modalBtnText}>{'Eliminar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#FFFFFF', fontSize: 18 },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  addBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: COLORS.textLight },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  cardLeft: { marginRight: 12 },
  medIcon: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  cardSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  horarioBadge: { backgroundColor: COLORS.goldPale, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  horarioBadgeText: { fontSize: 11, color: COLORS.gold, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: COLORS.red, fontSize: 16 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20, zIndex: 10 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, marginTop: 40 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.cacao, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10, fontSize: 15, color: COLORS.textDark, marginBottom: 16 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipBtnText: { fontSize: 12, color: COLORS.textLight },
  chipBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});