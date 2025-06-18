// Detecta modo dev por ?dev=1 en la URL
export const isDev = window.location.search.includes('dev=1');

// Cambia el endpoint base según el modo
export const BACKEND_URL = isDev
  ? "http://localhost:3000"
  : ""; // En producción, mismo dominio