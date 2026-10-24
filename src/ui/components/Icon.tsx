/** Line icons from the GUI review (24×24 viewBox, round caps). Decorative: hidden from screen readers. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color as palette, type ColorToken } from '../theme';

export type IconName =
  | 'flame'
  | 'play'
  | 'close'
  | 'pause'
  | 'check'
  | 'minus'
  | 'speaker'
  | 'speakerOff'
  | 'chevron'
  | 'sprout'
  | 'path'
  | 'me'
  | 'freeze'
  | 'plus';

interface Props {
  name: IconName;
  size?: number;
  color?: ColorToken;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = 'ink', strokeWidth = 2 }: Props) {
  const c = palette[color];
  const stroke = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} importantForAccessibility="no-hide-descendants">
      {name === 'flame' && (
        <Path {...stroke} d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 .5-2.5 0-5.5.5-8z" />
      )}
      {name === 'play' && <Path d="M7 4.5v15l12-7.5z" fill={c} />}
      {name === 'close' && <Path {...stroke} d="M6 6l12 12M18 6L6 18" />}
      {name === 'pause' && (
        <>
          <Rect x={6} y={5} width={4} height={14} rx={1} fill={c} />
          <Rect x={14} y={5} width={4} height={14} rx={1} fill={c} />
        </>
      )}
      {name === 'check' && <Path {...stroke} d="M5 12l5 5 9-10" />}
      {name === 'minus' && <Path {...stroke} d="M8 12h8" />}
      {name === 'plus' && <Path {...stroke} d="M12 6v12M6 12h12" />}
      {name === 'speaker' && (
        <>
          <Path {...stroke} d="M4 9v6h4l5 4V5L8 9z" />
          <Path {...stroke} d="M16.5 8.5a5 5 0 0 1 0 7" />
        </>
      )}
      {name === 'speakerOff' && (
        <>
          <Path {...stroke} d="M4 9v6h4l5 4V5L8 9z" />
          <Path {...stroke} d="M16 9l5 6M21 9l-5 6" />
        </>
      )}
      {name === 'chevron' && <Path {...stroke} d="M9 6l6 6-6 6" />}
      {name === 'sprout' && (
        <>
          <Path {...stroke} d="M12 21V11" />
          <Path {...stroke} d="M12 13c-4 0-6-3-6-7 4 0 6 3 6 7z" />
          <Path {...stroke} d="M12 11c0-4 2-7 6-7 0 4-2 7-6 7z" />
        </>
      )}
      {name === 'path' && <Path {...stroke} d="M4 20h4v-6h4V8h4V4h4" />}
      {name === 'me' && (
        <>
          <Circle {...stroke} cx={12} cy={8} r={4} />
          <Path {...stroke} d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </>
      )}
      {name === 'freeze' && <Path {...stroke} d="M12 2v20M4 6l16 12M20 6L4 18" />}
    </Svg>
  );
}
