import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearToken, getMisRoles } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
};

const OPCIONES: Record<string, { icon: string; titulo: string; desc: string; ruta: string }> = {
  familiar: {
    icon: '👨‍👩‍👧',
    titulo: 'Familiar / Administrador',
    desc: 'Superviso y gestiono a mi ser querido',
    ruta: '/',
  },
  cuidador: {
    icon: '🩺',
    titulo: 'Cuidador Profesional',
    desc: 'Atiendo turnos y registros operativos',
    ruta: '/cuidador',
  },
  autonomo: {
    icon: '🧑',
    titulo: 'Autocuidado',
    desc: 'Gestiono mi propio plan de salud',
    ruta: '/autocuidador',
  },
};

export default function SelectorRolScreen() {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMisRoles();
        setRoles(data.roles || []);
      } catch (e) {
        console.error('Error cargando roles:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSeleccionarRol = async (rol: string, ruta: string) => {
    await AsyncStorage.setItem('rol_activo', rol);
    router.replace(ruta as any);
  };

  const handleCerrarSesionCompleta = async () => {
    await AsyncStorage.removeItem('rol_activo');
    await clearToken();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>VITANOVA INTEGRALIS</Text>
          <Text style={styles.userName}>¿Cómo deseas entrar hoy?</Text>
        </View>

        {/* 🚪 Puerta directa al Login (Cerrar sesión completa) */}
        <TouchableOpacity 
          style={styles.logoutHeaderBtn}
          onPress={handleCerrarSesionCompleta}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>🚪</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {roles.map((r) => {
          const op = OPCIONES[r];
          if (!op) return null;

          return (
            <TouchableOpacity
              key={r}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => handleSeleccionarRol(r, op.ruta)}
            >
              <Text style={{ fontSize: 32, marginRight: 14 }}>{op.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{op.titulo}</Text>
                <Text style={styles.cardDesc}>{op.desc}</Text>
              </View>
              <Text style={{ color: COLORS.gold, fontSize: 24, fontWeight: '600' }}>›</Text>
            </TouchableOpacity>
          );
        })}

        {/* Opción al pie para cambiar de cuenta */}
        <TouchableOpacity 
          style={styles.btnCambiarCuenta} 
          onPress={handleCerrarSesionCompleta}
        >
          <Text style={styles.btnCambiarCuentaTexto}>Cerrar sesión / Cambiar de cuenta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  header: { 
    backgroundColor: COLORS.cacao, 
    paddingTop: 32, 
    paddingHorizontal: 24, 
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logoutHeaderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  body: { flex: 1, padding: 20, gap: 14 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  cardDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  btnCambiarCuenta: {
    marginTop: 'auto',
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnCambiarCuentaTexto: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});