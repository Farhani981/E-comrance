import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import pool from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';
import { PROFILE_COLUMNS, validateProfile } from '../utils/profile.js';

import { createRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

export const registerLimiter = createRateLimiter({
  limit: 50,
  windowMs: 15 * 60 * 1000,
  message: 'Too many registration attempts. Please try again later.',
});

export const loginLimiter = createRateLimiter({
  limit: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts. Please try again later.',
});

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

// Register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be between 1 and 100 characters' });
    }

    if (!trimmedEmail || trimmedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Public signup cannot provision privileged accounts, even for an admin caller.
    // The database role must never come from request input.
    const userRole = 'user';

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [trimmedName, trimmedEmail, hashedPassword, userRole]
    );

    const userId = result.insertId;
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: userId,
        name: trimmedName,
        email: trimmedEmail,
        role: userRole,
      },
      token: generateToken(userId),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Registration is temporarily unavailable. Please try again.' });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        created_at: user.created_at,
      },
      token: generateToken(user.id),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Login is temporarily unavailable. Please try again.' });
  }
});

// Get Current User Profile
router.get('/me', protect, async (req, res) => {
  try {
    const [[user]] = await pool.query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load your profile. Please try again.' });
  }
});

router.patch('/me', protect, async (req, res) => {
  try {
    const fields = validateProfile(req.body);
    // Keys come exclusively from the validated allowlist. Identity comes from JWT
    // verification and the current database user, never a body/query parameter.
    await pool.query(`UPDATE users SET ${Object.keys(fields).map(key => `${key} = ?`).join(', ')} WHERE id = ?`, [...Object.values(fields), req.user.id]);
    const [[user]] = await pool.query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'This email address is unavailable.' });
    res.status(500).json({ success: false, message: 'Unable to save your profile. Please try again.' });
  }
});

export default router;
