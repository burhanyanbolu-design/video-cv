import { createVideoCvClient } from "@video-cv/api-client";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const apiClient = createVideoCvClient({ baseUrl: BASE_URL });
