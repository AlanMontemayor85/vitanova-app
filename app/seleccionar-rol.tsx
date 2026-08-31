import { useRouter } from 'expo-router';
import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const COLORS = {
  cacao: '#3A2E2B',
  gold: '#C89D5C',
  bg: '#F8F5F0',
  white: '#FFFFFF',
  textDark: '#2C2523',
  textLight: '#7A6E6B',
  border: '#E8E3DA'
};

export default function SeleccionarRolScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      <View style={styles.header}>
        <Text style={styles.saludo}>Bienvenido a Vitanova</Text>
        <Text style={styles.subtitulo}>¿En qué modalidad deseas operar hoy?</Text>
      </View>

      <View style={styles.cardsContainer}>
        {/* 👨‍👩‍👧 OPCIÓN 1: MODO FAMILIAR */}
        <TouchableOpacity 
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.replace('/')}
        >
          <View style={styles.iconContainer}>
            <Text style={{ fontSize: 32 }}>👨‍👩‍👧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>Modo Familiar</Text>
            <Text style={styles.cardDesc}>
              Monitorea a tus familiares, revisa signos vitales y configura alertas.
            </Text>
          </View>
          <Text style={styles.flecha}>→</Text>
        </TouchableOpacity>

        {/* 🩺 OPCIÓN 2: MODO CUIDADOR */}
        <TouchableOpacity 
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.replace('/cuidador' as any)}
        >
          <View style={styles.iconContainer}>
            <Text style={{ fontSize: 32 }}>🩺</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>Modo Cuidador</Text>
            <Text style={styles.cardDesc}>
              Inicia turnos programados, revisa bitácoras y atiende a tus pacientes asignados.
            </Text>
          </View>
          <Text style={styles.flecha}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    justifyContent: 'center'
  },
  header: {
    marginBottom: 32,
    alignItems: 'center'
  },
  saludo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center'
  },
  subtitulo: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 6
  },
  cardsContainer: {
    gap: 16
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FAF5EE',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.cacao,
    marginBottom: 4
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16
  },
  flecha: {
    fontSize: 20,
    color: COLORS.gold,
    fontWeight: '700'
  }
});