import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../../core/navigation/MainStack';

export default function JobStatusScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  useEffect(() => { nav.replace('Tabs', { screen: 'Agent' }); }, [nav]);
  return null;
}
