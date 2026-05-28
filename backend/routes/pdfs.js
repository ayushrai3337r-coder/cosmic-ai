const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

// Get PDFs by board
router.get('/board/:board', authMiddleware, async (req, res) => {
  try {
    const pdfs = await sql`
      SELECT * FROM pdfs
      WHERE board = ${req.params.board}
      AND active = true
      ORDER BY created_at DESC
    `;

    const purchases = await sql`
      SELECT pdf_id FROM purchases
      WHERE user_id = ${req.user.id}
      AND status = 'approved'
      AND expiry_date > NOW()
    `;

    const purchasedIds = purchases.map(p => p.pdf_id);

    const pdfsWithAccess = pdfs.map(pdf => ({
      id: pdf.id,
      title: pdf.title,
      board: pdf.board,
      subject: pdf.subject,
      price: pdf.price,
      durationDays: pdf.duration_days,
      description: pdf.description,
      filePath: pdf.file_path,
      hasAccess: purchasedIds.includes(pdf.id)
    }));

    res.json({ success: true, pdfs: pdfsWithAccess });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View PDF - check access
router.get('/:id/view', authMiddleware, async (req, res) => {
  try {
    const purchases = await sql`
      SELECT * FROM purchases
      WHERE user_id = ${req.user.id}
      AND pdf_id = ${req.params.id}
      AND status = 'approved'
      AND expiry_date > NOW()
    `;

    if (purchases.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pdfs = await sql`
      SELECT * FROM pdfs WHERE id = ${req.params.id}
    `;

    if (pdfs.length === 0) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.json({
      success: true,
      filePath: pdfs[0].file_path,
      title: pdfs[0].title,
      expiryDate: purchases[0].expiry_date
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
