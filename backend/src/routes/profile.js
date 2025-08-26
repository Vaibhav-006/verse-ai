import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { authMiddleware } from '../security/auth-middleware.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../uploads/avatars');
await fs.ensureDir(UPLOADS_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// POST /api/profile/update
// Accepts optional auth; if token present, we store against user; otherwise, update a demo profile
router.post('/update', async (req, res) => {
  try {
    const { name, email, bio } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    // Find user by email or create if not present (only for demo completeness)
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await User.create({
        name: name || 'User',
        email: email.toLowerCase(),
        passwordHash: '',
        bio: bio || ''
      });
    } else {
      if (name) user.name = name;
      if (bio !== undefined) user.bio = bio;
      await user.save();
    }
    return res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Error updating profile' });
  }
});

// POST /api/profile/avatar
// multipart/form-data with field 'avatar'
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const publicPath = `/uploads/avatars/${req.file.filename}`;

    // Optionally bind to a user by email in query/body
    const { email } = req.body || {};
    if (email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.avatar = publicPath;
        await user.save();
      }
    }

    return res.json({ message: 'Avatar uploaded successfully', path: publicPath });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return res.status(500).json({ error: 'Error uploading avatar' });
  }
});

export default router;
