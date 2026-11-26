import {
  channelKindSchema,
  type CommunityDirectory,
  type CommunityDirectoryChannel,
} from "@ashes/contracts";
import type { Env } from "../types";

type CommunityRow = {
  community_id: string;
  community_slug: string;
  community_name: string;
  community_description: string;
  community_monogram: string;
  community_accent: string;
  channel_id: string | null;
  channel_slug: string | null;
  channel_name: string | null;
  channel_description: string | null;
  channel_kind: string | null;
};

function channelFrom(row: CommunityRow): CommunityDirectoryChannel | null {
  if (
    !row.channel_id ||
    !row.channel_slug ||
    !row.channel_name ||
    !row.channel_description ||
    !row.channel_kind
  ) {
    return null;
  }
  return {
    id: row.channel_id,
    slug: row.channel_slug,
    name: row.channel_name,
    description: row.channel_description,
    kind: channelKindSchema.parse(row.channel_kind),
  };
}

export async function listPublicCommunities(env: Env): Promise<CommunityDirectory[]> {
  const rows = await env.DB.prepare(
    `SELECT c.id AS community_id, c.slug AS community_slug, c.name AS community_name,
            c.description AS community_description, c.monogram AS community_monogram,
            c.accent AS community_accent,
            ch.id AS channel_id, ch.slug AS channel_slug, ch.name AS channel_name,
            ch.description AS channel_description, ch.kind AS channel_kind
     FROM communities c
     LEFT JOIN channels ch ON ch.community_id = c.id AND ch.visibility = 'public'
     WHERE c.visibility = 'public'
     ORDER BY c.name COLLATE NOCASE, ch.name COLLATE NOCASE`,
  ).all<CommunityRow>();

  const communities = new Map<string, CommunityDirectory>();
  for (const row of rows.results) {
    let community = communities.get(row.community_id);
    if (!community) {
      community = {
        id: row.community_id,
        slug: row.community_slug,
        name: row.community_name,
        description: row.community_description,
        monogram: row.community_monogram,
        accent: row.community_accent,
        channels: [],
      };
      communities.set(row.community_id, community);
    }
    const channel = channelFrom(row);
    if (channel) {
      community.channels.push(channel);
    }
  }
  return [...communities.values()];
}
