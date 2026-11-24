import React, { useLayoutEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize } from '../theme/appTheme';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import ProfileScreen, { getUserInitials } from '../../features/profile/screens/ProfileScreen';
import ConnectScreen from '../../features/settings/screens/ConnectScreen';
import WorkspaceScreen from '../../features/workspace/screens/WorkspaceScreen';
import AgentTabScreen from '../../features/agent/screens/AgentTabScreen';
import { useWorkspaceStore } from '../../features/workspace/store/useWorkspaceStore';

export type MainTabParamList = {
  Workspace: undefined;
  Agent: undefined;
  Connect: undefined;
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
  { name: 'Connect', label: 'Connect', icon: 'link-outline' },
];

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const account = useAuthStore(state => state.user?.username ?? null);
  const restoreProject = useWorkspaceStore(state => state.restoreProject);
  useLayoutEffect(() => { void restoreProject(account); }, [account, restoreProject]);

  return (
    <Tab.Navigator
      key={account ?? 'loading-account'}
      safeAreaInsets={{ bottom: 0 }}
      tabBar={(props) => (
        <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom - 20, 6) }]}>
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#B8C4D6',
        tabBarActiveBackgroundColor: 'transparent',
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ children, color, focused }) => (
          <View style={styles.tabLabelContainer}>
            <Text style={[styles.tabLabel, { color }, focused && styles.activeTabLabel]}>
              {children}
            </Text>
          </View>
        ),
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.name === 'Workspace' ? WorkspaceScreen : tab.name === 'Agent' ? AgentTabScreen : ConnectScreen}
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

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: colors.background,
    paddingTop: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  tabBar: {
    height: 72,
    width: '100%',
    maxWidth: 440,
    padding: 6,
    backgroundColor: '#18243B',
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: '#2A3850',
    borderRadius: 36,
    shadowColor: '#18243B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingVertical: 4,
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
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelContainer: {
    alignItems: 'center',
  },
  activeTabLabel: {
    fontWeight: '700',
  },
});
