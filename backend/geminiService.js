require('dotenv').config();
const fs = require('fs').promises;
const { GoogleGenAI } = require('@google/genai');
const { saveToGoogleSheets, getFromGoogleSheets } = require('./googleSheetsService');

// Obtiene la fecha y hora actual en formato DDMMAA:HHMM y DDMMAA-HHMMSS para filename
function getCurrentTimestamp() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const dd = pad(now.getDate());
  const mm = pad(now.getMonth() + 1);
  const aa = now.getFullYear().toString().slice(-2);
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return {
    campo: `${dd}/${mm}/${aa} ${hh}:${mi}`,
    archivo: `${dd}${mm}${aa}-${hh}${mi}${ss}`
  };
}

function detectarDisparador(history, prompt, eventoSesion = null) {
  if (eventoSesion === "fin_de_sesion") return "fin de sesión";
  if (prompt && prompt.trim() === "~resumen~") return "manual";
  return null;
}

function extractJsonFromMarkdown(text) {
  const regex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = text.match(regex);
  if (match) return match[1];
  return text;
}

function buildResumenPrompt(history, fechaCampo, disparador) {
  return `
Hoy es ${fechaCampo}. Esto te sirve para comparar las fechas de los resúmenes y cuándo se habló de cada tema.
Eres un asistente mentor experto. Resume la siguiente conversación entre mentor y usuario agrupando la información en los siguientes temas:

1. Objetivos (de salud física, lectura, aprendizaje de nuevas habilidades, o profesionales de su negocio)
2. Problemas (dificultades como no saber qué comunicar en su contenido, cómo hablarle a un cliente, qué vender, qué precio poner, etc.)
3. Soluciones a sus problemas (no des recomendaciones directas; describe sugerencias o preguntas que se hayan planteado)
4. Acciones pactadas (acciones concretas a realizar y, si existe, la fecha propuesta por el usuario)
5. Dudas o inquietudes (preguntas o preocupaciones del usuario)

Devuelve el resultado en formato JSON exactamente así:

{
  "fecha": "${fechaCampo}",
  "disparador": "${disparador}",
  "temas": {
    "Objetivos": "...",
    "Problemas": "...",
    "Soluciones": "...",
    "Acciones pactadas": "...",
    "Dudas o inquietudes": "..."
  }
}

Aquí está la conversación:

${history.map(m => `${m.role === 'user' ? 'Usuario' : 'Mentor'}: ${m.text}`).join('\n')}
`;
}

// Lee historial de Google Sheets
async function leerHistorial(ig_id) {
  const result = await getFromGoogleSheets({ tipo: 'historial', id_usuario: ig_id });
  console.log("[DEBUG] Resultado crudo getFromGoogleSheets (historial):", JSON.stringify(result, null, 2));
  if (!result.success || !Array.isArray(result.data)) return [];
  // El campo 'contenido' ya es objeto, pero por si acaso chequeamos tipo
  const history = result.data.map(row => {
    let contenido = row.contenido;
    if (typeof contenido === "string") {
      try { contenido = JSON.parse(contenido); } catch { contenido = {}; }
    }
    return {
      role: contenido.role,
      text: contenido.text
    };
  });
  console.log("[DEBUG] Historial parseado para ig_id", ig_id, ":", JSON.stringify(history, null, 2));
  return history;
}

// Guarda historial en Google Sheets
async function guardarHistorial(ig_id, history, mensajeNuevo) {
  // Guardamos solo el nuevo mensaje (ya que la hoja guarda cada mensaje como fila)
  const fecha = getCurrentTimestamp().campo;
  await saveToGoogleSheets({
    tipo: 'historial',
    id_usuario: ig_id,
    fecha,
    contenido: mensajeNuevo // {role, text}
  });
}

// Lee resúmenes de Google Sheets
async function leerResumenes(ig_id) {
  const result = await getFromGoogleSheets({ tipo: 'resumen', id_usuario: ig_id });
  console.log("[DEBUG] Resultado crudo getFromGoogleSheets (resumen):", JSON.stringify(result, null, 2));
  if (!result.success || !Array.isArray(result.data)) return [];
  const resumenes = result.data.map(row => {
    let contenido = row.contenido;
    if (typeof contenido === "string") {
      try { contenido = JSON.parse(contenido); } catch { contenido = {}; }
    }
    return contenido;
  });
  console.log("[DEBUG] Resúmenes parseados para ig_id", ig_id, ":", JSON.stringify(resumenes, null, 2));
  return resumenes;
}

