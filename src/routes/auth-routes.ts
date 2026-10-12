import { Router, Response } from 'express';
import { z } from 'zod';
import { pool, query } from '../database/connection.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSessionToken } from '../utils/auth-token.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

const router = Router();
const SESSION_COOKIE = 'novaseo_session';
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(200),
});

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

router.get('/setup-status', asyncHandler(async (_req, res) => {
  const result = await query('SELECT EXISTS (SELECT 1 FROM app_users) AS "hasOwner"');
  res.json({ data: { hasOwner: result.rows[0].hasOwner } });
}));

router.post('/setup', validate({
  body: credentialsSchema.extend({
    name: z.string().trim().min(1).max(120),
    workspace: z.string().trim().min(1).max(200),
  }),
}), asyncHandler(async (req, res) => {
  const client = await pool.connect();
  let user: { id: string; email: string; displayName: string } | undefined;
  let tenantId: string | undefined;
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE app_users IN ACCESS EXCLUSIVE MODE');
    const existing = await client.query('SELECT 1 FROM app_users LIMIT 1');
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: { code: 'SETUP_ALREADY_COMPLETED', message: 'Workspace setup is already complete.' } });
      return;
    }

    const tenant = await client.query('INSERT INTO tenants (name) VALUES ($1) RETURNING id', [req.body.workspace]);
    tenantId = tenant.rows[0].id;
    const created = await client.query(
      'INSERT INTO app_users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name AS "displayName"',
      [req.body.email, await hashPassword(req.body.password), req.body.name],
    );
    const createdUser = created.rows[0] as { id: string; email: string; displayName: string };
    user = createdUser;
    await client.query(
      'INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, $3)',
      [createdUser.id, tenantId, 'owner'],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (!user || !tenantId) throw new Error('WORKSPACE_SETUP_FAILED');
  setSessionCookie(res, createSessionToken(user.id, [tenantId]));
  res.status(201).json({ data: { user, tenant: { id: tenantId, name: req.body.workspace } } });
}));

router.post('/login', validate({ body: credentialsSchema }), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.password_hash,
            array_agg(m.tenant_id::text ORDER BY m.created_at) AS "tenantIds"
       FROM app_users u
       JOIN tenant_memberships m ON m.user_id = u.id
      WHERE u.email = $1
      GROUP BY u.id`,
    [req.body.email],
  );
  const user = result.rows[0];
  const timingHash = 'scrypt:00000000000000000000000000000000:' + '0'.repeat(128);
  const passwordValid = await verifyPassword(req.body.password, user?.password_hash || timingHash);
  if (!user || !passwordValid) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    return;
  }

  setSessionCookie(res, createSessionToken(user.id, user.tenantIds));
  res.json({ data: { user: { id: user.id, email: user.email, displayName: user.displayName } } });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(204).end();
});

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.display_name AS "displayName",
            m.tenant_id AS "tenantId", t.name AS "tenantName", m.role
       FROM app_users u
       JOIN tenant_memberships m ON m.user_id = u.id
       JOIN tenants t ON t.id = m.tenant_id
      WHERE u.id = $1 AND m.tenant_id = ANY($2::uuid[])
      ORDER BY m.created_at`,
    [req.auth!.userId, req.auth!.tenantIds],
  );
  if (!result.rowCount) {
    res.status(401).json({ error: { code: 'SESSION_REVOKED', message: 'Session is no longer valid.' } });
    return;
  }
  const first = result.rows[0];
  res.json({
    data: {
      user: { id: first.id, email: first.email, displayName: first.displayName },
      tenants: result.rows.map((row) => ({ id: row.tenantId, name: row.tenantName, role: row.role })),
    },
  });
}));

export default router;
