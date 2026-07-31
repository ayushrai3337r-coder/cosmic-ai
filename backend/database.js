const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        firebase_uid TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        picture TEXT,
        password_hash TEXT,
        auth_type TEXT DEFAULT 'email',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pdfs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        board TEXT NOT NULL,
        subject TEXT NOT NULL,
        price INTEGER NOT NULL,
        duration_days INTEGER NOT NULL,
        description TEXT,
        file_path TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        total_sales INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_email TEXT,
        pdf_id TEXT NOT NULL,
        pdf_title TEXT,
        pdf_board TEXT,
        amount INTEGER,
        screenshot_path TEXT,
        status TEXT DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pdf_id TEXT NOT NULL,
        payment_id TEXT,
        status TEXT DEFAULT 'approved',
        purchase_date TIMESTAMP DEFAULT NOW(),
        expiry_date TIMESTAMP NOT NULL
      )
    `;

    console.log('Database ready');
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

module.exports = { sql, initDB };
