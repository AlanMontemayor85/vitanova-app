import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as XLSX from 'xlsx';

import {
  actualizarItemInventario,
  actualizarMedicamento,
  actualizarTareaRecurrente,
  consumirItemInventario,
  crearItemInventario,
  crearMedicamento,
  crearTareaRecurrente,
  desactivarMedicamento,
  desactivarTareaRecurrente,
  getInventario,
  getMedicamentos,
  getPacientes,
  getTareasRecurrentes, sugerirDosisHistorica, vincularPacientesHogar
} from '../services/api';

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
  green: '#3DAA6A',
  greenPale: '#E8F5E9',
};

const FRECUENCIAS = [
  'Cada 4 horas',
  'Cada 6 horas',
  'Cada 8 horas',
  'Cada 12 horas',
  'Una vez al día',
  'Según razón necesaria',
];

const VIAS = ['oral', 'intravenosa', 'intramuscular', 'cutánea', 'oftálmica', 'otra'];

const TIPOS_RUTINA = ['higiene', 'alimentacion', 'ejercicio', 'estudio', 'otro'];

const ICONOS_RUTINA: Record<string, string> = {
  higiene: '🧼',
  alimentacion: '🥗',
  ejercicio: '🏃',
  estudio: '📚',
  otro: '📝',
};

