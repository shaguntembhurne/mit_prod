# Student AI Chat Frontend (`student-ai-chat-frontend`)

A clean, modular, responsive React + Vite + Tailwind CSS frontend for the University's AI-powered government data analysis chatbot (powered by **Gemma via `llama.cpp`** and **Model Context Protocol (MCP)** dataset tools through the Django backend).

---

## 1. Extracting the ZIP Archive

Unzip `student-ai-chat-frontend.zip` and navigate into the project directory:

```bash
unzip student-ai-chat-frontend.zip
cd student-ai-chat-frontend
```

---

## 2. Installing Node.js Dependencies

Ensure you have **Node.js 18+** installed, then run:

```bash
npm install
```

---

## 3. Configuring `VITE_API_BASE_URL`

Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

Verify that `.env` points to your local Django backend server on port `8002`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8002
```

*(Note: Never place MCP URLs, LLM endpoints, API keys, or SMTP credentials in `.env`. The frontend communicates exclusively with the Django server.)*

---

## 4. Starting the Frontend Locally

Start the Vite development server:

```bash
npm run dev
```

Open the printed local URL in your browser (by default `http://localhost:5173` or `http://127.0.0.1:5173`).

---

## 5. Building for Production

To compile and verify the production bundle:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## 6. Connecting to the Django Backend on Port 8002

Start your Django backend on `127.0.0.1:8002`:

```bash
python manage.py runserver 127.0.0.1:8002
```

### Integrated API Endpoints
All requests are routed through the centralized client in `src/api/client.js`:

| Flow | Endpoint | Method | Payload / Headers |
| :--- | :--- | :--- | :--- |
| **Request OTP** | `/api/auth/otp/request/` | `POST` | `{ "email": "student@mituniversity.edu.in" }` |
| **Verify OTP** | `/api/auth/otp/verify/` | `POST` | `{ "email": "student@mituniversity.edu.in", "otp": "123456" }` |
| **Refresh Token** | `/api/auth/token/refresh/` | `POST` | `{ "refresh": "<REFRESH_TOKEN>" }` |
| **Get Current User** | `/api/auth/me/` | `GET` | Header: `Authorization: Bearer <ACCESS_TOKEN>` |
| **Send Chat Message** | `/api/chat/` | `POST` | Header: `Authorization: Bearer <ACCESS_TOKEN>`<br>Body: `{ "message": "Find datasets about road accidents in Maharashtra" }` |
| **Logout** | `/api/auth/logout/` | `POST` | Header: `Authorization: Bearer <ACCESS_TOKEN>`<br>Body: `{ "refresh": "<REFRESH_TOKEN>" }` |

---

## 7. Security & Token Storage Strategy

- **Token Storage Trade-offs**:
  - *Ideal Strategy*: `HttpOnly`, `Secure`, `SameSite=Lax/Strict` cookies set directly by Django prevent JavaScript access to tokens during an XSS event.
  - *Current Backend Compatibility*: Because the existing Django REST + SimpleJWT endpoints return `access` and `refresh` tokens in the JSON response body and expect `Authorization: Bearer <access_token>` headers, the frontend stores tokens in `sessionStorage` (backed by an in-memory reference in `src/utils/tokenStorage.js`).
  - *Why `sessionStorage` over `localStorage`*: Tokens survive page reloads within the active tab (fulfilling Requirement 2.8) but are automatically purged as soon as the student closes the browser tab or clicks **Sign Out**, minimizing persistent token exposure.
- **Zero Secret Exposure**: No MCP server URLs, `llama.cpp` endpoints, or SMTP credentials exist in the frontend bundle.
- **Anti-Loop Refresh Protection**: `src/api/client.js` deduplicates concurrent `401` token refresh calls using a shared promise and retries failed requests at most once (`isRetry = true`) before clearing the session.

---

## 8. Troubleshooting CORS & Backend Configuration Requirements

If the browser shows **"Unable to reach the Django backend at http://127.0.0.1:8002"**, check the following in your Django project:

1. **Install and enable `django-cors-headers`**:
   ```bash
   pip install django-cors-headers
   ```
2. **Add `corsheaders` to `INSTALLED_APPS` and `MIDDLEWARE` in `settings.py`**:
   ```python
   INSTALLED_APPS = [
       # ...
       "corsheaders",
   ]

   MIDDLEWARE = [
       "corsheaders.middleware.CorsMiddleware",  # Must be placed near the top before CommonMiddleware
       "django.middleware.common.CommonMiddleware",
       # ...
   ]
   ```
3. **Allow the Vite frontend origin in `settings.py`**:
   ```python
   CORS_ALLOWED_ORIGINS = [
       "http://localhost:5173",
       "http://127.0.0.1:5173",
   ]
   ```
4. **Response Schema Compatibility**:
   - `POST /api/chat/`: `src/api/client.js` reads `response` (and gracefully supports `reply`, `answer`, or `message` if your serializer differs) along with optional `tools_used` (array of strings or tool invocation objects).
