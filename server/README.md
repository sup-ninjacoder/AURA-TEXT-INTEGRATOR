# Aura Backend

Node.js + Express server that handles AI generation. The OpenAI API key stays on the server and is never exposed to the extension.

## Setup

1. **Install dependencies**

   ```bash
   cd server
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your OpenAI API key:

   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

   Do not commit `.env` or share your key.

## Run the server

```bash
npm start
```

Server runs at **http://localhost:5000**. The extension calls `POST http://localhost:5000/generate` with `{ "message": "..." }` and receives `{ "reply": "..." }`.

## Endpoints

- **POST /generate**  
  - Body: `{ "message": "string" }`  
  - Returns: `{ "reply": "string" }`  
  - Uses `gpt-4o-mini` with a fixed system prompt. API key is read from `.env` only.

- **GET /health**  
  - Returns `{ "ok": true }` for liveness checks.

## Security

- `OPENAI_API_KEY` is loaded from `.env` on the server.
- The key is never sent in responses or exposed to the frontend or extension.
