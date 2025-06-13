const express = require('express');
const router = express.Router();
const { askGemini } = require('./geminiService');

// Endpoint para cierre de sesión automática/manual
router.post('/sesion-cerrada', async (req, res) => {
  const { ig_id } = req.body;
  if (!ig_id) return res.status(400).send('Falta ig_id');
  try {
    await askGemini({ ig_id, prompt: "", eventoSesion: "fin_de_sesion" });
    res.send('OK');
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al cerrar sesión');
  }
});

module.exports = router;