# VerseAI Backend

Express backend rebuilt to match the existing frontend. Now uses MongoDB (Mongoose).

## Endpoints

- POST `/signup`
  - Body: `{ name, email, password }`
  - Response: `{ message }`

- POST `/login`
  - Body: `{ email, password }`
  - Response: `{ message, token }`

- POST `/api/profile/update`
  - Body: `{ email, name?, bio? }`
  - Response: `{ message }`

- POST `/api/profile/avatar`
  - multipart/form-data with field `avatar`
  - Optional body: `email` (to bind avatar to user)
  - Response: `{ message, path }`

- GET `/health`
  - Response: `{ status: 'ok' }`

Uploads are served statically at `/uploads/...`.

## Getting Started

1. Node.js 18+
2. Create env file:

```
cp .env.example .env
```

3. Install and run:

```
npm install
npm run dev
```

Server runs at: `http://localhost:4000`

## Environment Variables

- `PORT` (default: 4000)
- `CORS_ORIGIN` (default: *)
- `JWT_SECRET` (default dev value)
- `MONGODB_URI` (Mongo connection string)
- `GEMINI_API_KEY` (Gemini API key returned by `/config/gemini-key`)

## Frontend Integration

- `login.html` and `signup.html` currently call `https://trial-b.onrender.com`. To use this backend locally, change those to `http://localhost:4000/login` and `http://localhost:4000/signup`.
- `profile/script.js` uses relative `/api/profile/avatar`. If serving frontend via a different origin, prepend the backend origin, e.g. `http://localhost:4000/api/profile/avatar`.

## Data Storage

- MongoDB via Mongoose. Provide `MONGODB_URI` in `.env`.

## Deploying on Render

- Build command: `npm install`
- Start command: `npm start`
- Environment variables (Render Dashboard): `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `MONGODB_URI`, `GEMINI_API_KEY`

## Config Route

- GET `/config/gemini-key` returns `{ key }` from `GEMINI_API_KEY`.
- Note: Exposing API keys to the browser is insecure. This exists to satisfy the current frontend requirement without changing the AI API URL.

## Notes

- This backend does not proxy the Gemini API. Your `AI/script.js` calls Google directly using `API_KEY`. If you want to move that to the backend (recommended for security), we can add a `/api/ai/chat` route that calls Gemini server-side and hides the key.
