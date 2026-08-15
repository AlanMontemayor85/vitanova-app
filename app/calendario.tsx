import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar as CalendarIcon, CheckCircle, Clock, Info } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// 🪐 Importamos tu función unificada de itinerario diario
import { getTareasDia, loadStoredToken } from '../services/api';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

const COLORS = {
  gold: '#BF9A40',
  cacao: '#4E3629',
  green: '#2E7D32',
  grayLight: '#F8F9FA',
  border: '#EAEAEA',
  white: '#FFFFFF',
  cream: '#F5F4F0',
  textLight: '#8A8078',
  greenPale: 'rgba(61, 170, 106, 0.15)',
  textDark: '#2C2C2C'
};

const ICONOS_TIPO: Record<string, string> = {
  medicamento: '💊',
  rutina: '📋',
  incidental: '⚡',
};

// 🎯 Helper 1: Formato 12 Horas limpia
const formatearHoraBonita = (horaRaw: string | null | undefined): string => {
  if (!horaRaw || horaRaw === 'Incidental') return 'Incidental';
  let soloHora = horaRaw.includes('T') ? horaRaw.split('T')[1] : horaRaw;
  soloHora = soloHora.split('.')[0].split('-')[0].split('+')[0].trim();

  const partes = soloHora.split(':');
  if (partes.length < 1) return horaRaw;

  let horas = parseInt(partes[0], 10);
  const minutos = partes[1] ? partes[1].padStart(2, '0') : '00';

  if (isNaN(horas)) return horaRaw;

  const ampm = horas >= 12 ? 'p.m.' : 'a.m.';
  horas = horas % 12;
  horas = horas ? horas : 12;

  return `${horas}:${minutos} ${ampm}`;
};

// 🎯 Helper 2: Formato Día / Mes / Año
const ISOaLatino = (fechaISO: string | null | undefined): string => {
  if (!fechaISO || fechaISO === 'null' || fechaISO === '') return '';
  const soloFecha = fechaISO.split('T')[0].trim();
  const partes = soloFecha.split('-');
  if (partes.length !== 3) return fechaISO;
  const [yyyy, mm, dd] = partes;
  return `${dd}/${mm}/${yyyy}`;
};

interface TareaPlan {
  id: string;
  descripcion: string;
  hora: string;
  tipo: string;
  completada: boolean;
  indicaciones?: string | null;
  notas?: string | null;
  ubicacion?: string | null;
}

