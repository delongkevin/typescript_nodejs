# Wireless Workbench

A fully functional TypeScript / Node.js backend application inspired by
[Shure's Wireless Workbench](https://www.shure.com/en-US/microphones-systems/software/wireless-workbench)
for managing and monitoring wireless microphone and in-ear monitor (IEM)
systems. It provides frequency coordination, inventory management, real-time
telemetry, and cloud backup — exposed over REST, GraphQL, and WebSockets.

## Stack

- **TypeScript** 5.6
- **Node.js** 20 LTS
- **Express** 4 for the REST API and middleware pipeline
- **Apollo Server** 4 for the GraphQL layer
- **`ws`** for real-time WebSocket telemetry streaming
- **AWS SDK v3** (S3 for backups, DynamoDB for device storage)
- **Zod** for request validation
- **JWT** + Node `crypto.scrypt` for authentication
- **Jest** + `ts-jest` for unit tests
- **Docker** for containerized deployment

## Features

### System Planning & Frequency Coordination
- Greedy frequency-coordination algorithm with a Most-Constrained-Variable
  ordering heuristic (`src/services/frequencyCoordinator.ts`).
- Respects per-device tuning range, global RF band, minimum inter-channel
  spacing, and a list of excluded (interfered) frequencies.
- Returns unassigned devices explicitly so the operator can adjust the plan.

### Inventory Management
- Full CRUD over devices and device groups.
- Simulated network discovery of Shure devices (ULXD4Q, AD4D, PSM1000, etc.).
- Tagging, grouping, and filtering.

### Real-Time Monitoring
- `MonitoringService` emits telemetry samples (RF signal dB, audio level dB,
  battery %, interference flag) every 2 seconds.
- Streamed to browsers via a JWT-authenticated WebSocket endpoint at `/ws`.
- REST snapshot endpoints at `/api/monitoring/latest`.

### Deployment / Configuration
- Swappable storage backend (`memory`, `file`, or `aws`) selected by env var.
- Optional AWS DynamoDB device repository and AWS S3 backup service.
- Docker + docker-compose for one-command deployment.

## REST API (summary)

All routes under `/api`. Authenticated routes require
`Authorization: Bearer <jwt>`.

| Method | Route                       | Role required   |
|--------|-----------------------------|-----------------|
| POST   | `/auth/login`               | -               |
| GET    | `/health`                   | -               |
| GET    | `/devices`                  | any             |
| POST   | `/devices`                  | admin, operator |
| PATCH  | `/devices/:id`              | admin, operator |
| DELETE | `/devices/:id`              | admin           |
| POST   | `/devices/discover`         | admin, operator |
| GET    | `/groups`                   | any             |
| POST   | `/groups`                   | admin, operator |
| POST   | `/coordinate`               | admin, operator |
| GET    | `/monitoring/latest`        | any             |
| POST   | `/backups`                  | admin           |
| GET    | `/backups`                  | admin           |

## GraphQL

Available at `/graphql`. Example query:

```graphql
query {
  devices { id name frequencyMhz status }
  monitoringLatest { deviceId batteryPercent rfSignalDb }
}
```

## WebSocket

Connect to `ws://<host>/ws?token=<jwt>`. Receives JSON messages of the form
`{ type: "sample" | "interference" | "welcome", data: {...} }`.

## Middleware Layer

The Express middleware pipeline in `src/api/middleware.ts` provides:

- Request logging with duration and status
- JWT authentication
- Role-based authorization (`admin`, `operator`, `viewer`)
- Body validation via Zod schemas
- Centralized error handling with safe defaults

## AWS Integration

- **DynamoDB** (`src/storage/dynamo.ts`) — production device storage.
- **S3** (`src/services/backupService.ts`) — timestamped JSON snapshots
  uploaded on demand or on a schedule.

Set `STORAGE_BACKEND=aws` and the AWS env vars from `.env.example` to enable.

## Running

```bash
# Install
npm install

# Run in dev
cp .env.example .env
npm run dev

# Build + start
npm run build
npm start

# Test
npm test

# Docker
docker compose up --build
```

Then open <http://localhost:4000/> in your browser. Default credentials are
`admin` / `admin` (override via `DEFAULT_ADMIN_PASSWORD`).

## Project Layout

```
src/
  api/           # REST routes, GraphQL, WebSocket, Express middleware
  domain/        # Types + Zod schemas
  services/      # Business logic: auth, inventory, coordination, monitoring, backup
  storage/       # Repository interfaces + memory / file / DynamoDB backends
  utils/         # Logger
  index.ts       # Server bootstrap
public/          # Static single-page web UI
```

## License

MIT
