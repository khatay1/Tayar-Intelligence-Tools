import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="tools/email-writer" options={{ title: 'AI Email' }} />
            <Stack.Screen name="tools/contract-writer" options={{ title: 'AI Contract' }} />
            <Stack.Screen name="tools/analytics-ai" options={{ title: 'AI Data Analytics' }} />
            <Stack.Screen name="tools/translator" options={{ title: 'Translator' }} />
            <Stack.Screen name="tools/pdf-tools" options={{ title: 'PDF Studio' }} />
            <Stack.Screen name="tools/invoice-generator" options={{ title: 'Invoice Generator' }} />
            <Stack.Screen name="tools/cv-builder" options={{ title: 'CV Builder' }} />
            <Stack.Screen name="tools/background-remover" options={{ title: 'Background Remover' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
