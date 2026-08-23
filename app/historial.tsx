import DateTimePicker from '@react-native-community/datetimepicker';
import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
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

  // 📄 EXPORTACIÓN COMPLETA A PDF — Reporte Clínico de Turno
const generarPDF = async (c: any) => {
  // ── 1. LOGO ──────────────────────────────────────────────
  let logoBase64 = '';
  try {
    const asset = Asset.fromModule(require('../assets/images/logo.png'));
    await asset.downloadAsync();
    if (asset.localUri) {
      const base64Raw = await readAsStringAsync(asset.localUri, { encoding: 'base64' });
      logoBase64 = `data:image/png;base64,${base64Raw}`;
    }
  } catch (err) {
    console.error('⚠️ Logo PDF:', err);
  }

  // ── 2. DATOS ─────────────────────────────────────────────
  const desglosePersonas = c?.desglose_por_persona || [];
  const inventarioUsado = c?.inventario_usado || [];
  const notasTurno = c?.notas_turno || [];
  const alertasClinicas = c?.alertas_clinicas || c?.alertas || [];

  const consumiblesUsados = inventarioUsado.filter(
    (inv: any) => inv.es_consumible !== false && inv.tipo !== 'otro'
  );
  const equiposEnHogar = inventarioUsado.filter(
    (inv: any) => inv.es_consumible === false || inv.tipo === 'otro'
  );

  // ── 3. HELPERS ───────────────────────────────────────────
  const obtenerHoraFormateada = (objeto: any) => {
    const horaRaw =
      objeto?.created_at || objeto?.fecha_hora || objeto?.hora || objeto?.timestamp || '';
    if (!horaRaw) return '';
    try {
      if (typeof formatHora === 'function') {
        const r = formatHora(horaRaw);
        if (r && r !== '—') return r;
      }
      const d = new Date(String(horaRaw).trim().replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      /* ignore */
    }
    return '';
  };

  const colorEstado = (estado?: string) =>
    estado === 'bien' ? '#3DAA6A' : '#D94F4F';

  // ── 4. BLOQUES HTML ──────────────────────────────────────
  const htmlDesglose =
    desglosePersonas.length === 0
      ? `<p class="empty">Sin actividades registradas.</p>`
      : desglosePersonas
          .map(
            (g: any) => `
        <div class="card no-split">
          <div class="card-title">👤 ${g.persona}
            <span class="badge">${g.tareas.length} actividades</span>
          </div>
          <table class="inner-table">
            ${g.tareas
              .map((t: any) => {
                const h = obtenerHoraFormateada(t) || t.hora_completada || '—';
                const icon =
                  (typeof ICONOS_TIPO !== 'undefined' && ICONOS_TIPO[t.tipo]) || '📋';
                return `
                  <tr>
                    <td class="td-desc">${icon} ${t.descripcion}</td>
                    <td class="td-time">${h}</td>
                  </tr>`;
              })
              .join('')}
          </table>
        </div>`
          )
          .join('');

  const htmlInsumos =
    consumiblesUsados.length === 0
      ? `<p class="empty">No se registraron consumos de insumos en este turno.</p>`
      : `
      <table class="data-table no-split">
        <thead>
          <tr>
            <th style="width:50%">Insumo / Medicamento</th>
            <th style="width:25%; text-align:center">Usado en turno</th>
            <th style="width:25%; text-align:center">Stock restante</th>
          </tr>
        </thead>
        <tbody>
          ${consumiblesUsados
            .map(
              (inv: any) => `
            <tr>
              <td class="td-strong">${inv.nombre}</td>
              <td class="td-center amber">−${inv.usado_hoy || inv.cantidad_usada || 0} ${inv.unidad || 'piezas'}</td>
              <td class="td-center green">${inv.stock_restante ?? inv.cantidad ?? '—'} ${inv.unidad || 'piezas'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;

  const htmlEquipos =
    equiposEnHogar.length === 0
      ? ''
      : `
      <table class="data-table no-split" style="margin-top:10px">
        <thead>
          <tr>
            <th style="width:60%">Equipo / Activo fijo</th>
            <th style="width:40%; text-align:center">Estatus</th>
          </tr>
        </thead>
        <tbody>
          ${equiposEnHogar
            .map((eq: any) => {
              const falla =
                String(eq.notas || '').includes('FALLA') ||
                String(eq.estatus || '').includes('falla');
              return `
              <tr>
                <td class="td-strong">♿ ${eq.nombre}</td>
                <td class="td-center" style="color:${falla ? '#D94F4F' : '#3DAA6A'}; font-weight:700">
                  ${falla ? `⚠️ ${eq.notas}` : '✅ Operativo'}
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;

  const htmlAlertas =
    alertasClinicas.length === 0
      ? `<p class="ok-line">✅ Sin alertas ni eventos críticos en el turno.</p>`
      : `
      <div class="alert-box alert-danger no-split">
        <div class="alert-title danger">🚨 Alertas e incidentes (${alertasClinicas.length})</div>
        <ul class="alert-list">
          ${alertasClinicas
            .map((alt: any) => {
              const esFalla =
                alt.tipo === 'fallo_equipo' ||
                String(alt.descripcion || alt.mensaje || '').includes('FALLA DE EQUIPO');
              const horaStr = obtenerHoraFormateada(alt);
              const sevColor = esFalla || alt.severidad === 'alta' ? '#D94F4F' : '#D4860A';
              const label = esFalla
                ? 'FALLA EQUIPO'
                : (alt.severidad || 'ALERTA').toUpperCase();
              return `
              <li>
                ${horaStr ? `<span class="time-badge">[${horaStr}]</span> ` : ''}
                <strong style="color:${sevColor}">[${label}]</strong>
                ${alt.descripcion || alt.mensaje}
              </li>`;
            })
            .join('')}
        </ul>
      </div>`;

  const tieneConfort =
    c.dolor_eva !== null && c.dolor_eva !== undefined;

  const htmlConfort = !tieneConfort
    ? ''
    : `
    <div class="no-split">
      <div class="section-title">Evaluación de confort</div>
      <table class="grid-table">
        <tr>
          <td class="metric-td" style="width:25%; border-top:3px solid ${Number(c.dolor_eva) > 4 ? '#D94F4F' : '#3DAA6A'}">
            <div class="metric-val">${c.dolor_eva}/10</div>
            <div class="metric-label">Dolor (EVA)</div>
          </td>
          <td class="metric-td" style="width:25%">
            <div class="metric-val" style="text-transform:capitalize">${c.estado_animo ?? '—'}</div>
            <div class="metric-label">Ánimo</div>
          </td>
          <td class="metric-td" style="width:25%">
            <div class="metric-val">${c.hidratacion_vasos ?? '0'} 💧</div>
            <div class="metric-label">Hidratación</div>
          </td>
          <td class="metric-td" style="width:25%">
            <div class="metric-val" style="text-transform:capitalize">${c.alimentacion ?? '—'}</div>
            <div class="metric-label">Alimentación</div>
          </td>
        </tr>
      </table>
    </div>`;

  const htmlObservaciones =
    !c.observaciones && notasTurno.length === 0
      ? ''
      : `
    <div class="no-split">
      <div class="section-title">Observaciones</div>
      ${
        c.observaciones
          ? `
        <div class="alert-box alert-warn">
          <div class="alert-title warn">Reporte de anomalía / confort</div>
          <p class="alert-desc">${c.observaciones}</p>
        </div>`
          : ''
      }
      ${
        notasTurno.length > 0
          ? `
        <div class="alert-box alert-info" style="margin-top:10px">
          <div class="alert-title info">📝 Notas de evolución</div>
          <ul class="alert-list">
            ${notasTurno
              .map(
                (n: any) =>
                  `<li>${String(n.descripcion || '').replace('📝 ', '')}
                    <span class="time-badge">(${obtenerHoraFormateada(n) || n.hora_completada || '—'})</span>
                  </li>`
              )
              .join('')}
          </ul>
        </div>`
          : ''
      }
    </div>`;

  // ── 5. DOCUMENTO ─────────────────────────────────────────
  const nombrePaciente =
    typeof pacienteNombre !== 'undefined' ? pacienteNombre : 'Paciente Vitanova';
  const fechaCons =
    typeof formatFecha === 'function' ? formatFecha(c.created_at) : c.created_at;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: letter; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0; padding: 0;
      color: #2C2820; background: #FAFAF7;
    }
    .no-split { page-break-inside: avoid !important; break-inside: avoid !important; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }

    /* Header */
    .header-table {
      width: 100%; background: #4A4540; color: #fff;
      border-radius: 12px; border-collapse: collapse; margin-bottom: 20px;
    }
    .header-table td { padding: 18px; vertical-align: middle; }
    .brand-title {
      font-size: 11px; font-weight: 800; letter-spacing: 2px;
      text-transform: uppercase; color: #BF9A40; margin-bottom: 4px;
    }
    .main-title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
    .meta-info { font-size: 12px; color: #E0D8CC; line-height: 1.55; }
    .header-logo { width: 120px; max-height: 90px; object-fit: contain; }

    /* Sections */
    .section-title {
      font-size: 12px; font-weight: 800; letter-spacing: 1.5px;
      text-transform: uppercase; color: #8A8078;
      border-bottom: 2px solid #E0D8CC; padding-bottom: 4px;
      margin: 22px 0 12px 0;
    }

    /* Metrics */
    .grid-table {
      width: 100%; table-layout: fixed;
      border-collapse: separate; border-spacing: 6px; margin-bottom: 8px;
    }
    .metric-td {
      background: #fff; border: 1px solid #E0D8CC; border-radius: 8px;
      padding: 10px 4px; text-align: center; vertical-align: middle;
    }
    .metric-val { font-size: 15px; font-weight: 800; color: #BF9A40; white-space: nowrap; }
    .metric-label {
      font-size: 9px; font-weight: 700; color: #8A8078;
      text-transform: uppercase; margin-top: 3px; white-space: nowrap;
    }

    /* Cards & tables */
    .card {
      background: #fff; border: 1px solid #E0D8CC; border-radius: 8px;
      padding: 12px; margin-bottom: 12px;
    }
    .card-title {
      font-size: 13px; font-weight: 800; color: #BF9A40; margin-bottom: 8px;
    }
    .badge {
      font-size: 11px; font-weight: 600; color: #8A8078; margin-left: 6px;
    }
    .inner-table { width: 100%; border-collapse: collapse; }
    .inner-table tr { border-top: 1px solid #F0EAE1; }
    .td-desc { padding: 6px; font-size: 12px; color: #2C2820; }
    .td-time {
      padding: 6px; font-size: 11px; color: #8A8078;
      text-align: right; white-space: nowrap;
    }

    .data-table {
      width: 100%; border-collapse: collapse; background: #fff;
      border: 1px solid #E0D8CC; border-radius: 10px; overflow: hidden;
      margin-bottom: 12px;
    }
    .data-table th {
      background: #F5EDD8; color: #4A4540; padding: 10px;
      font-size: 10px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1px; text-align: left;
    }
    .data-table td {
      padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #E0D8CC;
    }
    .td-strong { font-weight: 600; }
    .td-center { text-align: center; font-weight: 700; }
    .amber { color: #D4860A; }
    .green { color: #3DAA6A; }

    /* Alerts */
    .alert-box { border-radius: 8px; padding: 14px; margin-top: 8px; }
    .alert-warn { background: #FFF4E0; border-left: 5px solid #D4860A; }
    .alert-danger { background: #FDEAEA; border-left: 5px solid #D94F4F; }
    .alert-info { background: #EEF3FC; border-left: 5px solid #2D6BE4; }
    .alert-title { font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
    .alert-title.warn { color: #D4860A; }
    .alert-title.danger { color: #D94F4F; }
    .alert-title.info { color: #2D6BE4; }
    .alert-desc { font-size: 12px; margin: 0; line-height: 1.45; word-break: break-word; }
    .alert-list {
      margin: 6px 0 0 0; padding-left: 20px;
      font-size: 12px; line-height: 1.55; color: #2C2820; word-break: break-word;
    }
    .time-badge { color: #8A8078; font-weight: 700; font-size: 11px; }
    .empty { font-size: 12px; color: #8A8078; font-style: italic; }
    .ok-line { font-size: 12px; color: #3DAA6A; font-weight: 600; }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table no-split">
    <tr>
      <td>
        <div class="brand-title">Vitanova Integralis — Telemetría Vital</div>
        <h1 class="main-title">Reporte Clínico de Turno</h1>
        <div class="meta-info">
          <strong>Paciente:</strong> ${nombrePaciente}<br/>
          <strong>Cuidador:</strong> ${c.nombre_cuidador ?? 'Personal Vitanova'}<br/>
          <strong>Consolidación:</strong> ${fechaCons}<br/>
          <strong>Estado general:</strong>
          <span style="font-weight:800;color:${colorEstado(c.estado_paciente)}">
            ${(c.estado_paciente || 'Normal').toUpperCase()}
          </span>
        </div>
      </td>
      ${
        logoBase64
          ? `<td style="width:130px;text-align:right">
               <img class="header-logo" src="${logoBase64}" alt="Logo" />
             </td>`
          : ''
      }
    </tr>
  </table>

  <!-- Signos vitales -->
  <div class="no-split">
    <div class="section-title">Signos vitales</div>
    <table class="grid-table">
      <tr>
        <td class="metric-td" style="width:20%">
          <div class="metric-val">${c.spo2 ? `${c.spo2}%` : '—'}</div>
          <div class="metric-label">SpO₂</div>
        </td>
        <td class="metric-td" style="width:20%">
          <div class="metric-val">${
            c.presion_sistolica && c.presion_diastolica
              ? `${Math.round(c.presion_sistolica)}/${Math.round(c.presion_diastolica)}`
              : '—'
          }</div>
          <div class="metric-label">Presión</div>
        </td>
        <td class="metric-td" style="width:20%">
          <div class="metric-val">${c.frecuencia_cardiaca ?? '—'}</div>
          <div class="metric-label">Pulso</div>
        </td>
        <td class="metric-td" style="width:20%">
          <div class="metric-val">${c.temperatura ? `${c.temperatura}°C` : '—'}</div>
          <div class="metric-label">Temp.</div>
        </td>
        <td class="metric-td" style="width:20%">
          <div class="metric-val">${c.peso_kg ? `${c.peso_kg} kg` : '—'}</div>
          <div class="metric-label">Peso</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Alertas -->
  <div class="no-split">
    <div class="section-title">Alertas clínicas</div>
    ${htmlAlertas}
  </div>

  ${htmlConfort}

  <!-- Actividades -->
  <div class="no-split">
    <div class="section-title">Actividades por responsable</div>
    ${htmlDesglose}
  </div>

  <!-- Inventario -->
  <div class="no-split">
    <div class="section-title">Inventario y equipos</div>
    ${htmlInsumos}
    ${htmlEquipos}
  </div>

  ${htmlObservaciones}

</body>
</html>`;

  // ── 6. GENERAR Y COMPARTIR ───────────────────────────────
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const nombreSanitizado = (nombrePaciente || 'paciente')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/\s+/g, '_');
    const targetPath = `${documentDirectory}reporte_clinico_${nombreSanitizado}.pdf`;

    await moveAsync({ from: uri, to: targetPath });
    await Sharing.shareAsync(targetPath, {
      mimeType: 'application/pdf',
      dialogTitle: `Reporte clínico — ${nombrePaciente}`,
    });
  } catch (e) {
    console.error('❌ PDF:', e);
    Alert.alert('Error de impresión', 'No se pudo generar el reporte clínico.');
  }
};

  // 📲 MENSAJE ESTRUCTURADO Y COMPLETO PARA WHATSAPP
  const compartirPorWhatsApp = (c: any) => {
    const desglosePersonas = c?.desglose_por_persona || [];
    const inventarioUsado = c?.inventario_usado || [];
    const alertasClinicas = c?.alertas_clinicas || c?.alertas || [];
    const notasTurno = c?.notas_turno || [];

    // 🎯 1. Detección dinámica de Emoji y Nombre de Estado
    const estadoRaw = String(c?.estado_paciente || 'bien').toLowerCase();
    const emojiEstado = estadoRaw === 'bien' ? '🟢' : estadoRaw === 'preocupante' ? '🔴' : '🟡';
    const labelEstado = estadoRaw === 'bien' ? 'ESTABLE' : estadoRaw === 'preocupante' ? 'CRÍTICO / ALERTA' : 'REGULAR';

    // 🎯 2. Nombre del cuidador asignado al cierre
    const nombreCuidador = c?.nombre_cuidador || c?.usuarios?.nombre_completo || 'Personal Vitanova';

    // 🎯 3. Bloque de Alertas Clínicas y Fallas de Equipo
    let textoAlertas = "";
    if (alertasClinicas.length > 0) {
      textoAlertas = `🚨 *ALERTAS CLÍNICAS Y EVENTOS (${alertasClinicas.length}):*\n`;
      alertasClinicas.forEach((alt: any) => {
        const esFalla = alt.tipo === 'fallo_equipo' || String(alt.descripcion || alt.mensaje || '').includes('FALLA DE EQUIPO');
        const icono = esFalla ? '♿ ⚠️' : '⚠️';
        textoAlertas += `   ${icono} ${alt.descripcion || alt.mensaje}\n`;
      });
      textoAlertas += "\n";
    }

    // 🎯 4. Bloque de Actividades Desglosadas por Responsable
    let textoPersonas = "";
    if (desglosePersonas.length === 0) {
      textoPersonas = "Sin actividades registradas en este turno.\n\n";
    } else {
      desglosePersonas.forEach((g: any) => {
        textoPersonas += `👤 *${g.persona}* (${g.tareas.length} actividades):\n`;
        g.tareas.forEach((t: any) => {
          const hora = t.hora_completada 
            ? (typeof formatHora === 'function' ? formatHora(t.hora_completada) : t.hora_completada) 
            : '';
          const horaStr = hora ? `[${hora}] ` : '';
          textoPersonas += `   • ${horaStr}${t.descripcion}\n`;
        });
        textoPersonas += "\n";
      });
    }

    // 🎯 5. Bloque de Insumos Consumibles vs. Equipos/Activos Fijos
    const consumibles = inventarioUsado.filter((inv: any) => inv.es_consumible !== false && inv.tipo !== 'otro');
    const equipos = inventarioUsado.filter((inv: any) => inv.es_consumible === false || inv.tipo === 'otro');

    let textoInventario = "*📦 Insumos Consumidos en Turno:*\n";
    if (consumibles.length === 0) {
      textoInventario += "   • No se registraron consumos de insumos.\n";
    } else {
      consumibles.forEach((inv: any) => {
        const gastado = inv.usado_hoy ?? inv.cantidad_usada ?? 0;
        const restante = inv.stock_restante ?? inv.cantidad ?? '—';
        textoInventario += `   • *${inv.nombre}*: -${gastado} ${inv.unidad || 'piezas'} | *Stock restante: ${restante}*\n`;
      });
    }

    if (equipos.length > 0) {
      textoInventario += "\n*♿ Estatus de Equipos del Hogar:*\n";
      equipos.forEach((eq: any) => {
        const tieneFalla = String(eq.notas || '').includes('FALLA');
        textoInventario += `   • *${eq.nombre}*: ${tieneFalla ? `⚠️ ${eq.notas}` : '✅ Operativo'}\n`;
      });
    }

    // 🎯 6. Bloque de Notas Clínicas de Evolución
    let textoNotasEvolucion = "";
    if (notasTurno.length > 0) {
      textoNotasEvolucion = `\n📝 *NOTAS CLÍNICAS DE EVOLUCIÓN:*\n`;
      notasTurno.forEach((n: any) => {
        const hora = n.hora_completada ? (typeof formatHora === 'function' ? formatHora(n.hora_completada) : n.hora_completada) : '';
        const horaStr = hora ? `[${hora}] ` : '';
        textoNotasEvolucion += `   • ${horaStr}${String(n.descripcion || '').replace('📝 ', '')}\n`;
      });
    }

    // 🎯 7. Ensamblado del Mensaje Final
    const pNombre = typeof pacienteNombre !== 'undefined' ? pacienteNombre : 'Paciente Vitanova';
    const fechaFormatted = typeof formatFecha === 'function' ? formatFecha(c.created_at) : c.created_at;

    const mensaje = 
      `📋 *REPORTE CLINICO DE TURNO*\n` +
      `🏥 *Vitanova Integralis*\n` +
      `─────────────────────────────\n` +
      `👤 Paciente: *${pNombre}*\n` +
      `🧑‍⚕️ Responsable: *${nombreCuidador}*\n` +
      `📅 Fecha: ${fechaFormatted}\n` +
      `${emojiEstado} Estado General: *${labelEstado}*\n\n` +

      `🩺 *SIGNOS VITALES:*\n` +
      `• SpO₂: *${c.spo2 ?? '—'}%*\n` +
      `• Presión Arterial: *${c.presion_sistolica ?? '—'}/${c.presion_diastolica ?? '—'} mmHg*\n` +
      `• Pulso: *${c.frecuencia_cardiaca ?? '—'} bpm*\n` +
      `• Temperatura: *${c.temperatura ?? '—'} °C*\n` +
      `• Peso: *${c.peso_kg ?? '—'} kg*\n\n` +

      `${textoAlertas}` +

      (c.dolor_eva !== null && c.dolor_eva !== undefined ? 
        `🛋️ *CONFORT Y NUTRICIÓN:*\n` +
        `• Dolor (EVA): *${c.dolor_eva}/10*\n` +
        `• Estado de Ánimo: *${c.estado_animo ?? '—'}*\n` +
        `• Hidratación: *${c.hidratacion_vasos ?? '0'} vasos*\n` +
        `• Alimentación: *${c.alimentacion ?? '—'}*\n\n` : '') +

      `─────────────────────────────\n` +
      `✅ *ACTIVIDADES REALIZADAS*\n\n` +
      `${textoPersonas}` +

      `─────────────────────────────\n` +
      `📦 *CONTROL DE INVENTARIO Y EQUIPOS*\n\n` +
      `${textoInventario}` +

      `${textoNotasEvolucion}` +

      (c.observaciones ? `\n🚨 *OBSERVACIONES ESPECIALES:*\n${c.observaciones}\n` : '') +
      `\n_Consolidación de Telemetría Clínica Vitanova App_`;

    // Disparo a WhatsApp
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(mensaje)}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp en este dispositivo.');
    });
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
             {/* 🚨 SECCIÓN DE ALERTAS CLÍNICAS Y EVENTOS OPERATIVOS CON HORARIO */}
              {(() => {
                const todasAlertas = cierreSeleccionado?.alertas_clinicas || [];

                // Helper para formatear la hora (ej: 09:30 a.m.)
                const obtenerHoraTexto = (item: any) => {
                  const rawFecha = item.created_at || item.timestamp || item.hora;
                  if (!rawFecha) return '';
                  
                  try {
                    if (typeof rawFecha === 'string' && rawFecha.length <= 8 && rawFecha.includes(':')) {
                      return `[${rawFecha}] `;
                    }
                    const fechaObj = new Date(rawFecha);
                    if (isNaN(fechaObj.getTime())) return '';

                    const horaFormateada = fechaObj.toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                    return `[${horaFormateada}] `;
                  } catch {
                    return '';
                  }
                };

                // 🎯 1. Filtro Blindado: Eventos Operativos (Turnos, Inicios, Cierres, Relevos, Cuidador)
                const eventosTurno = todasAlertas.filter((a: any) => {
                  // Unimos todos los campos posibles y quitamos acentos
                  const textoCompleto = `
                    ${a.tipo || ''} 
                    ${a.categoria || ''} 
                    ${a.descripcion || ''} 
                    ${a.mensaje || ''} 
                    ${a.titulo || ''}
                  `.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                  return (
                    textoCompleto.includes('turno') ||
                    textoCompleto.includes('cuidador') ||
                    textoCompleto.includes('entrada') ||
                    textoCompleto.includes('salida') ||
                    textoCompleto.includes('inicio') ||
                    textoCompleto.includes('cierre') ||
                    textoCompleto.includes('relevo') ||
                    textoCompleto.includes('check-in') ||
                    textoCompleto.includes('checkin')
                  );
                });

                // 🎯 2. Filtro: Alertas Clínicas Reales (Cualquiera que NO sea evento operativo)
                const alertasClinicas = todasAlertas.filter((a: any) => !eventosTurno.includes(a));

                return (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {/* 🚨 1. SECCIÓN ROJA: ALERTAS Y PICOS CLÍNICOS */}
                    {alertasClinicas.length > 0 && (
                      <View style={{ backgroundColor: COLORS.redPale || '#FDEAEA', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F5C6C6' }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.red || '#D94F4F', marginBottom: 6 }}>
                          🚨 Alertas y Picos Clínicos Registrados ({alertasClinicas.length})
                        </Text>
                        {alertasClinicas.map((alt: any, idx: number) => {
                          const horaStr = obtenerHoraTexto(alt);
                          return (
                            <Text key={`clinica-${alt.id || idx}`} style={{ fontSize: 12, color: COLORS.cacao || '#4A4540', marginBottom: 4 }}>
                              • <Text style={{ fontWeight: '700' }}>{horaStr}</Text>{alt.descripcion || alt.mensaje || alt.titulo}
                            </Text>
                          );
                        })}
                      </View>
                    )}

                    {/* 🚪 2. SECCIÓN AZUL: REGISTROS DE ENTRADA, SALIDA Y TURNOS CON HORARIO */}
                    {eventosTurno.length > 0 && (
                      <View style={{ backgroundColor: '#E3F2FD', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BBDEFB' }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1565C0', marginBottom: 6 }}>
                          🚪 Registros de Entrada, Salida y Turnos ({eventosTurno.length})
                        </Text>
                        {eventosTurno.map((evt: any, idx: number) => {
                          const horaStr = obtenerHoraTexto(evt);
                          return (
                            <Text key={`turno-${evt.id || idx}`} style={{ fontSize: 12, color: '#0D47A1', marginBottom: 4 }}>
                              • <Text style={{ fontWeight: '700' }}>{horaStr}</Text>{evt.descripcion || evt.mensaje || evt.titulo}
                            </Text>
                          );
                        })}
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
  // ── 1. ESTRUCTURA Y CONTENEDORES BASE ──
  container: { 
    flex: 1, 
    backgroundColor: COLORS.cream 
  },
  body: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },

  // ── 2. ENCABEZADO ESTANDARIZADO (CACAO + DORADOS) ──
  header: { 
    backgroundColor: COLORS.cacao, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 38) : 52, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    flexDirection: 'row', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3530',
  },
  greeting: { 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1, 
    textTransform: 'uppercase', 
    color: COLORS.gold, 
    marginBottom: 2 
  },
  userName: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.white 
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  backIcon: { 
    fontSize: 18, 
    color: COLORS.white,
    fontWeight: 'bold' 
  },

  // ── 3. TARJETAS DE HISTORIAL Y CIERRES ──
  emptyCard: { 
    backgroundColor: COLORS.white, 
    borderRadius: 14, 
    padding: 32, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  cierreCard: { 
    backgroundColor: COLORS.white, 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cierreHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    gap: 10, 
    marginBottom: 12 
  },
  cierreNombreCuidador: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.textDark 
  },
  cierreFecha: { 
    fontSize: 10, 
    color: COLORS.textLight, 
    marginTop: 2,
    fontWeight: '600'
  },
  estadoPill: { 
    borderRadius: 20, 
    paddingHorizontal: 10, 
    paddingVertical: 4 
  },
  estadoPillText: { 
    fontSize: 10, 
    fontWeight: '800' 
  },

  // ── 4. SIGNOS VITALES DEL REGISTRO ──
  signosRow: { 
    flexDirection: 'row', 
    gap: 4, 
    marginBottom: 10 
  },
  signoItem: { 
    flex: 1, 
    backgroundColor: COLORS.cream, 
    borderRadius: 8, 
    paddingVertical: 8, 
    paddingHorizontal: 2, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border + '60'
  },
  signoVal: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: COLORS.gold, 
    textAlign: 'center' 
  },
  signoLabel: { 
    fontSize: 9, 
    color: COLORS.textLight, 
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase'
  },

  // ── 5. SECCIÓN DE TAREAS Y NOTAS CLINICAS ──
  tareasSection: { 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    paddingTop: 10, 
    marginTop: 8 
  },
  notasSection: { 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    paddingTop: 10, 
    marginTop: 10 
  },
  tareasSectionTitle: { 
    fontSize: 9, 
    fontWeight: '800', 
    letterSpacing: 1, 
    textTransform: 'uppercase', 
    color: COLORS.cacao, 
    marginBottom: 8 
  },
  tareaItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 6 
  },
  tareaItemIcon: { 
    fontSize: 14 
  },
  tareaItemText: { 
    flex: 1, 
    fontSize: 12, 
    fontWeight: '600', 
    color: COLORS.textDark 
  },
  tareaItemHora: { 
    fontSize: 10, 
    color: COLORS.textLight,
    fontWeight: '600'
  },
  notaItem: { 
    backgroundColor: COLORS.amberPale, 
    borderColor: COLORS.border, 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 10, 
    marginTop: 4 
  },
  escalaRow: { 
    flexDirection: 'row', 
    gap: 8, 
    alignItems: 'center' 
  },
  escalaLabel: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: COLORS.textDark, 
    minWidth: 80 
  },
  escalaVal: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    flex: 1 
  },
});