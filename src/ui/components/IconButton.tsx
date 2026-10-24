/** Round 44 pt glass button (close / pause / mute over camera, boss and rank-up grounds). */
import { Pressable } from 'react-native';
import { color, hit, type ColorToken } from '../theme';
import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  label: string;
  onPress(): void;
  tone?: 'camera' | 'forest' | 'paper';
  size?: number;
}

const BG = { camera: color.cameraGlass, forest: color.forestGlassStrong, paper: color.paper };
const FG: Record<NonNullable<Props['tone']>, ColorToken> = { camera: 'cameraInk', forest: 'forestInk', paper: 'ink' };

export function IconButton({ icon, label, onPress, tone = 'camera', size = hit }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: BG[tone],
        borderWidth: tone === 'paper' ? 1 : 0,
        borderColor: color.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={icon === 'speaker' || icon === 'speakerOff' ? 20 : 18} strokeWidth={icon === 'close' ? 2.4 : 2} color={FG[tone]} />
    </Pressable>
  );
}
