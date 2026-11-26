import { queryOptions } from "@tanstack/react-query";

import { fetchCommunities, fetchTopic, fetchTopics } from "./api";

export const exploreKeys = {
  topics: ["explore", "topics"] as const,
  topic: (slug: string) => ["explore", "topic", slug] as const,
  communities: ["explore", "communities"] as const,
};

export const topicsQuery = queryOptions({
  queryKey: exploreKeys.topics,
  queryFn: fetchTopics,
  staleTime: 300_000,
});

export const topicQuery = (slug: string) =>
  queryOptions({
    queryKey: exploreKeys.topic(slug),
    queryFn: () => fetchTopic(slug),
    staleTime: 300_000,
  });

export const communitiesQuery = queryOptions({
  queryKey: exploreKeys.communities,
  queryFn: fetchCommunities,
  staleTime: 300_000,
});
