import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import AuthStack from './AuthStack';
import LoadingSpinner from '../../shared/components/LoadingSpinner';

export default function AppNavigator() {
  const [hydrated, setHydrated] = useState(false);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage().then(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return <LoadingSpinner />;
  }

  // TODO: Add OnboardingStack (email verify gate, github authorize gate)
  // TODO: Add MainStack (projects, prompt, diff viewer, settings)
  // For now: no JWT → AuthStack
  return (
    <NavigationContainer>
      <AuthStack />
    </NavigationContainer>
  );
}
