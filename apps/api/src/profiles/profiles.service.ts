import { db } from '../db/client';
import { getPresignedUrl } from '../storage/s3-client';
import { buildCvQueue } from '../queues';
import {
  indexProfile,
  deleteProfileFromIndex,
  ProfileDocument,
} from '../search/elasticsearch-client';
import { emitToUser } from '../websocket/ws-server';

export interface Profile {
  id: string;
  session_id: string;
  user_id: string;
  slug: string;
  cv_pdf_url: string | null;
  video_url: string | null;
  visibility: 'private' | 'discoverable';
  expires_at: Date;
  deleted_at: Date | null;
  created_at: Date;
}

export interface ProfileView {
  id: string;
  slug: string;
  visibility: string;
  cv_pdf_url: string | null;
  video_url: string | null;
  cv_data: unknown;
  created_at: Date;
}

async function toView(profile: Profile, cvData: unknown): Promise<ProfileView> {
  return {
    id: profile.id,
    slug: profile.slug,
    visibility: profile.visibility,
    cv_data: cvData,
    created_at: profile.created_at,
    cv_pdf_url: profile.cv_pdf_url ? await getPresignedUrl(profile.cv_pdf_url) : null,
    video_url: profile.video_url ? await getPresignedUrl(profile.video_url) : null,
  };
}

export async function getProfileBySlug(slug: string): Promise<ProfileView> {
  const { rows } = await db.query<Profile & { cv_data: unknown }>(
    `SELECT p.*, s.cv_data
     FROM profiles p
     JOIN sessions s ON s.id = p.session_id
     WHERE p.slug = $1 AND p.deleted_at IS NULL`,
    [slug],
  );
  if (!rows.length) throw Object.assign(new Error('Profile not found'), { status: 404 });
  const { cv_data, ...profile } = rows[0];
  return toView(profile, cv_data);
}

export async function updateProfile(
  slug: string,
  userId: string,
  body: { cv_data?: unknown; visibility?: 'private' | 'discoverable' },
): Promise<ProfileView> {
  const { rows } = await db.query<Profile & { cv_data: unknown }>(
    `SELECT p.*, s.cv_data
     FROM profiles p
     JOIN sessions s ON s.id = p.session_id
     WHERE p.slug = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`,
    [slug, userId],
  );
  if (!rows.length) throw Object.assign(new Error('Profile not found'), { status: 404 });

  const { cv_data: existingCvData, ...profile } = rows[0];

  if (body.cv_data !== undefined) {
    // Update cv_data in session and re-trigger build-cv
    await db.query(
      `UPDATE sessions SET cv_data = $1 WHERE id = $2`,
      [JSON.stringify(body.cv_data), profile.session_id],
    );
    await buildCvQueue.add('build-cv', { sessionId: profile.session_id, userId });
  }

  if (body.visibility !== undefined) {
    await db.query(
      `UPDATE profiles SET visibility = $1 WHERE id = $2`,
      [body.visibility, profile.id],
    );
    profile.visibility = body.visibility;

    if (body.visibility === 'discoverable') {
      // Index in Elasticsearch within 60s (fire-and-forget with timeout)
      const cvData = (body.cv_data ?? existingCvData) as Record<string, unknown>;
      const doc: ProfileDocument = {
        profile_id: profile.id,
        name: (cvData?.name as string) ?? '',
        job_title: ((cvData?.work_experience as Array<{ title: string }>)?.[0]?.title) ?? '',
        skills: (cvData?.skills as string[]) ?? [],
        location: (cvData?.contact as Record<string, string>)?.location ?? null,
        profile_url: `/profiles/${profile.slug}`,
        visibility: 'discoverable',
      };
      setTimeout(() => indexProfile(doc).catch(console.error), 0);
    } else {
      // Remove from index within 60s
      setTimeout(() => deleteProfileFromIndex(profile.id).catch(console.error), 0);
    }

    emitToUser(userId, { event: 'profile:visibility_changed', profileId: profile.id, visibility: body.visibility });
  }

  const updatedCvData = body.cv_data ?? existingCvData;
  return toView(profile, updatedCvData);
}

export async function deleteProfile(slug: string, userId: string): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE profiles SET deleted_at = NOW()
     WHERE slug = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [slug, userId],
  );
  if (!rows.length) throw Object.assign(new Error('Profile not found'), { status: 404 });

  const profileId = rows[0].id;

  // Remove from Elasticsearch within 60s
  setTimeout(() => deleteProfileFromIndex(profileId).catch(console.error), 0);

  emitToUser(userId, { event: 'profile:visibility_changed', profileId, visibility: 'deleted' });
}
