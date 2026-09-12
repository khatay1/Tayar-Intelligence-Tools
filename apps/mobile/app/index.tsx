import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/useAuth';
import { colors } from '@/lib/theme';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.violetBright} />
      </View>
    );
  }
  return <Redirect href={user ? '/(tabs)/home' : '/login'} />;
}
