import { Link, useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { layout, palette, sans, serif } from "@/constants/ashes";

export function Mark() {
  return (
    <View style={styles.markRow}>
      <Text style={styles.mark}>ASHES</Text>
      <View style={styles.markDot} />
    </View>
  );
}

export function Page({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 64 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function TopBar({ back = false, right }: { back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  };

  return (
    <View style={styles.topBar}>
      {back ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : (
        <Mark />
      )}
      {right}
    </View>
  );
}

export function SectionTitle({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{children}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.primary : styles.ghost,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === "primary" ? styles.primaryLabel : styles.ghostLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CtaLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
      >
        <Text style={[styles.buttonLabel, styles.primaryLabel]}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export function TextLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.textLink}>{label} →</Text>
      </Pressable>
    </Link>
  );
}

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
      <CtaLink href="/" label="Back to Ashes" />
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
  screen: {
    flex: 1,
    backgroundColor: palette.ink,
  },
  page: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    gap: 24,
  },
  topBar: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  markRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mark: {
    fontFamily: serif,
    fontSize: 15,
    letterSpacing: 5,
    color: palette.cream,
  },
  markDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.ember,
  },
  back: {
    fontFamily: sans,
    fontSize: 14,
    color: palette.muted,
  },
  sectionTitle: {
    gap: 6,
    marginTop: 12,
  },
  sectionHeading: {
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 32,
    color: palette.cream,
  },
  sectionNote: {
    fontFamily: sans,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.dim,
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: palette.ember,
  },
  ghost: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.72,
  },
  buttonLabel: {
    fontFamily: sans,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryLabel: {
    color: palette.ink,
  },
  ghostLabel: {
    color: palette.cream,
  },
  textLink: {
    fontFamily: sans,
    fontSize: 14,
    fontWeight: "600",
    color: palette.ember,
  },
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
