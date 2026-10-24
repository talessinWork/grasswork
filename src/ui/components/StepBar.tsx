/** Onboarding progress: three short bars, moss up to the current step. */
import { View } from 'react-native';
import { color } from '../theme';

export function StepBar({ step, of = 3 }: { step: number; of?: number }) {
  return (
    <View
      style={{ flexDirection: 'row', gap: 6 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${of}`}
    >
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? color.moss : color.line }} />
      ))}
    </View>
  );
}
