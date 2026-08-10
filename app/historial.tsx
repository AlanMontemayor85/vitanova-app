import DateTimePicker from '@react-native-community/datetimepicker';
import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
import { loadStoredToken } from '../services/api';
const { documentDirectory, moveAsync, readAsStringAsync } = require('expo-file-system/legacy');

const BASE_URL = 'https://vitanova-backend-production.up.railway.app';

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
  amber: '#D4860A',
  amberPale: '#FFF4E0',
  blue: '#2D6BE4',
  bluePale: '#EEF3FC',
};

// ── HELPERS Y MOLDES DE FORMATO ──
const formatFecha = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatHora = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 🛡️ Helper para evaluar si el signo vital es heredado (>30 min) o reciente
const evaluarSignoVital = (
  valor: any, 
  timestampLectura: string | null | undefined, 
  timestampCierre: string | null | undefined
) => {
  if (valor === null || valor === undefined || valor === '—' || valor === '') {
    return { display: '—', etiqueta: null, esHeredado: false };
  }

  if (!timestampLectura || !timestampCierre) {
    return { display: String(valor), etiqueta: null, esHeredado: false };
  }

  try {
    const tLectura = new Date(timestampLectura).getTime();
    const tCierre = new Date(timestampCierre).getTime();
    const difMinutos = Math.round((tCierre - tLectura) / (1000 * 60));

    // Si pasaron más de 30 minutos entre la lectura del reloj y el cierre:
    if (difMinutos > 30) {
      const horaFormateada = new Date(timestampLectura).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });

      return {
        display: String(valor),
        etiqueta: `🕒 ${horaFormateada}`,
        esHeredado: true
      };
    }
  } catch (e) {
    console.error("Error evaluando timestamp de signo vital:", e);
  }

  return { display: String(valor), etiqueta: null, esHeredado: false };
};

