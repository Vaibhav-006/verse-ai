import { Router } from 'express';

const router = Router();

router.get('/gemini-key', (_req, res) => {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return res.status(404).json({ error: 'Key not configured' });
  // Note: returning the key to the client exposes it. This is per user request.
  return res.json({ key });
});

export default router;
