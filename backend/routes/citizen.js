const express    = require('express');
const router     = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
  getProfile, getBenefits, getConsent, updateConsent, getActivity
} = require('../controllers/citizenController');

// All citizen routes require authentication + citizen role
router.use(authenticate);
router.use(authorize('citizen'));

router.get('/profile',           getProfile);
router.get('/benefits',          getBenefits);
router.get('/consent',           getConsent);
router.patch('/consent/:agency', updateConsent);
router.get('/activity',          getActivity);

module.exports = router;
