const express = require('express');
const cors = require('cors');
const mentoriaRouter = require('./mentoriaRouter');
const sesionRouter = require('./sesionRouter'); // <--- NUEVO
const { PORT } = require('./config');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/mentoria', mentoriaRouter);
app.use('/api', sesionRouter); // <--- NUEVO

app.listen(PORT, () => {
  console.log(`Mentoria backend listening on port ${PORT}`);
});






