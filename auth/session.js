// auth/session.js

const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const SESSION_DB_FILE = path.join(__dirname, '..', 'sessions.db');

const sessionMiddleware = session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.dirname(SESSION_DB_FILE)
  }),
  secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set to true behind HTTPS in production
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
});

// Simple auth guard for future protected routes
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = {
  sessionMiddleware,
  requireAuth
};


