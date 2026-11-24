import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { MainTabParamList } from './MainTabs';
import MainTabs from './MainTabs';
import PromptScreen from '../../features/agent/screens/PromptScreen';
import JobStatusScreen from '../../features/agent/screens/JobStatusScreen';

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Prompt: { projectId: string; projectName: string };
  JobStatus: { jobId: string; projectName: string };
  DiffViewer: { jobId: string; projectName: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Prompt" component={PromptScreen} />
      <Stack.Screen name="JobStatus" component={JobStatusScreen} />
    </Stack.Navigator>
  );
}
