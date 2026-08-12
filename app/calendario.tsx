import { useLocalSearchParams } from 'expo-router';
import { Calendar as CalendarIcon, CheckCircle, Clock, Info } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Calendario */}
        <Calendar
          current={diaSeleccionado}
          key={diaSeleccionado}
          onDayPress={(day) => setDiaSeleccionado(day.dateString)}
          monthFormat={'MMMM yyyy'}
          markedDates={{
            [diaSeleccionado]: {
              selected: true,
              selectedColor: COLORS.gold,
              disableTouchEvent: true
            }
          }}
          theme={{
            todayTextColor: COLORS.gold,
            arrowColor: COLORS.cacao,
            selectedDayTextColor: COLORS.white,
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '700',
          }}
        />

        {/* Info del día seleccionado (🎯 Fecha estandarizada DD/MM/YYYY) */}
        <View style={styles.headerDia}>
          <CalendarIcon size={18} color={COLORS.gold} style={{ marginRight: 8 }} />
          <Text style={styles.tituloDia}>
            Plan de cuidados del <Text style={{ color: COLORS.gold }}>{ISOaLatino(diaSeleccionado)}</Text>
          </Text>
        </View>

        {/* Listado de tareas */}
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
                    {/* 🎯 Hora formateada a 12 horas */}
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
            <View style={{ backgroundColor: '#FFF', borderRadius: 14, padding: 20, width: '100%', maxWidth: 340, elevation: 5 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 }}>
                {itemSeleccionadoDetalle?.descripcion || 'Detalle de la tarea'}
              </Text>

              {itemSeleccionadoDetalle?.hora && (
                <Text style={{ fontSize: 12, color: '#0EA5E9', fontWeight: '700', marginBottom: 14 }}>
                  ⏰ Horario: {formatearHoraBonita(itemSeleccionadoDetalle.hora)}
                </Text>
              )}

              {/* 📍 Ubicación en Casa */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>
                  📍 Ubicación en Casa:
                </Text>
                <Text style={{ fontSize: 13, color: '#334155' }}>
                  {itemSeleccionadoDetalle?.ubicacion || 'Botiquín principal / Almacén general.'}
                </Text>
              </View>

              {/* 💡 Indicaciones / Modo de Uso */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>
                  💡 Indicaciones / Modo de Uso:
                </Text>
                <Text style={{ fontSize: 13, color: '#334155' }}>
                  {itemSeleccionadoDetalle?.indicaciones || 'Sin indicaciones especiales.'}
                </Text>
              </View>

              {/* 📌 Notas adicionales (Oculta si es idéntico a Indicaciones) */}
              {(() => {
                const ind = itemSeleccionadoDetalle?.indicaciones || '';
                const notas = itemSeleccionadoDetalle?.notas || '';
                
                if (!notas || notas.trim() === ind.trim()) return null;

                return (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>
                      📌 Notas Adicionales:
                    </Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>
                      {notas}
                    </Text>
                  </View>
                );
              })()}

              <TouchableOpacity 
                style={{ marginTop: 10, backgroundColor: '#0EA5E9', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setItemSeleccionadoDetalle(null)}
              >
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerDia: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.grayLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tituloDia: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  listaContainer: {
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCompletada: {
    backgroundColor: '#F4FAF4',
    borderColor: '#D0EED0',
  },
  tareaIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  cardTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.cacao,
  },
  textoCompletado: {
    textDecorationLine: 'line-through',
    color: '#777777',
  },
  rowHora: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardDetalle: {
    fontSize: 12,
    color: '#777777',
  },
  checkIcon: {
    marginLeft: 8,
  },
  infoBtnIcon: {
    marginLeft: 8,
    opacity: 0.8,
  },
  listaVacia: {
    textAlign: 'center',
    color: '#999999',
    marginTop: 40,
    fontSize: 14,
  }
});