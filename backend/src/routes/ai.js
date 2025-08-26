import { Router } from 'express';

const router = Router();

const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

router.post('/generate', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const { text, generationConfig } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing required field: text' });
    }

    const body = {
      contents: [
        {
          parts: [ { text } ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        stopSequences: [],
        ...(generationConfig || {})
      }
    };

    const resp = await fetch(`${MODEL_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const textResp = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Gemini API error`, details: textResp.slice(0, 1000) });
    }

    let data;
    try {
      data = JSON.parse(textResp);
    } catch (e) {
      return res.status(502).json({ error: 'Gemini non-JSON response', details: textResp.slice(0, 1000) });
    }

    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!out) {
      return res.status(502).json({ error: 'Invalid response format from Gemini', details: data });
    }

    return res.json({ text: out });
  } catch (err) {
    console.error('AI proxy error:', err);
    return res.status(500).json({ error: 'Internal error', details: err?.message || String(err) });
  }
});

export default router;
