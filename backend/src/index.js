import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import { connectMongo } from './db/mongo.js';
import configRoutes from './routes/config.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Config
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// Static for uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/', authRoutes); // /signup, /login
app.use('/api/profile', profileRoutes); // /update, /avatar
app.use('/config', configRoutes); // /gemini-key

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server after DB connect
async function start() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await connectMongo(mongoUri);
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`VerseAI backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message || err);
    process.exit(1);
  }
}

start();
