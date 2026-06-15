import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// 🚨 CORRECCIÓN TÁCTICA: Importamos el limpiador de token desde tu archivo api real
import { clearToken } from '../services/api';

const COLORS = {
  gold: '#BF9A40',
  cacao: '#4A4540',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  textDark: '#2C2820',
  textLight: '#8A8078',
  border: '#E0D8CC',
};

export default function AdminDashboardScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // 1. Limpiamos el almacenamiento local de tu app usando tu servicio
      await clearToken(); 
      // 2. Desmontamos la pantalla y mandamos de regreso al inicio
      router.replace('/login');
    } catch (error) {
      console.error("Error al cerrar sesión segura:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra de Encabezado */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Panel de Control</Text>
        <Text style={styles.headerSub}>Administrador Global • Vitanova Integralis</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tarjeta de Bienvenida */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>¡Bienvenido, Administrador!</Text>
          <Text style={styles.welcomeDesc}>
            Desde este módulo podrás supervisar la red de cuidadores, gestionar médicos, revisar alertas críticas del sistema y controlar los accesos globales.
          </Text>
        </View>

        {/* Módulos Disponibles */}
        <Text style={styles.sectionLabel}>Accesos Rápidos</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/red-cuidadores')}>
          <Text style={styles.menuIcon}>🤲</Text>
          <View>
            <Text style={styles.menuText}>Control de Cuidadores</Text>
            <Text style={styles.menuSubtext}>Verificar altas y asignaciones de pacientes</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/alertas')}>
          <Text style={styles.menuIcon}>🚨</Text>
          <View>
            <Text style={styles.menuText}>Historial de Alertas</Text>
            <Text style={styles.menuSubtext}>Monitoreo de incidencias en tiempo real</Text>
          </View>
        </TouchableOpacity>

        {/* Botón de Cierre de Sesión */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  headerBar: {
    backgroundColor: COLORS.cacao,
    paddingTop: 60, paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  scrollContent: { padding: 24, gap: 16 },
  welcomeCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  welcomeDesc: { fontSize: 13, color: COLORS.textLight, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textLight,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 8,
  },
  menuItem: {
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  menuIcon: { fontSize: 24 },
  menuText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  menuSubtext: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  logoutBtn: {
    borderColor: '#D94F4F', borderWidth: 1, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  logoutBtnText: { color: '#D94F4F', fontSize: 14, fontWeight: '700' },
});