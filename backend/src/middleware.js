import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { Address, StrKey } from '@stellar/stellar-sdk';

const STELLAR_PUBLIC_KEY_RE = /^G[A-Z0-9]{55}$/;

export function genReqId(req, res) {
  const correlationId = req.headers['x-correlation-id'];
  const id = typeof correlationId === 'string' && correlationId
    ? correlationId
    : crypto.randomUUID();
  res.setHeader('X-Correlation-ID', id);
  return id;
}

/**
 * Accepts every address form the API can look up: account public keys (G...),
 * contract addresses (C...) and muxed accounts (M...). The common G case is
 * matched by a cheap regex; the rest are checked with the Stellar SDK.
 */
export function isValidStellarAddress(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (STELLAR_PUBLIC_KEY_RE.test(value)) return true;
  try {
    Address.fromString(value);
    return true;
  } catch {
    // Not an account or contract address; it may still be a muxed account.
  }
  return StrKey.isValidMed25519PublicKey(value);
}

export function validateStellarAddress(req, res, next) {
  const { address } = req.params;
  if (!isValidStellarAddress(address)) {
    return res.status(400).json({
      error: 'Invalid Stellar address. Expected an account (G...), contract (C...) or muxed account (M...) address.',
    });
  }
  next();
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Every limiter is built here so they all emit the same standard headers
 * (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and
 * `RateLimit-Policy`) and the same `Retry-After` on a 429, and none emit the
 * legacy `X-RateLimit-*` set.
 */
export function createLimiter({ max, message, windowMs = RATE_LIMIT_WINDOW_MS }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

export const globalLimiter = createLimiter({
  max: 500,
  message: 'Too many requests, please try again later.',
});

export const addressRouteLimiter = createLimiter({
  max: 100,
  message: 'Too many requests for this address, please try again later.',
});

export const eventsLimiter = createLimiter({
  max: 50,
  message: 'Too many requests, please try again later.',
});
