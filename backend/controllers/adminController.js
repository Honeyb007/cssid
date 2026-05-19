const pool    = require('../config/db');
const bcrypt  = require('bcryptjs');

// ----------------------------------------------------------------
// GET /api/admin/stats
// System-wide statistics for the admin dashboard
// ----------------------------------------------------------------
async function getStats(req, res) {
  try {
    const [[citizens]]    = await pool.query('SELECT COUNT(*) AS total FROM citizens');
    const [[officials]]   = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE role = 'official'`);
    const [[verifications]] = await pool.query('SELECT COUNT(*) AS total FROM verification_logs');
    const [[todayVerifs]] = await pool.query(
      `SELECT COUNT(*) AS total FROM verification_logs WHERE DATE(created_at) = CURDATE()`
    );
    const [[eligible]]    = await pool.query(
      `SELECT COUNT(*) AS total FROM benefit_eligibility WHERE status = 'eligible'`
    );
    const [[pending]]     = await pool.query(
      `SELECT COUNT(*) AS total FROM benefit_eligibility WHERE status = 'pending'`
    );

    return res.status(200).json({
      stats: {
        totalCitizens:       citizens.total,
        totalOfficials:      officials.total,
        totalVerifications:  verifications.total,
        todayVerifications:  todayVerifs.total,
        eligibleBenefits:    eligible.total,
        pendingBenefits:     pending.total,
      },
    });
  } catch (err) {
    console.error('getStats error:', err);
    return res.status(500).json({ message: 'Server error fetching stats.' });
  }
}

// ----------------------------------------------------------------
// GET /api/admin/citizens
// List all registered citizens (paginated)
// ----------------------------------------------------------------
async function getAllCitizens(req, res) {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    const searchParam = `%${search}%`;

    const [citizens] = await pool.query(
      `SELECT id, ssid, nin, first_name, last_name, gender,
              state_of_origin, employment_type, nin_verified, created_at
       FROM citizens
       WHERE first_name LIKE ? OR last_name LIKE ? OR ssid LIKE ? OR nin LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [searchParam, searchParam, searchParam, searchParam, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM citizens
       WHERE first_name LIKE ? OR last_name LIKE ? OR ssid LIKE ? OR nin LIKE ?`,
      [searchParam, searchParam, searchParam, searchParam]
    );

    return res.status(200).json({
      citizens,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getAllCitizens error:', err);
    return res.status(500).json({ message: 'Server error fetching citizens.' });
  }
}

// ----------------------------------------------------------------
// GET /api/admin/logs
// Full system audit log (paginated)
// ----------------------------------------------------------------
async function getAllLogs(req, res) {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 30;
  const offset = (page - 1) * limit;

  try {
    const [logs] = await pool.query(
      `SELECT vl.id, vl.ssid_queried, vl.purpose, vl.agency,
              vl.result, vl.ip_address, vl.created_at,
              u.email AS queried_by
       FROM verification_logs vl
       JOIN users u ON vl.queried_by = u.id
       ORDER BY vl.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM verification_logs');

    return res.status(200).json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getAllLogs error:', err);
    return res.status(500).json({ message: 'Server error fetching logs.' });
  }
}

// ----------------------------------------------------------------
// GET /api/admin/officials
// List all government official accounts
// ----------------------------------------------------------------
async function getAllOfficials(req, res) {
  try {
    const [officials] = await pool.query(
      `SELECT id, email, agency, is_active, created_at
       FROM users
       WHERE role = 'official'
       ORDER BY created_at DESC`
    );

    return res.status(200).json({ officials });
  } catch (err) {
    console.error('getAllOfficials error:', err);
    return res.status(500).json({ message: 'Server error fetching officials.' });
  }
}

// ----------------------------------------------------------------
// POST /api/admin/officials
// Create a new government official account
// ----------------------------------------------------------------
async function createOfficial(req, res) {
  const { email, password, agency } = req.body;

  const validAgencies = ['PenCom', 'NSIPA', 'NASSCO'];
  if (!email || !password || !agency) {
    return res.status(400).json({ message: 'Email, password and agency are required.' });
  }
  if (!validAgencies.includes(agency)) {
    return res.status(400).json({ message: `Agency must be one of: ${validAgencies.join(', ')}` });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (citizen_id, role, email, password_hash, agency)
       VALUES (NULL, 'official', ?, ?, ?)`,
      [email, password_hash, agency]
    );

    return res.status(201).json({
      message: `Official account created for ${agency} successfully.`,
    });
  } catch (err) {
    console.error('createOfficial error:', err);
    return res.status(500).json({ message: 'Server error creating official.' });
  }
}

// ----------------------------------------------------------------
// PATCH /api/admin/users/:userId/toggle
// Activate or deactivate any user account
// ----------------------------------------------------------------
async function toggleUserStatus(req, res) {
  const { userId } = req.params;

  try {
    const [users] = await pool.query('SELECT id, is_active, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Prevent deactivating other admins
    if (users[0].role === 'admin') {
      return res.status(403).json({ message: 'Cannot deactivate admin accounts.' });
    }

    const newStatus = !users[0].is_active;
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);

    return res.status(200).json({
      message: `User account ${newStatus ? 'activated' : 'deactivated'} successfully.`,
    });
  } catch (err) {
    console.error('toggleUserStatus error:', err);
    return res.status(500).json({ message: 'Server error updating user status.' });
  }
}

module.exports = { getStats, getAllCitizens, getAllLogs, getAllOfficials, createOfficial, toggleUserStatus };
