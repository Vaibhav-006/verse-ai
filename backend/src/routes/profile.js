import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
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

// Helper: optional auth that sets req.user if token is valid, otherwise continues
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
  } catch (_) {
    // ignore invalid tokens in optional path
  }
  next();
}

// POST /api/profile/update
// Accepts optional auth; if token present, we store against the authenticated user; otherwise, upsert by email
router.post('/update', optionalAuth, async (req, res) => {
  try {
    const { name, email, bio } = req.body || {};

    // If authenticated, update the logged-in user's profile
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (name) user.name = name;
      if (bio !== undefined) user.bio = bio;
      // Allow updating email if provided and different
      if (email && email.toLowerCase() !== user.email) user.email = email.toLowerCase();
      await user.save();
      return res.json({ message: 'Profile updated successfully', user: { name: user.name, email: user.email, bio: user.bio, avatar: user.avatar } });
    }

    // Fallback: upsert by email (for demo/unauth flows)
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (!existing) {
      const created = await User.create({
        name: name || 'User',
        email: email.toLowerCase(),
        passwordHash: '',
        bio: bio || ''
      });
      return res.json({ message: 'Profile created successfully', user: { name: created.name, email: created.email, bio: created.bio, avatar: created.avatar } });
    } else {
      if (name) existing.name = name;
      if (bio !== undefined) existing.bio = bio;
      await existing.save();
      return res.json({ message: 'Profile updated successfully', user: { name: existing.name, email: existing.email, bio: existing.bio, avatar: existing.avatar } });
    }
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Error updating profile' });
  }
});

// POST /api/profile/avatar
// multipart/form-data with field 'avatar'
router.post('/avatar', optionalAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const publicPath = `/uploads/avatars/${req.file.filename}`;

    // Prefer authenticated user binding
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id);
      if (user) {
        user.avatar = publicPath;
        await user.save();
      }
    } else {
      // Optionally bind to a user by email in body
      const { email } = req.body || {};
      if (email) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          user.avatar = publicPath;
          await user.save();
        }
      }
    }

    return res.json({ message: 'Avatar uploaded successfully', path: publicPath });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return res.status(500).json({ error: 'Error uploading avatar' });
  }
});

// GET /api/profile/me - return current authenticated user's profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, email, bio, avatar } = user;
    return res.json({ name, email, bio, avatar });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ error: 'Error fetching profile' });
  }
});

export default router;
