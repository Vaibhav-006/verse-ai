import { Router } from 'express';

const router = Router();

router.get('/gemini-key', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return res.status(404).json({ error: 'Key not configured' });
  // Note: returning the key to the client exposes it. This is per user request.
  return res.json({ key });
});

export default router;
