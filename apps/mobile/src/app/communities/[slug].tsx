import { slugSchema } from "@ashes/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Page, TopBar } from "@/components/ashes-ui";
import { ErrorState, GuestNudge, Loading, NotFound } from "@/components/feedback";
import { palette, sans, serif } from "@/constants/ashes";
import { channelKindLabels } from "@/features/explore/labels";
import { communitiesQuery } from "@/features/explore/queries";

export default function CommunityScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const parsed = slugSchema.safeParse(rawSlug);
  const valid = parsed.success;
  const communities = useQuery({ ...communitiesQuery, enabled: valid });
  const [nudge, setNudge] = useState(false);

  if (!valid) {
    return (
      <Page>
        <TopBar back />
        <NotFound message="That community isn't here." />
      </Page>
    );
  }

  if (communities.isPending) {
    return (
      <Page>
        <TopBar back />
        <Loading />
      </Page>
    );
  }

  if (communities.isError) {
    return (
      <Page>
        <TopBar back />
        <ErrorState
          message={communities.error?.message ?? "That didn't load. Try again."}
          onRetry={() => {
            void communities.refetch();
          }}
        />
      </Page>
    );
  }

  const community = communities.data.items.find(
    (item) => item.slug === (parsed.success ? parsed.data : ""),
  );
  if (!community) {
    return (
      <Page>
        <TopBar back />
        <NotFound message="That community isn't here." />
      </Page>
    );
  }

  return (
    <Page>
      <TopBar back />

      <View style={styles.heading}>
        <View style={[styles.monogram, { borderColor: community.accent }]}>
          <Text style={[styles.monogramText, { color: community.accent }]}>
            {community.monogram}
          </Text>
        </View>
        <Text style={styles.title}>{community.name}</Text>
        <Text style={styles.description}>{community.description}</Text>
      </View>

      <View style={styles.list}>
        {community.channels.map((channel) => (
          <Pressable
            key={channel.id}
            onPress={() => setNudge(true)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${channel.name}`}
            style={({ pressed }) => [styles.channel, pressed && styles.pressed]}
          >
            <View style={styles.channelTop}>
              <Text style={styles.channelName}>#{channel.name}</Text>
              <Text style={styles.kind}>{channelKindLabels[channel.kind]}</Text>
            </View>
            <Text style={styles.channelDescription}>{channel.description}</Text>
          </Pressable>
        ))}
      </View>

      {community.channels.length === 0 ? (
        <Text style={styles.empty}>No public channels here yet.</Text>
      ) : null}

      <GuestNudge
        visible={nudge}
        onClose={() => setNudge(false)}
        context="Channels are where members talk. Reading is open; replying and joining will need an account, when you're ready."
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 12,
    paddingTop: 16,
  },
  monogram: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  monogramText: {
    fontFamily: serif,
    fontSize: 17,
    letterSpacing: 1,
  },
  title: {
    fontFamily: serif,
    fontSize: 42,
    lineHeight: 48,
    color: palette.cream,
  },
  description: {
    fontFamily: sans,
    fontSize: 17,
    lineHeight: 26,
    color: palette.muted,
    maxWidth: 580,
  },
  list: {
    gap: 10,
  },
  channel: {
    gap: 6,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  pressed: {
    opacity: 0.72,
  },
  channelTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  channelName: {
    fontFamily: sans,
    fontSize: 16,
    fontWeight: "600",
    color: palette.cream,
  },
  kind: {
    fontFamily: sans,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.dim,
  },
  channelDescription: {
    fontFamily: sans,
    fontSize: 14,
    lineHeight: 21,
    color: palette.muted,
  },
  empty: {
    fontFamily: sans,
    fontSize: 15,
    color: palette.muted,
  },
});
