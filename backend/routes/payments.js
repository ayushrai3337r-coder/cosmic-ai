const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { sql } = require('../database');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cosmicai_secret');
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/screenshots'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// Get UPI details
router.get('/upi-details', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      upiId: process.env.ADMIN_UPI_ID || 'yourname@upi',
      upiName: process.env.ADMIN_UPI_NAME || 'Cosmic AI',
      qrCode: process.env.ADMIN_QR_CODE || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit payment screenshot
router.post('/submit', authMiddleware, upload.single('screenshot'), async (req, res) => {
  try {
    const { pdfId } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Screenshot required' });
    }

    const pdfs = await sql`
      SELECT * FROM pdfs WHERE id = ${pdfId}
    `;
    if (pdfs.length === 0) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const users = await sql`
      SELECT * FROM users WHERE id = ${req.user.id}
    `;

    const pdf = pdfs[0];
    const user = users[0];
    const id = uuidv4();
    const screenshotPath = '/uploads/screenshots/' + req.file.filename;

    await sql`
      INSERT INTO payments (
        id, user_id, user_name, user_email,
        pdf_id, pdf_title, pdf_board,
        amount, screenshot_path, status
      ) VALUES (
        ${id}, ${req.user.id}, ${user.name}, ${user.email},
        ${pdfId}, ${pdf.title}, ${pdf.board},
        ${pdf.price}, ${screenshotPath}, ${'pending'}
      )
    `;

    res.json({
      success: true,
      message: 'Payment submitted. Admin will verify shortly.',
      paymentId: id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user payment history
router.get('/my-history', authMiddleware, async (req, res) => {
  try {
    const payments = await sql`
      SELECT p.*, pu.expiry_date,
        CASE
          WHEN pu.expiry_date > NOW() THEN 'active'
          WHEN pu.expiry_date IS NOT NULL THEN 'expired'
          ELSE p.status
        END as access_status
      FROM payments p
      LEFT JOIN purchases pu ON pu.payment_id = p.id
      WHERE p.user_id = ${req.user.id}
      ORDER BY p.submitted_at DESC
    `;

    res.json({ success: true, history: payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active purchases
router.get('/my-purchases', authMiddleware, async (req, res) => {
  try {
    const purchases = await sql`
      SELECT pu.*, p.title, p.board, p.subject,
        p.description, p.file_path, p.price
      FROM purchases pu
      JOIN pdfs p ON p.id = pu.pdf_id
      WHERE pu.user_id = ${req.user.id}
      AND pu.status = 'approved'
      AND pu.expiry_date > NOW()
      ORDER BY pu.purchase_date DESC
    `;

    const result = purchases.map(p => ({
      id: p.pdf_id,
      title: p.title,
      board: p.board,
      subject: p.subject,
      description: p.description,
      filePath: p.file_path,
      price: p.price,
      expiryDate: p.expiry_date,
      purchaseDate: p.purchase_date
    }));

    res.json({ success: true, purchases: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
