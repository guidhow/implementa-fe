# DevMind — Feature-to-Code Frontend

A React web application that bridges your issue tracker (Azure DevOps or Jira) with GitHub Copilot-powered code generation. Log in with GitHub, connect a project, select a feature/work item, and let the backend generate an implementation branch automatically.

## Features

- **GitHub OAuth** — authenticate with your GitHub account to unlock project features
- **Azure DevOps & Jira integration** — connect to your issue tracker and browse work items
- **AI code generation** — trigger background jobs that use GitHub Copilot to implement features
- **Job monitoring** — track the status of running jobs and view real-time logs
- **Configurable models** — choose from available Copilot models or enter a custom model name
- **Docker-ready** — ships with a multi-stage Dockerfile and an Nginx reverse-proxy config

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Build tool | Vite 5 |
| Routing | React Router DOM 6 |
| Data fetching | TanStack React Query 5 + Axios |
| Container | Docker (Node 22 build → Nginx Alpine serve) |

## Prerequisites

- **Node.js** ≥ 18 and **npm**
- A running instance of the [implementa backend](https://github.com/guidhow/implementa) (defaults to `http://localhost:8000`)

## Local Development

```bash
# Install dependencies
npm install

# Start the dev server (proxies /api/* to http://localhost:8000)
npm run dev
```

The app will be available at <http://localhost:5173>.

The Vite dev server automatically proxies all `/api` requests to `http://localhost:8000`. If your backend runs on a different port, update the `proxy.target` in `vite.config.js`.

## Build

```bash
npm run build
```

The production bundle is written to `dist/`.

## Lint

```bash
npm run lint
```

## Docker

### Build the image

```bash
docker build -t devmind-fe .
```

### Run the container

```bash
docker run -p 80:80 -e BACKEND_URL=http://<your-backend-host>:8000 devmind-fe
```

The `BACKEND_URL` environment variable tells Nginx where to forward `/api` requests at runtime. It defaults to `http://localhost:8000`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | *(empty)* | API base URL used at **build time** (leave empty to use the Vite proxy in dev or the Nginx proxy in production) |
| `BACKEND_URL` | `http://localhost:8000` | Backend URL injected into the Nginx config at **container start** |

## Project Structure

```
src/
├── api.js          # Axios client + all API call functions
├── App.jsx         # Root component (routing, auth, config panel)
├── main.jsx        # React entry point
├── index.css       # Global styles
├── images/         # Static assets (logo, etc.)
└── pages/
    ├── Features.jsx  # Work-item list and job submission
    ├── Jobs.jsx      # Job history list
    └── JobDetail.jsx # Real-time job log viewer
```

## Authentication Flow

1. Click **Login with GitHub** — the app fetches the OAuth client ID from the backend and redirects to GitHub.
2. GitHub redirects back with a `?code=` parameter.
3. The app exchanges the code with the backend, which returns an access token and user profile.
4. The token is stored in `localStorage` and attached to every subsequent API request as a `Bearer` token.

## License

This project is private. All rights reserved.
