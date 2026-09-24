# Cosmic AI

Cosmic AI is deployed as one Vercel project:

- Static frontend: `frontend/`
- Serverless Express API: `api/index.js`
- Backend implementation: `backend/`

## Vercel settings

When importing this repository into Vercel, use the repository root as the project root. Do not set `frontend` or `backend` as the root directory.

- Framework preset: Other
- Root directory: `.`
- Build command: leave empty
- Output directory: leave empty
- Install command: `npm install`

The included `vercel.json` routes `/api/*` and `/uploads/*` to the Express serverless function and serves the HTML/CSS/JS frontend from `frontend/`.

## Environment variables

Add every variable required by the backend, especially the database and authentication secrets, in Vercel under Project Settings → Environment Variables. Redeploy after adding or changing variables.

## Important serverless limitation

Vercel serverless storage is ephemeral. Files uploaded to `backend/uploads` should not be treated as permanent storage. Use object storage such as Vercel Blob, S3, or another persistent storage provider for production uploads.

## Local run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.
