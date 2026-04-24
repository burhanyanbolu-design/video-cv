import { Client } from '@elastic/elasticsearch';

export const PROFILE_INDEX = 'profiles';

/** Shape of a document stored in the profiles index. */
export interface ProfileDocument {
  profile_id: string;
  name: string;
  job_title: string;
  skills: string[];
  location: string | null;
  profile_url: string;
  visibility: 'private' | 'discoverable';
}

/** Singleton ES client, configured from environment variables. */
export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_API_KEY
    ? { apiKey: process.env.ELASTICSEARCH_API_KEY }
    : undefined,
});

/** Index (upsert) a profile document. */
export async function indexProfile(doc: ProfileDocument): Promise<void> {
  await esClient.index({
    index: PROFILE_INDEX,
    id: doc.profile_id,
    document: doc,
    refresh: 'wait_for',
  });
}

/** Remove a profile document from the index. */
export async function deleteProfileFromIndex(profileId: string): Promise<void> {
  await esClient.delete({
    index: PROFILE_INDEX,
    id: profileId,
    refresh: 'wait_for',
  });
}

export interface SearchProfilesParams {
  skills?: string;
  title?: string;
  location?: string;
  page?: number;
  limit?: number;
}

export interface SearchProfilesResult {
  hits: ProfileDocument[];
  total: number;
}

/** Search discoverable profiles using a bool query. */
export async function searchProfiles(
  params: SearchProfilesParams,
): Promise<SearchProfilesResult> {
  const { skills, title, location, page = 1, limit = 20 } = params;

  const must: object[] = [];
  if (title) must.push({ match: { job_title: title } });
  if (skills) must.push({ match: { skills } });

  const filter: object[] = [{ term: { visibility: 'discoverable' } }];
  if (location) filter.push({ term: { location } });

  const response = await esClient.search<ProfileDocument>({
    index: PROFILE_INDEX,
    from: (page - 1) * limit,
    size: limit,
    query: {
      bool: {
        must: must.length ? must : [{ match_all: {} }],
        filter,
      },
    },
  });

  const hits = response.hits.hits
    .map((h) => h._source)
    .filter((s): s is ProfileDocument => s !== undefined);

  const total =
    typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value ?? 0);

  return { hits, total };
}
