import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "react-native";

import { palette } from "@/constants/ashes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.ember,
    background: palette.ink,
    card: palette.ink,
    text: palette.cream,
    border: palette.border,
    notification: palette.ember,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar barStyle="light-content" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.ink },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
