import { Router, Request, Response } from 'express';
import { searchProfiles } from './elasticsearch-client';

export const searchRouter = Router();

/**
 * GET /search?skills=&title=&location=&page=&limit=
 * No authentication required.
 */
searchRouter.get('/', async (req: Request, res: Response) => {
  const { skills, title, location } = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20));

  try {
    const { hits, total } = await searchProfiles({ skills, title, location, page, limit });

    if (total === 0) {
      res.json({
        results: [],
        total: 0,
        page,
        limit,
        message: 'No profiles found matching your criteria',
      });
      return;
    }

    res.json({ results: hits, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
