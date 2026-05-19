const pool = require('../config/db');

/**
 * Generates a unique Social Security ID.
 * Format: SS-YYYY-XXXXXX-C
 * Example: SS-2026-000142-7
 *
 * Components:
 *   SS     — system prefix
 *   YYYY   — year of registration
 *   XXXXXX — zero-padded sequential number
 *   C      — mod-10 checksum digit
 */

function computeChecksum(base) {
  // Simple mod-10 checksum on numeric characters only
  const digits = base.replace(/\D/g, '');
  const sum = digits
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d) * (i % 2 === 0 ? 1 : 2), 0);
  return (10 - (sum % 10)) % 10;
}

async function generateSSID() {
  const year = new Date().getFullYear();

  // Get current count to determine sequential number
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM citizens WHERE YEAR(created_at) = ?',
    [year]
  );
  const sequential = (rows[0].total || 0) + 1;
  const padded = String(sequential).padStart(6, '0');
  const base = `SS${year}${padded}`;
  const checksum = computeChecksum(base);

  return `SS-${year}-${padded}-${checksum}`;
}

module.exports = { generateSSID };
