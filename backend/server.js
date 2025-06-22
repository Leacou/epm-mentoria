const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('Iniciando servidor de EPM Mentoría...');

const app = express();

app.use(cors());
app.use(express.json());

console.log('Intentando cargar routers...');
try {
  const mentoriaRouter = require('./mentoriaRouter');
  const sesionRouter = require('./sesionRouter');
  app.use('/api/mentoria', mentoriaRouter);
  app.use('/api', sesionRouter);
  console.log('Routers cargados correctamente.');
} catch (err) {
  console.error('Error al cargar routers:', err);
}

const frontendPath = path.join(__dirname, '../frontend');
console.log('Sirviendo archivos estáticos desde:', frontendPath);
app.use(express.static(frontendPath));

// Para rutas que no sean API, devuelve el index.html (Single Page App)
app.get('*', (req, res) => {
  console.log('Catch-all para SPA, url solicitada:', req.url);
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});