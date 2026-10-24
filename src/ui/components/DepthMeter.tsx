/**
 * Depth meter on the hold sheet: live depth as a moss bar, best-ever depth as an ember tick.
 * Values are already normalized 0..1 by the caller (see depthFraction in src/ui/session/depth.ts).
 */
import { StyleSheet, View } from 'react-native';
import { Txt } from '../Txt';
import { color } from '../theme';
import { ProgressBar } from './ProgressBar';

interface Props {
  /** 0..1 live depth toward the next rank's target */
  value: number;
  /** 0..1 position of the best-depth tick; null when there is no best yet */
  best: number | null;
  /** e.g. "Curb → Grass" */
  rangeLabel: string;
  /** helper line, e.g. "Deeper than your best (orange mark) right now" */
  caption: string;
}

export function DepthMeter({ value, best, rangeLabel, caption }: Props) {
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Depth, ${rangeLabel}. ${caption}`}>
      <View style={styles.head}>
        <Txt variant="smallSemi">Depth</Txt>
        <Txt variant="small" color="muted">
          {rangeLabel}
        </Txt>
      </View>
      <View>
        <ProgressBar value={value} height={12} />
        {best != null && <View style={[styles.tick, { left: `${Math.max(0, Math.min(1, best)) * 100}%` }]} />}
      </View>
      <Txt variant="caption" color="muted">
        {caption}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { position: 'absolute', top: -4, width: 2, height: 20, marginLeft: -1, backgroundColor: color.ember },
});
