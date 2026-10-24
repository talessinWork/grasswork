/** Your path (Path artboard): goal tabs, rank stepping stones, weekly-test chart, replay card. */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { GOALS, getSpec } from '../../src/core/evaluator/specs/index';
import type { GoalId } from '../../src/core/types';
import { Card } from '../../src/ui/components/Card';
import { RankStones } from '../../src/ui/components/RankStones';
import { FadeIn, Screen } from '../../src/ui/components/Screen';
import { Segmented } from '../../src/ui/components/Segmented';
import { TestChart } from '../../src/ui/components/TestChart';
import { useFocusLoad } from '../../src/ui/hooks/useFocusLoad';
import { useServices } from '../../src/ui/ServicesProvider';
import { Txt } from '../../src/ui/Txt';
import { color } from '../../src/ui/theme';

const TABS = GOALS.filter((g) => g.available).map((g) => ({ value: g.id, label: g.name }));

export default function PathScreen() {
  const services = useServices();
  const [goal, setGoal] = useState<GoalId>(TABS[0]?.value ?? 'deep_squat');
  const { data: vm, error } = useFocusLoad(() => services.getPath(goal, Date.now()), [services, goal]);

  const metricLabel = goal === 'deep_squat' ? 'hip depth' : 'reach';
  const higherIsDeeper = vm ? getSpec(vm.rank.currentStretchId).depthBetter === 'higher' : true;

  return (
    <Screen scroll gap={18}>
      <Txt variant="title" accessibilityRole="header">
        Your path
      </Txt>
      <Segmented options={TABS} value={goal} onChange={setGoal} role="tab" accessibilityLabel="Goal" />

      {!vm || vm.goalId !== goal ? (
        <View style={styles.loading}>{error ? <Txt color="muted">{error.message}</Txt> : <ActivityIndicator color={color.moss} />}</View>
      ) : (
        <FadeIn style={styles.stack} key={goal}>
          <Card r="xl" gap={10} style={styles.pad}>
            <RankStones ranks={vm.ranks} progress={vm.rank.progress} />
            <Txt variant="small" color="muted">
              {vm.nextStepText}
            </Txt>
          </Card>

          <Card r="xl" gap={8} style={styles.pad}>
            <View style={styles.between}>
              <Txt variant="bodySemi">Weekly test · {metricLabel}</Txt>
              <Txt variant="caption" color="muted">
                {vm.tests.length === 0 ? 'no tests yet' : `${vm.tests.length} test${vm.tests.length === 1 ? '' : 's'}`}
              </Txt>
            </View>
            {vm.tests.length === 0 ? (
              <Txt variant="small" color="muted">
                Your first weekly test draws the first point. Only tests are plotted, never daily noise.
              </Txt>
            ) : (
              <TestChart points={vm.tests} unit={vm.unit} referenceLabel={vm.referenceLabel} higherIsDeeper={higherIsDeeper} />
            )}
          </Card>

          <Card r="xl" style={styles.replay} accessibilityLabel="Replay, week 1 versus now. Coming soon.">
            <Svg width={64} height={56} viewBox="0 0 64 56">
              <Line x1={4} y1={52} x2={60} y2={52} stroke={color.ghost} strokeWidth={1.5} strokeDasharray="3 3" />
              <Polyline points="26,50 36,32 28,36 34,12" fill="none" stroke={color.pending} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points="26,50 40,36 22,44 32,18" fill="none" stroke={color.moss} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <View style={styles.flex}>
              <Txt variant="bodySemi">Replay: week 1 vs now</Txt>
              <Txt variant="small" color="muted">
                Your two skeletons, overlaid. Coming soon.
              </Txt>
            </View>
          </Card>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: 18 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  pad: { paddingVertical: 18, paddingHorizontal: 16 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  replay: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
});
