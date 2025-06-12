const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const USERS_BASE_PATH = path.join(__dirname, 'data', 'users');

// Inicializa archivos y carpetas para el usuario y responde con mensaje de bienvenida
router.post('/init', (req, res) => {
  const { ig_id, ig_name, ig_picture, long_lived_token } = req.body;
  if (!ig_id) return res.status(400).json({ error: 'Falta ig_id' });

  // 1. Crea la carpeta del usuario si no existe
  const userDir = path.join(USERS_BASE_PATH, ig_id);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  // 2. Crea credentials.json con todos los datos
  const credentialsFile = path.join(userDir, 'credentials.json');
  if (!fs.existsSync(credentialsFile)) {
    fs.writeFileSync(
      credentialsFile,
      JSON.stringify({ ig_id, ig_name, ig_picture, long_lived_token }, null, 2)
    );
  }

  // 3. Crea historial.json vacío si no existe
  const historyFile = path.join(userDir, 'historial.json');
  if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, '[]');

  // 4. Crea context.txt personalizado si no existe
  const contextFile = path.join(userDir, 'context.txt');
  if (!fs.existsSync(contextFile)) {
    fs.writeFileSync(
      contextFile,
      `Contexto base personalizado para IG ${ig_id} (${ig_name || ""})`
    );
  }

  res.json({
    ok: true,
    message: ig_name
      ? `¡Hola @${ig_name}!. Para empezar di "hola".`
      : `¡Hola! No pude cargar el nombre de tu cuenta de instagram. Escribe a hola@epm-marketing.com indicando tu IG id=${ig_id}.`
  });
});

const { askGemini } = require('./geminiService');

router.post('/ask', async (req, res) => {
  const { ig_id, prompt } = req.body;
  if (!ig_id || !prompt) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const respuesta = await askGemini({ ig_id, prompt });
    res.json({ ok: true, respuesta });
  } catch (e) {
    res.status(500).json({ error: e.message || "Error interno" });
  }
});

module.exports = router;