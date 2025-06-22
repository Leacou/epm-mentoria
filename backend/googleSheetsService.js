const axios = require('axios');

const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
if (!GOOGLE_SHEETS_WEBHOOK_URL) {
  throw new Error('Falta la variable de entorno GOOGLE_SHEETS_WEBHOOK_URL');
}

// Guarda datos en Google Sheets (historial, resumen, contexto, credenciales)
async function saveToGoogleSheets(data) {
  try {
    const response = await axios.post(GOOGLE_SHEETS_WEBHOOK_URL, data);
    return response.data;
  } catch (error) {
    console.error('Error al guardar en Google Sheets:', error.message);
    return { success: false, error: error.message };
  }
}

// Lee datos desde Google Sheets (historial, resumen, contexto, credenciales)
async function getFromGoogleSheets({ tipo, id_usuario, fecha }) {
  try {
    const params = new URLSearchParams({ tipo, id_usuario });
    if (fecha) params.append('fecha', fecha);
    const url = `${GOOGLE_SHEETS_WEBHOOK_URL}?${params.toString()}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error al leer desde Google Sheets:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { saveToGoogleSheets, getFromGoogleSheets };