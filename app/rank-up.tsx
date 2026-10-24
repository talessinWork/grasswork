/** Rank up (RankUp artboard): the one loud screen. Moss ground, leaf confetti, huge rank name, then calm. */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline } from 'react-native-svg';
import { getGoal } from '../src/core/evaluator/specs/index';
import type { GoalId } from '../src/core/types';
import { RANK_UP_XP } from '../src/services/app';
import { Card } from '../src/ui/components/Card';
import { LeafConfetti } from '../src/ui/components/LeafConfetti';
import { Pill } from '../src/ui/components/Pill';
import { PrimaryButton } from '../src/ui/components/PrimaryButton';
import { FadeIn, Screen } from '../src/ui/components/Screen';
import { RANK_TAGLINE } from '../src/ui/copy';
import { Txt } from '../src/ui/Txt';
import { color } from '../src/ui/theme';

type RankUp = { goalId: GoalId; rank: string };

function parseRanks(raw: string | undefined): RankUp[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.goalId === 'string' && typeof x.rank === 'string') : [];
  } catch {
    return [];
  }
}

/** Then vs now: pale week-1 outline and the deeper white pose, from the artboard. */
function ThenNow() {
  return (
    <Svg width={220} height={140} viewBox="0 0 220 140" accessible={false}>
      <Line x1={10} y1={132} x2={210} y2={132} stroke={color.rankEyebrow} strokeWidth={1.5} strokeDasharray="5 5" />
      <G fill="none" stroke={color.rankGhost} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="100,128 136,84 96,74 112,22" />
        <Circle cx={120} cy={14} r={10} />
      </G>
      <G fill="none" stroke={color.paper} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="100,128 136,100 92,118 116,54" />
        <Circle cx={124} cy={40} r={12} />
      </G>
      <Circle cx={92} cy={118} r={5} fill={color.emberLight} />
    </Svg>
  );
}

export default function RankUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ranks?: string; i?: string }>();
  const ranks = useMemo(() => parseRanks(params.ranks), [params.ranks]);
  const i = Math.max(0, Number(params.i ?? 0) || 0);
  const current = ranks[i];

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [i]);

  const next = () => {
    if (i + 1 < ranks.length) router.setParams({ i: String(i + 1) });
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!current) {
    return (
      <Screen bg={color.moss} bottomInset footer={<PrimaryButton variant="light" label="Keep going" onPress={next} />}>
        <View />
      </Screen>
    );
  }

  const goal = getGoal(current.goalId);
  return (
    <View style={styles.root}>
      <LeafConfetti key={i} />
      <Screen
        bg={color.transparent}
        top={60}
        gap={24}
        bottomInset
        footer={<PrimaryButton variant="light" size="lg" label="Keep going" onPress={next} />}
      >
        <FadeIn key={`h${i}`} style={styles.hero}>
          <Txt variant="eyebrow" color="rankEyebrow" align="center" style={styles.eyebrow}>
            {goal.name} · new rank
          </Txt>
          <Txt variant="hero" color="paper" align="center" accessibilityRole="header" adjustsFontSizeToFit numberOfLines={1}>
            {current.rank}
          </Txt>
          <Txt variant="body" color="mossSoft" align="center" style={styles.tagline}>
            {RANK_TAGLINE[current.rank] ?? 'A new stone on your path.'}
          </Txt>
        </FadeIn>

        <FadeIn key={`c${i}`} delay={300}>
          <Card tone="rank" r="xxl" padding={20} gap={10} style={styles.card} accessibilityLabel="Your first test compared with now">
            <ThenNow />
            <View style={styles.between}>
              <Txt variant="small" color="mossSoft">
                Week 1
              </Txt>
              <Txt variant="smallSemi" color="paper">
                Now · {current.rank}
              </Txt>
            </View>
          </Card>
        </FadeIn>

        <FadeIn key={`p${i}`} delay={500} style={styles.pills}>
          <Pill label={`+${RANK_UP_XP} XP`} tone="reward" size="md" />
          {i + 1 < ranks.length && <Pill label={`${ranks.length - i - 1} more to celebrate`} tone="rankGlass" size="md" />}
        </FadeIn>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.moss },
  hero: { alignItems: 'center', gap: 4, paddingTop: 40 },
  eyebrow: { letterSpacing: 1.7 },
  tagline: { fontSize: 16, lineHeight: 22 },
  card: { alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
});
