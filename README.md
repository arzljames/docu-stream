# DocuStream

DocuStream is split into a Vite React frontend and a small Node.js upload bridge.

## Project Structure

- `frontend/` - React 19, TypeScript, Vite, TanStack Router, Tailwind CSS.
- `backend/` - local Node.js backend bridge for upload requests.
- `api/` - Vercel Function adapters that reuse backend handlers.

## Commands

On Windows PowerShell, use `npm.cmd`:

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

`npm.cmd run dev` starts both the backend bridge and the frontend. The frontend proxies `/api` to `http://localhost:8787`.

## Upload Bridge

The frontend uploads documents to `/api/upload`. The backend verifies the logged-in user's session, uploads the file to Zesty media storage, then creates a content item with the returned file ZUID.

Copy `.env.example` values into your deployment environment:

```env
PORT=8787
MEDIA_ZUID=
MEDIA_DRIVER=gcp
MEDIA_BUCKET_NAME=
ZESTY_INSTANCE_ZUID=8-e8e981c5f6-2twrfl
CONTENT_MODEL_ZUID=6-bcf1eac59e-4xdbl3
CONTENT_PARENT_ZUID=0
```

Use server-side env names, not `VITE_` names, for upload settings. Upload and content write requests use the currently signed-in user's bearer token.
