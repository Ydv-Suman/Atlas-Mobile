import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import LoadingSpinner from '../../shared/components/LoadingSpinner';

export default function AppNavigator() {
  const [hydrated, setHydrated] = useState(false);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const jwt = useAuthStore((s) => s.jwt);

  useEffect(() => {
    loadFromStorage().then(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      {jwt ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
