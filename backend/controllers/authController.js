const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../config/db');
const { verifyNIN }       = require('../services/ninAuthService');
const { generateSSID }    = require('../services/ssidService');
const { saveFingerprint, savePassport } = require('../services/uploadService');
require('dotenv').config();

// ----------------------------------------------------------------
// POST /api/auth/register
// ----------------------------------------------------------------
async function register(req, res) {
  const {
    nin, dob, first_name, last_name, middle_name,
    gender, phone, email, password,
    state_of_origin, lga, address, employment_type,
  } = req.body;

  // 1. Basic field validation
  if (!nin || !dob || !first_name || !last_name || !gender ||
      !phone || !password || !state_of_origin || !lga) {
    return res.status(400).json({ message: 'All required fields must be provided.' });
  }

  if (!/^\d{11}$/.test(nin)) {
    return res.status(400).json({ message: 'NIN must be exactly 11 digits.' });
  }

  try {
    // 2. Check NIN not already registered
    const [existing] = await pool.query('SELECT id FROM citizens WHERE nin = ?', [nin]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This NIN is already registered in the system.' });
    }

    // 3. Verify NIN against mock NINAuth
    const ninResult = await verifyNIN(nin, dob);
    if (!ninResult.verified) {
      return res.status(400).json({ message: `NIN verification failed: ${ninResult.message}` });
    }

    // 4. Generate unique SSID
    const ssid = await generateSSID();

    // 5. Process uploaded images
    let fingerprintPath = null;
    let passportPath    = null;

    if (req.files?.fingerprint?.[0]) {
      fingerprintPath = await saveFingerprint(req.files.fingerprint[0].buffer, ssid);
    }
    if (req.files?.passport?.[0]) {
      passportPath = await savePassport(req.files.passport[0].buffer, ssid);
    }

    // 6. Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // 7. Insert citizen record
    const [citizenResult] = await pool.query(
      `INSERT INTO citizens
        (nin, ssid, first_name, last_name, middle_name, dob, gender,
         phone, email, state_of_origin, lga, address, employment_type,
         fingerprint_path, passport_path, nin_verified)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nin, ssid, first_name, last_name, middle_name || null, dob, gender,
        phone, email || null, state_of_origin, lga, address || null,
        employment_type || 'informal', fingerprintPath, passportPath, true,
      ]
    );

    const citizenId = citizenResult.insertId;

    // 8. Create login account
    await pool.query(
      `INSERT INTO users (citizen_id, role, email, password_hash)
       VALUES (?, 'citizen', ?, ?)`,
      [citizenId, email || `${nin}@ssid.gov.ng`, password_hash]
    );

    // 9. Create default consent records for both agencies
    await pool.query(
      `INSERT INTO consent_records (citizen_id, agency, granted) VALUES (?,?,?),(?,?,?)`,
      [citizenId, 'PenCom', true, citizenId, 'NSIPA', true]
    );

    // 10. Create default benefit eligibility entries
    await pool.query(
      `INSERT INTO benefit_eligibility (citizen_id, program, status) VALUES
       (?, 'CPS', 'pending'),
       (?, 'CCT', 'pending'),
       (?, 'NPOWER', 'pending'),
       (?, 'SCHOOL_FEEDING', 'pending')`,
      [citizenId, citizenId, citizenId, citizenId]
    );

    return res.status(201).json({
      message: 'Registration successful.',
      ssid,
      name: `${first_name} ${last_name}`,
    });

  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
}

// ----------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [users] = await pool.query(
      `SELECT u.*, c.ssid, c.first_name, c.last_name
       FROM users u
       LEFT JOIN citizens c ON u.citizen_id = c.id
       WHERE u.email = ? AND u.is_active = TRUE`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }


    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      {
        userId:    user.id,
        citizenId: user.citizen_id,
        role:      user.role,
        agency:    user.agency,
        ssid:      user.ssid || null,
        name:      user.first_name ? `${user.first_name} ${user.last_name}` : user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      role:    user.role,
      name:    user.first_name ? `${user.first_name} ${user.last_name}` : user.email,
      ssid:    user.ssid || null,
      agency:  user.agency || null,
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
}
// ----------------------------------------------------------------
// POST /api/auth/verify-nin
// Step 1 of enrollment — verify NIN against NINAuth gateway.
// Returns partial citizen data (name) if found in mock database.
// This endpoint exists separately from /register so the frontend
// can autofill fields BEFORE the citizen completes the full form.
// In production: this would be a consent-gated NINAuth API call.
// ----------------------------------------------------------------
async function verifyNINStep(req, res) {
  const { nin, dob } = req.body;

  if (!nin || !dob) {
    return res.status(400).json({ message: 'NIN and date of birth are required.' });
  }

  if (!/^\d{11}$/.test(nin)) {
    return res.status(400).json({ message: 'NIN must be exactly 11 digits.' });
  }

  try {
    // Check if NIN is already registered in the system
    const [existing] = await pool.query(
      'SELECT id FROM citizens WHERE nin = ?', [nin]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        message: 'This NIN is already registered in the CNSSID system.',
      });
    }

    // Call NINAuth gateway
    const ninResult = await verifyNIN(nin, dob);

    if (!ninResult.verified) {
      return res.status(400).json({
        message: ninResult.message,
        errorCode: ninResult.errorCode || null,
      });
    }

    // Return whatever the gateway gave us
    // If NIN is in mock DB → real name returned
    // If NIN is unknown → name is null (citizen fills manually)
    return res.status(200).json({
      verified: true,
      message: ninResult.message,
      data: {
        firstName: ninResult.data?.firstName || null,
        lastName:  ninResult.data?.lastName  || null,
        gender:    ninResult.data?.gender    || null,
        phone:     ninResult.data?.phone     || null,
        // We never return the full DOB back — security best practice
      },
    });

  } catch (err) {
    console.error('verifyNINStep error:', err);
    return res.status(500).json({ message: 'Server error during NIN verification.' });
  }
}

module.exports = { register, login, verifyNINStep };
