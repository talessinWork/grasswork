/** Me = Gus's attitude (Attitude artboard): tone slider + live line, nag ladder toggles, quiet hours, rest day, voice cues, export. */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { canUseRestDay } from '../../src/core/game/streak';
import { ladderTimes } from '../../src/core/reminders/ladder';
import { pickMessage } from '../../src/core/reminders/messages';
import { toLocalDate } from '../../src/core/util';
import type { Settings } from '../../src/core/types';
import { Card } from '../../src/ui/components/Card';
import { PrimaryButton } from '../../src/ui/components/PrimaryButton';
import { Screen } from '../../src/ui/components/Screen';
import { TimeStepper } from '../../src/ui/components/TimeStepper';
import { ToggleRow } from '../../src/ui/components/Toggle';
import { ToneSlider } from '../../src/ui/components/ToneSlider';
import { DEFAULT_QUIET, LADDER_NAMES } from '../../src/ui/copy';
import { useFocusLoad } from '../../src/ui/hooks/useFocusLoad';
import { useServices, useSettings } from '../../src/ui/ServicesProvider';
import { Txt } from '../../src/ui/Txt';
import { color, hit, radius } from '../../src/ui/theme';

export default function Me() {
  const services = useServices();
  const { settings, updateSettings } = useSettings();
  const home = useFocusLoad(() => services.getHome(Date.now()), [services]);
  const [editingQuiet, setEditingQuiet] = useState(false);
  const [busy, setBusy] = useState<'rest' | 'export' | null>(null);

  if (!settings) return null;
  const save = (patch: Partial<Settings>) => updateSettings({ ...settings, ...patch }).catch((e) => Alert.alert("Couldn't save", String(e)));

  const streak = home.data?.streak.current ?? 0;
  const preview = pickMessage(settings.tone, 2, 1, { streak, minutes: 6 }).body;
  const times = ladderTimes(settings);
  const quietOn = settings.quietStart !== settings.quietEnd;

  const today = toLocalDate(Date.now());
  const restUsedToday = home.data?.streak.restDayUsed === today;
  const restAvailable = !!home.data && !home.data.doneToday && canUseRestDay(home.data.streak, today);
  const restText = restUsedToday
    ? 'Taken today. Gus is resting too.'
    : home.data && canUseRestDay(home.data.streak, today)
      ? '1 per week, unused'
      : 'Used this week';

  const takeRest = async () => {
    setBusy('rest');
    try {
      const ok = await services.useRestDay(Date.now());
      if (!ok) Alert.alert('No rest day left', 'You get one guilt-free rest day per week.');
      await home.reload();
    } finally {
      setBusy(null);
    }
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const json = await services.exportJson();
      const uri = `${FileSystem.cacheDirectory}grasswork-${today}.json`;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export Grasswork data' });
      } else {
        Alert.alert('Saved', uri);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll gap={18}>
      <Txt variant="title" accessibilityRole="header">
        Gus's attitude
      </Txt>

      <Card r="xl" gap={12}>
        <ToneSlider value={settings.tone} onChange={(tone) => save({ tone })} />
        <View style={styles.quote} accessibilityLiveRegion="polite">
          <Txt style={styles.quoteText}>“{preview}”</Txt>
        </View>
      </Card>

      <Card r="xl" gap={4} style={styles.ladder}>
        <Txt variant="eyebrow" color="muted" style={styles.ladderHead}>
          Nag ladder (only if you haven't stretched)
        </Txt>
        {LADDER_NAMES.map((name, i) => (
          <ToggleRow
            key={name}
            lead={times[i]}
            title={name}
            value={settings.ladderEnabled[i]}
            divider={i < LADDER_NAMES.length - 1}
            onChange={(v) => {
              const next = [...settings.ladderEnabled] as Settings['ladderEnabled'];
              next[i] = v;
              save({ ladderEnabled: next });
            }}
          />
        ))}
      </Card>

      <View style={styles.tiles}>
        <Pressable
          onPress={() => setEditingQuiet((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded: editingQuiet }}
          accessibilityLabel={`Quiet hours, ${quietOn ? `${settings.quietStart} to ${settings.quietEnd}` : 'off'}`}
          style={styles.tile}
        >
          <Txt variant="bodySemi">Quiet hours</Txt>
          <Txt variant="small" color="muted">
            {quietOn ? `${settings.quietStart} – ${settings.quietEnd}` : 'Off'}
          </Txt>
        </Pressable>
        <Pressable
          onPress={takeRest}
          disabled={!restAvailable || busy === 'rest'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !restAvailable }}
          accessibilityLabel={`Rest day, ${restText}`}
          accessibilityHint={restAvailable ? 'Takes today off without breaking your streak' : undefined}
          style={[styles.tile, restUsedToday && { backgroundColor: color.emberSoft }]}
        >
          <Txt variant="bodySemi">{restAvailable ? 'Take rest day' : 'Rest day'}</Txt>
          <Txt variant="small" color={restUsedToday ? 'emberInk' : 'muted'}>
            {restText}
          </Txt>
        </Pressable>
      </View>

      {editingQuiet && (
        <Card r="xl" gap={12}>
          <ToggleRow
            title="Quiet hours"
            value={quietOn}
            onChange={(on) => save(on ? { quietStart: DEFAULT_QUIET.start, quietEnd: DEFAULT_QUIET.end } : { quietStart: '00:00', quietEnd: '00:00' })}
          />
          {quietOn && (
            <>
              <View style={styles.between}>
                <Txt color="muted">From</Txt>
                <TimeStepper variant="stat" value={settings.quietStart} label="Quiet hours start" onChange={(quietStart) => save({ quietStart })} />
              </View>
              <View style={styles.between}>
                <Txt color="muted">Until</Txt>
                <TimeStepper variant="stat" value={settings.quietEnd} label="Quiet hours end" onChange={(quietEnd) => save({ quietEnd })} />
              </View>
            </>
          )}
        </Card>
      )}

      <Card r="xl" gap={4}>
        <ToggleRow
          title="Voice cues"
          subtitle="Gus talks you through each hold"
          value={settings.voiceCues}
          onChange={(voiceCues) => save({ voiceCues })}
        />
      </Card>

      <PrimaryButton variant="secondary" label="Export my data" onPress={exportData} loading={busy === 'export'} />
      <Txt variant="caption" color="muted" align="center">
        Video never leaves this phone. Only angles and times are saved.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quote: { marginTop: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: color.stone, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 4 },
  quoteText: { fontSize: 14, lineHeight: 20 },
  ladder: { paddingVertical: 8 },
  ladderHead: { paddingTop: 8, paddingBottom: 4 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: hit, gap: 2, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.lg, backgroundColor: color.paper },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