export default function HistorialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pacienteId = params.pacienteId as string;
  const pacienteNombre = params.pacienteNombre as string;

  // ── 1. ESTADOS DE DATOS ──
  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [indice, setIndice] = useState(0);

  // ── 2. ESTADOS DEL MODAL DE FILTROS ──
  const [modalVisible, setModalVisible] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState(''); // Formato YYYY-MM-DD
  const [filtroCuidador, setFiltroCuidador] = useState('todos');

  const cuidadoresDisponibles = Array.from(
    new Set(cierres.map(c => c.nombre_cuidador || c.cuidador_nombre || '').filter(nombre => nombre !== ''))
  );

  // ── 🎯 FILTRADO MAESTRO CON CONVERSIÓN DE FECHA LOCAL ──
  const cierresFiltrados = cierres.filter(c => {
    let coincideFecha = true;
    if (filtroFecha !== '') {
      const rawDateStr = c.fecha || c.created_at;
      if (rawDateStr) {
        try {
          const d = new Date(rawDateStr);
          const anio = d.getFullYear();
          const mes = String(d.getMonth() + 1).padStart(2, '0');
          const dia = String(d.getDate()).padStart(2, '0');
          const fechaLocalFormateada = `${anio}-${mes}-${dia}`;
          coincideFecha = (fechaLocalFormateada === filtroFecha);
        } catch (err) {
          coincideFecha = false;
        }
      } else {
        coincideFecha = false;
      }
    }
    
    let coincideCuidador = true;
    if (filtroCuidador !== 'todos') {
      const nombreC = c.nombre_cuidador || c.cuidador_nombre || '';
      coincideCuidador = (nombreC === filtroCuidador);
    }
    
    return coincideFecha && coincideCuidador;
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [fechaObjeto, setFechaObjeto] = useState(new Date());
  const cierreSeleccionado = cierresFiltrados[indice];

  const ICONOS_TIPO: Record<string, string> = {
    medicamento: '💊',
    rutina: '🚶',
    control: '📋'
  };

  // ── 4. EFFECT DE CARGA RECARGABLE (AL ENTRAR O VOLVER A LA PANTALLA) ──
useFocusEffect(
  useCallback(() => {
    let isMounted = true;

    const cargar = async () => {
      try {
        setLoading(true);
        const token = await loadStoredToken();
        if (!token) { 
          router.replace('/login'); 
          return; 
        }

        const res = await fetch(
          `${BASE_URL}/pacientes/${pacienteId}/historial-cierres?limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = await res.json();

        // 🩺 DEBUG EN CONSOLA: Verificamos qué inventario devuelve la API
        if (data.cierres && data.cierres.length > 0) {
          console.log("🔍 [FRONTEND DEBUG] Inventario usado del último cierre:", 
            JSON.stringify(data.cierres[0]?.inventario_usado, null, 2)
          );
        }

        if (isMounted && data.cierres && Array.isArray(data.cierres)) {
          // Si el backend ya trae el historial desduplicado, asignamos directamente
          setCierres(data.cierres);
        }
      } catch (e) {
        console.error("❌ Error recuperando historial:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    cargar();

    return () => {
      isMounted = false;
    };
  }, [pacienteId])
);

  // 📄 EXPORTACIÓN COMPLETA A PDF CON ALERTAS CLÍNICAS
  const generarPDF = async (c: any) => {
    let logoBase64 = "";
    try {
      const asset = Asset.fromModule(require('../assets/images/logo.png'));
      await asset.downloadAsync();
      if (asset.localUri) {
        const base64Raw = await readAsStringAsync(asset.localUri, { encoding: 'base64' });
        logoBase64 = `data:image/png;base64,${base64Raw}`;
      }
    } catch (err) {
      console.error("⚠️ No se pudo procesar el logo para el PDF:", err);
    }
    
    const desglosePersonas = c?.desglose_por_persona || [];
    const inventarioUsado = c?.inventario_usado || [];
    const notasTurno = c?.notas_turno || [];
    const alertasClinicas = c?.alertas_clinicas || []; // 👈 🎯 NUEVA VARIABLE DE ALERTAS

    const htmlDesglose = desglosePersonas.map((g: any) => `
      <div style="margin-bottom: 14px; background-color: #FFFFFF; border: 1px solid #E0D8CC; border-radius: 8px; padding: 12px;" class="no-split">
        <div style="font-size: 13px; font-weight: 800; color: #BF9A40; margin-bottom: 8px;">
          👤 ${g.persona} (${g.tareas.length} actividades)
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${g.tareas.map((t: any) => `
            <tr style="border-top: 1px solid #F0EAE1;">
              <td style="padding: 6px; font-size: 12px; color: #2C2820;">
                ${ICONOS_TIPO[t.tipo] || '📋'} ${t.descripcion}
              </td>
              <td style="padding: 6px; font-size: 11px; color: #8A8078; text-align: right;">
                ${t.hora_completada ? formatHora(t.hora_completada) : '—'}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    `).join('');

    const htmlInventario = inventarioUsado.length > 0 ? `
      <table class="data-table no-split">
        <thead>
          <tr>
            <th style="width: 50%;">Insumo / Medicamento</th>
            <th style="width: 25%; text-align: center;">Usado Hoy</th>
            <th style="width: 25%; text-align: center;">Stock Restante</th>
          </tr>
        </thead>
        <tbody>
          ${inventarioUsado.map((inv: any) => `
            <tr style="border-bottom: 1px solid #E0D8CC;">
              <td style="padding: 8px 10px; font-size: 12px; font-weight: 600;">${inv.nombre}</td>
              <td style="padding: 8px 10px; font-size: 12px; text-align: center; color: #D4860A; font-weight: 700;">-${inv.usado_hoy} ${inv.unidad}</td>
              <td style="padding: 8px 10px; font-size: 12px; text-align: center; color: #3DAA6A; font-weight: 800;">${inv.stock_restante} ${inv.unidad}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="font-size: 12px; color: #8A8078;">No se registraron consumos de inventario en este día.</p>';

    // 🎯 HTML PARA SECCIÓN DE ALERTAS CLÍNICAS
    const htmlAlertas = alertasClinicas.length > 0 ? `
      <div class="alert-box" style="background-color: #FDEAEA; border-left: 5px solid #D94F4F; margin-bottom: 20px;">
        <div class="alert-title" style="color: #D94F4F;">🚨 Alertas Clínicas e Incidentes del Día (${alertasClinicas.length})</div>
        <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #2C2820;">
          ${alertasClinicas.map((alt: any) => `
            <li>
              <strong style="color: ${alt.severidad === 'alta' ? '#D94F4F' : '#D4860A'};">[${(alt.severidad || 'baja').toUpperCase()}]</strong> 
              ${alt.descripcion || alt.mensaje}
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '<p style="font-size: 12px; color: #3DAA6A; font-weight: 600;">✅ Sin alertas ni eventos críticos registrados durante el turno.</p>';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: letter; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 10px; color: #2C2820; background-color: #FAFAF7; }
          .no-split { page-break-inside: avoid !important; break-inside: avoid !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .header-container { background-color: #4A4540; padding: 24px; border-radius: 14px; color: #FFFFFF; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
          .header-text { flex: 1; }
          .header-logo { width: 140px; height: auto; margin-left: 20px; object-fit: contain; max-height: 120px; }
          .brand-title { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #BF9A40; margin-bottom: 4px; }
          .main-title { font-size: 24px; font-weight: 800; margin: 0; padding-bottom: 4px; }
          .meta-info { font-size: 13px; color: #E0D8CC; margin-top: 8px; line-height: 1.6; }
          .section-title { font-size: 14px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #8A8078; margin-top: 25px; margin-bottom: 12px; border-bottom: 2px solid #E0D8CC; padding-bottom: 6px; }
          .grid-container { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
          .metric-card { flex: 1; min-width: 120px; background-color: #FFFFFF; border: 1px solid #E0D8CC; border-radius: 10px; padding: 12px; text-align: center; }
          .metric-val { font-size: 16px; font-weight: 800; color: #BF9A40; margin-bottom: 2px; }
          .metric-label { font-size: 10px; font-weight: 700; color: #8A8078; text-transform: uppercase; }
          .data-table { width: 100%; border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #E0D8CC; border-radius: 12px; overflow: hidden; margin-bottom: 25px; }
          .data-table th { background-color: #F5EDD8; color: #4A4540; padding: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: left; letter-spacing: 1px; }
          .alert-box { background-color: #FFF4E0; border-left: 5px solid #D4860A; border-radius: 8px; padding: 16px; margin-top: 15px; }
          .alert-title { font-size: 12px; font-weight: 800; color: #D4860A; text-transform: uppercase; margin-bottom: 6px; }
          .alert-desc { font-size: 13px; color: #2C2820; margin: 0; line-height: 1.5; }
        </style>
      </head>
      <body>

        <div class="header-container no-split">
          <div class="header-text">
            <div class="brand-title">Vitanova Integralis — Telemetría Vital</div>
            <h1 class="main-title">Reporte Clínico de Turno</h1>
            <div class="meta-info">
              <strong>Paciente:</strong> ${pacienteNombre}<br/>
              <strong>Especialista/Cuidador:</strong> ${c.nombre_cuidador ?? 'Personal Vitanova'}<br/>
              <strong>Fecha de Consolidación:</strong> ${formatFecha(c.created_at)}<br/>
              <strong>Estado General Dictado:</strong> <span style="font-weight: 800; color: ${c.estado_paciente === 'bien' ? '#3DAA6A' : '#D94F4F'};">${c.estado_paciente?.toUpperCase()}</span>
            </div>
          </div>
          ${logoBase64 ? `<img class="header-logo" src="${logoBase64}" alt="Logo Vitanova" />` : ''}
        </div>

        <div class="no-split">
          <div class="section-title">Signos Vitales Consolidados</div>
          <div class="grid-container">
            <div class="metric-card"><div class="metric-val">${c.spo2 ? `${c.spo2}%` : '—'}</div><div class="metric-label">SpO₂</div></div>
            <div class="metric-card"><div class="metric-val">${c.presion_sistolica && c.presion_diastolica ? `${Math.round(c.presion_sistolica)}/${Math.round(c.presion_diastolica)}` : '—'}</div><div class="metric-label">Presión (mmHg)</div></div>
            <div class="metric-card"><div class="metric-val">${c.frecuencia_cardiaca ? `${c.frecuencia_cardiaca}` : '—'}</div><div class="metric-label">Pulso (bpm)</div></div>
            <div class="metric-card"><div class="metric-val">${c.temperatura ? `${c.temperatura}°C` : '—'}</div><div class="metric-label">Temperatura</div></div>
            <div class="metric-card"><div class="metric-val">${c.peso_kg ? `${c.peso_kg} kg` : '—'}</div><div class="metric-label">Peso</div></div>
          </div>
        </div>

        {/* 🚨 🎯 SECCIÓN INCLUIDA: ALERTAS CLÍNICAS */}
        <div class="no-split">
          <div class="section-title">🚨 Alertas Clínicas del Día</div>
          ${htmlAlertas}
        </div>

        ${c.dolor_eva !== null && c.dolor_eva !== undefined ? `
          <div class="no-split">
            <div class="section-title">Evaluación de Confort Diario</div>
            <div class="grid-container">
              <div class="metric-card" style="border-top: 3px solid ${c.dolor_eva > 4 ? '#D94F4F' : '#3DAA6A'};"><div class="metric-val">${c.dolor_eva}/10</div><div class="metric-label">Dolor (EVA)</div></div>
              <div class="metric-card"><div class="metric-val" style="text-transform: capitalize;">${c.estado_animo ?? '—'}</div><div class="metric-label">Estado de Ánimo</div></div>
              <div class="metric-card"><div class="metric-val">${c.hidratacion_vasos ?? '0'} 💧</div><div class="metric-label">Hidratación</div></div>
              <div class="metric-card"><div class="metric-val" style="text-transform: capitalize;">${c.alimentacion ?? '—'}</div><div class="metric-label">Alimentación</div></div>
            </div>
          </div>
        ` : ''}

        <div class="no-split">
          <div class="section-title">✅ Actividades Realizadas por Responsable</div>
          ${htmlDesglose || '<p style="font-size: 12px; color: #8A8078;">Sin actividades registradas.</p>'}
        </div>

        <div class="no-split">
          <div class="section-title">📦 Concentrado de Insumos Usados e Inventario Restante</div>
          ${htmlInventario}
        </div>

        ${c.observaciones || notasTurno.length > 0 ? `
          <div class="no-split">
            <div class="section-title">Observaciones Especiales</div>
            ${c.observaciones ? `
              <div class="alert-box">
                <div class="alert-title">🚨 Reporte de Anomalía o Alerta de Confort</div>
                <p class="alert-desc">${c.observaciones}</p>
              </div>
            ` : ''}
            ${notasTurno.length > 0 ? `
              <div class="alert-box" style="background-color: #EEF3FC; border-left-color: #2D6BE4;">
                <div class="alert-title" style="color: #2D6BE4;">📝 Notas de Evolución Clínicas</div>
                <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #2C2820;">
                  ${notasTurno.map((n: any) => `<li>${String(n.descripcion || '').replace('📝 ', '')} (${formatHora(n.hora_completada)})</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        ` : ''}

      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const nombreSanitizado = (pacienteNombre || 'paciente')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_');
      const targetPath = `${documentDirectory}reporte_clinico_${nombreSanitizado}.pdf`;

      await moveAsync({ from: uri, to: targetPath });
      await Sharing.shareAsync(targetPath, { mimeType: 'application/pdf', dialogTitle: `Reporte Clínico — ${pacienteNombre}` });
    } catch (e) {
      console.error("❌ Error imprimiendo PDF:", e);
      Alert.alert("Error de Impresión", "Hubo un fallo al compilar el reporte clínico.");
    }
  };

  // 📲 MENSAJE ESTRUCTURADO PARA WHATSAPP
  const compartirPorWhatsApp = (c: any) => {
    const desglosePersonas = c?.desglose_por_persona || [];
    const inventarioUsado = c?.inventario_usado || [];
    const alertasClinicas = c?.alertas_clinicas || [];

    // 🎯 1. Detección dinámica de Emoji y Nombre de Estado
    const emojiEstado = c?.estado_paciente === 'bien' ? '😊' : c?.estado_paciente === 'preocupante' ? '😟' : '😐';
    const labelEstado = c?.estado_paciente === 'bien' ? 'ESTABLE' : c?.estado_paciente === 'preocupante' ? 'CRÍTICO' : 'REGULAR';

    // 🎯 2. Nombre del cuidador asignado al cierre
    const nombreCuidador = c?.nombre_cuidador || c?.usuarios?.nombre_completo || 'Personal Vitanova';

    let textoAlertas = "";
    if (alertasClinicas.length > 0) {
      textoAlertas = `🚨 *ALERTAS CLÍNICAS DEL DÍA (${alertasClinicas.length}):*\n`;
      alertasClinicas.forEach((alt: any) => {
        textoAlertas += `  • ${alt.descripcion || alt.mensaje}\n`;
      });
      textoAlertas += "\n";
    }

    let textoPersonas = "";
    if (desglosePersonas.length === 0) {
      textoPersonas = "Sin actividades registradas hoy.\n";
    } else {
      desglosePersonas.forEach((g: any) => {
        textoPersonas += `👤 *${g.persona}* (${g.tareas.length} tareas):\n`;
        g.tareas.forEach((t: any) => {
          const hora = t.hora_completada ? formatHora(t.hora_completada) : '';
          textoPersonas += `   • [${hora}] ${t.descripcion}\n`;
        });
        textoPersonas += "\n";
      });
    }

    let textoInventario = "";
    if (inventarioUsado.length === 0) {
      textoInventario = "No se consumieron insumos de la despensa hoy.\n";
    } else {
      inventarioUsado.forEach((inv: any) => {
        textoInventario += `   • *${inv.nombre}*: Usado hoy: -${inv.usado_hoy} ${inv.unidad} | *Stock restante: ${inv.stock_restante} ${inv.unidad}*\n`;
      });
    }

    // 🎯 3. Mensaje dinámico completo y ordenado
    const mensaje = 
      `📋 *REPORTE DIARIO DE CUIDADOS*\n` +
      `👤 Paciente: *${pacienteNombre}*\n` +
      `🧑‍⚕️ Cuidador: *${nombreCuidador}*\n` +
      `📅 Fecha: ${formatFecha(c.created_at)}\n` +
      `${emojiEstado} Estado: *${labelEstado}*\n\n` +
      `*Signos Vitales:*\n` +
      `SpO₂: ${c.spo2 ?? '—'}% | PA: ${c.presion_sistolica ?? '—'}/${c.presion_diastolica ?? '—'} | FC: ${c.frecuencia_cardiaca ?? '—'} bpm\n` +
      `Temp: ${c.temperatura ?? '—'}°C | Peso: ${c.peso_kg ?? '—'} kg\n\n` +
      `${textoAlertas}` +
      (c.dolor_eva !== null && c.dolor_eva !== undefined ? `*Confort:*\nDolor: ${c.dolor_eva}/10 | Ánimo: ${c.estado_animo ?? '—'} | Hidratación: ${c.hidratacion_vasos ?? '0'} vasos\n\n` : '') +
      `─────────────────────────────\n` +
      `✅ *ACTIVIDADES POR RESPONSABLE*\n\n` +
      `${textoPersonas}` +
      `─────────────────────────────\n` +
      `📦 *CONCENTRADO DE INSUMOS Y STOCK RESTANTE*\n\n` +
      `${textoInventario}` +
      (c.observaciones ? `\n🚨 *Observaciones:* ${c.observaciones}\n` : '');

    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(mensaje)}`);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  const tieneRegistrosBase = cierres.length > 0;
  const tieneRegistrosFiltrados = cierresFiltrados.length > 0;

  const displayEstado = cierreSeleccionado?.estado_paciente === 'bien' ? 'ESTABLE' : 
                        cierreSeleccionado?.estado_paciente === 'preocupante' ? 'CRÍTICO' : 'REGULAR';

  const desglosePersonas = cierreSeleccionado?.desglose_por_persona || [];
  const inventarioUsado = cierreSeleccionado?.inventario_usado || [];
  const notasTurno = cierreSeleccionado?.notas_turno || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>HISTORIAL DE TURNOS Y REPORTES</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {!tieneRegistrosBase ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center' }}>
              Sin registros de turnos anteriores
            </Text>
          </View>
        ) : !tieneRegistrosFiltrados ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
            <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center' }}>
              Ningún cierre coincide con los filtros aplicados
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setFiltroFecha('');
                setFiltroCuidador('todos');
                setIndice(0);
              }}
              style={{ marginTop: 12, backgroundColor: COLORS.cream, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}
            >
              <Text style={{ fontSize: 12, color: COLORS.textDark, fontWeight: '600' }}>Limpiar Filtros ✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
           {/* NAVEGADOR MULTI-TURNO INTERACTIVO */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* Botón Turno Anterior (Siguiente en el tiempo / más antiguo) */}
            <TouchableOpacity
              onPress={() => setIndice(Math.min(indice + 1, cierresFiltrados.length - 1))}
              disabled={indice >= cierresFiltrados.length - 1}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 28, color: indice >= cierresFiltrados.length - 1 ? COLORS.border : COLORS.gold }}>{'‹'}</Text>
            </TouchableOpacity>
            
            {/* Selector de Fecha / Turno Actual */}
            <TouchableOpacity 
              style={{ alignItems: 'center', marginVertical: 4, paddingVertical: 4 }} 
              onPress={() => setModalVisible(true)}
            >
              {/* Encabezado: Turno X de Y + Nombre del Cuidador */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 2 }}>
                {`Turno ${indice + 1} de ${cierresFiltrados.length}`}
                {cierreSeleccionado?.nombre_cuidador ? ` · ${cierreSeleccionado.nombre_cuidador.split(' ')[0]}` : ''}
              </Text>
              
              {/* Píldora de Fecha + Hora de Cierre */}
              <View style={{
                flexDirection: 'row', 
                alignItems: 'center',
                backgroundColor: filtroFecha ? COLORS.goldPale : COLORS.cream,
                paddingHorizontal: 12, 
                paddingVertical: 5, 
                borderRadius: 12,
                borderWidth: 1, 
                borderColor: filtroFecha ? COLORS.gold : COLORS.border,
                gap: 6, 
                marginTop: 2
              }}>
                <Text style={{ fontSize: 11, color: COLORS.gold, fontWeight: '700' }}>
                  {cierreSeleccionado?.created_at 
                    ? new Date(cierreSeleccionado.created_at).toLocaleString('es-MX', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) 
                    : cierreSeleccionado?.fecha 
                      ? new Date(cierreSeleccionado.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'Filtrar Fecha'}
                </Text>
                <Text style={{ fontSize: 10 }}>📅</Text>
              </View>
            </TouchableOpacity>

            {/* Botón Turno Siguiente (Más reciente) */}
            <TouchableOpacity
              onPress={() => setIndice(Math.max(indice - 1, 0))}
              disabled={indice <= 0}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 28, color: indice <= 0 ? COLORS.border : COLORS.gold }}>{'›'}</Text>
            </TouchableOpacity>
          </View>
            {/* BOTONES DE EXPORTACIÓN */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: COLORS.greenPale, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.green }}
                onPress={() => generarPDF(cierreSeleccionado)}
              >
                <Text style={{ fontSize: 11, color: COLORS.green, fontWeight: '700' }}>{'📄 PDF'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#25D366' }}
                onPress={() => compartirPorWhatsApp(cierreSeleccionado)}
              >
                <Text style={{ fontSize: 11, color: '#25D366', fontWeight: '700' }}>{'📲 WhatsApp'}</Text>
              </TouchableOpacity>
            </View>

            {/* TARJETA DE REPORTE DIARIO CONSOLIDADO */}
            <View style={styles.cierreCard}>
              <View style={styles.cierreHeader}>
                {/* 1. Emoji dinámico según el estado real del paciente */}
                <Text style={{ fontSize: 28 }}>
                  {cierreSeleccionado?.estado_paciente === 'bien' ? '😊' : 
                  cierreSeleccionado?.estado_paciente === 'preocupante' ? '😟' : '😐'}
                </Text>
                
                <View style={{ flex: 1 }}>
                  {/* 2. Título de Reporte Diario en lugar de centrarse en un solo nombre */}
                  <Text style={[styles.cierreNombreCuidador, { fontSize: 15, fontWeight: '800' }]}>
                    Reporte Diario de Operación
                  </Text>
                  
                  {/* Fecha de la operación */}
                  <Text style={styles.cierreFecha}>
                    {formatFecha(cierreSeleccionado?.created_at)}
                  </Text>

                  {/* 3. Etiqueta transparente de quién realizó el cierre final */}
                  <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 2, fontWeight: '600' }}>
                    {`📋 Cierre consolidado por: ${cierreSeleccionado?.nombre_cuidador ?? 'Personal Vitanova'}`}
                  </Text>
                </View>

                {/* Badge de Estatus Clinico (ESTABLE, REGULAR, CRÍTICO) */}
                <View style={[styles.estadoPill, {
                  backgroundColor: cierreSeleccionado?.estado_paciente === 'bien' ? COLORS.greenPale :
                    cierreSeleccionado?.estado_paciente === 'preocupante' ? COLORS.redPale : COLORS.amberPale
                }]}>
                  <Text style={[styles.estadoPillText, {
                    color: cierreSeleccionado?.estado_paciente === 'bien' ? COLORS.green :
                      cierreSeleccionado?.estado_paciente === 'preocupante' ? COLORS.red : COLORS.amber
                  }]}>{displayEstado}</Text>
                </View>
              </View>

              {/* 1. MATRIZ DE SIGNOS VITALES CON TRAZABILIDAD TEMPORAL */}
              {(() => {
                const tCierre = cierreSeleccionado?.created_at;

                const spo2Info = evaluarSignoVital(cierreSeleccionado?.spo2, cierreSeleccionado?.spo2_timestamp, tCierre);
                
                const presionVal = (cierreSeleccionado?.presion_sistolica && cierreSeleccionado?.presion_diastolica)
                  ? `${Math.round(cierreSeleccionado.presion_sistolica)}/${Math.round(cierreSeleccionado.presion_diastolica)}`
                  : null;
                const presionInfo = evaluarSignoVital(presionVal, cierreSeleccionado?.presion_timestamp, tCierre);

                const fcInfo = evaluarSignoVital(cierreSeleccionado?.frecuencia_cardiaca, cierreSeleccionado?.fc_timestamp, tCierre);
                const tempInfo = evaluarSignoVital(cierreSeleccionado?.temperatura, cierreSeleccionado?.temperatura_timestamp, tCierre);
                const pesoInfo = evaluarSignoVital(cierreSeleccionado?.peso_kg, cierreSeleccionado?.peso_timestamp, tCierre);

                return (
                  <View style={styles.signosRow}>
                    {/* SpO2 */}
                    <View style={styles.signoItem}>
                      <Text style={styles.signoVal}>{spo2Info.display}{spo2Info.display !== '—' ? '%' : ''}</Text>
                      <Text style={styles.signoLabel}>SpO₂</Text>
                      {spo2Info.esHeredado && (
                        <Text style={{ fontSize: 8, color: COLORS.amber, marginTop: 2, fontWeight: '700' }}>
                          {spo2Info.etiqueta}
                        </Text>
                      )}
                    </View>

                    {/* Presión Arterial */}
                    <View style={styles.signoItem}>
                      <Text style={styles.signoVal}>{presionInfo.display}</Text>
                      <Text style={styles.signoLabel}>Presión</Text>
                      {presionInfo.esHeredado && (
                        <Text style={{ fontSize: 8, color: COLORS.amber, marginTop: 2, fontWeight: '700' }}>
                          {presionInfo.etiqueta}
                        </Text>
                      )}
                    </View>

                    {/* Frecuencia Cardíaca */}
                    <View style={styles.signoItem}>
                      <Text style={styles.signoVal}>{fcInfo.display}</Text>
                      <Text style={styles.signoLabel}>FC bpm</Text>
                      {fcInfo.esHeredado && (
                        <Text style={{ fontSize: 8, color: COLORS.amber, marginTop: 2, fontWeight: '700' }}>
                          {fcInfo.etiqueta}
                        </Text>
                      )}
                    </View>

                    {/* Temperatura */}
                    <View style={styles.signoItem}>
                      <Text style={styles.signoVal}>{tempInfo.display}{tempInfo.display !== '—' ? '°C' : ''}</Text>
                      <Text style={styles.signoLabel}>Temp</Text>
                      {tempInfo.esHeredado && (
                        <Text style={{ fontSize: 8, color: COLORS.amber, marginTop: 2, fontWeight: '700' }}>
                          {tempInfo.etiqueta}
                        </Text>
                      )}
                    </View>

                    {/* Peso */}
                    <View style={styles.signoItem}>
                      <Text style={styles.signoVal}>{pesoInfo.display}{pesoInfo.display !== '—' ? ' kg' : ''}</Text>
                      <Text style={styles.signoLabel}>Peso</Text>
                      {pesoInfo.esHeredado && (
                        <Text style={{ fontSize: 8, color: COLORS.amber, marginTop: 2, fontWeight: '700' }}>
                          {pesoInfo.etiqueta}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })()}

              {/* 2. PARÁMETROS DE CONFORT LOGÍSTICO */}
              {(cierreSeleccionado?.dolor_eva !== null && cierreSeleccionado?.dolor_eva !== undefined || cierreSeleccionado?.estado_animo || cierreSeleccionado?.hidratacion_vasos || cierreSeleccionado?.alimentacion || cierreSeleccionado?.observaciones) ? (
                <View style={styles.tareasSection}>
                  <Text style={styles.tareasSectionTitle}>REGISTRO DE CONFORT</Text>
                  <View style={styles.signosRow}>
                    {cierreSeleccionado?.dolor_eva !== null && cierreSeleccionado?.dolor_eva !== undefined ? (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{`${cierreSeleccionado.dolor_eva}/10`}</Text>
                        <Text style={styles.signoLabel}>Dolor EVA</Text>
                      </View>
                    ) : null}
                    {cierreSeleccionado?.hidratacion_vasos !== null && cierreSeleccionado?.hidratacion_vasos !== undefined ? (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{`${cierreSeleccionado.hidratacion_vasos} 💧`}</Text>
                        <Text style={styles.signoLabel}>Hidratación</Text>
                      </View>
                    ) : null}
                    {cierreSeleccionado?.alimentacion ? (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{cierreSeleccionado.alimentacion}</Text>
                        <Text style={styles.signoLabel}>Alimentación</Text>
                      </View>
                    ) : null}
                    {cierreSeleccionado?.estado_animo ? (
                      <View style={styles.signoItem}>
                        <Text style={styles.signoVal}>{cierreSeleccionado.estado_animo}</Text>
                        <Text style={styles.signoLabel}>Ánimo</Text>
                      </View>
                    ) : null}
                  </View>
                  {cierreSeleccionado?.observaciones ? (
                    <View style={styles.notaItem}>
                      <Text style={{ fontSize: 11, color: COLORS.textDark }}>{cierreSeleccionado.observaciones}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
               
              {/* 3. ACTIVIDADES REALIZADAS POR RESPONSABLE */}
              <View style={styles.tareasSection}>
                <Text style={[styles.tareasSectionTitle, { color: COLORS.cacao, marginBottom: 10 }]}>
                  ✅ ACTIVIDADES REALIZADAS POR RESPONSABLE
                </Text>

                {desglosePersonas.length === 0 ? (
                  <Text style={{ fontSize: 12, color: COLORS.textLight }}>Sin actividades completadas hoy.</Text>
                ) : (
                  desglosePersonas.map((grupo: any, gi: number) => (
                    <View key={`persona-${gi}`} style={{ marginBottom: 12, backgroundColor: COLORS.cream, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.gold, marginBottom: 6 }}>
                        👤 {grupo.persona} ({grupo.tareas.length} actividades)
                      </Text>
                      {grupo.tareas.map((t: any, ti: number) => (
                        <View key={`tarea-p-${ti}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
                          <Text style={{ fontSize: 11, color: COLORS.textDark, flex: 1 }}>
                            {ICONOS_TIPO[t.tipo] ?? '📋'} {t.descripcion}
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.textLight }}>
                            {t.hora_completada ? formatHora(t.hora_completada) : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
             
              {/* 4. CONCENTRADO DE INSUMOS USADOS Y STOCK RESTANTE (DIVIDIDO POR CATEGORÍA) */}
              {(() => {
                const listaUsados = inventarioUsado || [];

                // 🎯 Clasificación Inteligente
                const medicamentos = listaUsados.filter((inv: any) => {
                  const tipo = (inv.tipo || '').toLowerCase();
                  const nombre = (inv.nombre || inv.descripcion || '').toLowerCase();
                  return tipo === 'medicamento' || (inv.tipo_tarea === 'medicamento' && !nombre.includes('pañal') && !nombre.includes('panal'));
                });

                const insumos = listaUsados.filter((inv: any) => {
                  const tipo = (inv.tipo || '').toLowerCase();
                  const nombre = (inv.nombre || inv.descripcion || '').toLowerCase();
                  return tipo === 'insumo' || tipo === 'material' || tipo === 'higiene' || tipo === 'despensa' || nombre.includes('pañal') || nombre.includes('panal') || nombre.includes('toallita') || nombre.includes('gasa');
                });

                const otros = listaUsados.filter((inv: any) => !medicamentos.includes(inv) && !insumos.includes(inv));

                const renderFilaInsumo = (inv: any, ii: number, prefix: string) => {
                  const nombreInsumo = inv.nombre || inv.descripcion || 'Insumo sin nombre';
                  const cantidadUsada = inv.usado_hoy ?? inv.cantidad ?? 1;
                  const stockRestante = inv.stock_restante ?? inv.stock ?? 'N/A';
                  const unidadMedida = inv.unidad || 'piezas';
                  
                  // 🎯 Extraer el desglose por persona o fallback si viene en string
                  const desgloseObj: Record<string, number> = inv.desglose_por_persona || {};
                  const listaDesglose = Object.entries(desgloseObj);
                  const registradoPorFallback = inv.registrado_por;

                  return (
                    <View 
                      key={`${prefix}-${inv.id || 'item'}-${ii}`} 
                      style={{ 
                        backgroundColor: COLORS.white, 
                        padding: 10, 
                        borderRadius: 8, 
                        borderWidth: 1, 
                        borderColor: COLORS.border 
                      }}
                    >
                      {/* FILA SUPERIOR: Nombre, Cantidad Total y Stock Restante */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textDark }}>
                            {nombreInsumo}
                          </Text>
                          
                          <Text style={{ fontSize: 10, color: COLORS.amber, fontWeight: '700', marginTop: 2 }}>
                            Usado hoy: -{cantidadUsada} {unidadMedida}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', backgroundColor: COLORS.greenPale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.green }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.green }}>
                            Stock: {stockRestante} {unidadMedida}
                          </Text>
                        </View>
                      </View>

                      {/* 🎯 SECCIÓN INFERIOR: DESGLOSE EXACTO POR PERSONA */}
                      {listaDesglose.length > 0 ? (
                        <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F0F0F0', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                          {listaDesglose.map(([persona, cant], idx) => (
                            <Text key={`desglose-${idx}`} style={{ fontSize: 10, color: COLORS.textLight, fontWeight: '600' }}>
                              👤 {persona}: <Text style={{ fontWeight: '700', color: COLORS.textDark }}>{cant} {unidadMedida}</Text>
                            </Text>
                          ))}
                        </View>
                      ) : registradoPorFallback ? (
                        /* Fallback simple por si un registro antiguo no traía diccionario */
                        <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
                          <Text style={{ fontSize: 10, color: COLORS.textLight, fontWeight: '600' }}>
                            👤 {registradoPorFallback}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                };

                return (
                  <View style={[styles.tareasSection, { marginTop: 12 }]}>
                    <Text style={[styles.tareasSectionTitle, { color: COLORS.amber, marginBottom: 8 }]}>
                      📦 CONCENTRADO DE INSUMOS Y MEDICAMENTOS HOY
                    </Text>

                    {listaUsados.length === 0 ? (
                      <Text style={{ fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' }}>
                        No se consumieron insumos de la despensa en este día.
                      </Text>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {/* 💊 MEDICAMENTOS */}
                        {medicamentos.length > 0 && (
                          <View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                              💊 Medicamentos Administrados ({medicamentos.length})
                            </Text>
                            <View style={{ gap: 6 }}>
                              {medicamentos.map((inv: any, ii: number) => renderFilaInsumo(inv, ii, 'med'))}
                            </View>
                          </View>
                        )}

                        {/* 📦 INSUMOS Y PAÑALES */}
                        {insumos.length > 0 && (
                          <View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                              📦 Insumos, Pañales y Materiales ({insumos.length})
                            </Text>
                            <View style={{ gap: 6 }}>
                              {insumos.map((inv: any, ii: number) => renderFilaInsumo(inv, ii, 'ins'))}
                            </View>
                          </View>
                        )}

                        {/* 📋 OTROS */}
                        {otros.length > 0 && (
                          <View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                              📋 Otros Consumos ({otros.length})
                            </Text>
                            <View style={{ gap: 6 }}>
                              {otros.map((inv: any, ii: number) => renderFilaInsumo(inv, ii, 'otr'))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}

             {/* 5. SECCIÓN NOTAS EVOLUTIVAS DEL TURNO */}
              {notasTurno.length > 0 ? (
                <View style={styles.notasSection}>
                  <Text style={[styles.tareasSectionTitle, { color: COLORS.amber }]}>NOTAS DEL TURNO</Text>
                  {notasTurno.map((n: any, ni: number) => {
                    // 🎯 Extracción segura del nombre del autor de la nota
                    const autorNota = 
                      (typeof n.usuarios === 'object' && n.usuarios?.nombre_completo) 
                      || (Array.isArray(n.usuarios) && n.usuarios[0]?.nombre_completo)
                      || cierreSeleccionado?.nombre_cuidador 
                      || 'Personal Vitanova';

                    return (
                      <View key={`nota-${ni}`} style={styles.notaItem}>
                        <Text style={{ fontSize: 11, color: COLORS.textDark, fontWeight: '600' }}>
                          {String(n.descripcion || '').replace('📝 ', '')}
                        </Text>
                        <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 4 }}>
                          {`👤 ${autorNota}${n.hora_completada ? ` · 🕒 ${formatHora(n.hora_completada)}` : ''}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {/* 🚨 SECCIÓN DE ALERTAS CLÍNICAS Y EVENTOS OPERATIVOS */}
{(() => {
  const todasAlertas = cierreSeleccionado?.alertas_clinicas || [];

  // 🎯 1. Filtro: Eventos Operativos (Entradas, Salidas, Cierres de Turno)
  const eventosTurno = todasAlertas.filter((a: any) => {
    const desc = (a.descripcion || a.mensaje || '').toLowerCase();
    const tipo = (a.tipo || '').toLowerCase();
    return (
      tipo.includes('turno') ||
      tipo.includes('cuidador') ||
      desc.includes('cierre turno') ||
      desc.includes('inicio turno') ||
      desc.includes('entrada') ||
      desc.includes('salida') ||
      desc.includes('cuidador')
    );
  });

        // 🎯 2. Filtro: Alertas Clínicas Reales (Picos de SpO2, Presión, Temperatura, Caídas)
        const alertasClinicas = todasAlertas.filter((a: any) => !eventosTurno.includes(a));

        return (
          <View style={{ marginTop: 12, gap: 10 }}>
            {/* 🚨 1. SECCIÓN ROJA: ALERTAS Y PICOS CLÍNICOS */}
            {alertasClinicas.length > 0 && (
              <View style={{ backgroundColor: COLORS.redPale || '#FDEAEA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F5C6C6' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.red || '#D94F4F', marginBottom: 6 }}>
                  🚨 Alertas y Picos Clínicos Registrados ({alertasClinicas.length})
                </Text>
                {alertasClinicas.map((alt: any, idx: number) => (
                  <Text key={`clinica-${alt.id || idx}`} style={{ fontSize: 12, color: COLORS.cacao || '#4A4540', marginBottom: 4 }}>
                    • {alt.descripcion || alt.mensaje}
                  </Text>
                ))}
              </View>
            )}

            {/* 🚪 2. SECCIÓN AZUL: REGISTROS DE ENTRADA, SALIDA Y TURNOS */}
            {eventosTurno.length > 0 && (
              <View style={{ backgroundColor: '#E3F2FD', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BBDEFB' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1565C0', marginBottom: 6 }}>
                  🚪 Registros de Entrada, Salida y Turnos ({eventosTurno.length})
                </Text>
                {eventosTurno.map((evt: any, idx: number) => (
                  <Text key={`turno-${evt.id || idx}`} style={{ fontSize: 12, color: '#0D47A1', marginBottom: 4 }}>
                    • {evt.descripcion || evt.mensaje}
                  </Text>
                ))}
              </View>
            )}
          </View>
        );
      })()}
              {/* 6. EVALUACIONES DE ESCALAS MÉDICAS */}
              {(cierreSeleccionado?.barthel_total !== null || cierreSeleccionado?.morse_total !== null) ? (
                <View style={[styles.tareasSection, { marginTop: 8 }]}>
                  <Text style={styles.tareasSectionTitle}>ESCALAS CLÍNICAS</Text>
                  {cierreSeleccionado?.barthel_total !== null && cierreSeleccionado?.barthel_total !== undefined ? (
                    <View style={styles.escalaRow}>
                      <Text style={styles.escalaLabel}>Barthel:</Text>
                      <Text style={styles.escalaVal}>{`${cierreSeleccionado.barthel_total}/100 — ${cierreSeleccionado.barthel_label}`}</Text>
                    </View>
                  ) : null}
                  {cierreSeleccionado?.morse_total !== null && cierreSeleccionado?.morse_total !== undefined ? (
                    <View style={styles.escalaRow}>
                      <Text style={styles.escalaLabel}>Morse:</Text>
                      <Text style={styles.escalaVal}>{`${cierreSeleccionado.morse_total} pts — ${cierreSeleccionado.morse_label}`}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL DE FILTRADO SÚPER AVANZADO ── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, width: '100%', padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
            
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.cacao, marginBottom: 16, textAlign: 'center' }}>
              🔍 Filtrar Historial de Cierres
            </Text>

            {/* BLOQUE A: SELECCIÓN DE FECHA */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#8A8078', marginBottom: 6 }}>
              FECHA DE OPERACIÓN
            </Text>
            
            <TouchableOpacity 
              onPress={() => setShowCalendar(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}
            >
              <Text style={{ marginRight: 8 }}>📅</Text>
              <Text style={{ flex: 1, fontSize: 14, color: filtroFecha ? COLORS.textDark : COLORS.textLight }}>
                {filtroFecha ? filtroFecha : "Seleccionar fecha..."}
              </Text>
              {filtroFecha !== '' ? (
                <TouchableOpacity onPress={() => { setFiltroFecha(''); setFechaObjeto(new Date()); }}>
                  <Text style={{ color: COLORS.red, fontWeight: '700', paddingHorizontal: 4 }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            {/* BLOQUE B: BURBUJAS DE CUIDADORES */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#8A8078', marginBottom: 8 }}>
              CUIDADOR EN TURNO
            </Text>

            <View style={{ marginBottom: 24 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                  <TouchableOpacity 
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: filtroCuidador === 'todos' ? COLORS.gold : COLORS.border, backgroundColor: filtroCuidador === 'todos' ? COLORS.goldPale : COLORS.white }}
                    onPress={() => setFiltroCuidador('todos')}
                  >
                    <Text style={{ fontSize: 12, color: filtroCuidador === 'todos' ? COLORS.gold : '#8A8078', fontWeight: '600' }}>
                      👤 Todos
                    </Text>
                  </TouchableOpacity>
                  
                  {cuidadoresDisponibles.map((c) => (
                    <TouchableOpacity 
                      key={c}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: filtroCuidador === c ? COLORS.gold : COLORS.border, backgroundColor: filtroCuidador === c ? COLORS.goldPale : COLORS.white }}
                      onPress={() => setFiltroCuidador(c)}
                    >
                      <Text style={{ fontSize: 12, color: filtroCuidador === c ? COLORS.gold : '#8A8078', fontWeight: '600' }}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* BLOQUE C: BOTONES DE ACCIÓN INFERIORES */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.cream, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
                onPress={() => {
                  setFiltroFecha('');
                  setFiltroCuidador('todos');
                  setIndice(0);
                  setModalVisible(false);
                }}
              >
                <Text style={{ color: COLORS.textDark, fontWeight: '600', fontSize: 14 }}>Resetear</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ flex: 1.5, padding: 12, borderRadius: 10, backgroundColor: COLORS.cacao, alignItems: 'center' }}
                onPress={() => {
                  setIndice(0);
                  setModalVisible(false);
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* SELECTOR DE CALENDARIO NATIVO */}
      {showCalendar ? (
        <DateTimePicker
          value={fechaObjeto}
          mode="date"
          display="calendar"
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowCalendar(false);
            if (event.type === 'set' && selectedDate) {
              setFechaObjeto(selectedDate);
              const isoString = selectedDate.toISOString().split('T')[0];
              setFiltroFecha(isoString);
            }
          }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { backgroundColor: COLORS.cacao, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backIcon: { fontSize: 18, color: COLORS.white },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cierreCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cierreHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cierreNombreCuidador: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  cierreFecha: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  estadoPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoPillText: { fontSize: 10, fontWeight: '700' },
  signosRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  signoItem: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  signoVal: { fontSize: 11, fontWeight: '800', color: COLORS.gold, textAlign: 'center' },
  signoLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 2 },
  tareasSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 8 },
  notasSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 },
  tareasSectionTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.textLight, marginBottom: 8 },
  tareaItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tareaItemIcon: { fontSize: 14 },
  tareaItemText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textDark },
  tareaItemHora: { fontSize: 10, color: COLORS.textLight },
  notaItem: { backgroundColor: COLORS.amberPale, borderColor: '#F5DBA0', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 4 },
  escalaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  escalaLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textDark, minWidth: 80 },
  escalaVal: { fontSize: 11, color: COLORS.textLight, flex: 1 },
});