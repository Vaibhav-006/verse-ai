import { Router } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../security/auth-middleware.js';
import { Chat } from '../models/Chat.js';

const router = Router();

// GET /api/chats - list user's chats (most recent first)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id })
      .select('_id title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ chats });
  } catch (e) {
    console.error('List chats error:', e);
    res.status(500).json({ message: 'Failed to list chats' });
  }
});

// POST /api/chats - create a new chat
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body || {};
    const chat = await Chat.create({ user: req.user.id, title: title?.trim() || 'New chat' });
    res.status(201).json({ chat: { _id: chat._id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt } });
  } catch (e) {
    console.error('Create chat error:', e);
    res.status(500).json({ message: 'Failed to create chat' });
  }
});

// GET /api/chats/:id - get a chat with messages
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid chat id' });
    const chat = await Chat.findOne({ _id: id, user: req.user.id }).lean();
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    res.json({ chat });
  } catch (e) {
    console.error('Get chat error:', e);
    res.status(500).json({ message: 'Failed to get chat' });
  }
});

// POST /api/chats/:id/messages - append a message
router.post('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content } = req.body || {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid chat id' });
    if (!role || !content || !['user', 'bot'].includes(role)) return res.status(400).json({ message: 'Invalid message' });

    const chat = await Chat.findOne({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    chat.messages.push({ role, content });
    // update title from first user message if default
    if ((!chat.title || chat.title === 'New chat') && role === 'user') {
      chat.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }
    await chat.save();
    res.status(201).json({ message: 'Appended', chatId: chat._id });
  } catch (e) {
    console.error('Append message error:', e);
    res.status(500).json({ message: 'Failed to append message' });
  }
});

export default router;
