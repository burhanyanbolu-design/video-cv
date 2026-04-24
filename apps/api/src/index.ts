import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { authRouter } from './auth/auth.router';
import { sessionsRouter } from './sessions/sessions.router';
import { profilesRouter } from './profiles/profiles.router';
import { searchRouter } from './search/search.router';
import { initWsServer } from './websocket/ws-server';
import './workers/purge-account.worker';
import './workers/transcribe.worker';
import './workers/clean.worker';
import './workers/extract.worker';
import './workers/build-cv.worker';
import './workers/process-video.worker';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routers
app.use('/auth', authRouter);
app.use('/sessions', sessionsRouter);
app.use('/profiles', profilesRouter);
app.use('/search', searchRouter);

const PORT = Number(process.env.PORT ?? 3001);
const httpServer = http.createServer(app);

// WebSocket server (keyed by userId, path: /ws?token=<jwt>)
initWsServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});

export { app };
