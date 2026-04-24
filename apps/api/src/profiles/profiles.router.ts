import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { getProfileBySlug, updateProfile, deleteProfile } from './profiles.service';

export const profilesRouter = Router();

// ---------------------------------------------------------------------------
// GET /profiles/:slug — public, no JWT required
// ---------------------------------------------------------------------------
profilesRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await getProfileBySlug(req.params.slug);
    res.json(profile);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /profiles/:slug — JWT required; update cv_data or visibility
// ---------------------------------------------------------------------------
profilesRouter.patch('/:slug', authenticate, async (req: Request, res: Response) => {
  const { cv_data, visibility } = req.body as {
    cv_data?: unknown;
    visibility?: 'private' | 'discoverable';
  };

  if (cv_data === undefined && visibility === undefined) {
    res.status(400).json({ error: 'Provide cv_data or visibility to update' });
    return;
  }

  if (visibility !== undefined && visibility !== 'private' && visibility !== 'discoverable') {
    res.status(400).json({ error: 'visibility must be "private" or "discoverable"' });
    return;
  }

  try {
    const updated = await updateProfile(req.params.slug, req.userId!, { cv_data, visibility });
    res.json(updated);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /profiles/:slug — JWT required; soft-delete
// ---------------------------------------------------------------------------
profilesRouter.delete('/:slug', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteProfile(req.params.slug, req.userId!);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
