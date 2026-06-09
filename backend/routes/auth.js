const express = require('express');
const router  = express.Router();
const { register, login, verifyNINStep } = require('../controllers/authController');
const { upload } = require('../services/uploadService');

// Multer handles both fingerprint and passport in one request
const uploadFields = upload.fields([
  { name: 'fingerprint', maxCount: 1 },
  { name: 'passport',    maxCount: 1 },
]);

router.post('/verify-nin', verifyNINStep);
router.post('/register', uploadFields, register);
router.post('/login',    login);

module.exports = router;
