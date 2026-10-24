/** Onboarding 1 of 3: pick up to three goals (OnboardingGoals artboard). */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GOALS } from '../../src/core/evaluator/specs/index';
import type { GoalId } from '../../src/core/types';
import { Icon } from '../../src/ui/components/Icon';
import { PrimaryButton } from '../../src/ui/components/PrimaryButton';
import { Screen } from '../../src/ui/components/Screen';
import { Silhouette } from '../../src/ui/components/Silhouette';
import { StepBar } from '../../src/ui/components/StepBar';
import { GOAL_CARD } from '../../src/ui/copy';
import { Txt } from '../../src/ui/Txt';
import { color, radius } from '../../src/ui/theme';

const MAX = 3;

export default function OnboardingGoals() {
  const router = useRouter();
  const [picked, setPicked] = useState<GoalId[]>(['deep_squat', 'forward_fold']);

  const toggle = (id: GoalId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));

  const n = picked.length;
  return (
    <Screen
      scroll
      top={20}
      gap={24}
      bottomInset
      footer={
        <>
          <Txt variant="small" color="muted" align="center">
            Next: a 2-minute test to find where you start.
          </Txt>
          <PrimaryButton
            label={n === 0 ? 'Pick a goal' : `Continue with ${n} goal${n === 1 ? '' : 's'}`}
            disabled={n === 0}
            onPress={() => router.push({ pathname: '/onboarding/rhythm', params: { goals: picked.join(',') } })}
          />
        </>
      }
    >
      <StepBar step={1} />
      <View style={styles.head}>
        <Txt variant="h1" accessibilityRole="header">
          What should your body be able to do?
        </Txt>
        <Txt color="muted">Pick up to three. Gus builds a path to each one.</Txt>
      </View>
      <View style={styles.grid}>
        {GOALS.map((g) => {
          const card = GOAL_CARD[g.id];
          const on = picked.includes(g.id);
          const locked = !g.available;
          const full = !on && n >= MAX;
          return (
            <Pressable
              key={g.id}
              onPress={() => !locked && toggle(g.id)}
              disabled={locked || full}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: locked || full }}
              accessibilityLabel={locked ? `${card.title}, coming later` : card.title}
              style={[styles.card, on && styles.cardOn, (locked || full) && styles.cardOff]}
            >
              <Silhouette kind={card.silhouette} ink={on ? color.ink : color.muted} />
              <Txt variant="bodySemi">{card.title}</Txt>
              {locked && (
                <Txt variant="caption" color="muted">
                  Coming later
                </Txt>
              )}
              {on && (
                <View style={styles.check}>
                  <Icon name="check" size={14} strokeWidth={3} color="paper" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 10,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.transparent,
    backgroundColor: color.paper,
  },
  cardOn: { borderColor: color.moss, backgroundColor: color.mossSoft },
  cardOff: { opacity: 0.6 },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.moss,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
