/** Session summary (Summary artboard): grown Gus, stat tiles, personal bests, one Done button. */
import { StyleSheet, View } from 'react-native';
import type { SummaryVM } from '../../services/contract';
import { Card } from '../components/Card';
import { Gus } from '../components/Gus';
import { Icon } from '../components/Icon';
import { Pill } from '../components/Pill';
import { PrimaryButton } from '../components/PrimaryButton';
import { FadeIn, Screen } from '../components/Screen';
import { mmss } from '../format';
import { Txt } from '../Txt';
import type { ColorToken } from '../theme';

function Stat({ value, label, tint }: { value: string; label: string; tint?: ColorToken }) {
  return (
    <Card r="lg" gap={2} style={styles.tile} accessibilityLabel={`${value} ${label}`}>
      <Txt variant="h2" color={tint}>
        {value}
      </Txt>
      <Txt variant="small" color="muted">
        {label}
      </Txt>
    </Card>
  );
}

export function SummaryView({ vm, onDone }: { vm: SummaryVM; onDone(): void }) {
  const counted = vm.holdsVerified > 0;
  const pbXp = vm.xpBreakdown.filter((e) => e.source === 'personal_best').reduce((s, e) => s + e.amount, 0);
  return (
    <Screen top={40} gap={24} bottomInset scroll footer={<PrimaryButton label={vm.rankUps.length ? 'Continue' : 'Done'} onPress={onDone} />}>
      <View style={styles.hero}>
        <Gus mood={counted ? 'thriving' : 'waiting'} grown={counted} size={120} />
        <Txt variant="h1" align="center" accessibilityRole="header">
          {counted ? `Day ${vm.dayNumber}. Done.` : 'Not quite yet.'}
        </Txt>
        <Txt color="muted" align="center">
          {counted ? `Gus grew a new leaf. ${vm.nextSessionText}.` : `No hold was verified this time. ${vm.nextSessionText}.`}
        </Txt>
      </View>

      <FadeIn delay={200} style={styles.grid}>
        <Stat value={String(vm.holdsVerified)} label="holds verified" />
        <Stat value={mmss(vm.secondsHeld)} label="time in position" />
        <Stat value={`+${vm.xpEarned} XP`} label={pbXp > 0 ? `incl. +${pbXp} best-depth bonus` : 'earned today'} tint="emberText" />
        <Stat value={String(vm.dayNumber)} label="day streak" />
      </FadeIn>

      {vm.personalBests.map((pb) => (
        <FadeIn key={pb.stretchId} delay={400}>
          <Card tone="moss" r="lg" style={styles.pb} accessibilityLabel={`New best: ${pb.name}, ${pb.text}`}>
            <Icon name="sprout" size={40} strokeWidth={1.8} color="moss" />
            <View style={styles.flex}>
              <Txt variant="bodySemi">New {pb.name.toLowerCase()} best</Txt>
              <Txt variant="small" color="mossDeep">
                {pb.text}
              </Txt>
            </View>
          </Card>
        </FadeIn>
      ))}

      {vm.newBadges.length > 0 && (
        <FadeIn delay={500} style={styles.badges}>
          {vm.newBadges.map((b) => (
            <Pill key={b.id} label={`Pressed leaf: ${b.name}`} tone="met" />
          ))}
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1 },
  pb: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
});
