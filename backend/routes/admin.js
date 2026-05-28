const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { sql } = require('../database');

const adminAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cosmicai_secret');
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Not admin' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/pdfs'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    const token = jwt.sign(
      { isAdmin: true },
      process.env.JWT_SECRET || 'cosmicai_secret',
      { expiresIn: '7d' }
    );

    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalRevenue = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments WHERE status = 'approved'
    `;

    const totalStudents = await sql`
      SELECT COUNT(*) as count FROM users
    `;

    const totalPdfs = await sql`
      SELECT COUNT(*) as count FROM pdfs WHERE active = true
    `;

    const pendingRequests = await sql`
      SELECT COUNT(*) as count FROM payments WHERE status = 'pending'
    `;

    const activePurchases = await sql`
      SELECT COUNT(*) as count FROM purchases
      WHERE status = 'approved' AND expiry_date > NOW()
    `;

    const totalSales = await sql`
      SELECT COUNT(*) as count FROM payments WHERE status = 'approved'
    `;

    const revenueBySubject = await sql`
      SELECT pdf_title, SUM(amount) as total
      FROM payments WHERE status = 'approved'
      GROUP BY pdf_title
      ORDER BY total DESC
    `;

    const recentPayments = await sql`
      SELECT * FROM payments
      ORDER BY submitted_at DESC
      LIMIT 5
    `;

    const revenueObj = {};
    revenueBySubject.forEach(r => {
      revenueObj[r.pdf_title] = parseInt(r.total);
    });

    res.json({
      success: true,
      stats: {
        totalRevenue: parseInt(totalRevenue[0].total),
        totalStudents: parseInt(totalStudents[0].count),
        totalPdfs: parseInt(totalPdfs[0].count),
        pendingRequests: parseInt(pendingRequests[0].count),
        activePurchases: parseInt(activePurchases[0].count),
        totalSales: parseInt(totalSales[0].count)
      },
      revenueBySubject: revenueObj,
      recentPayments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pending payments
router.get('/payments/pending', adminAuth, async (req, res) => {
  try {
    const payments = await sql`
      SELECT * FROM payments
      WHERE status = 'pending'
      ORDER BY submitted_at DESC
    `;
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// All payments
router.get('/payments/all', adminAuth, async (req, res) => {
  try {
    const payments = await sql`
      SELECT * FROM payments
      ORDER BY submitted_at DESC
    `;
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve payment
router.post('/payments/:id/approve', adminAuth, async (req, res) => {
  try {
    const { durationDays } = req.body;

    const payments = await sql`
      SELECT * FROM payments WHERE id = ${req.params.id}
    `;
    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];

    await sql`
      UPDATE payments
      SET status = 'approved', approved_at = NOW()
      WHERE id = ${req.params.id}
    `;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (durationDays || 30));

    const purchaseId = uuidv4();
    await sql`
      INSERT INTO purchases (id, user_id, pdf_id, payment_id, status, expiry_date)
      VALUES (
        ${purchaseId},
        ${payment.user_id},
        ${payment.pdf_id},
        ${payment.id},
        ${'approved'},
        ${expiryDate.toISOString()}
      )
    `;

    await sql`
      UPDATE pdfs SET total_sales = total_sales + 1
      WHERE id = ${payment.pdf_id}
    `;

    res.json({ success: true, message: 'Payment approved. Student can now access PDF.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject payment
router.post('/payments/:id/reject', adminAuth, async (req, res) => {
  try {
    await sql`
      UPDATE payments
      SET status = 'rejected', rejected_at = NOW()
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true, message: 'Payment rejected.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload PDF
router.post('/pdfs/upload', adminAuth, upload.single('pdf'), async (req, res) => {
  try {
    const { title, board, subject, price, durationDays, description } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file required' });
    }

    const id = uuidv4();
    const filePath = '/uploads/pdfs/' + req.file.filename;

    await sql`
      INSERT INTO pdfs (id, title, board, subject, price, duration_days, description, file_path)
      VALUES (
        ${id}, ${title}, ${board}, ${subject},
        ${parseInt(price)}, ${parseInt(durationDays)},
        ${description || ''}, ${filePath}
      )
    `;

    res.json({ success: true, message: 'PDF uploaded successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all PDFs
router.get('/pdfs', adminAuth, async (req, res) => {
  try {
    const pdfs = await sql`
      SELECT * FROM pdfs ORDER BY created_at DESC
    `;
    res.json({ success: true, pdfs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete PDF
router.delete('/pdfs/:id', adminAuth, async (req, res) => {
  try {
    await sql`
      UPDATE pdfs SET active = false WHERE id = ${req.params.id}
    `;
    res.json({ success: true, message: 'PDF deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all students
router.get('/students', adminAuth, async (req, res) => {
  try {
    const students = await sql`
      SELECT
        u.*,
        COUNT(DISTINCT pu.id) as total_purchases,
        COALESCE(SUM(pay.amount), 0) as total_spent
      FROM users u
      LEFT JOIN purchases pu ON pu.user_id = u.id
      LEFT JOIN payments pay ON pay.user_id = u.id AND pay.status = 'approved'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update UPI settings
router.post('/settings/upi', adminAuth, async (req, res) => {
  try {
    res.json({ success: true, message: 'Update UPI in .env file and restart server.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change admin password
router.post('/settings/password', adminAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (oldPassword !== adminPassword) {
      return res.status(401).json({ error: 'Wrong old password' });
    }

    res.json({ success: true, message: 'Update ADMIN_PASSWORD in .env file and restart server.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
