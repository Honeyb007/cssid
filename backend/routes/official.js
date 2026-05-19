const express    = require('express');
const router     = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
  verifyCitizen, updateBenefitStatus, getAgencyLogs
} = require('../controllers/officialController');

// All official routes require authentication + official role
router.use(authenticate);
router.use(authorize('official', 'admin'));

router.get('/verify',                           verifyCitizen);
router.patch('/benefits/:citizenId/:program',   updateBenefitStatus);
router.get('/logs',                             getAgencyLogs);

module.exports = router;
