import { useLocalSearchParams } from 'expo-router';
import { Calendar as CalendarIcon, CheckCircle, Clock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
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

interface TareaPlan {
  id: string;
  descripcion: string;
  hora: string;
  tipo: string;
  completada: boolean;
}

export default function CalendarioScreen() {
  const params = useLocalSearchParams<{ pacienteId?: string }>();
  const pacienteId = params.pacienteId || '';

  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [tareas, setTareas] = useState<TareaPlan[]>([]);

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
      await loadStoredToken(); // Asegurar sesión
      console.log(`🛰️ Consultando plan para fecha: ${diaSeleccionado} y paciente: ${pacienteId}`);
      
      const response = await getTareasDia(pacienteId, diaSeleccionado);
      console.log("📥 Respuesta de tareas-dia:", response);

      if (Array.isArray(response)) {
        // Mapeamos los datos para homogeneizarlos en nuestro estado local
        const formatoTareas = response.map((t: any) => ({
          id: t.id || String(Math.random()),
          descripcion: t.descripcion || t.nombre || 'Sin descripción',
          hora: t.hora || 'Incidental',
          tipo: t.tipo || 'rutina',
          completada: !!t.completada
        }));

        // Ordenar cronológicamente (las incidentales o sin hora al final)
        formatoTareas.sort((a, b) => {
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

        {/* Info del día seleccionado */}
        <View style={styles.headerDia}>
          <CalendarIcon size={18} color={COLORS.gold} style={{ marginRight: 8 }} />
          <Text style={styles.tituloDia}>
            Plan de cuidados del <Text style={{ color: COLORS.gold }}>{diaSeleccionado}</Text>
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
              <View style={[styles.card, item.completada && styles.cardCompletada]}>
                <Text style={styles.tareaIcon}>{ICONOS_TIPO[item.tipo] ?? '📋'}</Text>
                
                <View style={styles.infoContainer}>
                  <Text style={[styles.cardTitulo, item.completada && styles.textoCompletado]}>
                    {item.descripcion}
                  </Text>
                  <View style={styles.rowHora}>
                    <Clock size={12} color="#777777" style={{ marginRight: 4 }} />
                    <Text style={styles.cardDetalle}>{item.hora}</Text>
                  </View>
                </View>

                {item.completada && (
                  <CheckCircle size={20} color={COLORS.green} style={styles.checkIcon} />
                )}
              </View>
            )}
          />
        )}
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
  listaVacia: {
    textAlign: 'center',
    color: '#999999',
    marginTop: 40,
    fontSize: 14,
  }
});