// Guarda resumen en Google Sheets (EVITA guardar 'crudo')
async function guardarResumen(ig_id, resumenJson) {
  const fecha = resumenJson.fecha || getCurrentTimestamp().campo;
  // Clonamos el resumen sin el campo 'crudo', si existe
  const resumenSinCrudo = { ...resumenJson };
  delete resumenSinCrudo.crudo;
  await saveToGoogleSheets({
    tipo: 'resumen',
    id_usuario: ig_id,
    fecha,
    contenido: resumenSinCrudo
  });
}

// Lee contexto personalizado de Google Sheets
async function leerContextoUsuario(ig_id) {
  const result = await getFromGoogleSheets({ tipo: 'contexto', id_usuario: ig_id });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return "";
  // Devuelve solo el primer contexto que encuentra
  return result.data[0].contexto || "";
}

// Lee contexto base (desde archivo)
async function leerContextoBase() {
  try {
    return await fs.readFile(__dirname + "/data/context_base.txt", "utf8");
  } catch (e) {
    console.log("[DEBUG] No se pudo leer context_base.txt", e.message);
    return "";
  }
}

// -------------------- Lógica Gemini adaptada --------------------

async function resumirHistorial(ai, ig_id, history, disparador = "manual") {
  const { campo: fechaCampo } = getCurrentTimestamp();
  const resumenPrompt = buildResumenPrompt(history, fechaCampo, disparador);

  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: [],
    config: { systemInstruction: "" }
  });

  let response = await chat.sendMessage({ message: resumenPrompt });
  let resumenJson;
  let resumenCrudo = response.text;

  try {
    const cleanJson = extractJsonFromMarkdown(resumenCrudo);
    resumenJson = JSON.parse(cleanJson);
  } catch (e) {
    // Segundo intento: pedirle a Gemini que convierta SU texto a JSON, o ponga NO hablado
    const convertirPrompt = `
Convierte el siguiente texto a un JSON con el formato:
{
  "fecha": "${fechaCampo}",
  "disparador": "${disparador}",
  "temas": {
    "Objetivos": "...",
    "Problemas": "...",
    "Soluciones": "...",
    "Acciones pactadas": "...",
    "Dudas o inquietudes": "..."
  }
}
Si el texto no contiene información válida para algún tema, pon "NO hablado". Si el texto no tiene sentido o no es posible segmentarlo, pon "NO hablado" en todos los campos.

Texto a convertir:
${resumenCrudo}
    `;
    const conversion = await chat.sendMessage({ message: convertirPrompt });
    try {
      const cleanJson2 = extractJsonFromMarkdown(conversion.text);
      resumenJson = JSON.parse(cleanJson2);
    } catch (e2) {
      resumenJson = {
        fecha: fechaCampo,
        disparador,
        temas: {
          "Objetivos": "NO hablado",
          "Problemas": "NO hablado",
          "Soluciones": "NO hablado",
          "Acciones pactadas": "NO hablado",
          "Dudas o inquietudes": "NO hablado"
        }
      };
    }
  }

  if (!resumenJson.disparador) resumenJson.disparador = disparador;
  // NO agregamos el campo 'crudo' para evitar duplicidad/repetición

  // Guardar el resumen en Google Sheets SIN 'crudo'
  await guardarResumen(ig_id, resumenJson);
}

