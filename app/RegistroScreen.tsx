import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { registrarUsuario } from '../services/api';

export default function RegistroScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleRegistro = async () => {
    // 1. Validaciones previas
    if (!email.trim() || !password.trim()) {
      Alert.alert('Datos Incompletos', 'Por favor ingresa tu correo y una contraseña.');
      return;
    }

    if (!aceptaAviso) {
      Alert.alert(
        'Consentimiento Requerido',
        'Debes aceptar el Aviso de Privacidad para el tratamiento de datos de salud conforme a la LFPDPPP.'
      );
      return;
    }

    setCargando(true);

    try {
      // 2. Llamada directa a tu API en Railway (Backend gestiona Supabase y la auditoría)
      await registrarUsuario(email.trim(), password, aceptaAviso);

      Alert.alert('Éxito', 'Cuenta creada y consentimiento registrado correctamente.');
      setEmail('');
      setPassword('');
      setAceptaAviso(false);
    } catch (error: any) {
      Alert.alert('Error en Registro', error.message || 'No se pudo completar el registro.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Crear Cuenta</Text>

      <TextInput
        placeholder="Correo electrónico"
        placeholderTextColor="#9CA3AF"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Contraseña"
        placeholderTextColor="#9CA3AF"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {/* Checkbox y Consentimiento Legal */}
      <TouchableOpacity 
        style={styles.filaAviso} 
        onPress={() => setAceptaAviso(!aceptaAviso)}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, aceptaAviso && styles.checkboxActivo]}>
          {aceptaAviso && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={styles.textoLegal}>
          Otorgo mi consentimiento expreso para el tratamiento de mis datos personales sensibles de salud y acepto el{' '}
          <Text style={styles.enlaceAviso}>Aviso de Privacidad</Text>.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.boton, cargando && styles.botonDesactivado]} 
        onPress={handleRegistro}
        disabled={cargando}
      >
        {cargando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.textoBoton}>Registrarme</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#FFFFFF' },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#1A1A1A' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, color: '#1A1A1A' },
  filaAviso: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#0066CC', borderRadius: 4, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxActivo: { backgroundColor: '#0066CC' },
  checkMark: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  textoLegal: { flex: 1, fontSize: 13, color: '#4B5563', lineHeight: 18 },
  enlaceAviso: { color: '#0066CC', fontWeight: '600' },
  boton: { backgroundColor: '#0066CC', padding: 14, borderRadius: 8, alignItems: 'center' },
  botonDesactivado: { opacity: 0.6 },
  textoBoton: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});