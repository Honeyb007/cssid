const pool = require('../config/db');

// ----------------------------------------------------------------
// GET /api/citizen/profile
// Returns the logged-in citizen's full profile
// ----------------------------------------------------------------
async function getProfile(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.nin, c.ssid, c.first_name, c.last_name, c.middle_name,
              c.dob, c.gender, c.phone, c.email, c.state_of_origin, c.lga,
              c.address, c.employment_type, c.passport_path, c.nin_verified,
              c.created_at
       FROM citizens c
       WHERE c.id = ?`,
      [req.user.citizenId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Citizen profile not found.' });
    }

    return res.status(200).json({ citizen: rows[0] });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ message: 'Server error fetching profile.' });
  }
}

// ----------------------------------------------------------------
// GET /api/citizen/benefits
// Returns all benefit eligibility records for the logged-in citizen
// ----------------------------------------------------------------
async function getBenefits(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT be.program, be.status, be.notes, be.last_verified_at,
              u.email AS verified_by_email, u.agency AS verified_by_agency
       FROM benefit_eligibility be
       LEFT JOIN users u ON be.verified_by = u.id
       WHERE be.citizen_id = ?
       ORDER BY be.program`,
      [req.user.citizenId]
    );

    return res.status(200).json({ benefits: rows });
  } catch (err) {
    console.error('getBenefits error:', err);
    return res.status(500).json({ message: 'Server error fetching benefits.' });
  }
}

// ----------------------------------------------------------------
// GET /api/citizen/consent
// Returns the citizen's agency consent settings
// ----------------------------------------------------------------
async function getConsent(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT agency, granted, granted_at, revoked_at
       FROM consent_records
       WHERE citizen_id = ?`,
      [req.user.citizenId]
    );

    return res.status(200).json({ consent: rows });
  } catch (err) {
    console.error('getConsent error:', err);
    return res.status(500).json({ message: 'Server error fetching consent.' });
  }
}

// ----------------------------------------------------------------
// PATCH /api/citizen/consent/:agency
// Toggle consent for a specific agency
// ----------------------------------------------------------------
async function updateConsent(req, res) {
  const { agency } = req.params;
  const { granted } = req.body;

  const validAgencies = ['PenCom', 'NSIPA', 'NASSCO'];
  if (!validAgencies.includes(agency)) {
    return res.status(400).json({ message: 'Invalid agency specified.' });
  }

  try {
    await pool.query(
      `UPDATE consent_records
       SET granted = ?, revoked_at = ?
       WHERE citizen_id = ? AND agency = ?`,
      [
        granted,
        granted ? null : new Date(),
        req.user.citizenId,
        agency,
      ]
    );

    return res.status(200).json({
      message: `Consent for ${agency} ${granted ? 'granted' : 'revoked'} successfully.`,
    });
  } catch (err) {
    console.error('updateConsent error:', err);
    return res.status(500).json({ message: 'Server error updating consent.' });
  }
}

// ----------------------------------------------------------------
// GET /api/citizen/activity
// Returns recent verification activity on this citizen's SSID
// ----------------------------------------------------------------
async function getActivity(req, res) {
  try {
    // First get the citizen's SSID
    const [citizen] = await pool.query(
      'SELECT ssid FROM citizens WHERE id = ?',
      [req.user.citizenId]
    );

    if (citizen.length === 0) {
      return res.status(404).json({ message: 'Citizen not found.' });
    }

    const [logs] = await pool.query(
      `SELECT vl.purpose, vl.agency, vl.result, vl.created_at
       FROM verification_logs vl
       WHERE vl.ssid_queried = ?
       ORDER BY vl.created_at DESC
       LIMIT 20`,
      [citizen[0].ssid]
    );

    return res.status(200).json({ activity: logs });
  } catch (err) {
    console.error('getActivity error:', err);
    return res.status(500).json({ message: 'Server error fetching activity.' });
  }
}

module.exports = { getProfile, getBenefits, getConsent, updateConsent, getActivity };
