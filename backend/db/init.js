const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './database.sqlite';
let db;

function getDatabase() {
  if (!db) {
    db = new Database(dbPath, { 
      verbose: process.env.NODE_ENV === 'development' ? console.log : null 
    });
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Optimize for performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }
  return db;
}

async function initializeDatabase() {
  const db = getDatabase();
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active BOOLEAN DEFAULT 1
    )
  `);

  // Create plaid_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      access_token TEXT NOT NULL,
      item_id TEXT NOT NULL,
      institution_id TEXT,
      institution_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plaid_transaction_id TEXT UNIQUE,
      account_id TEXT,
      amount DECIMAL(10,2) NOT NULL,
      date DATE NOT NULL,
      name TEXT,
      merchant_name TEXT,
      category TEXT,
      subcategory TEXT,
      type TEXT,
      pending BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create audit_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Create sessions table for refresh tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      refresh_token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      color TEXT,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
    CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items(user_id);
  `);

  console.log('Database tables created successfully');
}

// Helper functions for database operations
const dbHelpers = {
  // User operations
  createUser: (email, passwordHash) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash) 
      VALUES (?, ?)
    `);
    return stmt.run(email, passwordHash);
  },

  getUserByEmail: (email) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  getUserById: (id) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  },

  updateLastLogin: (userId) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(userId);
  },

  // Audit log operations
  createAuditLog: (data) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, user_agent, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.userId || null,
      data.action,
      data.resource,
      data.resourceId || null,
      data.ipAddress || null,
      data.userAgent || null,
      data.success !== false ? 1 : 0,
      data.errorMessage || null
    );
  },

  // Session operations
  createSession: (userId, refreshToken, expiresAt) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO sessions (user_id, refresh_token, expires_at)
      VALUES (?, ?, ?)
    `);
    return stmt.run(userId, refreshToken, expiresAt);
  },

  getSession: (refreshToken) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT s.*, u.email 
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.refresh_token = ? AND s.expires_at > datetime('now')
    `);
    return stmt.get(refreshToken);
  },

  deleteSession: (refreshToken) => {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM sessions WHERE refresh_token = ?');
    return stmt.run(refreshToken);
  },

  // Cleanup expired sessions
  cleanupExpiredSessions: () => {
    const db = getDatabase();
    const stmt = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");
    return stmt.run();
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  ...dbHelpers
};