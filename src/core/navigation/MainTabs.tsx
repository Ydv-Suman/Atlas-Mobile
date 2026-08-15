import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing } from '../theme/appTheme';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import ProfileScreen, { getUserInitials } from '../../features/profile/screens/ProfileScreen';
import GitScreen from '../../features/git/screens/GitScreen';
import WorkspaceScreen from '../../features/workspace/screens/WorkspaceScreen';

export type MainTabParamList = {
  Workspace: undefined;
  Agent: undefined;
  Git: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const tabs: Array<{
  name: Exclude<keyof MainTabParamList, 'Profile'>;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  { name: 'Workspace', label: 'Workspace', icon: 'grid-outline' },
  { name: 'Agent', label: 'Agent', icon: 'sparkles-outline' },
  { name: 'Git', label: 'Git', icon: 'git-branch-outline' },
];

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.name === 'Workspace' ? WorkspaceScreen : tab.name === 'Git' ? GitScreen : TabPlaceholderScreen}
          options={{
            title: tab.label,
            tabBarIcon: ({ color }) => (
              <View style={styles.libraryTabIcon}>
                <Ionicons name={tab.icon} size={25} color={color} />
              </View>
            ),
          }}
        />
      ))}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function ProfileTabIcon({ color }: { color: string }) {
  const user = useAuthStore((s) => s.user);

  return (
    <View style={[styles.profileTabIcon, { borderColor: color }]}>
      <Text style={[styles.profileTabInitials, { color }]}>
        {getUserInitials(user)}
      </Text>
    </View>
  );
}

function TabPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Atlas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  tabBar: {
    height: 64,
    width: '80%',
    alignSelf: 'center',
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopColor: colors.border,
  },
  tabItem: {
    maxWidth: 78,
  },
  profileTabIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTabInitials: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  libraryTabIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
