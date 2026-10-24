/**
 * Today. Morning (Home artboard): Gus + line, today's practice with one Start button, rank tiles, week pebbles.
 * Evening (HomeEvening artboard, HomeVM.evening): dusk palette, countdown, 3-minute rescue.
 * On test day a weekly-boss card leads into /boss.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { getGoal } from '../../src/core/evaluator/specs/index';
import { gusLine } from '../../src/core/game/gus';
import type { SessionKind } from '../../src/core/types';
import type { HomeVM } from '../../src/services/contract';
import { Card } from '../../src/ui/components/Card';
import { Gus } from '../../src/ui/components/Gus';
import { Icon } from '../../src/ui/components/Icon';
import { Pill } from '../../src/ui/components/Pill';
import { PrimaryButton } from '../../src/ui/components/PrimaryButton';
import { ProgressBar } from '../../src/ui/components/ProgressBar';
import { FadeIn, Screen } from '../../src/ui/components/Screen';
import { SpeechBubble } from '../../src/ui/components/SpeechBubble';
import { WeekPebbles } from '../../src/ui/components/WeekPebbles';
import { GOAL_SHORT } from '../../src/ui/copy';
import { dayHeader, eveningHeader, hoursMinutes, planMinutes, planSummary } from '../../src/ui/format';
import { useFocusLoad } from '../../src/ui/hooks/useFocusLoad';
import { useServices, useSettings } from '../../src/ui/ServicesProvider';
import { Txt } from '../../src/ui/Txt';
import { color } from '../../src/ui/theme';

/** re-fetch every minute while focused so the countdown and dawn → dusk switch stay current */
function useMinuteTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