async function askGemini({ ig_id, prompt, eventoSesion = null }) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  let contextGeneral = "";
  let contextUsuario = "";
  try {
    contextGeneral = await fs.readFile(__dirname + "/data/context_base.txt", "utf8");
  } catch (e) {
    console.log("[DEBUG] No se pudo leer context_base.txt", e.message);
  }
  try {
    contextUsuario = await leerContextoUsuario(ig_id);
    if (contextUsuario) {
      console.log(`[DEBUG] Contexto usuario leído de Sheets para ig_id ${ig_id}:`, contextUsuario);
    } else {
      console.log(`[DEBUG] No se encontró contexto usuario en Sheets para ig_id ${ig_id}`);
    }
  } catch (e) {
    console.log(`[DEBUG] Error leyendo contexto usuario de Sheets para ig_id ${ig_id}:`, e.message);
  }

  // Leer historial desde Google Sheets
  let history = await leerHistorial(ig_id);

  // Leer resumen más reciente desde Google Sheets
  let resumenContext = "";
  try {
    const resumenes = await leerResumenes(ig_id);
    if (Array.isArray(resumenes) && resumenes.length > 0) {
      const resumen = resumenes[resumenes.length - 1];
      resumenContext = `\n\nResumen de sesiones previas (actualizado al ${resumen.fecha}):\n` +
        Object.entries(resumen.temas).map(([tema, texto]) => `- ${tema}: ${texto}`).join('\n');
    }
  } catch (e) {
    console.log("[DEBUG] Error leyendo resúmenes:", e.message);
  }

  // [DEBUG] Mostrar el historial que se pasará a Gemini
  console.log("[DEBUG] Historial FINAL antes de Gemini:", JSON.stringify(history, null, 2));

  const disparador = detectarDisparador(history, prompt, eventoSesion);

  if (disparador) {
    await resumirHistorial(ai, ig_id, history, disparador);

    // Limpieza del historial: si es manual, borra todo; si no, borra primeros 40 mensajes
    if (disparador === 'manual') {
      history = [];
    } else {
      history = history.slice(40);
    }

    if (disparador === 'manual') {
      return "¡Se generó un nuevo resumen de la conversación! Ahora puedes comenzar un nuevo tema o seguir conversando.";
    }
  }

  const geminiHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
  console.log("[DEBUG] History mapeado para Gemini:", JSON.stringify(geminiHistory, null, 2));

  const systemInstruction = `${contextGeneral}\n${resumenContext}\n${contextUsuario}`;
  console.log("[DEBUG] System instruction para Gemini:", systemInstruction);

  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: geminiHistory,
    config: { systemInstruction }
  });

  const response = await chat.sendMessage({ message: prompt });

  // [DEBUG] Mostrar respuesta de Gemini
  console.log("[DEBUG] Respuesta generada por Gemini:", response.text);

  // Guardar el mensaje del usuario y la respuesta del modelo en Google Sheets
  await guardarHistorial(ig_id, history, { role: "user", text: prompt });
  await guardarHistorial(ig_id, history, { role: "model", text: response.text });

  return response.text;
}

// Lee credenciales de Google Sheets
async function leerCredenciales(ig_id) {
  const result = await getFromGoogleSheets({ tipo: 'credenciales', id_usuario: ig_id });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return null;
  return result.data[0];
}
async function guardarCredenciales({ ig_id, ig_name, ig_picture, long_lived_token }) {
  await saveToGoogleSheets({
    tipo: 'credenciales',
    ig_id,
    ig_name,
    ig_picture,
    long_lived_token
  });
}
// Devuelve el último resumen para el usuario
async function leerUltimoResumen(ig_id) {
  const result = await getFromGoogleSheets({ tipo: 'resumen', id_usuario: ig_id });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return null;
  // Los resúmenes suelen estar ordenados de más antiguo a más nuevo, así que tomamos el último
  const ultimo = result.data[result.data.length - 1];
  return ultimo;
}

// --------- NUEVO: Mensaje personalizado con contexto base y usuario ---------
async function generarMensajePersonalizado({ nombre, resumen, ig_id }) {
  try {
    // 1. Lee contextos base y personalizado
    const contextBase = await leerContextoBase();
    const contextUsuario = await leerContextoUsuario(ig_id);

    // 2. Armá el prompt
    const prompt = `
Eres un mentor virtual que ayuda a usuarios a avanzar en sus procesos y objetivos.
Ten en cuenta estos dos contextos:
--- CONTEXTO BASE ---
${contextBase}

--- CONTEXTO DEL USUARIO ---
${contextUsuario}

--- RESUMEN DE LA SESIÓN ANTERIOR ---
${typeof resumen === "string" ? resumen : JSON.stringify(resumen, null, 2)}

Tu tarea:
- Genera un mensaje de bienvenida personalizado para ${nombre ? "@" + nombre : "el usuario"}.
- Comenta los temas o acciones más relevantes según el resumen.
- Haz una pregunta para avanzar, o sugiere retomar algún punto pendiente si corresponde.
- Usa un tono cercano y motivador.
- Si hay acciones pactadas pendientes, recuérdaselas.
- Responde solo con el mensaje que verá el usuario.
    `.trim();

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      history: [],
      config: { systemInstruction: "" }
    });

    const response = await chat.sendMessage({ message: prompt });
    console.log('[DEBUG] Gemini result:', JSON.stringify(response));
    return response.text || "¡Bienvenido/a de nuevo!";
  } catch (err) {
    console.error('[ERROR] Error en generarMensajePersonalizado:', err);
    throw err;
  }
}

module.exports = {
  askGemini,
  leerCredenciales,
  guardarCredenciales,
  leerContextoUsuario,
  leerUltimoResumen,
  generarMensajePersonalizado,
};