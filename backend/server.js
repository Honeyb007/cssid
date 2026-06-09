const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const path          = require('path');
require('dotenv').config();

const app = express();

// ── Security middleware ──────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please wait 15 minutes.' },
});
app.use('/api/auth/', authLimiter);

// ── Static files ─────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ───────────────────────────────────────────────
// IMPORTANT: API routes MUST be registered before the catch-all below
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/citizen',  require('./routes/citizen'));
app.use('/api/official', require('./routes/official'));
app.use('/api/admin',    require('./routes/admin'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'SSID Management System', timestamp: new Date() });
});

// ── Catch-all: serve frontend HTML pages ONLY ────────────────
// Only intercepts requests for actual .html pages or bare routes
// Never intercepts /api/* (already handled above)
// Never intercepts requests with file extensions (css, js, images etc.)
app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API route not found.' });
    }
    if (path.extname(req.path) !== '') {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
  }
  res.status(500).json({ message: err.message || 'Internal server error.' });
});

// ── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ SSID System running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database    : ${process.env.DB_NAME}@${process.env.DB_HOST}\n`);
});

module.exports = app;