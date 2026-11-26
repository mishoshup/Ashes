import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, CtaLink } from "@/components/ashes-ui";
import { palette, sans, serif } from "@/constants/ashes";
import { routes } from "@/libs/navigation/routes";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <Text style={styles.loading}>{label}</Text>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorText}>{message}</Text>
      <Button label="Try again" variant="ghost" onPress={onRetry} />
    </View>
  );
}

export function NotFound({ message = "This page isn't here." }: { message?: string }) {
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundText}>{message}</Text>
      <CtaLink href={routes.home} label="Back to Ashes" />
    </View>
  );
}

export function GuestNudge({
  visible,
  onClose,
  context,
}: {
  visible: boolean;
  onClose: () => void;
  context?: string;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>You can keep looking around.</Text>
          <Text style={styles.sheetBody}>
            {context ??
              "Reading is open to everyone. Replying, joining a channel, and saving a reflection will need an account, when you're ready."}
          </Text>
          <Button label="Keep reading" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: {
    fontFamily: sans,
    fontSize: 15,
    color: palette.muted,
    paddingVertical: 12,
  },
  errorState: {
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  errorText: {
    fontFamily: sans,
    fontSize: 15,
    lineHeight: 22,
    color: palette.muted,
  },
  notFound: {
    gap: 20,
    paddingTop: 24,
  },
  notFoundText: {
    fontFamily: serif,
    fontSize: 30,
    lineHeight: 38,
    color: palette.cream,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  sheet: {
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 36,
    backgroundColor: palette.raised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    marginBottom: 6,
  },
  sheetTitle: {
    fontFamily: serif,
    fontSize: 28,
    lineHeight: 34,
    color: palette.cream,
  },
  sheetBody: {
    fontFamily: sans,
    fontSize: 15,
    lineHeight: 23,
    color: palette.muted,
  },
});
