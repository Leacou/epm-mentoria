const params = new URLSearchParams(window.location.search);
const ig_id = params.get('ig_id');

function notificarCierreSesion() {
  if (!ig_id) return;
  const url = '/api/sesion-cerrada';
  const data = JSON.stringify({ ig_id });
  navigator.sendBeacon(url, data);
}

window.addEventListener('unload', notificarCierreSesion);