import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { apiLimiter } from './middlewares/rate-limit.middleware.js';
import apiRouter from './routes/index.js';
import errorMiddleware from './middlewares/error.middleware.js';
import env from './config/env.js';
import cookieParser from 'cookie-parser';

const app = express();

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Body parsers (expanded limit for base64 image payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Performance
app.use(compression());

// Rate limiting
app.use(apiLimiter);

// Serve static uploaded files
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'store-management-be' });
});


// API routes
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorMiddleware);

export default app;
