import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/useAuth';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.violetBright} /></View>;
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: '#0D0D16',
          borderTopColor: colors.border,
          height: 74,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.violetBright,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', headerShown: false, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', headerShown: false, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-grid-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="files" options={{ title: 'Files', headerShown: false, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="folder-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerShown: false, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
