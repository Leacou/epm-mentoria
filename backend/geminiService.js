const fs = require('fs').promises;
const { GoogleGenAI } = require('@google/genai');

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

function totalTokens(history) {
  // Aproximación rápida: 1 token ≈ 4 caracteres
  return history.reduce((acc, msg) => acc + Math.ceil(msg.text.length / 4), 0);
}

function detectarDisparador(history, prompt) {
  if (prompt && prompt.trim() === "~resumen~") return "manual";
  if (history.length > 50) return "cantidad de mensajes";
  if (totalTokens(history) > 4000) return "cantidad de tokens";
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

async function resumirHistorial(ai, ig_id, history, disparador = "manual") {
  const { campo: fechaCampo, archivo: fechaArchivo } = getCurrentTimestamp();
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
  resumenJson.crudo = resumenCrudo;

  // Guarda el resumen con timestamp único en el nombre del archivo
  await fs.writeFile(__dirname + `/data/users/${ig_id}/resumen_${fechaArchivo}.json`, JSON.stringify(resumenJson, null, 2));
  // Opcional: copia/actualiza el resumen "actual" para la lógica principal
  await fs.writeFile(__dirname + `/data/users/${ig_id}/resumen.json`, JSON.stringify(resumenJson, null, 2));
}

async function askGemini({ ig_id, prompt }) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const contextGeneral = await fs.readFile(__dirname + "/data/context_base.txt", "utf8");
  let contextUsuario = "";
  try {
    contextUsuario = await fs.readFile(__dirname + `/data/users/${ig_id}/context.txt`, "utf8");
  } catch (e) {}

  let history = [];
  try {
    const rawHist = await fs.readFile(__dirname + `/data/users/${ig_id}/historial.json`, "utf8");
    history = JSON.parse(rawHist);
  } catch (e) {}

  let resumenContext = "";
  try {
    const resumenJson = await fs.readFile(__dirname + `/data/users/${ig_id}/resumen.json`, "utf8");
    const resumen = JSON.parse(resumenJson);
    resumenContext = `\n\nResumen de sesiones previas (actualizado al ${resumen.fecha}):\n` +
      Object.entries(resumen.temas).map(([tema, texto]) => `- ${tema}: ${texto}`).join('\n');
  } catch (e) {}

  const disparador = detectarDisparador(history, prompt);

  if (disparador) {
    await resumirHistorial(ai, ig_id, history, disparador);

    // Limpieza del historial: si es manual, borra todo; si no, borra primeros 40 mensajes
    history = (disparador === 'manual') ? [] : history.slice(40);
    await fs.writeFile(__dirname + `/data/users/${ig_id}/historial.json`, JSON.stringify(history, null, 2));

    if (disparador === 'manual') {
      return "¡Se generó un nuevo resumen de la conversación! Ahora puedes comenzar un nuevo tema o seguir conversando.";
    }
  }

  const geminiHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  const systemInstruction = `${contextGeneral}\n${resumenContext}\n${contextUsuario}`;

  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: geminiHistory,
    config: { systemInstruction }
  });

  const response = await chat.sendMessage({ message: prompt });

  history.push({ role: "user", text: prompt });
  history.push({ role: "model", text: response.text });
  await fs.writeFile(__dirname + `/data/users/${ig_id}/historial.json`, JSON.stringify(history, null, 2));

  return response.text;
}

module.exports = { askGemini };