export default function MedicamentosScreen() {
  const params = useLocalSearchParams<{ pacienteId?: string; refresh?: string }>();
  const pacienteIdParam = params.pacienteId as string;
  const router = useRouter();

  const [paciente, setPaciente] = useState<any>(null);
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [tareasRec, setTareasRec] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'medicamentos' | 'rutinas' | 'inventario'>('medicamentos');

  // --- Modal Medicamento ---
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [medicamentoEditando, setMedicamentoEditando] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [dosis, setDosis] = useState('');
  const [frecuencia, setFrecuencia] = useState('cada 12 horas');
  const [via, setVia] = useState('oral');
  const [indicaciones, setIndicaciones] = useState('');
  const [cantidadInicial, setCantidadInicial] = useState('0'); // 📦 Stock para Inventario
  const [unidadMedida, setUnidadMedida] = useState('piezas');

  // Autocompletado desde Inventario
  const [sugerencias, setSugerencias] = useState<any[]>([]);

  // --- Temporalidad y Recurrencia ---
  const getHoyISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [esPermanente, setEsPermanente] = useState<boolean>(true);
  const [fechaInicio, setFechaInicio] = useState<string>(getHoyISO());
  const [fechaFin, setFechaFin] = useState<string>('');
  const [diasSemana, setDiasSemana] = useState<number[]>([]);

  const [showInicioPicker, setShowInicioPicker] = useState<boolean>(false);
  const [showFinPicker, setShowFinPicker] = useState<boolean>(false);

  // --- Time Picker Medicamento ---
  const [horariosArray, setHorariosArray] = useState<string[]>(['08:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [horarioIndex, setHorarioIndex] = useState(0);

  // --- Modal Rutina ---
  const [modalRutinaOpen, setModalRutinaOpen] = useState(false);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const [rutinaEditando, setRutinaEditando] = useState<any>(null);
  const [rutinaDesc, setRutinaDesc] = useState('');
  const [rutinaTipo, setRutinaTipo] = useState('higiene');
  const [rutinaHora, setRutinaHora] = useState('09:00');
  const [showRutinaTimePicker, setShowRutinaTimePicker] = useState(false);

  // --- Modal Inventario ---
  const [modalInvOpen, setModalInvOpen] = useState(false);
  const [guardandoInv, setGuardandoInv] = useState(false);
  const [invEditando, setInvEditando] = useState<any>(null);
  const [invNombre, setInvNombre] = useState('');
  const [invTipo, setInvTipo] = useState<'medicamento' | 'insumo' | 'otro'>('medicamento');
  const [invCantidad, setInvCantidad] = useState('0');
  const [invUnidad, setInvUnidad] = useState('piezas');
  const [invMinimo, setInvMinimo] = useState('0');
  const [invCaducidad, setInvCaducidad] = useState('');
  const [invNotas, setInvNotas] = useState('');
  const [esCuidador, setEsCuidador] = useState<boolean>(false);
  const [invDosis, setInvDosis] = useState<string>('');
  const [showDatePickerInv, setShowDatePickerInv] = useState<boolean>(false);
  // --- Control de Eliminación e Importación ---
  const [confirmDelete, setConfirmDelete] = useState<{ tipo: 'med' | 'rutina'; id: string; nombre: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [invEsCompartido, setInvEsCompartido] = useState<boolean>(false);
  const [dosisSugeridas, setDosisSugeridas] = useState<string[]>([]);
  const [modalVincularOpen, setModalVincularOpen] = useState(false);
  const [procesandoVinculo, setProcesandoVinculo] = useState(false);
  const [listaPacientes, setListaPacientes] = useState<any[]>([]);
  
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getPacientes('medicamentos');

        if (!data?.patients?.length) {
          setLoading(false);
          return;
        }
        setListaPacientes(data.patients);
        const p = pacienteIdParam
          ? data.patients.find((x: any) => x.id === pacienteIdParam) || data.patients[0]
          : data.patients[0];

        if (!p?.id) {
          setLoading(false);
          return;
        }

        setPaciente(p);

        const [meds, rutinas, inv] = await Promise.all([
          getMedicamentos(p.id),
          getTareasRecurrentes(p.id),
          getInventario(p.id),
        ]);

        if (meds.medicamentos) setMedicamentos(meds.medicamentos);
        if (rutinas.tareas) setTareasRec(rutinas.tareas);
        if (inv.items) setInventario(inv.items);
      } catch (e) {
        console.error('Error cargando pantalla de medicamentos:', e);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [pacienteIdParam, params?.refresh]);

  const resetControlesTiempo = () => {
    setEsPermanente(true);
    setFechaInicio(getHoyISO());
    setFechaFin('');
    setDiasSemana([]);
  };

  const toggleDiaSemana = (diaId: number) => {
    setDiasSemana(prev =>
      prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId].sort()
    );
  };
  const handleVincularPacientes = async (pacienteDestinoId: string) => {
  if (!paciente?.id || !pacienteDestinoId) return;

  setProcesandoVinculo(true);
  try {
    const res = await vincularPacientesHogar(paciente.id, pacienteDestinoId);

    if (res.status === 'ok') {
      Alert.alert(
        '🏠 ¡Hogar Vinculado!',
        'Los insumos compartidos (como pañales o gasas) ahora estarán sincronizados entre ambos pacientes.'
      );
      
      // Refrescamos el inventario actual para reflejar los insumos del nuevo hogar
      const invData = await getInventario(paciente.id);
      if (invData?.items) setInventario(invData.items);
      
      setModalVincularOpen(false);
    } else {
      Alert.alert('Error', res.detail || 'No se pudo vincular el hogar.');
    }
  } catch (error) {
    console.error('Error vinculando pacientes:', error);
    Alert.alert('Error', 'Hubo un fallo de conexión al vincular.');
  } finally {
    setProcesandoVinculo(false);
  }
 };
 const handlePressAgregar = () => {
  if (tab === 'medicamentos') {
    resetFormularioMedicamento(); // 👈 Llama la limpieza primero
    setModalOpen(true); 

  } else if (tab === 'rutinas') {
    setRutinaEditando?.(null);
    setRutinaDesc?.('');
    setRutinaHora?.('09:00');
    resetControlesTiempo();
    setModalRutinaOpen(true); 

  } else if (tab === 'inventario') {
    resetFormularioInventario();
    setDosisSugeridas([]);
    setModalInvOpen(true);
  }
};

const resetFormularioMedicamento = () => {
  setMedicamentoEditando(null); 
  setNombre('');                
  setDosis('');
  setFrecuencia('cada 12 horas');
  setVia('oral');
  setIndicaciones('');
  setHorariosArray(['08:00']);
  setCantidadInicial('0');
  setSugerencias([]);
  resetControlesTiempo();
};

  const guardarMedicamento = async () => {
    if (!nombre.trim() || !dosis.trim() || !paciente?.id) return;
    setGuardando(true);

    const payload = {
      paciente_id: paciente.id, // 👈 CRÍTICO: FastAPI exige este campo en MedicamentoCreate
      nombre: nombre.trim(),
      dosis: dosis.trim(),
      frecuencia,
      via_administracion: via,
      horarios: horariosArray,
      indicaciones: indicaciones.trim() || null,
      fecha_inicio: fechaInicio,
      fecha_fin: esPermanente ? null : (fechaFin || null),
      dias_semana: diasSemana.length === 0 ? null : diasSemana,
      cantidad_inicial: Number(cantidadInicial) || 0,
      unidad_medida: unidadMedida || 'piezas',
    };

    try {
      if (medicamentoEditando) {
        await actualizarMedicamento(medicamentoEditando.id, payload);
      } else {
        await crearMedicamento(paciente.id, payload);
      }
      
      // Refrescamos Medicamentos e Inventario simultáneamente
      const [meds, inv] = await Promise.all([
        getMedicamentos(paciente.id),
        getInventario(paciente.id)
      ]);
      
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      if (inv.items) setInventario(inv.items);

      DeviceEventEmitter.emit('RECARGAR_TAREAS');

      setModalOpen(false);
      setMedicamentoEditando(null);
      setNombre('');
      setDosis('');
      setFrecuencia('cada 12 horas');
      setVia('oral');
      setIndicaciones('');
      setHorariosArray(['08:00']);
      setCantidadInicial('0');
      setSugerencias([]);
      resetControlesTiempo();
    } catch (e) {
      console.error('Error al guardar medicamento:', e);
    } finally {
      setGuardando(false);
    }
  };

  const guardarRutina = async () => {
    if (!rutinaDesc.trim()) return;
    setGuardandoRutina(true);

    const payload = {
      descripcion: rutinaDesc.trim(),
      tipo: rutinaTipo,
      hora: rutinaHora,
      fecha_inicio: fechaInicio,
      fecha_fin: esPermanente ? null : (fechaFin || null),
      dias_semana: diasSemana.length === 0 ? null : diasSemana,
    };

    try {
      if (rutinaEditando) {
        await actualizarTareaRecurrente(rutinaEditando.id, payload);
      } else {
        await crearTareaRecurrente(paciente.id, payload);
      }
      const rutinas = await getTareasRecurrentes(paciente.id);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);
      DeviceEventEmitter.emit('RECARGAR_TAREAS');

      setModalRutinaOpen(false);
      setRutinaEditando(null);
      setRutinaDesc('');
      setRutinaTipo('higiene');
      setRutinaHora('09:00');
      resetControlesTiempo();
    } catch (e) {
      console.error('Error al guardar rutina:', e);
    } finally {
      setGuardandoRutina(false);
    }
  };
  const resetFormularioInventario = () => {
    setInvEditando(null);
    setInvNombre('');
    setInvDosis('');
    setInvTipo('medicamento');
    setInvCantidad('0');
    setInvUnidad('piezas');
    setInvMinimo('0');
    setInvCaducidad('');
    setInvNotas('');
  };
  const manejarCambioNombre = async (texto: string) => {
  setInvNombre(texto);

  const idPacienteActual = paciente?.id;

  if (texto.trim().length >= 3 && idPacienteActual) {
    try {
      // 🎯 Usamos el servicio importado de api.ts
      const data = await sugerirDosisHistorica(idPacienteActual, texto);

      if (data?.historico && data.historico.length > 0) {
        setDosisSugeridas(data.historico);
        
        // Autocompleta la dosis solo si no se ha escrito nada
        setInvDosis((dosisActual) => {
          if (!dosisActual && data.dosis_sugerida) {
            return data.dosis_sugerida;
          }
          return dosisActual;
        });
      } else {
        setDosisSugeridas([]);
      }
    } catch (e) {
      console.log("⚠️ Error al buscar sugerencia de dosis:", e);
    }
  } else {
    setDosisSugeridas([]);
  }
};
  const guardarInventario = async () => {
  // 1. Obtener ID del paciente de forma segura
  const idPacienteActual = paciente?.id;

  if (!idPacienteActual) {
    Alert.alert('Error', 'No se detectó un paciente seleccionado.');
    return;
  }

  // 2. Validación básica
  if (!invNombre.trim()) {
    Alert.alert('Campo requerido', 'Por favor ingresa el nombre del ítem.');
    return;
  }

  setGuardandoInv(true);

  try {
    // 3. Payload listo para el backend
    const payload = {
      paciente_id: idPacienteActual,
      nombre: invNombre.trim(),
      dosis: invDosis.trim() || null,
      tipo: invTipo,
      cantidad: Number(invCantidad) || 0,
      unidad: invUnidad.trim() || 'piezas',
      cantidad_minima: Number(invMinimo) || 0,
      fecha_caducidad: invCaducidad.trim() || null,
      es_compartido: invEsCompartido,
      notas: invNotas.trim() || null,
    };

    console.log("📦 [GUARDANDO INVENTARIO] Payload:", payload);

    let res;
    if (invEditando) {
      res = await actualizarItemInventario(invEditando.id, payload);
    } else {
      res = await crearItemInventario(idPacienteActual, payload);
    }

    console.log("✅ [INVENTARIO GUARDADO] Respuesta:", res);

    // 4. Refrescar lista de inventario
    const invFrescor = await getInventario(idPacienteActual);
    const listaActualizada = invFrescor?.items || (Array.isArray(invFrescor) ? invFrescor : []);
    setInventario(listaActualizada);

    // 5. Cerrar y resetear
    setModalInvOpen(false);
    resetFormularioInventario();

    Alert.alert(
      '✅ Éxito', 
      invEditando ? 'Artículo actualizado correctamente.' : 'Artículo agregado al inventario.'
    );

  } catch (error: any) {
    console.error("❌ Error al guardar inventario:", error);
    Alert.alert('Error', `No se pudo guardar el ítem: ${error.message || 'Error de conexión'}`);
  } finally {
    setGuardandoInv(false);
  }
  };
  
  const importarDesdeExcel = async () => {
    if (!paciente?.id) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setImportando(true);
      const fileUri = result.assets[0].uri;

      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();
      const dataBuffer = new Uint8Array(arrayBuffer);

      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const filas: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (filas.length === 0) {
        alert('El archivo Excel está vacío o no tiene el formato correcto.');
        setImportando(false);
        return;
      }

      const limpiarYFormatearFecha = (fechaRaw: any) => {
        if (!fechaRaw) return null;

        if (typeof fechaRaw === 'number' || !isNaN(Number(fechaRaw))) {
          const serialExcel = Number(fechaRaw);
          const fechaJS = new Date((serialExcel - 25569) * 86400 * 1000);
          const anio = fechaJS.getUTCFullYear();
          const mes = String(fechaJS.getUTCMonth() + 1).padStart(2, '0');
          const dia = String(fechaJS.getUTCDate()).padStart(2, '0');
          return `${anio}-${mes}-${dia}`;
        }

        const fechaStr = String(fechaRaw).trim();

        if (fechaStr.includes('/')) {
          const partes = fechaStr.split('/');
          if (partes.length === 3) {
            const dia = partes[0].padStart(2, '0');
            const mes = partes[1].padStart(2, '0');
            const anio = partes[2];
            return `${anio}-${mes}-${dia}`;
          }
        }

        return fechaStr.split('T')[0];
      };

      for (const fila of filas) {
        const tipo = String(fila.Tipo || '').toLowerCase().trim();
        const fInicioClean = limpiarYFormatearFecha(fila.FechaInicio || fila['Fecha Inicio']);
        const fFinClean = limpiarYFormatearFecha(fila.FechaFin || fila['Fecha Fin']);

        const fecha_inicio = fInicioClean || getHoyISO();
        const fecha_fin = fFinClean ? fFinClean : null;

        try {
          if (tipo === 'medicina' || tipo === 'medicamento') {
            let horariosRaw = fila.Horarios ? String(fila.Horarios).trim() : '08:00';

            if (!isNaN(Number(horariosRaw)) && Number(horariosRaw) > 0 && Number(horariosRaw) < 1) {
              const fraccionDia = Number(horariosRaw);
              const totalMinutos = Math.round(fraccionDia * 24 * 60);
              const horas = Math.floor(totalMinutos / 60);
              const minutos = totalMinutos % 60;
              horariosRaw = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
            }

            const horariosArr = horariosRaw.split(',').map(h => {
              let horaLimpia = h.trim();
              if (!isNaN(Number(horaLimpia)) && Number(horaLimpia) > 0 && Number(horaLimpia) < 1) {
                const f = Number(horaLimpia);
                const tm = Math.round(f * 24 * 60);
                horaLimpia = `${String(Math.floor(tm / 60)).padStart(2, '0')}:${String(tm % 60).padStart(2, '0')}`;
              }
              return horaLimpia;
            });

            await crearMedicamento(paciente.id, {
              nombre: String(fila.Nombre || 'Medicamento Sin Nombre').trim(),
              dosis: String(fila.Dosis || '1 tableta').trim(),
              frecuencia: String(fila.Frecuencia || 'cada 12 horas').trim(),
              via_administracion: String(fila.Via || 'oral').toLowerCase().trim(),
              horarios: horariosArr,
              indicaciones: fila.Indicaciones ? String(fila.Indicaciones).trim() : null,
              fecha_inicio,
              fecha_fin,
              fuente: 'manual',
              activo: true,
            });
          } else if (tipo === 'rutina' || tipo === 'actividad') {
            let horaRaw = fila.Hora ? String(fila.Hora).trim() : '09:00';

            if (!isNaN(Number(horaRaw)) && Number(horaRaw) > 0 && Number(horaRaw) < 1) {
              const fraccionDia = Number(horaRaw);
              const totalMinutos = Math.round(fraccionDia * 24 * 60);
              const horas = Math.floor(totalMinutos / 60);
              const minutos = totalMinutos % 60;
              horaRaw = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
            }

            await crearTareaRecurrente(paciente.id, {
              descripcion: String(fila.Descripcion || 'Rutina sin descripción').trim(),
              tipo: String(fila.Categoria || 'otro').toLowerCase().trim(),
              hora: horaRaw,
              fecha_inicio,
              fecha_fin,
            });
          }
        } catch (apiError: any) {
          console.error(`❌ Error importando fila "${fila.Nombre || fila.Descripcion}":`, apiError?.message || apiError);
        }
      }

      const [meds, rutinas, inv] = await Promise.all([
        getMedicamentos(paciente.id),
        getTareasRecurrentes(paciente.id),
        getInventario(paciente.id),
      ]);

      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      if (rutinas.tareas) setTareasRec(rutinas.tareas);
      if (inv.items) setInventario(inv.items);

      DeviceEventEmitter.emit('RECARGAR_TAREAS');
      alert('📊 ¡Itinerario importado e integrado con éxito!');
    } catch (error) {
      console.error('❌ Error procesando Excel:', error);
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

    const tieneFechaFin = med.fecha_fin && med.fecha_fin !== '' && med.fecha_fin !== null;
    setFechaInicio(med.fecha_inicio || getHoyISO());
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

    const tieneFechaFin = t.fecha_fin && t.fecha_fin !== '' && t.fecha_fin !== null;
    setFechaInicio(t.fecha_inicio || getHoyISO());
    setFechaFin(tieneFechaFin ? t.fecha_fin : '');
    setEsPermanente(!tieneFechaFin);
    setDiasSemana(t.dias_semana || []);

    setModalRutinaOpen(true);
  };
  // ✏️ Carga los datos del ítem seleccionado y abre el modal en modo edición
  const abrirEdicionInventario = (item: any) => {
    setInvEditando(item);
    setInvNombre(item.nombre || '');
    setInvDosis(item.dosis || '');
    setInvTipo(item.tipo || 'medicamento');
    setInvCantidad(String(item.cantidad ?? 0));
    setInvUnidad(item.unidad || 'piezas');
    setInvMinimo(String(item.cantidad_minima ?? 0));
    setInvCaducidad(item.fecha_caducidad || '');
    setInvNotas(item.notas || '');
    setInvEsCompartido(!!item.es_compartido);
    setModalInvOpen(true);
  };
  const eliminarMedicamento = async (id: string) => {
    if (!paciente?.id) return;
    try {
      await desactivarMedicamento(id);
      const meds = await getMedicamentos(paciente.id);
      if (meds.medicamentos) setMedicamentos(meds.medicamentos);
      DeviceEventEmitter.emit('RECARGAR_TAREAS');
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
      DeviceEventEmitter.emit('RECARGAR_TAREAS');
    } catch (e) {
      console.error(e);
    }
  };

  const onMedicamentoTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
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
    setShowRutinaTimePicker(false);
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

        {/* Botón Agregar único con handlePressAgregar */}
        <TouchableOpacity style={styles.addBtn} onPress={handlePressAgregar}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* TABS (Sin desfase) */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('medicamentos')}>
          <Text style={[styles.tabText, tab === 'medicamentos' && styles.tabTextActive]}>
            💊 Medicamentos
          </Text>
          {tab === 'medicamentos' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => setTab('rutinas')}>
          <Text style={[styles.tabText, tab === 'rutinas' && styles.tabTextActive]}>
            📋 Rutinas
          </Text>
          {tab === 'rutinas' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => setTab('inventario')}>
          <Text style={[styles.tabText, tab === 'inventario' && styles.tabTextActive]}>
            📦 Inventario
          </Text>
          {tab === 'inventario' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>

      {/* ACCESO EXCEL MASIVO */}
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
            gap: 8,
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

      {/* CUERPO PRINCIPAL / LISTAS */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {tab === 'medicamentos' && (
          medicamentos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyText}>Sin medicamentos registrados</Text>
            </View>
          ) : (
            medicamentos.map((med, i) => {
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
                  <TouchableOpacity onPress={() => abrirEdicionMedicamento(med)} style={[styles.deleteBtn, { marginRight: 8 }]}>
                    <Text style={{ color: COLORS.gold, fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmDelete({ tipo: 'med', id: med.id, nombre: `${med.nombre} ${med.dosis}` })} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )
        )}

        {tab === 'rutinas' && (
          tareasRec.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin rutinas registradas</Text>
            </View>
          ) : (
            tareasRec.map((t, i) => {
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

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <View style={styles.horarioBadge}>
                        <Text style={styles.horarioBadgeText}>{'⏰ ' + t.hora}</Text>
                      </View>
                      <View style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#EAEAEA' }}>
                        {renderTemporalidadRutina()}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => abrirEdicionRutina(t)} style={[styles.deleteBtn, { marginRight: 8 }]}>
                    <Text style={{ color: COLORS.gold, fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmDelete({ tipo: 'rutina', id: t.id, nombre: t.descripcion })} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )
        )}

      {tab === 'inventario' && (
  inventario.length === 0 ? (
    <View style={{ alignItems: 'center', marginTop: 40 }}>
      <Text style={{ fontSize: 40 }}>📦</Text>
      <Text style={{ color: COLORS.textLight, marginTop: 8 }}>
        {esCuidador ? 'Sin medicamentos activos registrados' : 'Sin ítems en despensa'}
      </Text>
    </View>
  ) : (
    inventario.map((item) => (
      <View key={item.id} style={styles.card}>
        
        {/* 📄 Datos del Ítem */}
        <View style={{ flex: 1, marginRight: 8 }}>
          
          {/* Nombre + Dosis/Presentación */}
          <Text style={{ fontWeight: '800', color: COLORS.textDark, fontSize: 15 }} numberOfLines={1}>
            {item.nombre} {item.dosis ? `• ${item.dosis}` : ''}
          </Text>

          {/* Stock y Días de Cobertura */}
          <Text style={{ color: COLORS.textLight, fontSize: 12, marginTop: 2 }}>
            Stock: <Text style={{ fontWeight: '800', color: COLORS.cacao }}>{item.cantidad} {item.unidad}</Text>
            {item.dias_cobertura != null ? ` · ~${item.dias_cobertura}d` : ''}
          </Text>

          {/* 📅 Caducidad */}
          {item.fecha_caducidad && (
            <Text style={{ color: COLORS.textLight, fontSize: 11, marginTop: 2 }}>
              🗓️ Caduca: <Text style={{ fontWeight: '600', color: COLORS.textDark }}>{item.fecha_caducidad}</Text>
            </Text>
          )}

          {/* ⚠️ Badges de Alerta */}
          {item.bajo_stock && (
            <Text style={{ color: COLORS.red, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
              ⚠️ Stock bajo
            </Text>
          )}
          {item.estado_caducidad === 'vencido' && (
            <Text style={{ color: COLORS.red, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
              ⛔ Producto vencido
            </Text>
          )}
          {item.estado_caducidad === 'por_vencer' && (
            <Text style={{ color: '#E65100', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
              ⏳ Por vencer pronto
            </Text>
          )}

          {/* 🏠 Indicador de Insumo Compartido */}
          {item.es_compartido && (
            <Text style={{ color: COLORS.gold, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
              🏠 Compartido en casa
            </Text>
          )}
        </View>
           
        {/* 🛠️ Acciones de Control (Solo Familiar / Admin) */}
        {!esCuidador && (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={async () => {
                await consumirItemInventario(item.id, 1);
                const inv = await getInventario(paciente.id);
                if (inv.items) setInventario(inv.items);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: COLORS.cream,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontWeight: '800', color: COLORS.cacao, fontSize: 13 }}>−1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                await actualizarItemInventario(item.id, { cantidad: Number(item.cantidad) + 1 });
                const inv = await getInventario(paciente.id);
                if (inv.items) setInventario(inv.items);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: COLORS.cream,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontWeight: '800', color: COLORS.cacao, fontSize: 13 }}>+1</Text>
            </TouchableOpacity>

            {/* ✏️ Botón Editar Ítem */}
            <TouchableOpacity
              onPress={() => abrirEdicionInventario(item)}
              style={{ padding: 6, marginLeft: 2 }}
            >
              <Text style={{ color: COLORS.gold, fontSize: 16 }}>✏️</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    ))
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

              <Text style={styles.label}>Nombre del medicamento *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Metformina, Omega 3..."
                placeholderTextColor={COLORS.textLight}
                value={nombre}
                onChangeText={(texto) => {
                  setNombre(texto);
                  // 💡 Autocompletado desde Inventario
                  if (texto.trim().length > 1) {
                    const coincides = inventario.filter(i =>
                      i.nombre.toLowerCase().includes(texto.toLowerCase().trim())
                    );
                    setSugerencias(coincides);
                  } else {
                    setSugerencias([]);
                  }
                }}
                autoFocus
              />

              {/* 💡 Sugerencias de Autocompletado */}
              {sugerencias.length > 0 && (
                <View style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gold, borderRadius: 8, marginTop: 4, maxHeight: 110 }}>
                  <ScrollView nestedScrollEnabled>
                    {sugerencias.map((sug) => (
                      <TouchableOpacity
                        key={sug.id}
                        onPress={() => {
                          setNombre(sug.nombre);
                          setSugerencias([]);
                        }}
                        style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cream }}
                      >
                        <Text style={{ fontSize: 13, color: COLORS.textDark, fontWeight: '700' }}>
                          📦 {sug.nombre} <Text style={{ fontSize: 11, color: COLORS.textLight }}>(En stock: {sug.cantidad} {sug.unidad})</Text>
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.label}>Dosis *</Text>
              <TextInput style={styles.input} placeholder="Ej: 500mg" placeholderTextColor={COLORS.textLight} value={dosis} onChangeText={setDosis} />

              {/* 📦 Stock Inicial Opcional para Inventario */}
              {!medicamentoEditando && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Stock en casa (Opcional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. 30"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="numeric"
                      value={cantidadInicial}
                      onChangeText={setCantidadInicial}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Unidad</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="tabletas, frascos"
                      placeholderTextColor={COLORS.textLight}
                      value={unidadMedida}
                      onChangeText={setUnidadMedida}
                    />
                  </View>
                </View>
              )}

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
                      <Text style={{ color: COLORS.red, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setHorariosArray(prev => [...prev, '12:00'])}
                style={{ borderWidth: 1, borderColor: COLORS.gold, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: COLORS.goldPale, marginBottom: 12 }}
              >
                <Text style={{ color: COLORS.gold, fontWeight: '700' }}>+ Agregar horario</Text>
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

              <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#F9F9F9', borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao, marginBottom: 8 }}>🗓️ Duración del Plan</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, esPermanente && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => { setEsPermanente(true); setFechaFin(''); }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, esPermanente && { color: '#FFF' }]}>♾️ Permanente</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => {
                      setEsPermanente(false);
                      if (fechaFin === fechaInicio) setFechaFin('');
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { color: '#FFF' }]}>📅 Por Periodo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => {
                      setEsPermanente(false);
                      setFechaFin(fechaInicio);
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { color: '#FFF' }]}>📍 Fecha Específica</Text>
                  </TouchableOpacity>
                </View>

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
                        style={[{ borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center' }, (fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: '#EAEAEA' }]}
                        onPress={() => setShowFinPicker(true)}
                      >
                        <Text style={{ fontSize: 13, color: COLORS.cacao, fontWeight: '600' }}>
                          {fechaFin || 'Seleccionar término'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {showInicioPicker && (
                  <DateTimePicker
                    value={new Date(fechaInicio + 'T12:00:00')}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowInicioPicker(false);
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        const nuevaFecha = `${yyyy}-${mm}-${dd}`;
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
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        setFechaFin(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                  />
                )}

                <Text style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>Días de ejecución (Vacío aplica diario)</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
                  {[
                    { id: 0, label: 'D' }, { id: 1, label: 'L' }, { id: 2, label: 'M' },
                    { id: 3, label: 'M' }, { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' },
                  ].map(d => {
                    const seleccionado = diasSemana.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: seleccionado ? COLORS.cacao : COLORS.border,
                          backgroundColor: seleccionado ? COLORS.cacao : '#FFF',
                          alignItems: 'center',
                          justifyContent: 'center',
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
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setModalOpen(false); setMedicamentoEditando(null); resetControlesTiempo(); }}>
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

              <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#F9F9F9', borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.cacao, marginBottom: 8 }}>🗓️ Duración del Plan</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, esPermanente && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => { setEsPermanente(true); setFechaFin(''); }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, esPermanente && { color: '#FFF' }]}>♾️ Permanente</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => {
                      setEsPermanente(false);
                      if (fechaFin === fechaInicio) setFechaFin('');
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, (!esPermanente && fechaFin && fechaInicio !== fechaFin) && { color: '#FFF' }]}>📅 Por Periodo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
                    onPress={() => {
                      setEsPermanente(false);
                      setFechaFin(fechaInicio);
                    }}
                  >
                    <Text style={[{ fontSize: 12, color: '#666', fontWeight: '600' }, (!esPermanente && fechaInicio === fechaFin && fechaFin !== '') && { color: '#FFF' }]}>📍 Fecha Específica</Text>
                  </TouchableOpacity>
                </View>

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
                        style={[{ borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center' }, (fechaInicio === fechaFin && fechaFin !== '') && { backgroundColor: '#EAEAEA' }]}
                        onPress={() => setShowFinPicker(true)}
                      >
                        <Text style={{ fontSize: 13, color: COLORS.cacao, fontWeight: '600' }}>
                          {fechaFin || 'Seleccionar término'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {showInicioPicker && (
                  <DateTimePicker
                    value={new Date(fechaInicio + 'T12:00:00')}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowInicioPicker(false);
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        const nuevaFecha = `${yyyy}-${mm}-${dd}`;
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
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        setFechaFin(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                  />
                )}

                <Text style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>Días de ejecución (Vacío aplica diario)</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
                  {[
                    { id: 0, label: 'D' }, { id: 1, label: 'L' }, { id: 2, label: 'M' },
                    { id: 3, label: 'M' }, { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' },
                  ].map(d => {
                    const seleccionado = diasSemana.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: seleccionado ? COLORS.cacao : COLORS.border,
                          backgroundColor: seleccionado ? COLORS.cacao : '#FFF',
                          alignItems: 'center',
                          justifyContent: 'center',
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
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.cream }]} onPress={() => { setModalRutinaOpen(false); setRutinaEditando(null); resetControlesTiempo(); }}>
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
      
     {/* 📦 MODAL INVENTARIO */}
{modalInvOpen && (
  <View style={styles.modalOverlay}>
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.modalCard, { backgroundColor: COLORS.white || '#FFFFFF', borderRadius: 16, padding: 20 }]}>
        <Text style={styles.modalTitle}>
          {invEditando ? '✏️ Editar artículo' : '📦 Nuevo ítem en inventario'}
        </Text>

        {/* 1. Nombre del Ítem */}
        <Text style={styles.label}>Nombre del ítem *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Paracetamol, Pañales Adulto, Gasas"
          placeholderTextColor={COLORS.textLight}
          value={invNombre}
          onChangeText={setInvNombre}
          autoFocus
        />

        {/* 2. Dosis / Presentación (NUEVO E IMPRESCINDIBLE) */}
        <Text style={styles.label}>Dosis / Presentación</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 500 mg, 10 mg / 5 ml, Talla M"
          placeholderTextColor={COLORS.textLight}
          value={invDosis}
          onChangeText={setInvDosis}
        />

        {/* 3. Categoría */}
        <Text style={styles.label}>Categoría</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {[
            { id: 'medicamento', label: '💊 Medicamento' },
            { id: 'insumo', label: '🩹 Insumo' },
            { id: 'otro', label: '📦 Otro' },
          ].map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chipBtn, invTipo === item.id && styles.chipBtnActive]}
              onPress={() => setInvTipo(item.id as any)}
            >
              <Text style={[styles.chipBtnText, invTipo === item.id && styles.chipBtnTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 4. Cantidad y Unidad */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Cantidad Actual</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={invCantidad}
              onChangeText={setInvCantidad}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Unidad</Text>
            <TextInput
              style={styles.input}
              placeholder="piezas, tabletas, ml"
              placeholderTextColor={COLORS.textLight}
              value={invUnidad}
              onChangeText={setInvUnidad}
            />
          </View>
        </View>

        {/* 5. Mínimo en Stock y Fecha de Caducidad */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Mínimo Stock</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. 5"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={invMinimo}
              onChangeText={setInvMinimo}
            />
          </View>
          <View style={{ flex: 1 }}>
  <Text style={styles.label}>Fecha Caducidad</Text>
  <TouchableOpacity
    style={[styles.input, { justifyContent: 'center' }]}
    onPress={() => setShowDatePickerInv(true)}
  >
    <Text style={{ color: invCaducidad ? COLORS.textDark : COLORS.textLight }}>
      {invCaducidad ? `🗓️ ${invCaducidad}` : 'Seleccionar fecha...'}
    </Text>
  </TouchableOpacity>

  {/* Componente DatePicker (Si usas @react-native-community/datetimepicker) */}
  {showDatePickerInv && (
    <DateTimePicker
      value={invCaducidad ? new Date(invCaducidad) : new Date()}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(event, selectedDate) => {
        setShowDatePickerInv(false);
        if (selectedDate) {
          const formattedDate = selectedDate.toISOString().split('T')[0];
          setInvCaducidad(formattedDate);
        }
      }}
    />
  )}
</View>
        </View>

        {/* 6. Casilla de Insumo Compartido (NUEVO) */}
        {invTipo !== 'medicamento' && (
          <TouchableOpacity
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: invEsCompartido ? '#E8F5E9' : '#F5F5F5', 
              padding: 10, 
              borderRadius: 8, 
              marginVertical: 10,
              borderWidth: 1,
              borderColor: invEsCompartido ? COLORS.gold : '#E0E0E0'
            }}
            onPress={() => setInvEsCompartido(!invEsCompartido)}
          >
            <Text style={{ fontSize: 18, marginRight: 8 }}>
              {invEsCompartido ? '☑️' : '⬛'}
            </Text>
            <Text style={{ color: COLORS.textDark, fontWeight: '600', fontSize: 13 }}>
              Insumo compartido del hogar 🏠
            </Text>
          </TouchableOpacity>
        )}

        {/* 7. Notas adicionales */}
        <Text style={styles.label}>Notas adicionales</Text>
        <TextInput
          style={[styles.input, { minHeight: 50, textAlignVertical: 'top' }]}
          placeholder="Ubicación en repisa o instrucciones de compra..."
          placeholderTextColor={COLORS.textLight}
          multiline
          value={invNotas}
          onChangeText={setInvNotas}
        />

        {/* Botones de Acción */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: COLORS.cream || '#E0E0E0' }]}
            onPress={() => {
              setModalInvOpen(false);
              resetFormularioInventario();
            }}
          >
            <Text style={[styles.modalBtnText, { color: COLORS.textLight }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: COLORS.gold, flex: 1 }]}
            onPress={guardarInventario}
            disabled={guardandoInv}
          >
            <Text style={styles.modalBtnText}>
              {guardandoInv ? 'Guardando...' : 'Guardar en Inventario'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  </View>
)}
{/* 🏠 MODAL DE VINCULACIÓN DE HOGAR */}
<Modal visible={modalVincularOpen} transparent animationType="slide">
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
    <View style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 20 }}>
      
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>
        🏠 Compartir Despensa del Hogar
      </Text>
      
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Selecciona con qué paciente deseas vincular a <Text style={{ fontWeight: 'bold' }}>{paciente?.nombre_completo}</Text> para compartir insumos comunes.
      </Text>

      {/* Lista de otros pacientes (excluyendo al paciente actual) */}
      {listaPacientes
        .filter((p: any) => p.id !== paciente?.id)
        .map((p: any) => (
          <TouchableOpacity
            key={p.id}
            disabled={procesandoVinculo}
            onPress={() => handleVincularPacientes(p.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F5F5',
              padding: 14,
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 20, marginRight: 10 }}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#333' }}>{p.nombre_completo}</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>Tocar para vincular hogar</Text>
            </View>
            {procesandoVinculo && <ActivityIndicator color="#007AFF" />}
          </TouchableOpacity>
        ))}

      {/* Botón Cancelar */}
      <TouchableOpacity
        onPress={() => setModalVincularOpen(false)}
        style={{ marginTop: 10, padding: 12, alignItems: 'center' }}
      >
        <Text style={{ color: '#888', fontWeight: 'bold' }}>Cancelar</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>
      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      {confirmDelete && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { gap: 16 }]}>
            <Text style={{ fontSize: 32, textAlign: 'center' }}>🗑️</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' }}>
              ¿Eliminar registro?
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
                <Text style={styles.modalBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    backgroundColor: COLORS.cacao,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 10,
    color: COLORS.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  addBtn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: COLORS.cacao,
    fontWeight: '800',
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.gold,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLeft: {
    marginRight: 12,
  },
  medIcon: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  horarioBadge: {
    backgroundColor: COLORS.goldPale,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  horarioBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.textDark,
    backgroundColor: COLORS.cream,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipBtnActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  chipBtnText: {
    fontSize: 12,
    color: COLORS.textDark,
  },
  chipBtnTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
});