/** Design tokens from the Grasswork GUI review. Stone grounds, moss = verified/progress, ember = streaks/rewards only. */
export const color = {
  stone: '#F0F1EC',
  paper: '#FAFAF7',
  mist: '#DFE6DF',
  line: '#D3D9D2',
  lineSoft: '#ECEFEA',
  pending: '#C5CEC6',
  ghost: '#9FB3A4',
  moss: '#3F7556',
  mossDeep: '#2C5A40',
  mossSoft: '#E1ECE3',
  leafLight: '#8DBF95',
  leaf: '#6FA37F',
  ember: '#E8914A',
  emberText: '#B5642A',
  emberSoft: '#F6E6D6',
  emberInk: '#8A4B17',
  ink: '#1D2621',
  muted: '#5F6B63',
  // dusk palette (evening, streak at risk)
  dusk: '#1F2526',
  duskCard: '#2A3132',
  duskLine: '#4A5354',
  duskInk: '#E9ECE8',
  duskMuted: '#A9B2AC',
  duskGround: '#2E3637',
  duskEmber: '#3A2A1E',
  frost: '#9FC6E0',
  // camera screens
  camera: '#172019',
  cameraFloor: '#1C2620',
  cameraInk: '#F0F2EE',
  cameraMuted: '#C3CBC5',
  cameraGlass: 'rgba(240,242,238,0.14)',
  cameraTrack: 'rgba(240,242,238,0.16)',
  cameraScrim: 'rgba(23,32,25,0.86)',
  floorLine: '#9FD1AE',
  jointOk: '#7FD19B',
  jointOkSoft: 'rgba(127,209,155,0.18)',
  jointOkText: '#9FE0B3',
  jointBad: '#F4B888',
  jointBadSoft: 'rgba(244,184,136,0.18)',
  // boss / rank-up
  forest: '#23392D',
  forestInk: '#EEF3EF',
  forestMuted: '#A9C4B2',
  forestText: '#C3D4C8',
  forestGlass: 'rgba(238,243,239,0.08)',
  forestGlassStrong: 'rgba(238,243,239,0.12)',
  forestTrack: 'rgba(238,243,239,0.14)',
  forestShadow: '#1A2C22',
  boulder: '#7E8B83',
  boulderLight: '#97A39C',
  rankEyebrow: '#CFE3D4',
  rankGlass: 'rgba(250,250,247,0.1)',
  rankGlassStrong: 'rgba(250,250,247,0.16)',
  rankGhost: 'rgba(250,250,247,0.4)',
  emberDeep: '#3A2410',
  // wilted Gus
  wiltStem: '#7C8A5E',
  wiltLeaf: '#B5A66B',
  wiltLeafDark: '#A39459',
  dormant: '#9A9A8A',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof color;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
} as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum touch target (iOS HIG / Material). */
export const hit = 44;

/** Dynamic Type: big display numbers stop growing early so layouts hold. */
export const fontScale = { display: 1.2, body: 1.6 } as const;

/** Motion: slow and calm. */
export const motion = { calm: 400, slow: 700, breathInMs: 4000, breathOutMs: 6000 } as const;
