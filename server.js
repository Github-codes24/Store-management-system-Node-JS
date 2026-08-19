import { createServer } from 'node:http';
import mongoose from 'mongoose';
import app from './src/app.js';
import env from './src/config/env.js';
import connectDB from './src/config/db.js';
import { init } from './src/socket.js';

const server = createServer(app);

init(server); // initialize socket.io on HTTP server

const startServer = async () => {
  try {
    await connectDB();

    server.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Server startup error:', error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);

  forceExit.unref();

  server.close(async () => {
    try {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (err) {
      console.error('Error during shutdown:', err.message);
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();
