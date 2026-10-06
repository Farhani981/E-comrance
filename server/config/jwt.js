import dotenv from 'dotenv';

dotenv.config();

// Shared by startup, signing and verification. Never substitute a default key.
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('JWT_SECRET is required. Configure it in the server environment before starting the application.');
  }
  return secret;
}
