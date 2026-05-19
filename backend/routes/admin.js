const express    = require('express');
const router     = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const {
  getStats, getAllCitizens, getAllLogs, getAllOfficials, createOfficial, toggleUserStatus
} = require('../controllers/adminController');

// All admin routes require authentication + admin role only
router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats',                    getStats);
router.get('/citizens',                 getAllCitizens);
router.get('/officials',                getAllOfficials);
router.get('/logs',                     getAllLogs);
router.post('/officials',               createOfficial);
router.patch('/users/:userId/toggle',   toggleUserStatus);

module.exports = router;
