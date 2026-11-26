import { communitiesResponseSchema } from "@ashes/contracts";
import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR REPLACE INTO communities
       (id, slug, name, description, monogram, accent, visibility, created_at, updated_at)
       VALUES ('com_pressure', 'pressure', 'Pressure', 'When smoking is how you cope with stress.',
       'PR', '#E2603A', 'public', '2026-11-01T09:00:00.000Z', '2026-11-01T09:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT OR REPLACE INTO communities
       (id, slug, name, description, monogram, accent, visibility, created_at, updated_at)
       VALUES ('com_idle', 'idle', 'Idle', 'When smoking fills empty time.',
       'ID', '#D9A441', 'public', '2026-11-01T09:00:00.000Z', '2026-11-01T09:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT OR REPLACE INTO communities
       (id, slug, name, description, monogram, accent, visibility, created_at, updated_at)
       VALUES ('com_hidden', 'hidden', 'Hidden', 'A private community.',
       'HI', '#000000', 'private', '2026-11-01T09:00:00.000Z', '2026-11-01T09:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT OR REPLACE INTO channels
       (id, community_id, slug, name, description, kind, visibility, created_at)
       VALUES ('chn_stress', 'com_pressure', 'stress-and-smoking', 'stress-and-smoking',
       'What pressure does to the urge to smoke.', 'mixed', 'public', '2026-11-01T09:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT OR REPLACE INTO channels
       (id, community_id, slug, name, description, kind, visibility, created_at)
       VALUES ('chn_work', 'com_pressure', 'work-and-pressure', 'work-and-pressure',
       'Deadlines and the cigarette after.', 'forum', 'public', '2026-11-01T09:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT OR REPLACE INTO channels
       (id, community_id, slug, name, description, kind, visibility, created_at)
       VALUES ('chn_private', 'com_idle', 'private-channel', 'private-channel',
       'Only members can see this.', 'chat', 'private', '2026-11-01T09:00:00.000Z')`,
    ),
  ]);
});

describe("public community directory", () => {
  it("lists psychology communities without a session", async () => {
    // Given seeded public and private communities
    // When the directory is requested without auth
    const response = await SELF.fetch("https://example.com/api/communities");

    // Then only public communities and public channels are returned
    expect(response.status).toBe(200);
    const body = communitiesResponseSchema.parse(await response.json());
    expect(body.items.map((community) => community.name)).toEqual(["Pressure", "Idle"]);

    const pressure = body.items.find((community) => community.slug === "pressure");
    expect(pressure?.channels.map((channel) => channel.slug)).toEqual([
      "stress-and-smoking",
      "work-and-pressure",
    ]);
    expect(pressure?.channels[0]?.kind).toBe("mixed");

    const idle = body.items.find((community) => community.slug === "idle");
    expect(idle?.channels).toHaveLength(0);
    expect(body.items.some((community) => community.slug === "hidden")).toBe(false);
  });
});
