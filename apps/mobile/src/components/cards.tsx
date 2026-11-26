import type { CommunityDirectory, PsychTopicSummary } from "@ashes/contracts";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette, sans, serif } from "@/constants/ashes";
import { triggerLabels } from "@/features/explore/labels";

export function TopicCard({ topic }: { topic: PsychTopicSummary }) {
  return (
    <Link href={{ pathname: "/topics/[slug]", params: { slug: topic.slug } }} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Text style={styles.eyebrow}>{triggerLabels[topic.trigger]}</Text>
        <Text style={styles.title}>{topic.title}</Text>
        <Text style={styles.summary}>{topic.summary}</Text>
      </Pressable>
    </Link>
  );
}

export function CommunityCard({ community }: { community: CommunityDirectory }) {
  const channelLabel = community.channels.length === 1 ? "channel" : "channels";
  return (
    <Link href={{ pathname: "/communities/[slug]", params: { slug: community.slug } }} asChild>
      <Pressable style={({ pressed }) => [styles.community, pressed && styles.pressed]}>
        <View style={[styles.monogram, { borderColor: community.accent }]}>
          <Text style={[styles.monogramText, { color: community.accent }]}>
            {community.monogram}
          </Text>
        </View>
        <View style={styles.communityBody}>
          <Text style={styles.communityName}>{community.name}</Text>
          <Text style={styles.summary}>{community.description}</Text>
          <Text style={styles.meta}>
            {community.channels.length} {channelLabel}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  pressed: {
    opacity: 0.72,
  },
  eyebrow: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: palette.ember,
  },
  title: {
    fontFamily: serif,
    fontSize: 24,
    lineHeight: 30,
    color: palette.cream,
  },
  summary: {
    fontFamily: sans,
    fontSize: 14,
    lineHeight: 21,
    color: palette.muted,
  },
  community: {
    flexDirection: "row",
    gap: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  monogram: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    fontFamily: serif,
    fontSize: 16,
    letterSpacing: 1,
  },
  communityBody: {
    flex: 1,
    gap: 6,
  },
  communityName: {
    fontFamily: serif,
    fontSize: 21,
    color: palette.cream,
  },
  meta: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.dim,
  },
});
