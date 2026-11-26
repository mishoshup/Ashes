import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { CtaLink, Page, SectionTitle, TextLink, TopBar } from "@/components/ashes-ui";
import { CommunityCard, TopicCard } from "@/components/cards";
import { ErrorState, Loading } from "@/components/feedback";
import { palette, sans, serif } from "@/constants/ashes";
import { communitiesQuery, topicsQuery } from "@/features/explore/queries";
import { routes } from "@/libs/navigation/routes";

export default function HomeScreen() {
  const topics = useQuery(topicsQuery);
  const communities = useQuery(communitiesQuery);
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  return (
    <Page>
      <TopBar />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>A different way to look at smoking</Text>
        <Text style={[styles.heroTitle, wide && styles.heroTitleWide]}>
          Ever wondered why you smoke?
        </Text>
        <Text style={styles.heroBody}>
          Not a quit timer. A place to notice the pattern, read what other people have noticed, and
          decide what it means.
        </Text>
        <View style={styles.heroAction}>
          <CtaLink href={routes.topics} label="Explore your habits" />
        </View>
        <Text style={styles.quiet}>No account needed to look around.</Text>
      </View>

      <SectionTitle note="One question at a time">Start with one question</SectionTitle>
      {topics.isPending ? (
        <Loading />
      ) : topics.isError ? (
        <ErrorState
          message={topics.error?.message ?? "That didn't load. Try again."}
          onRetry={() => {
            void topics.refetch();
          }}
        />
      ) : (
        <View style={styles.stack}>
          <View style={styles.list}>
            {topics.data.items.slice(0, 3).map((topic) => (
              <TopicCard key={topic.slug} topic={topic} />
            ))}
          </View>
          <TextLink href={routes.topics} label="See all questions" />
        </View>
      )}

      <SectionTitle note="No feed. No ranking.">Find your edge</SectionTitle>
      {communities.isPending ? (
        <Loading />
      ) : communities.isError ? (
        <ErrorState
          message={communities.error?.message ?? "That didn't load. Try again."}
          onRetry={() => {
            void communities.refetch();
          }}
        />
      ) : (
        <View style={styles.stack}>
          <View style={wide ? styles.grid : styles.list}>
            {communities.data.items.slice(0, 4).map((community) => (
              <View key={community.id} style={wide ? styles.gridItem : undefined}>
                <CommunityCard community={community} />
              </View>
            ))}
          </View>
          <TextLink href={routes.communities} label="See all communities" />
        </View>
      )}

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Nothing is posted for you.</Text>
        <Text style={styles.privacyBody}>
          Reflections stay private unless you choose to share them. There is no algorithm deciding
          what you should see.
        </Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 18,
    paddingTop: 24,
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: palette.ember,
  },
  heroTitle: {
    fontFamily: serif,
    fontSize: 40,
    lineHeight: 46,
    color: palette.cream,
  },
  heroTitleWide: {
    fontSize: 58,
    lineHeight: 64,
  },
  heroBody: {
    fontFamily: sans,
    fontSize: 17,
    lineHeight: 26,
    color: palette.muted,
    maxWidth: 560,
  },
  heroAction: {
    alignItems: "flex-start",
    paddingTop: 6,
  },
  quiet: {
    fontFamily: sans,
    fontSize: 12,
    color: palette.dim,
  },
  stack: {
    gap: 16,
  },
  list: {
    gap: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "48.5%",
  },
  privacy: {
    gap: 8,
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  privacyTitle: {
    fontFamily: serif,
    fontSize: 21,
    color: palette.cream,
  },
  privacyBody: {
    fontFamily: sans,
    fontSize: 14,
    lineHeight: 21,
    color: palette.muted,
  },
});
