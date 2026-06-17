# NMS Bahrain BookX

NMS Bahrain BookX is a real full-stack school book exchange application for NMS Bahrain students. Students can register, log in, post syllabus books, upload book images, find available books, request books, manage incoming requests, send direct messages, view notifications, use a rule-based AI Book Finder, and access admin statistics when their account has the admin role.

## Features

- NMS student registration with `@nmsedu.bh` email validation
- JWT login and session expiry handling
- Student profile and dashboard statistics
- Give, take, find, and request book workflows
- Book image uploads
- Direct messages and unread message notifications
- Request approval and rejection flows
- Leaderboard and trust points
- Admin dashboard statistics
- AI Book Finder for matching available books
- PWA metadata for installable mobile use

## Tech Stack

- Backend: FastAPI, Uvicorn, SQLAlchemy
- Database: MySQL with PyMySQL
- Frontend: React, Vite, Axios, React Icons
- Authentication: JWT bearer tokens
- Deployment: Vercel frontend, Railway or Render backend, hosted MySQL database

## Project Structure

```text
NMSBookExchange/
  backend/
    main.py
    database.py
    auth.py
    models.py
    schemas.py
    crud.py
    requirements.txt
    .env.example
    Procfile
  frontend/
    nms-book-frontend/
      index.html
      package.json
      .env.example
      public/
        manifest.json
        pwa-192.svg
        pwa-512.svg
        sw.js
      src/
```

## Local Backend Setup

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

For local MySQL, edit `backend\.env` and set:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE
SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

The backend health check is available at `http://127.0.0.1:8000/health`. API docs are available at `http://127.0.0.1:8000/docs` when `ENABLE_DOCS=true`.

## Local Frontend Setup

```powershell
cd frontend\nms-book-frontend
npm install
copy .env.example .env
npm run dev
```

For local development, set:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Environment Variables

Backend:

- `DATABASE_URL`: Hosted MySQL URL, for example `mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE`
- `SECRET_KEY`: Long random JWT signing secret
- `FRONTEND_URL`: Deployed frontend URL, used for CORS
- `CORS_ORIGINS`: Comma-separated allowed frontend origins
- `ENVIRONMENT`: Use `production` for deployment
- `ENABLE_DB_INIT`: Use `true` to create missing tables on startup
- `ENABLE_DOCS`: Use `true` to expose `/docs`, or `false` to hide docs
- `JWT_EXPIRE_MINUTES`: Token lifetime in minutes

Frontend:

- `VITE_API_BASE_URL`: Backend URL, for example `https://your-backend-app.up.railway.app`

## Database Setup

Use a hosted MySQL database on Railway, Render, PlanetScale, Aiven, or another MySQL provider. Create a database, copy its connection details, and set:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE
```

Do not commit real database credentials. Store them only in Railway, Render, Vercel, or a local `.env` file.

## Uploads and Images

The app currently stores uploaded book images in `backend/uploads` and serves them from `/uploads/...`.

This is stable for local testing and simple deployment, but local filesystem uploads are not durable on many free Railway or Render services. A redeploy, restart, or instance replacement can remove uploaded files. For production durability, move image storage to one of these services:

- Cloudinary
- Supabase Storage
- Amazon S3 or S3-compatible storage

The frontend already supports absolute image URLs, so a future storage integration can save Cloudinary/Supabase/S3 URLs in `book.image_url`.

## Vercel Frontend Deployment

1. Push the repository to GitHub.
2. Create a new Vercel project.
3. Set Root Directory to `frontend/nms-book-frontend`.
4. Set Build Command to `npm run build`.
5. Set Output Directory to `dist`.
6. Add environment variable `VITE_API_BASE_URL=<backend deployed URL>`.
7. Deploy.

## Railway Backend Deployment

1. Create a Railway project from the GitHub repository.
2. Set the backend service root directory to `backend` if Railway asks for one.
3. Add a Railway MySQL database or another hosted MySQL database.
4. Set environment variables:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE
SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_URL=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-vercel-app.vercel.app
ENVIRONMENT=production
ENABLE_DB_INIT=true
ENABLE_DOCS=true
```

5. Use this start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

The included `backend/Procfile` uses the same command.

## Render Backend Deployment

1. Create a Render Web Service from the GitHub repository.
2. Set Root Directory to `backend`.
3. Set Build Command to `pip install -r requirements.txt`.
4. Set Start Command to:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

5. Add the same backend environment variables listed in the Railway section.

## PWA Install Instructions

The frontend includes `manifest.json`, install icons, theme color, and a conservative service worker. After deploying to Vercel over HTTPS:

1. Open the Vercel app URL on a phone or desktop browser.
2. Use the browser install option, such as Add to Home Screen or Install App.
3. The installed app opens in standalone mode as BookX.

## Final Testing Checklist

Backend:

```powershell
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

Frontend:

```powershell
cd frontend\nms-book-frontend
npm install
npm run build
npm run dev
```

Manual checks:

- `GET /health`
- `GET /docs`
- Register with a valid NMS email
- Login
- Profile page
- Give book
- Take page
- Find page
- Messages
- AI Book Finder
- Admin dashboard with an admin user
- Image upload and image display
- PWA install prompt or Add to Home Screen

## Troubleshooting

- CORS errors: confirm `FRONTEND_URL` and `CORS_ORIGINS` match the exact Vercel URL, including `https://`.
- Database errors: confirm `DATABASE_URL` uses the `mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE` format and that the database accepts external connections.
- Login fails after deployment: confirm the same `SECRET_KEY` stays set between backend redeploys.
- Images disappear after redeploy: move uploads to Cloudinary, Supabase Storage, or S3-compatible storage.
- Frontend points to localhost in production: set `VITE_API_BASE_URL` in Vercel and redeploy the frontend.
- `/docs` missing: set `ENABLE_DOCS=true` on the backend.
