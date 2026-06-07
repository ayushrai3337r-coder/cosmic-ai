const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB } = require('./database');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads folder serve karo
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline');
    }
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.set('Content-Type', 'image/jpeg');
    }
  }
}));

// Frontend serve karo
app.use(express.static(path.join(__dirname, '../frontend')));

// Upload folders banao
const folders = [
  'uploads',
  'uploads/pdfs',
  'uploads/screenshots'
];
folders.forEach(folder => {
  const p = path.join(__dirname, folder);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pdfs', require('./routes/pdfs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));

app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log('Cosmic AI running on port ' + PORT);
  });
});
