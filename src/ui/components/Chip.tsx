/** Selectable chip (habit anchors): ink when selected, paper with hairline otherwise. 44 pt hit target. */
import { Pressable } from 'react-native';
import { Txt } from '../Txt';
import { color, hit } from '../theme';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 2, bottom: 2 }}
      style={({ pressed }) => ({
        minHeight: 40,
        minWidth: hit,
        paddingHorizontal: 16,
        borderRadius: 20,
        justifyContent: 'center',
        backgroundColor: selected ? color.ink : color.paper,
        borderWidth: selected ? 0 : 1,
        borderColor: color.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Txt variant={selected ? 'bodySemi' : 'bodyMedium'} color={selected ? 'paper' : 'ink'} style={{ fontSize: 14 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
