import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import PromptScreen from '../../features/agent/screens/PromptScreen';

export type MainStackParamList = {
  Tabs: undefined;
  Prompt: { projectId: string; projectName: string };
  // ponytail: add JobStatus + DiffViewer when built
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Prompt" component={PromptScreen} />
    </Stack.Navigator>
  );
}
