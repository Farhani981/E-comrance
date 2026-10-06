import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import pool from '../config/db.js';

let io = null;

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Middleware to authenticate Socket connection
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication failed: Missing JWT token'));
      }

      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      const userId = decoded.id;

      if (!userId) {
        return next(new Error('Authentication failed: Invalid payload'));
      }

      const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
      if (!rows.length) {
        return next(new Error('Authentication failed: User not found'));
      }

      const user = rows[0];
      if (user.role !== 'admin') {
        return next(new Error('Forbidden: Only administrators can connect to notification channel'));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error.message);
      next(new Error(`Authentication failed: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Admin connected to Socket.io: User #${socket.user.id} (${socket.user.name}) [socket: ${socket.id}]`);
    
    // Automatically join admin room
    socket.join('admin_room');

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Admin disconnected from Socket.io [socket: ${socket.id}]: ${reason}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}
