const express = require('express');
const cors = require('cors');
const path = require('path');
const mentoriaRouter = require('./mentoriaRouter');
const sesionRouter = require('./sesionRouter');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/mentoria', mentoriaRouter);
app.use('/api', sesionRouter);

// Sirve archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Para rutas que no sean API, devuelve el index.html (Single Page App)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});