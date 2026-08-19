# Store Management Backend Service

Backend REST API and real-time service for the Store Management system built with Node.js, Express, MongoDB (Mongoose), and Socket.io.

## Project Structure

```
├── server.js               # Entry point
├── src/
│   ├── app.js              # Express app initialization & middleware configuration
│   ├── socket.js           # Realtime Socket.IO configuration
│   ├── config/             # DB, environment, mailer, S3, storage configs
│   ├── constants/          # Application constants
│   ├── controllers/        # Route controllers (Add your domain logic here)
│   ├── cron/               # Scheduled tasks
│   ├── middlewares/        # Express middlewares (auth, validation, error, rate-limit)
│   ├── models/             # Mongoose schemas (Add your domain models here)
│   ├── routes/             # API routes definition
│   ├── services/           # Business logic & services
│   ├── templates/          # Email/Document templates
│   ├── utils/              # Utility helpers (logger, response formats, error classes)
│   └── validations/        # Request payload validation schemas
└── tests/                  # Unit and integration tests
```

## Documentation

For a comprehensive explanation of the folder structure, request lifecycles, multi-role auth, and WebSockets, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env.development`:
   ```bash
   cp .env.example .env.development
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

