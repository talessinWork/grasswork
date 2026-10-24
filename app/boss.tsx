/** Weekly boss (WeeklyBoss artboard): the boulder, last week's mark, boss health, rewards → test session. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { getGoal } from '../src/core/evaluator/specs/index';
import type { GoalId } from '../src/core/types';
import { Card } from '../src/ui/components/Card';
import { IconButton } from '../src/ui/components/IconButton';
import { PrimaryButton } from '../src/ui/components/PrimaryButton';
import { ProgressBar } from '../src/ui/components/ProgressBar';
import { FadeIn, Screen } from '../src/ui/components/Screen';
import { useFocusLoad } from '../src/ui/hooks/useFocusLoad';
import { useServices } from '../src/ui/ServicesProvider';
import { Txt } from '../src/ui/Txt';
import { color } from '../src/ui/theme';

function Boulder() {
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170" accessible={false}>
      <Ellipse cx={110} cy={158} rx={90} ry={8} fill={color.forestShadow} />
      <Path d="M30 150 C20 110 40 50 100 40 C160 30 200 80 194 130 C192 146 180 154 160 154 H52 C40 154 32 152 30 150Z" fill={color.boulder} />
      <Path d="M60 70 C80 54 110 50 130 56" stroke={color.boulderLight} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M78 100 L96 108 M150 100 L132 108" stroke={color.forest} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={90} cy={114} r={5} fill={color.forest} />
      <Circle cx={138} cy={114} r={5} fill={color.forest} />
      <Path d="M96 134 Q114 126 132 134" stroke={color.forest} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M150 50 C156 40 166 38 172 42" stroke={color.leafLight} strokeWidth={4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export default function Boss() {
  const router = useRouter();
  const services = useServices();
  const params = useLocalSearchParams<{ goal?: string }>();
  const { data, error } = useFocusLoad(async () => {
    let goalId = params.goal as GoalId | undefined;
    if (!goalId) goalId = (await services.getHome(Date.now())).goals[0]?.goalId ?? 'deep_squat';
    return services.getBoss(goalId, Date.now());
  }, [services, params.goal]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      bg={color.forest}
      gap={20}
      bottomInset
      scroll
      footer={
        <PrimaryButton
          variant="light"
          size="lg"
          label="Fight it"
          disabled={!data}
          onPress={() => router.replace({ pathname: '/session', params: { kind: 'test' } })}
          accessibilityHint="Starts the weekly test with the camera"
        />
      }
    >
      <View style={styles.header}>
        <Txt variant="eyebrow" color="forestMuted">
          {data ? `Weekly boss · week ${data.weekNumber}` : 'Weekly boss'}
        </Txt>
        <IconButton icon="close" tone="forest" label="Close" onPress={close} />
      </View>

      {!data ? (
        <View style={styles.loading}>{error ? <Txt color="forestText">{error.message}</Txt> : <ActivityIndicator color={color.forestInk} />}</View>
      ) : (
        <FadeIn style={styles.stack}>
          <View style={styles.hero}>
            <Boulder />
            <Txt variant="h1" color="forestInk" align="center" accessibilityRole="header">
              {data.bossName}
            </Txt>
            <Txt color="forestText" align="center">
              {getGoal(data.goalId).name} test.{' '}
              {data.lastBestText ? `Last time you reached ${data.lastBestText}.` : 'No mark yet. Today you set the first one.'}
            </Txt>
          </View>

          <Card tone="forest" r="lg" gap={8}>
            <View style={styles.between}>
              <Txt variant="smallSemi" color="forestInk">
                Boss health
              </Txt>
              <Txt variant="small" color="forestText">
                {data.health <= 0 ? 'Defeated. Hold your rank.' : `${Math.round(data.health * 100)}% left to beat`}
              </Txt>
            </View>
            <ProgressBar value={data.health} height={14} track={color.forestTrack} fill={color.ember} accessibilityLabel="Boss health" />
          </Card>

          <View style={styles.rewards}>
            {data.rewards.map((r) => (
              <View key={r.label} style={styles.between}>
                <Txt color="forestInk">{r.label}</Txt>
                <Txt variant="bodySemi" color="emberLight">
                  {r.value}
                </Txt>
              </View>
            ))}
            <View style={styles.between}>
              <Txt color="forestMuted">One try per goal, best depth counts</Txt>
              <Txt color="forestMuted">~2 min</Txt>
            </View>
          </View>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loading: { paddingVertical: 80, alignItems: 'center' },
  stack: { gap: 20 },
  hero: { alignItems: 'center', gap: 8, paddingTop: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  rewards: { gap: 10 },
});
