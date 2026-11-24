import { useEffect } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../../core/navigation/MainStack';
import { useWorkspaceStore } from '../../workspace/store/useWorkspaceStore';

export default function PromptScreen() {
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList, 'Prompt'>>();
  const { params } = useRoute<RouteProp<MainStackParamList, 'Prompt'>>();
  const setActiveProject = useWorkspaceStore(state => state.setActiveProject);

  useEffect(() => {
    setActiveProject(Number(params.projectId));
    nav.replace('Tabs', { screen: 'Agent' });
  }, [nav, params.projectId, setActiveProject]);

  return null;
}
