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
            <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="tools/email-writer" options={{ title: 'AI Email' }} />
            <Stack.Screen name="tools/ai-writer" options={{ title: 'AI Writer' }} />
            <Stack.Screen name="tools/cover-letter" options={{ title: 'Cover Letter' }} />
            <Stack.Screen name="tools/document-ai" options={{ title: 'Document AI' }} />
            <Stack.Screen name="tools/study-assistant" options={{ title: 'Study Assistant' }} />
            <Stack.Screen name="tools/contract-writer" options={{ title: 'AI Contract' }} />
            <Stack.Screen name="tools/analytics-ai" options={{ title: 'AI Data Analytics' }} />
            <Stack.Screen name="tools/translator" options={{ title: 'Translator' }} />
            <Stack.Screen name="tools/prompt-library" options={{ title: 'Prompt Library' }} />
            <Stack.Screen name="tools/background-remover" options={{ title: 'Background Remover' }} />
            <Stack.Screen name="tools/image-cropper" options={{ title: 'Image Cropper' }} />
            <Stack.Screen name="tools/image-to-pdf" options={{ title: 'Image to PDF' }} />
            <Stack.Screen name="tools/batch-image-tools" options={{ title: 'Batch Image Converter' }} />
            <Stack.Screen name="tools/pdf-tools" options={{ title: 'PDF Studio' }} />
            <Stack.Screen name="tools/csv-cleaner" options={{ title: 'CSV Cleaner' }} />
            <Stack.Screen name="tools/invoice-generator" options={{ title: 'Invoice Generator' }} />
            <Stack.Screen name="tools/cv-builder" options={{ title: 'CV Builder' }} />
            <Stack.Screen name="tools/name-generator" options={{ title: 'Name Generator' }} />
            <Stack.Screen name="tools/letter-generator" options={{ title: 'Letter Generator' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
