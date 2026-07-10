import DateTimePicker from '@react-native-community/datetimepicker';
import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

 
  // ── 🎯 CONTROL DE FILTRADO SEGURO DE EMERGENCIA ──
  
  // Extraemos los nombres reales. Si todos vienen vacíos, dejamos la lista vacía para no generar burbujas falsas
  const cuidadoresDisponibles = Array.from(
    new Set(cierres.map(c => c.nombre_cuidador || c.cuidador_nombre || '').filter(nombre => nombre !== ''))
  );

  const cierresFiltrados = cierres.filter(c => {
    // 1. Filtrado de fecha seguro
    let coincideFecha = true;
    if (filtroFecha !== '') {
      const fechaRegistro = c.fecha || c.created_at || '';
      coincideFecha = fechaRegistro.includes(filtroFecha);
    }
    
    // 2. Filtrado de cuidador seguro
    let coincideCuidador = true;
    // Solo filtramos por nombre si el filtro no es 'todos' Y si el registro tiene un nombre real
    if (filtroCuidador !== 'todos') {
      const nombreReal = c.nombre_cuidador || c.cuidador_nombre || '';
      coincideCuidador = (nombreReal === filtroCuidador);
    }
    
    return coincideFecha && coincideCuidador;
  });

  

  const [showCalendar, setShowCalendar] = useState(false);
  const [fechaObjeto, setFechaObjeto] = useState(new Date());
  const cierreSeleccionado = cierresFiltrados[indice];

  // Mapeo estático de íconos para evitar colisiones de contexto
  const ICONOS_TIPO: Record<string, string> = {
    medicamento: '💊',
    rutina: '🚶',
    control: '📋'
  };

  // ── 4. EFFECT DE CARGA (IDÉNTICO) ──
  useEffect(() => {
    const cargar = async () => {
      try {
        const token = await loadStoredToken();
        if (!token) { router.replace('/login'); return; }
        const res = await fetch(
          `${BASE_URL}/pacientes/${pacienteId}/historial-cierres?limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.cierres) {
          // 🚨 ESTA LÍNEA ES PARA ESPIAR EL OBJETO EN LA TERMINAL:
          console.log("🔍 JEFE, ASÍ SE VE UN REGISTRO REAL:", data.cierres[0]);
          
          setCierres(data.cierres);
        }
      } catch (e) {
        console.error("❌ Error recuperando historial:", e);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [pacienteId]);
  
  const generarPDF = async (c: any) => {
    // 🎯 1. LEER EL LOGO NATIVO AUTOMÁTICAMENTE Y PASARLO A BASE64
    let logoBase64 = "";
    try {
      // Cargamos el módulo de la imagen desde tus carpetas de assets
      const asset = Asset.fromModule(require('../assets/images/logo.png'));
      await asset.downloadAsync(); // Aseguramos disponibilidad en el caché local
      
      if (asset.localUri) {
        // Leemos el binario y lo transformamos en texto codificado Base64 en tiempo real
        const base64Raw = await readAsStringAsync(asset.localUri, { encoding: 'base64' });
        logoBase64 = `data:image/png;base64,${base64Raw}`;
      }
    } catch (err) {
      console.error("⚠️ No se pudo procesar el logo para el PDF, se generará sin él:", err);
    }

    // 🎯 2. CLASIFICACIÓN DE TAREAS Y NOTAS (Mantiene tu validación existente)
    const tareasTrabajo = ((c?.tareas || []) as any[]).filter((t: any) => !(t.descripcion || '').startsWith('📝'));
    const notasTurno = ((c?.tareas || []) as any[]).filter((t: any) => (t.descripcion || '').startsWith('📝'));

    // Generamos las filas de la tabla de actividades planificadas de forma dinámica
    const filasActividades = tareasTrabajo.map((t: any) => `
      <tr style="border-bottom: 1px solid #E0D8CC;">
        <td style="padding: 10px; font-size: 13px; font-weight: 600; color: #2C2820;">
          ${t.tipo === 'medicamento' ? '💊' : t.tipo === 'rutina' ? '🚶' : '📋'} ${t.descripcion}
        </td>
        <td style="padding: 10px; font-size: 13px; text-align: center;">
          ${t.completada ? '<span style="color: #3DAA6A; font-weight: 800;">✓ Completada</span>' : '<span style="color: #8A8078;">⏳ Pendiente</span>'}
        </td>
        <td style="padding: 10px; font-size: 13px; color: #8A8078; text-align: center;">
          ${t.hora_completada ? formatHora(t.hora_completada) : '—'}
        </td>
      </tr>
    `).join('');

    // 🎯 3. ARQUITECTURA DEL HTML COMPLETO CON DISEÑO SIMÉTRICO Y CONDICIONALES
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #2C2820; background-color: #FAFAF7; }
          
          /* Contenedor Flexbox para alinear texto a la izquierda y el logotipo a la derecha */
          .header-container { 
            background-color: #4A4540; 
            padding: 24px; 
            border-radius: 14px; 
            color: #FFFFFF; 
            margin-bottom: 25px; 
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-text { flex: 1; }
          /* 🎯 Incrementamos el tamaño del logo y ajustamos su centrado */
          .header-logo { 
            width: 140px;          /* Subimos de 95px a 140px para que destaque */
            height: auto; 
            margin-left: 20px; 
            object-fit: contain; 
            max-height: 120px;     /* Ponemos un tope para que no sature el contenedor */
          }

          .brand-title { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #BF9A40; margin-bottom: 4px; }
          .main-title { font-size: 24px; font-weight: 800; margin: 0; padding-bottom: 4px; }
          .meta-info { font-size: 13px; color: #E0D8CC; margin-top: 8px; line-height: 1.6; }
          
          .section-title { font-size: 14px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #8A8078; margin-top: 30px; margin-bottom: 12px; border-bottom: 2px solid #E0D8CC; padding-bottom: 6px; }
          
          .grid-container { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
          .metric-card { flex: 1; min-width: 130px; background-color: #FFFFFF; border: 1px solid #E0D8CC; border-radius: 10px; padding: 12px; text-align: center; }
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

        <div class="header-container">
          <div class="header-text">
            <div class="brand-title">Vitanova Integralis — Telemetría Vital</div>
            <h1 class="main-title">Reporte Clínico de Turno</h1>
            <div class="meta-info">
              <strong>Paciente:</strong> ${pacienteNombre}<br/>
              <strong>Especialista/Cuidador:</strong> ${c.usuarios?.nombre_completo ?? 'Personal Vitanova'}<br/>
              <strong>Fecha de Consolidación:</strong> ${formatFecha(c.created_at)}<br/>
              <strong>Estado General Dictado:</strong> <span style="font-weight: 800; color: ${c.estado_paciente === 'bien' ? '#3DAA6A' : '#D94F4F'};">${c.estado_paciente?.toUpperCase()}</span>
            </div>
          </div>
          
          ${logoBase64 ? `<img class="header-logo" src="${logoBase64}" alt="Logo Vitanova" />` : ''}
        </div>

        <div class="section-title">Signos Vitales Consolidados</div>
        <div class="grid-container">
          <div class="metric-card"><div class="metric-val">${c.spo2 ? `${c.spo2}%` : '—'}</div><div class="metric-label">SpO₂</div></div>
          <div class="metric-card"><div class="metric-val">${c.presion_sistolica && c.presion_diastolica ? `${Math.round(c.presion_sistolica)}/${Math.round(c.presion_diastolica)}` : '—'}</div><div class="metric-label">Presión (mmHg)</div></div>
          <div class="metric-card"><div class="metric-val">${c.frecuencia_cardiaca ? `${c.frecuencia_cardiaca}` : '—'}</div><div class="metric-label">Pulso (bpm)</div></div>
          <div class="metric-card"><div class="metric-val">${c.temperatura ? `${c.temperatura}°C` : '—'}</div><div class="metric-label">Temperatura</div></div>
          <div class="metric-card"><div class="metric-val">${c.peso_kg ? `${c.peso_kg} kg` : '—'}</div><div class="metric-label">Peso</div></div>
        </div>

        ${c.dolor_eva !== null && c.dolor_eva !== undefined ? `
          <div class="section-title">Evaluación de Confort Diario</div>
          <div class="grid-container">
            <div class="metric-card" style="border-top: 3px solid ${c.dolor_eva > 4 ? '#D94F4F' : '#3DAA6A'};"><div class="metric-val">${c.dolor_eva}/10</div><div class="metric-label">Dolor (EVA)</div></div>
            <div class="metric-card"><div class="metric-val" style="text-transform: capitalize;">${c.estado_animo ?? '—'}</div><div class="metric-label">Estado de Ánimo</div></div>
            <div class="metric-card"><div class="metric-val">${c.hidratacion_vasos ?? '0'} 💧</div><div class="metric-label">Hidratación</div></div>
            <div class="metric-card"><div class="metric-val" style="text-transform: capitalize;">${c.alimentacion ?? '—'}</div><div class="metric-label">Alimentación</div></div>
          </div>
        ` : ''}

        ${tareasTrabajo.length > 0 ? `
          <div class="section-title">Cronograma de Actividades and Controles</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 55%;">Descripción de la Tarea</th>
                <th style="width: 25%; text-align: center;">Estatus</th>
                <th style="width: 20%; text-align: center;">Hora Ejecución</th>
              </tr>
            </thead>
            <tbody>
              ${filasActividades}
            </tbody>
          </table>
        ` : ''}

        ${c.observaciones || notasTurno.length > 0 || c.notes_consolidated ? `
          <div class="section-title">Observaciones Especiales y Alertas</div>
          
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
        ` : ''}

      </body>
      </html>
    `;

    // 🎯 4. PROCESO DE RENDERIZADO, RENOMBRADO FORMAL Y COMPARTIR
    try {
      // Impresión a archivo temporal
      const { uri } = await Print.printToFileAsync({ html });
      
      // Sanitizamos el nombre real de la paciente de forma estricta
      const nombreSanitizado = (pacienteNombre || 'paciente')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Limpia acentos de español
        .replace(/[^a-zA-Z0-9_]/g, '') // Elimina caracteres especiales
        .replace(/\s+/g, '_'); // Reemplaza espacios por guiones bajos

      // Creamos la ruta de destino nítida
      const targetPath = `${documentDirectory}reporte_clinico_${nombreSanitizado}.pdf`;

      // Mudamos el archivo al búnker final con su nombre correcto
      await moveAsync({ 
        from: uri, 
        to: targetPath 
      });

      console.log("📥 PDF Clínico renombrado con éxito en:", targetPath);

      // Lanzamos la ventana nativa de compartir
      await Sharing.shareAsync(targetPath, { 
        mimeType: 'application/pdf',
        dialogTitle: `Reporte Clínico de Turno — ${pacienteNombre}`
      });

    } catch (e) {
      console.error("❌ Error imprimiendo o renombrando el archivo PDF:", e);
      Alert.alert("Error de Impresión", "Hubo un fallo al compilar el reporte clínico.");
    }
  };

  const compartirPorWhatsApp = (c: any) => {
    const texto = `📋 *Reporte de Turno — ${pacienteNombre}*\n\n` +
      `👤 Cuidador: ${c.usuarios?.nombre_completo ?? 'Personal Vitanova'}\n` +
      `📅 Fecha: ${formatFecha(c.created_at)}\n` +
      `😊 Estado: ${c.estado_paciente}\n\n` +
      `*Signos Vitales:*\n` +
      `SpO₂: ${c.spo2 ?? '—'}% | PA: ${c.presion_sistolica ?? '—'}/${c.presion_diastolica ?? '—'} | FC: ${c.frecuencia_cardiaca ?? '—'} bpm\n` +
      `Temp: ${c.temperatura ?? '—'}°C | Peso: ${c.peso_kg ?? '—'} kg\n\n` +
      (c.dolor_eva !== null && c.dolor_eva !== undefined ? `*Confort:*\nDolor: ${c.dolor_eva}/10 | Ánimo: ${c.estado_animo ?? '—'} | Hidratación: ${c.hidratacion_vasos ?? '—'} vasos\n\n` : '') +
      (c.observaciones ? `*Observaciones:* ${c.observaciones}\n` : '') +
      (c.notas ? `*Notes:* ${c.notas}\n` : '');
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(texto)}`);
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

  // Separación segura de tareas (protegida contra nulos si el turno viene vacío)
  const tareasTrabajo = cierreSeleccionado?.tareas ? cierreSeleccionado.tareas.filter((t: any) => !t.es_incidental) : [];
  const notasTurno = cierreSeleccionado?.tareas ? cierreSeleccionado.tareas.filter((t: any) => t.es_incidental) : [];
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cacao} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>HISTORIAL DE TURNOS</Text>
          <Text style={styles.userName}>{pacienteNombre}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {!tieneRegistrosBase ? (
          /* CASO 1: Sin historial clínico registrado en la BD de Vitanova */
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center' }}>
              Sin registros de turnos anteriores
            </Text>
          </View>
        ) : !tieneRegistrosFiltrados ? (
          /* CASO 2: Sí hay cierres, pero ninguno coincide con la fecha/cuidador seleccionados */
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
          /* CASO 3: Todo perfecto, pintamos la tarjeta del reporte vital */
          <View>
            {/* 🎯 NAVEGADOR MULTI-TURNO INTERACTIVO */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setIndice(Math.min(indice + 1, cierresFiltrados.length - 1))}
                disabled={indice >= cierresFiltrados.length - 1}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 28, color: indice >= cierresFiltrados.length - 1 ? COLORS.border : COLORS.gold }}>{'‹'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setModalVisible(true)}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textDark }}>
                  {`Turno ${indice + 1} de ${cierresFiltrados.length}`}
                </Text>
                <Text style={{ fontSize: 10, color: COLORS.gold, fontWeight: '600', textDecorationLine: 'underline' }}>
                  {cierreSeleccionado?.fecha 
                    ? new Date(cierreSeleccionado.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) 
                    : 'Filtrar Fecha 📅'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIndice(Math.max(indice - 1, 0))}
                disabled={indice <= 0}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 28, color: indice <= 0 ? COLORS.border : COLORS.gold }}>{'›'}</Text>
              </TouchableOpacity>
            </View>

            {/* ACCIONES COMPARTIR */}
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

            {/* TARJETA DE REPORTE VITAL VITANOVA */}
            <View style={styles.cierreCard}>
              <View style={styles.cierreHeader}>
                <Text style={{ fontSize: 28 }}>
                  {cierreSeleccionado?.estado_paciente === 'bien' ? '😊' : cierreSeleccionado?.estado_paciente === 'preocupante' ? '😟' : '😐'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cierreNombreCuidador}>{cierreSeleccionado?.nombre_cuidador ?? 'Personal Vitanova'}</Text>
                  <Text style={styles.cierreFecha}>{formatFecha(cierreSeleccionado?.created_at)}</Text>
                </View>
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

              {/* MATRIZ DE SIGNOS VITALES */}
              <View style={styles.signosRow}>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{cierreSeleccionado?.spo2 ? `${cierreSeleccionado.spo2}%` : '—'}</Text><Text style={styles.signoLabel}>SpO₂</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{cierreSeleccionado?.presion_sistolica && cierreSeleccionado?.presion_diastolica ? `${Math.round(cierreSeleccionado.presion_sistolica)}/${Math.round(cierreSeleccionado.presion_diastolica)}` : '—'}</Text><Text style={styles.signoLabel}>Presión</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{cierreSeleccionado?.frecuencia_cardiaca ? `${cierreSeleccionado.frecuencia_cardiaca}` : '—'}</Text><Text style={styles.signoLabel}>FC bpm</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{cierreSeleccionado?.temperatura ? `${cierreSeleccionado.temperatura}°C` : '—'}</Text><Text style={styles.signoLabel}>Temp</Text></View>
                <View style={styles.signoItem}><Text style={styles.signoVal}>{cierreSeleccionado?.peso_kg ? `${cierreSeleccionado.peso_kg} kg` : '—'}</Text><Text style={styles.signoLabel}>Peso</Text></View>
              </View>

              {/* PARÁMETROS DE CONFORT LOGÍSTICO */}
              {(cierreSeleccionado?.dolor_eva !== null && cierreSeleccionado?.dolor_eva !== undefined || cierreSeleccionado?.estado_animo || cierreSeleccionado?.hidratacion_vasos || cierreSeleccionado?.alimentacion || cierreSeleccionado?.observaciones) ? (
                <View style={styles.tareasSection}>
                  <Text style={styles.tareasSectionTitle}>{'REGISTRO DE CONFORT'}</Text>
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

              {/* BLOQUE DE TAREAS PLANIFICADAS */}
              {tareasTrabajo.length > 0 ? (
                <View style={styles.tareasSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.tareasSectionTitle}>ACTIVIDADES PLANIFICADAS</Text>
                    <Text style={[styles.tareasSectionTitle, { color: COLORS.green }]}>
                      {`${tareasTrabajo.filter((t: any) => t.completada).length}/${tareasTrabajo.length} completadas`}
                    </Text>
                  </View>
                  {tareasTrabajo.map((t: any, ti: number) => (
                    <View key={`trabajo-${ti}`} style={styles.tareaItem}>
                      <Text style={styles.tareaItemIcon}>{ICONOS_TIPO[t.tipo] ?? '📋'}</Text>
                      <Text style={[styles.tareaItemText, t.completada && { textDecorationLine: 'line-through', color: COLORS.textLight }]}>
                        {t.descripcion}
                      </Text>
                      {t.hora_completada ? <Text style={styles.tareaItemHora}>{formatHora(t.hora_completada)}</Text> : null}
                      {t.completada ? <Text style={{ color: COLORS.green, fontSize: 16 }}>{'✅'}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* SECCIÓN NOTAS EVOLUTIVAS */}
              {notasTurno.length > 0 ? (
                <View style={styles.notasSection}>
                  <Text style={[styles.tareasSectionTitle, { color: COLORS.amber }]}>NOTAS DEL TURNO</Text>
                  {notasTurno.map((n: any, ni: number) => (
                    <View key={`nota-${ni}`} style={styles.notaItem}>
                      <Text style={{ fontSize: 11, color: COLORS.textDark }}>
                        {String(n.descripcion || '').replace('📝 ', '')}
                      </Text>
                      {n.hora_completada ? (
                        <Text style={{ fontSize: 9, color: COLORS.textLight, marginTop: 4 }}>
                          {formatHora(n.hora_completada)}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* EVALUACIONES DE ESCALAS MÉDICAS */}
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

      {/* ── 🎯 MODAL DE FILTRADO SÚPER AVANZADO ── */}
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

      {/* 🚀 SELECTOR DE CALENDARIO NATIVO */}
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