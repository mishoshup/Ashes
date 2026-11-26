import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { Page, TopBar } from "@/components/ashes-ui";
import { CommunityCard } from "@/components/cards";
import { ErrorState, Loading } from "@/components/feedback";
import { palette, sans, serif } from "@/constants/ashes";
import { communitiesQuery } from "@/features/explore/queries";

export default function CommunitiesScreen() {
  const communities = useQuery(communitiesQuery);

  return (
    <Page>
      <TopBar back />
      <View style={styles.heading}>
        <Text style={styles.title}>Communities</Text>
        <Text style={styles.lead}>
          One for each way smoking shows up. No general room, no popularity contest. Pick the edge
          that sounds like you.
        </Text>
      </View>

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
        <View style={styles.list}>
          {communities.data.items.map((community) => (
            <CommunityCard key={community.id} community={community} />
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
    maxWidth: 580,
  },
  list: {
    gap: 12,
  },
});
