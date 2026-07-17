import { useLocalSearchParams } from 'expo-router';
import { Activity, Calendar as CalendarIcon, Clock, Pill } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
// 🪐 Importamos tus funciones de la API local
import { getMedicamentos, getTareasRecurrentes } from '../services/api'; // 👈 Ajusta si tu ruta a api.ts varía

// Configuración del idioma
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

interface Evento {
  id: string;
  tipo: 'medicamento' | 'rutina';
  titulo: string;
  detalle: string;
  hora: string;
}

export default function CalendarioScreen() {
  // 🎯 RECUPERAMOS EL PARAMETRO DE EXPO ROUTER DIRECTAMENTE AQUÍ:
  const params = useLocalSearchParams<{ pacienteId?: string }>();
  
  // Si no viene ningún ID en los parámetros (por ejemplo, en pruebas locales), 
  // le asignamos un string vacío o el de Blanca por defecto para que no truene.
  const pacienteId = params.pacienteId || ''; 

  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    setDiaSeleccionado(hoy);
  }, []);

  useEffect(() => {
    if (diaSeleccionado && pacienteId) {
      cargarItinerarioDeAPI();
    }
  }, [diaSeleccionado, pacienteId]);

  const cargarItinerarioDeAPI = async () => {
    setLoading(true);
    try {
      const nuevosEventos: Evento[] = [];

      // 1. 💊 Consultar Medicamentos a tu API en Railway
      const meds = await getMedicamentos(pacienteId);
      if (Array.isArray(meds)) {
        meds.forEach(m => {
          if (m.activo) {
            const horarios = m.horarios || [];
            horarios.forEach((hora: string) => {
              nuevosEventos.push({
                id: `${m.id}-${hora}`,
                tipo: 'medicamento',
                titulo: m.nombre,
                detalle: `Dosis: ${m.dosis}`,
                hora: hora
              });
            });
          }
        });
      }

      // 2. 📋 Consultar Tareas Recurrentes a tu API en Railway
      const rutinas = await getTareasRecurrentes(pacienteId);
      if (Array.isArray(rutinas)) {
        rutinas.forEach(r => {
          if (r.activo) {
            nuevosEventos.push({
              id: r.id,
              tipo: 'rutina',
              titulo: r.descripcion,
              detalle: 'Rutina diaria programada',
              hora: r.hora ? r.hora.slice(0, 5) : '00:00'
            });
          }
        });
      }

      // 3. ⏰ Ordenar cronológicamente por hora
      nuevosEventos.sort((a, b) => a.hora.localeCompare(b.hora));
      setEventos(nuevosEventos);

    } catch (error) {
      console.error('❌ Error al cargar el itinerario de la API:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Calendario */}
      <Calendar
        current={diaSeleccionado}
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
          Itinerario del <Text style={{ color: COLORS.gold }}>{diaSeleccionado}</Text>
        </Text>
      </View>

      {/* Listado de tareas */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : (
        <FlatList
          data={eventos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listaContainer}
          ListEmptyComponent={
            <Text style={styles.listaVacia}>No hay actividades programadas para este día.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconContainer}>
                {item.tipo === 'medicamento' ? (
                  <Pill size={22} color={COLORS.gold} />
                ) : (
                  <Activity size={22} color={COLORS.green} />
                )}
              </View>
              <View style={styles.infoContainer}>
                <Text style={styles.cardTitulo}>{item.titulo}</Text>
                <Text style={styles.cardDetalle}>{item.detalle}</Text>
              </View>
              <View style={styles.badgeHora}>
                <Clock size={12} color={COLORS.cacao} style={{ marginRight: 4 }} />
                <Text style={styles.badgeHoraText}>{item.hora}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardDetalle: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  badgeHora: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeHoraText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.cacao,
  },
  listaVacia: {
    textAlign: 'center',
    color: '#999999',
    marginTop: 40,
    fontSize: 14,
  }
});