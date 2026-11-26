import { Link, useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { layout, palette, sans, serif } from "@/constants/ashes";
import { routes } from "@/libs/navigation/routes";

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
    router.replace(routes.home);
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
});
