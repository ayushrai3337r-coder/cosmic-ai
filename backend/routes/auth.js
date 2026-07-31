const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../database');

const makeToken = (user) => jwt.sign(
  { id: user.id, email: user.email },
  process.env.JWT_SECRET || 'cosmicai_secret',
  { expiresIn: '30d' }
);

// Firebase config
router.get('/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  });
});

// Google / Firebase login
router.post('/firebase', async (req, res) => {
  try {
    const { firebaseUid, name, email, picture, authType } = req.body;
    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'Invalid data' });
    }
    let users = await sql`SELECT * FROM users WHERE firebase_uid = ${firebaseUid}`;
    if (users.length === 0) {
      const id = uuidv4();
      await sql`
        INSERT INTO users (id, firebase_uid, name, email, picture, auth_type)
        VALUES (${id}, ${firebaseUid}, ${name}, ${email}, ${picture || ''}, ${authType || 'google'})
      `;
      users = await sql`SELECT * FROM users WHERE id = ${id}`;
    }
    const user = users[0];
    res.json({
      success: true,
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, picture: user.picture }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Register
router.post('/email-register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Fill all fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password min 6 characters' });
    }
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);
    await sql`
      INSERT INTO users (id, firebase_uid, name, email, picture, password_hash, auth_type)
      VALUES (${id}, ${id}, ${name}, ${email}, ${''}, ${password_hash}, ${'email'})
    `;
    const user = { id, name, email, picture: '' };
    res.json({
      success: true,
      token: makeToken(user),
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Login
router.post('/email-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Fill all fields' });
    }
    const users = await sql`
      SELECT * FROM users WHERE email = ${email} AND auth_type = 'email'
    `;
    if (users.length === 0) {
      return res.status(401).json({ error: 'Email not found' });
    }
    const user = users[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Use Google login for this account' });
    }
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Wrong password' });
    }
    res.json({
      success: true,
      token: makeToken(user),
      user: { id: user.id, name: user.name, email: user.email, picture: user.picture }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify Token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cosmicai_secret');
    const users = await sql`
      SELECT id, name, email, picture FROM users WHERE id = ${decoded.id}
    `;
    if (users.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json({ success: true, user: users[0] });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
