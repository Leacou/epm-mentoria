import { BACKEND_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const ig_id = params.get('ig_id');
const ig_name = params.get('ig_name');
const ig_picture = params.get('ig_picture');
const long_lived_token = params.get('long_lived_token');

// Renderiza foto y nombre usuario si existen
if (ig_name) document.getElementById('user-name').textContent = '@' + ig_name;
if (ig_picture) document.getElementById('user-avatar').src = ig_picture;
else document.getElementById('user-avatar').src = 'placeholder.png'; // Asegúrate de tener este archivo

if (!ig_id) {
  document.getElementById('bienvenida').innerHTML = '<b>Error:</b> falta identificación de usuario Instagram.';
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
  document.getElementById('bienvenida').innerHTML = formatMentorMessage(data.message || 'Listo!');
  // Oculta el loading
  const loadingDiv = document.getElementById('loading-message');
  if (loadingDiv) loadingDiv.style.display = 'none';
}

// Formatea el mensaje del mentor permitiendo saltos de línea, etc.
function formatMentorMessage(msg) {
  // Convierte doble salto de línea en <br><br>
  return msg.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
}

// Inicializa QuillJS
const quill = new Quill('#quill-container', {
  theme: 'snow',
  placeholder: 'Escribe tu mensaje...',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      [{ 'align': [] }],
      ['clean']
    ]
  }
});

const chatForm = document.getElementById('chat-form');
const chatArea = document.getElementById('chat-area');

if (chatForm) {
  chatForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    // Obtiene el HTML enriquecido del editor
    const prompt = quill.root.innerHTML.trim();
    // Evita mensajes vacíos o solo con salto de línea
    if (!prompt || prompt === '<p><br></p>') return;

    // Muestra el mensaje del usuario en el chat (puedes agregar avatar si quieres)
    chatArea.innerHTML += `<div class="chat-bubble user-msg">
      <img src="${ig_picture || 'placeholder.png'}" class="avatar"/>
      <span>${prompt}</span>
    </div>`;

    // Limpia el editor
    quill.setContents([]);

    // Muestra "Pensando..."
    chatArea.innerHTML += `<div class="chat-bubble model-msg"><i>Pensando...</i></div>`;
    chatArea.scrollTop = chatArea.scrollHeight;

    try {
      const res = await fetch(`${BACKEND_URL}/api/mentoria/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ig_id, prompt })
      });
      const data = await res.json();
      chatArea.removeChild(chatArea.lastChild); // Borra "Pensando..."
      if (data.respuesta) {
        chatArea.innerHTML += `<div class="chat-bubble model-msg"><b>Mentor:</b> ${formatMentorMessage(data.respuesta)}</div>`;
      } else if (data.error) {
        chatArea.innerHTML += `<div class="chat-bubble model-msg error"><b>Error:</b> ${data.error}</div>`;
      }
      chatArea.scrollTop = chatArea.scrollHeight;
    } catch (err) {
      chatArea.removeChild(chatArea.lastChild);
      chatArea.innerHTML += `<div class="chat-bubble model-msg error"><b>Error de conexión</b></div>`;
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  });
}