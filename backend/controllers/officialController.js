const pool = require('../config/db');

// ----------------------------------------------------------------
// GET /api/official/verify?ssid=XX or ?nin=XX
// Core function — look up a citizen by SSID or NIN
// Logs every query to the audit trail
// ----------------------------------------------------------------
async function verifyCitizen(req, res) {
  const { ssid, nin } = req.query;

  if (!ssid && !nin) {
    return res.status(400).json({ message: 'Provide either ssid or nin as a query parameter.' });
  }

  try {
    // Build query based on what was provided
    const field = ssid ? 'c.ssid' : 'c.nin';
    const value = ssid || nin;

    const [rows] = await pool.query(
      `SELECT c.id, c.ssid, c.nin, c.first_name, c.last_name, c.middle_name,
              c.dob, c.gender, c.phone, c.state_of_origin, c.lga,
              c.employment_type, c.passport_path, c.nin_verified, c.created_at
       FROM citizens c
       WHERE ${field} = ?`,
      [value]
    );

    const result = rows.length > 0 ? 'found' : 'not_found';

    // Log this query to audit trail regardless of result
    await pool.query(
      `INSERT INTO verification_logs
        (ssid_queried, queried_by, purpose, agency, result, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ssid || (rows[0]?.ssid || nin),
        req.user.userId,
        req.query.purpose || 'identity_verification',
        req.user.agency || 'Unknown Agency',
        result,
        req.ip,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No citizen found with the provided identifier.' });
    }

    // Check consent — does this citizen allow this agency to query them?
    const [consent] = await pool.query(
      `SELECT granted FROM consent_records
       WHERE citizen_id = ? AND agency = ?`,
      [rows[0].id, req.user.agency]
    );

    const hasConsent = consent.length === 0 || consent[0].granted;

    if (!hasConsent) {
      return res.status(403).json({
        message: 'Citizen has revoked consent for your agency to access their records.',
      });
    }

    // Fetch benefit eligibility for this citizen
    const [benefits] = await pool.query(
      `SELECT program, status, notes, last_verified_at
       FROM benefit_eligibility
       WHERE citizen_id = ?`,
      [rows[0].id]
    );

    return res.status(200).json({
      message: 'Citizen identity verified successfully.',
      citizen: rows[0],
      benefits,
    });

  } catch (err) {
    console.error('verifyCitizen error:', err);
    return res.status(500).json({ message: 'Server error during verification.' });
  }
}

// ----------------------------------------------------------------
// PATCH /api/official/benefits/:citizenId/:program
// Update a citizen's benefit eligibility status
// ----------------------------------------------------------------
async function updateBenefitStatus(req, res) {
  const { citizenId, program } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['eligible', 'ineligible', 'pending', 'suspended'];

// Agency-based program restrictions
const agencyPrograms = {
  PenCom: ['CPS'],
  NSIPA:  ['CCT', 'NPOWER', 'SCHOOL_FEEDING'],
  NASSCO: ['CCT'],
};

const allowedPrograms = agencyPrograms[req.user.agency] || [];

if (!validStatuses.includes(status)) {
  return res.status(400).json({ message: 'Invalid status value.' });
}
if (!allowedPrograms.includes(program)) {
  return res.status(403).json({
    message: `${req.user.agency} is not authorized to update ${program} benefits.`,
  });
}

  try {
    await pool.query(
      `UPDATE benefit_eligibility
       SET status = ?, notes = ?, last_verified_at = NOW(), verified_by = ?
       WHERE citizen_id = ? AND program = ?`,
      [status, notes || null, req.user.userId, citizenId, program]
    );

    return res.status(200).json({
      message: `${program} status updated to "${status}" successfully.`,
    });
  } catch (err) {
    console.error('updateBenefitStatus error:', err);
    return res.status(500).json({ message: 'Server error updating benefit status.' });
  }
}

// ----------------------------------------------------------------
// GET /api/official/logs
// View recent verification logs for this official's agency
// ----------------------------------------------------------------
async function getAgencyLogs(req, res) {
  try {
    const [logs] = await pool.query(
      `SELECT vl.id, vl.ssid_queried, vl.purpose, vl.result,
              vl.ip_address, vl.created_at,
              u.email AS queried_by_email
       FROM verification_logs vl
       JOIN users u ON vl.queried_by = u.id
       WHERE vl.agency = ?
       ORDER BY vl.created_at DESC
       LIMIT 50`,
      [req.user.agency]
    );

    return res.status(200).json({ logs });
  } catch (err) {
    console.error('getAgencyLogs error:', err);
    return res.status(500).json({ message: 'Server error fetching logs.' });
  }
}

module.exports = { verifyCitizen, updateBenefitStatus, getAgencyLogs };
