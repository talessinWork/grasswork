/** Onboarding 2 of 3: anchor + time, Gus's tone with a live line, quiet hours (OnboardingRhythm artboard) → completeOnboarding. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { GOALS } from '../../src/core/evaluator/specs/index';
import { pickMessage } from '../../src/core/reminders/messages';
import { DEFAULT_SETTINGS } from '../../src/core/util';
import type { GoalId, Settings, Tone } from '../../src/core/types';
import { ensureNotificationPermission } from '../../src/ui/bootstrap';
import { Card } from '../../src/ui/components/Card';
import { Chip } from '../../src/ui/components/Chip';
import { Gus } from '../../src/ui/components/Gus';
import { PrimaryButton } from '../../src/ui/components/PrimaryButton';
import { Screen } from '../../src/ui/components/Screen';
import { Segmented } from '../../src/ui/components/Segmented';
import { SpeechBubble } from '../../src/ui/components/SpeechBubble';
import { StepBar } from '../../src/ui/components/StepBar';
import { TimeStepper } from '../../src/ui/components/TimeStepper';
import { ToggleRow } from '../../src/ui/components/Toggle';
import { ANCHORS, DEFAULT_QUIET, TONE_OPTIONS } from '../../src/ui/copy';
import { useServices, useSettings } from '../../src/ui/ServicesProvider';
import { Txt } from '../../src/ui/Txt';

export default function OnboardingRhythm() {
  const router = useRouter();
  const services = useServices();
  const { settings, reloadSettings } = useSettings();
  const params = useLocalSearchParams<{ goals?: string }>();
  const goals = useMemo(() => {
    const ids = (params.goals ?? '').split(',').filter(Boolean);
    return GOALS.filter((g) => g.available && ids.includes(g.id)).map((g) => g.id as GoalId);
  }, [params.goals]);

  const base = settings ?? DEFAULT_SETTINGS;
  const [anchor, setAnchor] = useState(base.anchorLabel);
  const [time, setTime] = useState(base.sessionTime);
  const [tone, setTone] = useState<Tone>(base.tone);
  const [quiet, setQuiet] = useState(base.quietStart !== base.quietEnd);
  const [saving, setSaving] = useState(false);

  const preview = pickMessage(tone, 0, 3, { streak: 0, minutes: 6 }).body;
  const quietStart = base.quietStart !== base.quietEnd ? base.quietStart : DEFAULT_QUIET.start;
  const quietEnd = base.quietStart !== base.quietEnd ? base.quietEnd : DEFAULT_QUIET.end;

  const finish = async () => {
    setSaving(true);
    try {
      const next: Settings = {
        ...base,
        anchorLabel: anchor,
        sessionTime: time,
        tone,
        quietStart: quiet ? quietStart : '00:00',
        quietEnd: quiet ? quietEnd : '00:00',
        onboarded: true,
      };
      await services.completeOnboarding({ goals: goals.length ? goals : ['deep_squat'], settings: next });
      // permission is asked only now, with the reminders it is for already planned
      await ensureNotificationPermission().catch(() => false);
      await services.syncReminders(Date.now());
      await reloadSettings();
      router.replace('/');
      // day-1 baseline test sets the starting rank
      router.push({ pathname: '/session', params: { kind: 'test' } });
    } catch (e) {
      setSaving(false);
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen scroll top={20} gap={24} bottomInset footer={<PrimaryButton label="Continue" onPress={finish} loading={saving} />}>
      <StepBar step={2} />
      <Txt variant="h1" accessibilityRole="header">
        When should Gus find you?
      </Txt>

      <View style={styles.section}>
        <Txt variant="eyebrow" color="muted">
          Tie it to something you already do
        </Txt>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Habit anchor">
          {ANCHORS.map((a) => (
            <Chip
              key={a.label}
              label={a.label}
              selected={anchor === a.label}
              onPress={() => {
                setAnchor(a.label);
                setTime(a.time);
              }}
            />
          ))}
        </View>
        <Card r="lg" padding={0} style={styles.timeCard}>
          <Txt color="muted">Usually around</Txt>
          <TimeStepper value={time} onChange={setTime} label="Usual stretch time" />
        </Card>
      </View>

      <View style={styles.section}>
        <Txt variant="eyebrow" color="muted">
          How should Gus nag?
        </Txt>
        <Segmented options={TONE_OPTIONS} value={tone} onChange={setTone} accessibilityLabel="Tone" />
        <View style={styles.gusRow}>
          <Gus mood="waiting" size={48} noGround />
          <SpeechBubble style={styles.flex}>{preview}</SpeechBubble>
        </View>
      </View>

      <Card r="lg" padding={0} style={styles.quietCard}>
        <ToggleRow
          title="Quiet hours"
          subtitle={quiet ? `No nags ${quietStart} – ${quietEnd}` : 'Gus may nag at any hour'}
          value={quiet}
          onChange={setQuiet}
          size="md"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingLeft: 20, paddingRight: 12 },
  gusRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  quietCard: { paddingVertical: 14, paddingHorizontal: 20 },
});