export default function CalendarioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pacienteId?: string }>();
  const pacienteId = params.pacienteId || '';
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [tareas, setTareas] = useState<TareaPlan[]>([]);
  
  // 🎯 Estado para el Modal Informativo de Detalle
  const [itemSeleccionadoDetalle, setItemSeleccionadoDetalle] = useState<TareaPlan | null>(null);

  // 1. Inicializar con la fecha local de Monterrey
  useEffect(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const fechaLocal = new Date(local.getTime() - (offset * 60 * 1000));
    const hoy = fechaLocal.toISOString().split('T')[0];
    setDiaSeleccionado(hoy);
  }, []);

  // 2. Cargar tareas cada vez que cambie el día seleccionado o el paciente
  useEffect(() => {
    if (diaSeleccionado && pacienteId) {
      cargarPlanDelDia();
    }
  }, [diaSeleccionado, pacienteId]);

  const cargarPlanDelDia = async () => {
    setLoading(true);
    try {
      await loadStoredToken();
      
      const response = await getTareasDia(pacienteId, diaSeleccionado);

      const arregloTareas = response && Array.isArray(response.tareas) 
        ? response.tareas 
        : Array.isArray(response) 
          ? response 
          : [];

      if (arregloTareas.length > 0) {
        const formatoTareas = arregloTareas.map((t: any) => ({
          id: t.id || String(Math.random()),
          descripcion: t.descripcion || t.nombre || 'Sin descripción',
          hora: t.hora || 'Incidental',
          tipo: t.tipo || 'rutina',
          completada: !!t.completada,
          // 🎯 Guardamos las observaciones/modo de uso para el modal
          indicaciones: t.indicaciones || t.instrucciones || t.modo_uso || null,
          notas: t.notas || t.observaciones || null,
          ubicacion: t.ubicacion || t.lugar_almacenaje || t.almacen || null,
        }));

        formatoTareas.sort((a: TareaPlan, b: TareaPlan) => {
          if (a.hora === 'Incidental') return 1;
          if (b.hora === 'Incidental') return -1;
          return a.hora.localeCompare(b.hora);
        });

        setTareas(formatoTareas);
      } else {
        setTareas([]);
      }
    } catch (error) {
      console.error('❌ Error cargando plan de cuidados:', error);
      setTareas([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: '#3A3530' }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#3A3530" />
        {/* 🚫 OCULTA EL HEADER BLANCO POR DEFECTO */}
        <Stack.Screen options={{ headerShown: false }} />
        {/* 🧭 HEADER INSTITUCIONAL ESTANDARIZADO (SIN LIBRERÍAS EXTERNAS) */}
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()} // o navigation.goBack()
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleCenter}>
              <Text style={styles.headerSubtitle}>AGENDA CLÍNICA</Text>
              <Text style={styles.headerTitle}>Calendario de Cuidados</Text>
            </View>

            {/* Espaciador de balance para centrado simétrico */}
            <View style={{ width: 38 }} />
          </View>
        </View>

        {/* 📱 CUERPO PRINCIPAL */}
        <View style={{ flex: 1, backgroundColor: '#F8F6F2' }}>
          {/* 📅 TARJETA DEL CALENDARIO */}
          <View style={styles.calendarCardWrapper}>
            <View style={styles.calendarCard}>
              <Calendar
                current={diaSeleccionado}
                key={diaSeleccionado}
                onDayPress={(day) => setDiaSeleccionado(day.dateString)}
                monthFormat={'MMMM yyyy'}
                markedDates={{
                  [diaSeleccionado]: {
                    selected: true,
                    selectedColor: COLORS.gold,
                    disableTouchEvent: true,
                  },
                }}
                theme={{
                  backgroundColor: '#FFFFFF',
                  calendarBackground: '#FFFFFF',
                  todayTextColor: COLORS.gold,
                  arrowColor: '#3A3530',
                  selectedDayTextColor: COLORS.white,
                  textMonthFontWeight: '800',
                  textDayHeaderFontWeight: '700',
                  textSectionTitleColor: '#8C8275',
                  dayTextColor: '#2B2621',
                  textMonthFontSize: 15,
                  textDayFontSize: 14,
                }}
              />
            </View>
          </View>

          {/* 📋 INFO DEL DÍA SELECCIONADO */}
          <View style={styles.headerDia}>
            <CalendarIcon size={18} color={COLORS.gold} style={{ marginRight: 8 }} />
            <Text style={styles.tituloDia}>
              Plan de cuidados del <Text style={{ color: COLORS.gold }}>{ISOaLatino(diaSeleccionado)}</Text>
            </Text>
          </View>

          {/* 📋 LISTADO DE TAREAS */}
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : (
            <FlatList
              data={tareas}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listaContainer}
              ListEmptyComponent={
                <Text style={styles.listaVacia}>No hay actividades programadas para este día.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.card, item.completada && styles.cardCompletada]}
                  onPress={() => setItemSeleccionadoDetalle(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tareaIcon}>{ICONOS_TIPO[item.tipo] ?? '📋'}</Text>
                  
                  <View style={styles.infoContainer}>
                    <Text style={[styles.cardTitulo, item.completada && styles.textoCompletado]}>
                      {item.descripcion}
                    </Text>
                    <View style={styles.rowHora}>
                      <Clock size={12} color="#777777" style={{ marginRight: 4 }} />
                      <Text style={styles.cardDetalle}>{formatearHoraBonita(item.hora)}</Text>
                    </View>
                  </View>

                  {item.completada ? (
                    <CheckCircle size={20} color={COLORS.green} style={styles.checkIcon} />
                  ) : (
                    <Info size={18} color={COLORS.gold} style={styles.infoBtnIcon} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* 🎯 MODAL INFORMATIVO ESTANDARIZADO */}
        <Modal 
          visible={!!itemSeleccionadoDetalle} 
          transparent 
          animationType="fade" 
          onRequestClose={() => setItemSeleccionadoDetalle(null)}
        >
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            activeOpacity={1}
            onPress={() => setItemSeleccionadoDetalle(null)}
          >
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#E0D8CC', elevation: 5 }}>
              
              {/* TÍTULO */}
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#4A4540', marginBottom: 4, textTransform: 'uppercase' }}>
                {(itemSeleccionadoDetalle as any)?.descripcion || (itemSeleccionadoDetalle as any)?.nombre || (itemSeleccionadoDetalle as any)?.titulo || 'Detalle de la tarea'}
              </Text>

              {/* ⏰ HORARIO */}
              {((itemSeleccionadoDetalle as any)?.hora || (itemSeleccionadoDetalle as any)?.hora_programada) && (
                <Text style={{ fontSize: 12, color: '#BF9A40', fontWeight: '800', marginBottom: 14 }}>
                  ⏰ Horario: {formatearHoraBonita((itemSeleccionadoDetalle as any)?.hora_programada || (itemSeleccionadoDetalle as any)?.hora)}
                </Text>
              )}

              {/* 📍 UBICACIÓN EN CASA */}
              {(itemSeleccionadoDetalle as any)?.tipo?.toLowerCase() === 'medicamento' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#8A8078', textTransform: 'uppercase', marginBottom: 3 }}>
                    📍 Ubicación en Casa:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#2C2820', fontWeight: '600' }}>
                    {(itemSeleccionadoDetalle as any)?.ubicacion || (itemSeleccionadoDetalle as any)?.lugar_almacenaje || 'Botiquín principal / Almacén general.'}
                  </Text>
                </View>
              )}

              {/* 💡 INDICACIONES */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#8A8078', textTransform: 'uppercase', marginBottom: 3 }}>
                  💡 Indicaciones / Modo de Uso:
                </Text>
                <Text style={{ fontSize: 13, color: '#2C2820', fontWeight: '600', lineHeight: 18 }}>
                  {(itemSeleccionadoDetalle as any)?.indicaciones || (itemSeleccionadoDetalle as any)?.instrucciones || 'Sin indicaciones especiales.'}
                </Text>
              </View>

              {/* 📌 NOTAS ADICIONALES */}
              {Boolean(
                (itemSeleccionadoDetalle as any)?.notas && 
                (itemSeleccionadoDetalle as any)?.notas.trim() !== ((itemSeleccionadoDetalle as any)?.indicaciones || (itemSeleccionadoDetalle as any)?.instrucciones || '').trim()
              ) && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#8A8078', textTransform: 'uppercase', marginBottom: 3 }}>
                    📌 Notas Adicionales:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#2C2820', fontWeight: '600', lineHeight: 18 }}>
                    {(itemSeleccionadoDetalle as any)?.notas || (itemSeleccionadoDetalle as any)?.observaciones}
                  </Text>
                </View>
              )}

              {/* BOTÓN DE CIERRE */}
              <TouchableOpacity 
                style={{ marginTop: 10, backgroundColor: '#4A4540', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
                onPress={() => setItemSeleccionadoDetalle(null)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Entendido</Text>
              </TouchableOpacity>

            </View>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // ── 1. ESTRUCTURA Y CONTENEDOR PRINCIPAL ──
  container: {
    flex: 1,
    backgroundColor: '#3A3530', // Fondo base para emparejar el notch/header
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
  },
  listaContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },

  // ── 2. HEADER INSTITUCIONAL ESTANDARIZADO ──
  headerContainer: {
    backgroundColor: '#3A3530',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 6 : 4,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    marginTop: -3,
    marginLeft: -1,
  },
  headerTitleCenter: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: COLORS.gold,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },

  // ── 3. TARJETA FLOTANTE DEL CALENDARIO ──
  calendarCardWrapper: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: COLORS.cream,
  },
  calendarCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // ── 4. BARRA DEL PLAN DEL DÍA SELECCIONADO ──
  headerDia: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cacao,
    borderBottomWidth: 1,
    borderBottomColor: '#2B2621',
  },
  tituloDia: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  // ── 5. TARJETAS DE TAREAS Y ACTIVIDADES ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardCompletada: {
    backgroundColor: COLORS.greenPale,
    borderColor: COLORS.green + '40',
  },
  tareaIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  cardTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.cacao,
  },
  textoCompletado: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  rowHora: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardDetalle: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  // ── 6. BOTONES E ICONOS DE ACCIÓN ──
  checkIcon: {
    marginLeft: 8,
  },
  infoBtnIcon: {
    marginLeft: 8,
    opacity: 0.8,
  },

  // ── 7. ESTADO VACÍO ──
  listaVacia: {
    textAlign: 'center',
    color: COLORS.textLight,
    marginTop: 36,
    fontSize: 13,
    fontWeight: '600',
  },
});