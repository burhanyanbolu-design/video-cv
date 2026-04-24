import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { register, login, logout, deleteAccount } from './auth.service';

export const authRouter = Router();

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }

  try {
    const { token, userId } = await register({ email: email.toLowerCase().trim(), password });
    res.status(201).json({ token, userId });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const { token, userId } = await login({ email: email.toLowerCase().trim(), password });
    res.status(200).json({ token, userId });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await logout(req.userId!);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /auth/account
// ---------------------------------------------------------------------------
authRouter.delete('/account', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.userId!);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
