import { BACKEND_URL } from './config.js';

// --- INICIO LÓGICA PARA IG_ID ÚNICO DE INVITADO ---
function getOrCreateGuestId() {
  const GUEST_ID_KEY = 'epm_guest_ig_id';
  // Si ya existe en localStorage, úsalo
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (guestId) return guestId;
  // Si no, genera uno aleatorio y guárdalo
  guestId = 'user_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem(GUEST_ID_KEY, guestId);
  return guestId;
}

// Obtiene los parámetros de la URL
const params = new URLSearchParams(window.location.search);
let ig_id = params.get('ig_id');
let ig_name = params.get('ig_name');
let ig_picture = params.get('ig_picture');
let long_lived_token = params.get('long_lived_token');

// Si ig_id es "gratis", "GENERAR", "{gratis}", o vacío, usamos/generamos uno único
if (!ig_id || ig_id === 'gratis' || ig_id === '{gratis}' || ig_id === 'GENERAR') {
  ig_id = getOrCreateGuestId();
  // Opcional: si quieres que la URL cambie para reflejar el nuevo ig_id (esto ayuda si el usuario guarda la URL)
  params.set('ig_id', ig_id);
  const newUrl = window.location.pathname + '?' + params.toString();
  window.history.replaceState({}, '', newUrl);
}

// --- FIN LÓGICA IG_ID INVITADO ÚNICO ---

// Helper para inicial
function getInitial(name) {
  if (!name || typeof name !== 'string') return '?';
  return name.trim()[0].toUpperCase();
}

// Helper para construir la URL del proxy
function getAvatarUrl(url) {
  if (!url) return null;
  return `${BACKEND_URL}/api/proxy-avatar?url=${encodeURIComponent(url)}`;
}

// Renderiza el avatar: imagen si carga, si no, círculo con inicial
function setUserAvatar(url, name) {
  const avatarImg = document.getElementById('user-avatar');
  const avatarFallback = document.getElementById('user-avatar-fallback');
  const initial = getInitial(name);

  // Reset fallback
  avatarFallback.textContent = initial;
  avatarFallback.style.display = 'none';

  if (!url) {
    avatarImg.style.display = 'none';
    avatarFallback.style.display = 'flex';
    return;
  }
  avatarImg.src = getAvatarUrl(url);
  avatarImg.style.display = 'block';

  avatarImg.onerror = function() {
    this.style.display = 'none';
    avatarFallback.style.display = 'flex';
  };
  avatarImg.onload = function() {
    avatarImg.style.display = 'block';
    avatarFallback.style.display = 'none';
  };
}

// Renderiza foto y nombre usuario si existen
if (ig_name) document.getElementById('user-name').textContent = '@' + ig_name;
setUserAvatar(ig_picture, ig_name);

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

// Helper para generar el avatar html
function chatAvatarHTML(url, name, className = '') {
  const initial = getInitial(name);
  const avatarUrl = getAvatarUrl(url);
  // Si hay URL, pone la imagen y fallback con inicial oculta
  // Si no hay URL, solo el círculo con la inicial
  if (avatarUrl) {
    return `<span class="avatar-wrapper">
      <img src="${avatarUrl}" class="avatar ${className}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
      <span class="avatar-fallback ${className}" style="display:none;">${initial}</span>
    </span>`;
  } else {
    return `<span class="avatar-wrapper">
      <span class="avatar-fallback ${className}" style="display:flex;">${initial}</span>
    </span>`;
  }
}

if (chatForm) {
  chatForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    // Obtiene el HTML enriquecido del editor
    const prompt = quill.root.innerHTML.trim();
    // Evita mensajes vacíos o solo con salto de línea
    if (!prompt || prompt === '<p><br></p>') return;

    // Muestra el mensaje del usuario en el chat (usa proxy y onerror para fallback)
    chatArea.innerHTML += `<div class="chat-bubble user-msg">
      ${chatAvatarHTML(ig_picture, ig_name)}
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