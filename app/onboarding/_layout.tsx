import { Stack } from 'expo-router';
import { color } from '../../src/ui/theme';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.stone }, animation: 'fade' }} />;
}
