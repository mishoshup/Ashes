import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Button,
  CtaLink,
  ErrorState,
  GuestNudge,
  Loading,
  NotFound,
  Page,
  TopBar,
} from "@/components/ashes-ui";
import { palette, sans, serif } from "@/constants/ashes";
import { triggerLabels } from "@/features/explore/labels";
import { topicQuery } from "@/features/explore/queries";
import { ApiError } from "@/lib/api";

const SLUG = /^[a-z0-9-]+$/;

export default function TopicScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const valid = typeof slug === "string" && SLUG.test(slug);
  const topic = useQuery({ ...topicQuery(slug ?? ""), enabled: valid });
  const [nudge, setNudge] = useState(false);

  if (!valid) {
    return (
      <Page>
        <TopBar back />
        <NotFound message="That question isn't here." />
      </Page>
    );
  }

  if (topic.isPending) {
    return (
      <Page>
        <TopBar back />
        <Loading />
      </Page>
    );
  }

  if (topic.isError) {
    if (topic.error instanceof ApiError && topic.error.status === 404) {
      return (
        <Page>
          <TopBar back />
          <NotFound message="That question isn't here." />
        </Page>
      );
    }
    return (
      <Page>
        <TopBar back />
        <ErrorState
          message={topic.error?.message ?? "That didn't load. Try again."}
          onRetry={() => {
            void topic.refetch();
          }}
        />
      </Page>
    );
  }

  const data = topic.data;

  return (
    <Page>
      <TopBar back />

      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{triggerLabels[data.trigger]}</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.summary}>{data.summary}</Text>
      </View>

      <View style={styles.body}>
        {data.body.split("\n\n").map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </View>

      {data.reflectionPrompt ? (
        <View style={styles.prompt}>
          <Text style={styles.promptLabel}>A question to sit with</Text>
          <Text style={styles.promptQuestion}>{data.reflectionPrompt}</Text>
          <View style={styles.promptAction}>
            <Button label="Save a reflection" variant="ghost" onPress={() => setNudge(true)} />
          </View>
        </View>
      ) : null}

      {data.channel ? (
        <View style={styles.related}>
          <Text style={styles.relatedLabel}>Others exploring this</Text>
          <Text style={styles.channel}>#{data.channel.name}</Text>
          <CtaLink
            href={{
              pathname: "/communities/[slug]",
              params: { slug: data.channel.communitySlug },
            }}
            label="See how others experience this"
          />
        </View>
      ) : null}

      <GuestNudge
        visible={nudge}
        onClose={() => setNudge(false)}
        context="You can read everything without an account. Saving a reflection is members-only for now."
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 14,
    paddingTop: 16,
  },
  eyebrow: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: palette.ember,
  },
  title: {
    fontFamily: serif,
    fontSize: 42,
    lineHeight: 48,
    color: palette.cream,
    maxWidth: 620,
  },
  summary: {
    fontFamily: sans,
    fontSize: 17,
    lineHeight: 26,
    color: palette.muted,
    maxWidth: 580,
  },
  body: {
    gap: 18,
    maxWidth: 620,
  },
  paragraph: {
    fontFamily: sans,
    fontSize: 17,
    lineHeight: 28,
    color: palette.cream,
  },
  prompt: {
    gap: 12,
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  promptLabel: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: palette.dim,
  },
  promptQuestion: {
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 34,
    color: palette.cream,
  },
  promptAction: {
    alignItems: "flex-start",
    paddingTop: 4,
  },
  related: {
    gap: 10,
    paddingTop: 8,
  },
  relatedLabel: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: palette.dim,
  },
  channel: {
    fontFamily: sans,
    fontSize: 16,
    fontWeight: "600",
    color: palette.cream,
  },
});
