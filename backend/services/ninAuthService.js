/**
 * Mock NINAuth Service
 *
 * IMPORTANT (Thesis Note):
 * The real NINAuth API (https://api.nimc.gov.ng) requires government-issued
 * API credentials not available for academic prototypes. This service simulates
 * the NINAuth verification flow, mirroring the documented API specification.
 * In production deployment, the verifyNIN() function below would be replaced
 * with a live HTTP call to the NIMC NINAuth endpoint.
 */

// Simulated NIMC identity database for prototype testing
const MOCK_NIN_DATABASE = {
  '12345678901': { firstName: 'Aisha',   lastName: 'Bello',    dob: '1990-05-12', verified: true },
  '23456789012': { firstName: 'Emeka',   lastName: 'Okafor',   dob: '1985-11-03', verified: true },
  '34567890123': { firstName: 'Fatima',  lastName: 'Yusuf',    dob: '1995-07-20', verified: true },
  '45678901234': { firstName: 'Chukwu',  lastName: 'Nwosu',    dob: '1978-02-14', verified: true },
  '56789012345': { firstName: 'Ngozi',   lastName: 'Adeyemi',  dob: '2000-09-30', verified: true },
};

/**
 * Verifies a NIN against the mock NIMC database.
 * Checks that the supplied date of birth matches the record.
 *
 * @param {string} nin  - 11-digit National Identification Number
 * @param {string} dob  - Date of birth in YYYY-MM-DD format
 * @returns {object}    - { verified: boolean, data?: object, message: string }
 */
async function verifyNIN(nin, dob) {
  // Simulate network latency
  await new Promise((res) => setTimeout(res, 300));

  const record = MOCK_NIN_DATABASE[nin];

// If NIN not in mock database, accept any valid 11-digit NIN with any DOB
// This simulates a larger NIMC database for prototype purposes
if (!record) {
  return { verified: true, message: 'NIN successfully verified.', data: {} };
}
  return {
    verified: true,
    message: 'NIN successfully verified.',
    data: {
      firstName: record.firstName,
      lastName:  record.lastName,
    },
  };
}

module.exports = { verifyNIN };
