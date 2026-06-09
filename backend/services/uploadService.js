const multer  = require('multer');
const sharp   = require('sharp');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

// Use a temp directory for development uploads to avoid triggering
// Live Server / editor file-watch auto-reloads when the backend writes
// files into the workspace. This keeps the frontend state stable.
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'cnssid_uploads');
const FINGERPRINT_DIR = path.join(UPLOAD_ROOT, 'fingerprints');
const PASSPORT_DIR    = path.join(UPLOAD_ROOT, 'passports');
[FINGERPRINT_DIR, PASSPORT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Store uploads in memory first — Sharp will process before writing to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG images are accepted.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * Process and save a fingerprint image.
 * Resizes to 300x300, converts to JPEG, saves to disk.
 */
async function saveFingerprint(buffer, ssid) {
  const filename = `fp_${ssid.replace(/-/g, '_')}.jpg`;
  const filepath  = path.join(FINGERPRINT_DIR, filename);

  await sharp(buffer)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(filepath);

  return filepath;
}

/**
 * Process and save a passport photo.
 * Resizes to 200x200, converts to JPEG, saves to disk.
 */
async function savePassport(buffer, ssid) {
  const filename = `pp_${ssid.replace(/-/g, '_')}.jpg`;
  const filepath  = path.join(PASSPORT_DIR, filename);

  await sharp(buffer)
    .resize(200, 200, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(filepath);

  return filepath;
}

module.exports = { upload, saveFingerprint, savePassport };
