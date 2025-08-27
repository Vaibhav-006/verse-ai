import { Router } from 'express';
import { authMiddleware } from '../security/auth-middleware.js';
import { Chat } from '../models/Chat.js';

const router = Router();

// GET /api/dashboard/summary
// Returns user-specific dashboard stats and recent activity
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Stats
    const chats = await Chat.countDocuments({ user: userId });

    // Estimate hours used based on chat lifetimes (createdAt->updatedAt)
    const chatDocs = await Chat.find({ user: userId })
      .select('createdAt updatedAt title messages')
      .sort({ updatedAt: -1 })
      .limit(20) // enough to estimate time and recent activity
      .lean();

    let totalMs = 0;
    const recentActivity = [];

    for (const c of chatDocs) {
      const start = new Date(c.createdAt).getTime();
      const end = new Date(c.updatedAt || c.createdAt).getTime();
      const dur = Math.max(end - start, 0);
      totalMs += dur;

      // Build a simple recent activity entry from last message or chat
      const lastMsg = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1] : null;
      recentActivity.push({
        type: 'chat',
        title: c.title || (lastMsg?.content ? lastMsg.content.slice(0, 50) : 'AI Chat'),
        at: c.updatedAt || c.createdAt,
      });
    }

    // Convert ms to hours with 2 decimals, minimum 0
    const hours = Math.round((totalMs / 36e5) * 100) / 100;

    // Placeholder rating (extend schema later if needed)
    const rating = 4.8;

    res.json({
      stats: {
        chats,
        hours,
        rating,
      },
      recentActivity,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ message: 'Failed to compute dashboard summary' });
  }
});

export default router;
