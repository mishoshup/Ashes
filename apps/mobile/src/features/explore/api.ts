import {
  communitiesResponseSchema,
  psychTopicSchema,
  psychTopicsResponseSchema,
} from "@ashes/contracts";
import { apiGet } from "@/lib/api";

export async function fetchTopics() {
  return psychTopicsResponseSchema.parse(await apiGet("/api/topics"));
}

export async function fetchTopic(slug: string) {
  return psychTopicSchema.parse(await apiGet(`/api/topics/${encodeURIComponent(slug)}`));
}

export async function fetchCommunities() {
  return communitiesResponseSchema.parse(await apiGet("/api/communities"));
}
