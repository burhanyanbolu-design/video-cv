import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
} from './sessions.service';

export const sessionsRouter = Router();

// Store upload in memory so we can forward the buffer to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB cap
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are accepted'));
    }
  },
});

// ---------------------------------------------------------------------------
// POST /sessions — upload raw video, create session, enqueue transcription
// ---------------------------------------------------------------------------
sessionsRouter.post(
  '/',
  authenticate,
  upload.single('video'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'A video file is required (field name: video)' });
      return;
    }

    try {
      const result = await createSession(
        req.userId!,
        req.file.buffer,
        req.file.mimetype,
      );
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /sessions — list all sessions for the authenticated user
// ---------------------------------------------------------------------------
sessionsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const sessions = await listSessions(req.userId!);
    res.json({ sessions });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /sessions/:id — get a single session (with pre-signed video URLs)
// ---------------------------------------------------------------------------
sessionsRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    res.json(session);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /sessions/:id — remove session row (and S3 objects)
// ---------------------------------------------------------------------------
sessionsRouter.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteSession(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
