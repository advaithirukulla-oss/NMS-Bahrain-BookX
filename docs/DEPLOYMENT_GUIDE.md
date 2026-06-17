# Deployment Guide

## Backend

1. Create a production server or platform service for the FastAPI app.
2. Install dependencies from `backend\requirements.txt`.
3. Configure environment variables from `backend\.env.example`.
4. Set `ENVIRONMENT=production`.
5. Set `CORS_ORIGINS` to the exact deployed frontend URL.
6. Store real MySQL and JWT secrets in the server environment.
7. Start the API with:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

For a managed server, run the command behind a process manager or platform runtime that restarts the app if it exits.

## Frontend

1. Set `VITE_API_BASE_URL` in `frontend\nms-book-frontend\.env` to the deployed backend URL.
2. Build the app:

```bash
npm run build
```

3. Deploy the generated `dist` folder to a static host.
4. Confirm the hosted frontend can reach `GET /health` on the backend.

## Production Readiness Checks

- Use HTTPS for both frontend and backend.
- Use a long random JWT secret.
- Do not commit real `.env` files.
- Restrict CORS to trusted frontend origins only.
- Keep MySQL credentials outside source control.
- Run `npm run lint` and `npm run build` before release.
- Review server logs after the first production login and book request.
