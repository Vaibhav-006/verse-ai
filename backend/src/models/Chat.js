import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'bot'], required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const chatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    title: { type: String, default: 'New chat' },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

export const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
