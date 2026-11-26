import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { ErrorState, Loading, Page, TopBar } from "@/components/ashes-ui";
import { TopicCard } from "@/components/cards";
import { palette, sans, serif } from "@/constants/ashes";
import { topicsQuery } from "@/features/explore/queries";

export default function TopicsScreen() {
  const topics = useQuery(topicsQuery);

  return (
    <Page>
      <TopBar back />
      <View style={styles.heading}>
        <Text style={styles.title}>Questions</Text>
        <Text style={styles.lead}>
          Small places to start. Read one, notice what fits, leave the rest.
        </Text>
      </View>

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
        <View style={styles.list}>
          {topics.data.items.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} />
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontFamily: serif,
    fontSize: 42,
    lineHeight: 48,
    color: palette.cream,
  },
  lead: {
    fontFamily: sans,
    fontSize: 16,
    lineHeight: 24,
    color: palette.muted,
    maxWidth: 560,
  },
  list: {
    gap: 12,
  },
});
