const express = require('express');
const router = express.Router();

const {
  askGemini,
  leerCredenciales,
  guardarCredenciales,
  leerContextoUsuario,
  leerUltimoResumen,
  generarMensajePersonalizado
} = require('./geminiService');

router.post('/init', async (req, res) => {
  const { ig_id, ig_name, ig_picture, long_lived_token } = req.body;
  if (!ig_id) return res.status(400).json({ error: 'Falta ig_id' });

  let esNuevo = false;
  try {
    const existe = await leerCredenciales(ig_id);
    if (!existe) {
      await guardarCredenciales({ ig_id, ig_name, ig_picture, long_lived_token });
      esNuevo = true;
    }
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo consultar/guardar credenciales', details: e.message });
  }

  // Si es usuario nuevo
  if (esNuevo) {
    return res.json({
      ok: true,
      message: ig_name
        ? `¡Hola @${ig_name}! Bienvenido/a a tu espacio de mentoría. Para empezar, contame sobre tu idea de emprendimiento, tus objetivos, dudas o desafíos actuales.`
        : `¡Hola! No pude cargar el nombre de tu cuenta de instagram. Escribe a hola@epm-marketing.com indicando tu IG id=${ig_id}.`
    });
  }

  // Si es usuario existente, busca el último resumen y genera mensaje personalizado
  let resumenObj = null;
  try {
    const resumen = await leerUltimoResumen(ig_id);
    if (resumen && resumen.contenido) {
      try {
        resumenObj = typeof resumen.contenido === "string"
          ? JSON.parse(resumen.contenido)
          : resumen.contenido;
      } catch (err) {
        resumenObj = resumen.contenido || resumen.resumen;
      }
    }
  } catch (e) {
    // Si falla igual puede continuar, resumenObj queda como null
  }

  let mensajePersonalizado = "";
  if (resumenObj) {
    try {
      console.log('[DEBUG] Llamando a generarMensajePersonalizado con:', {ig_name, resumenObj, ig_id});
      mensajePersonalizado = await generarMensajePersonalizado({
        nombre: ig_name,
        resumen: resumenObj,
        ig_id
      });
      console.log('[DEBUG] Mensaje personalizado generado:', mensajePersonalizado);
    } catch (e) {
      console.error('[ERROR] No se pudo generar mensaje personalizado:', e);
      mensajePersonalizado = "¡Hola de nuevo! No pude generar un mensaje personalizado, pero puedes retomar tu mentoría cuando quieras.";
    }
  } else {
    mensajePersonalizado = ig_name
      ? `¡Hola ${ig_name}! ¿Me querés contar primero si ya estás emprendiendo o si te gustaría empezar a emprender? ¿Tienes alguna traba o algo específico en lo que te gustaría trabajar hoy?.`
      : `¡Hola de nuevo! No pude cargar el nombre de tu cuenta de instagram. Escribe a hola@epm-marketing.com indicando tu IG id=${ig_id}.`;
  }

  res.json({
    ok: true,
    message: mensajePersonalizado
  });
});

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