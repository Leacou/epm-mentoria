import { BACKEND_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const ig_id = params.get('ig_id');
const ig_name = params.get('ig_name');
const ig_picture = params.get('ig_picture');
const long_lived_token = params.get('long_lived_token');

if (!ig_id) {
  document.getElementById('bienvenida').textContent = 'Error: falta identificación de usuario Instagram.';
} else {
  initMentoria();
}

async function initMentoria() {
  const res = await fetch(`${BACKEND_URL}/api/mentoria/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ig_id, ig_name, ig_picture, long_lived_token })
  });
  const data = await res.json();
  document.getElementById('bienvenida').textContent = data.message || 'Listo!';
}

// CHAT LOGIC:
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatArea = document.getElementById('chat-area'); // un div donde mostrar mensajes

if (chatForm) {
  chatForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const prompt = userInput.value.trim();
    if (!prompt) return;

    // Muestra el mensaje del usuario en el chat
    chatArea.innerHTML += `<div class="user-msg"><b>Tú:</b> ${prompt}</div>`;

    // Limpia el campo de input
    userInput.value = '';

    // Llama al backend con el prompt
    chatArea.innerHTML += `<div class="model-msg"><i>Pensando...</i></div>`;
    try {
      const res = await fetch(`${BACKEND_URL}/api/mentoria/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ig_id, prompt })
      });
      const data = await res.json();
      // Borra el "Pensando..."
      chatArea.removeChild(chatArea.lastChild);
      if (data.respuesta) {
        chatArea.innerHTML += `<div class="model-msg"><b>Mentor:</b> ${data.respuesta}</div>`;
      } else if (data.error) {
        chatArea.innerHTML += `<div class="model-msg error"><b>Error:</b> ${data.error}</div>`;
      }
    } catch (err) {
      chatArea.removeChild(chatArea.lastChild);
      chatArea.innerHTML += `<div class="model-msg error"><b>Error de conexión</b></div>`;
    }
  });
}