export default function Home() {
  const services = useServices();
  const router = useRouter();
  const tick = useMinuteTick();
  const { data: vm, error, reload } = useFocusLoad(() => services.getHome(Date.now()), [services]);

  useEffect(() => {
    if (tick > 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const start = (kind: SessionKind) => router.push({ pathname: '/session', params: { kind } });

  if (!vm) {
    return (
      <View style={[styles.center, { backgroundColor: color.stone }]}>
        {error ? <Txt color="muted">{error.message}</Txt> : <ActivityIndicator color={color.moss} />}
      </View>
    );
  }
  return vm.evening ? <Evening vm={vm} onStart={start} /> : <Morning vm={vm} onStart={start} onBoss={() => router.push('/boss')} />;
}

// ---------------------------------------------------------------------------

function Morning({ vm, onStart, onBoss }: { vm: HomeVM; onStart(k: SessionKind): void; onBoss(): void }) {
  const { settings } = useSettings();
  const [line, setLine] = useState(vm.gusLine);
  useEffect(() => setLine(vm.gusLine), [vm.gusLine]);
  const minutes = planMinutes(vm.plan);
  const shuffleLine = () =>
    setLine(gusLine(vm.gus, settings?.tone ?? 'sassy', Math.floor(Math.random() * 1000), { streak: vm.streak.current, minutesPlanned: minutes }));

  return (
    <Screen scroll gap={20}>
      <View style={styles.header}>
        <View>
          <Txt variant="small" color="muted">
            {dayHeader(Date.now())}
          </Txt>
          <Txt variant="title" accessibilityRole="header">
            Today
          </Txt>
        </View>
        <View style={styles.pills}>
          <Pill
            label={String(vm.streak.current)}
            icon="flame"
            iconColor="ember"
            size="md"
            accessibilityLabel={`${vm.streak.current} day streak`}
          />
          <Pill label={`Lv ${vm.level.level}`} size="md" accessibilityLabel={`Level ${vm.level.level}`} />
        </View>
      </View>

      <View style={styles.gusRow}>
        <Pressable onLongPress={shuffleLine} accessibilityRole="button" accessibilityLabel="Gus" accessibilityHint="Long press for another line">
          <Gus mood={vm.gus} size={96} />
        </Pressable>
        <SpeechBubble style={styles.bubble}>{line}</SpeechBubble>
      </View>

      {vm.isTestDay && vm.goals.length > 0 && (
        <FadeIn>
          <Card tone="forest" onPress={onBoss} accessibilityLabel="Weekly boss is here. Open the weekly test." style={styles.bossCard} gap={4}>
            <Txt variant="eyebrow" color="forestMuted">
              Weekly boss
            </Txt>
            <View style={styles.between}>
              <Txt variant="stat" color="forestInk">
                {getGoal(vm.goals[0].goalId).bossName} awaits
              </Txt>
              <Icon name="chevron" color="forestInk" />
            </View>
            <Txt variant="small" color="forestText">
              One try per goal. Beat last week's depth.
            </Txt>
          </Card>
        </FadeIn>
      )}

      <Card r="xl" padding={20} gap={16}>
        <View style={styles.between}>
          <Txt variant="lead">{vm.doneToday ? 'Done for today' : "Today's practice"}</Txt>
          <Txt variant="small" color="muted">
            {planSummary(vm.plan)}
          </Txt>
        </View>
        <View style={styles.lines}>
          {vm.planLines.map((l) => (
            <View key={l.stretchId} style={styles.between} accessible accessibilityLabel={`${l.name}, ${l.detail}`}>
              <Txt style={styles.flex}>{l.name}</Txt>
              <Txt color="muted">{l.detail}</Txt>
            </View>
          ))}
        </View>
        {vm.doneToday ? (
          <Txt variant="small" color="mossDeep">
            Gus is thriving. Another round only adds XP.
          </Txt>
        ) : (
          <PrimaryButton label="Start" icon="play" size="lg" onPress={() => onStart('daily')} accessibilityHint={`${minutes} minute session with the camera`} />
        )}
      </Card>

      {vm.goals.length > 0 && (
        <View style={styles.tiles}>
          {vm.goals.map((g) => (
            <Card key={g.goalId} r="lg" gap={8} style={styles.tile}>
              <Txt variant="small" color="muted">
                {GOAL_SHORT[g.goalId]} rank
              </Txt>
              <Txt variant="stat">{g.currentRank ?? 'Unranked'}</Txt>
              <ProgressBar value={g.progress} />
              <Txt variant="caption" color="muted">
                {g.nextRank ? `${Math.round(g.progress * 100)}% to ${g.nextRank}` : 'Top rank'}
              </Txt>
            </Card>
          ))}
        </View>
      )}

      <WeekPebbles week={vm.week} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Evening({ vm, onStart }: { vm: HomeVM; onStart(k: SessionKind): void }) {
  const streak = vm.streak.current;
  const minutes = planMinutes(vm.plan);
  return (
    <Screen bg={color.dusk} gap={20} scroll>
      <View style={styles.header}>
        <View>
          <Txt variant="small" color="duskMuted">
            {eveningHeader(Date.now())}
          </Txt>
          <Txt variant="title" color="duskInk" accessibilityRole="header">
            Today
          </Txt>
        </View>
        {streak > 0 && (
          <Pill label={`${streak} at risk`} icon="flame" tone="emberDusk" size="md" accessibilityLabel={`${streak} day streak at risk`} />
        )}
      </View>

      <View style={styles.eveningHero}>
        <Gus mood={vm.gus} size={140} dusk />
        {vm.minutesLeft != null && (
          <View style={styles.countdown}>
            <Txt variant="display" color="duskInk" align="center">
              {hoursMinutes(vm.minutesLeft)}
            </Txt>
            <Txt color="duskMuted" align="center">
              {streak > 0 ? `left to keep your ${streak}-day streak` : 'left to start a streak today'}
            </Txt>
          </View>
        )}
        <SpeechBubble shape="round" tone="dusk" style={styles.eveningBubble}>
          {vm.gusLine}
        </SpeechBubble>
      </View>

      <View style={styles.eveningActions}>
        {vm.rescueAvailable ? (
          <>
            <PrimaryButton variant="ember" label="3-minute rescue" sublabel="One hold per goal. Saves the streak." onPress={() => onStart('rescue')} />
            <PrimaryButton variant="outlineDusk" label={`Full session · ${minutes} min`} onPress={() => onStart('daily')} />
          </>
        ) : (
          <PrimaryButton variant="ember" size="lg" label={`Start · ${minutes} min`} icon="play" onPress={() => onStart('daily')} />
        )}
        {vm.streak.freezesBanked > 0 && (
          <View style={styles.freeze} accessible>
            <Icon name="freeze" size={16} color="frost" />
            <Txt variant="small" color="duskMuted">
              {vm.streak.freezesBanked} streak freeze{vm.streak.freezesBanked === 1 ? '' : 's'} banked, used automatically at midnight
            </Txt>
          </View>
        )}
        <WeekPebbles week={vm.week} dusk />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', gap: 8 },
  gusRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingVertical: 4 },
  bubble: { flex: 1, marginBottom: 28 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  lines: { gap: 10 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  bossCard: { backgroundColor: color.forest },
  eveningHero: { alignItems: 'center', gap: 16, paddingTop: 24, paddingBottom: 8 },
  countdown: { gap: 6 },
  eveningBubble: { maxWidth: 300 },
  eveningActions: { gap: 12, marginTop: 'auto' },
  freeze: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
});
