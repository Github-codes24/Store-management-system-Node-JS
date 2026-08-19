import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import env from './config/env.js';

let io;

export const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user || {};
    console.log(`Socket connected: ${role} - ${userId}`);

    // Join notification room based on role
    if (role && userId) {
      const userType = role === 'admin' ? 'Admin' : 'StoreEmployee';
      socket.join(`notif:${userType}:${userId}`);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${role} - ${userId}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call init(server) first.');
  return io;
};

function socketAuthMiddleware(socket, next) {
  try {
    const cookies = socket.handshake.headers?.cookie
      ? cookie.parse(socket.handshake.headers.cookie)
      : {};

    const role =
      socket.handshake.auth?.role ||
      socket.handshake.headers?.role ||
      cookies.role;

    const token =
      socket.handshake.auth?.token ||
      extractBearerToken(socket.handshake.headers?.authorization) ||
      socket.handshake.headers?.token ||
      getCookieTokenForRole(cookies, role);

    if (!token || !role) {
      return next(new Error('Authentication required'));
    }

    const secretMap = {
      admin: env.ADMIN_JWT_SECRET,
      storeEmployee: env.STORE_EMPLOYEE_JWT_SECRET,
    };

    const secret = secretMap[role];
    if (!secret) return next(new Error('Invalid role'));

    const decoded = jwt.verify(token, secret);

    socket.user = { id: decoded.id, role };
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
}

function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

function getCookieTokenForRole(cookies, role) {
  const cookieNameMap = {
    admin: 'adminToken',
    storeEmployee: 'storeEmployeeToken',
  };

  const cookieName = cookieNameMap[role];
  return cookieName ? cookies[cookieName] : null;
}
