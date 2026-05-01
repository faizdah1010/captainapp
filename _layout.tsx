import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { Colors, Typography } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const tabBarStyle = {
    height: Platform.select({ ios: insets.bottom + 64, android: insets.bottom + 64, default: 70 }),
    paddingTop: 10,
    paddingBottom: Platform.select({ ios: insets.bottom + 10, android: insets.bottom + 10, default: 10 }),
    paddingHorizontal: 8,
    backgroundColor: '#130003',
    borderTopWidth: 1,
    borderTopColor: 'rgba(204,16,32,0.25)',
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.red,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: Typography.sizes.xs, fontWeight: Typography.weights.semiBold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: t('rides'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="directions-car" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('chat'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="chat" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('account'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
