/** Design tokens from the Grasswork GUI review. Stone grounds, moss = verified/progress, ember = streaks/rewards only. */
export const color = {
  stone: '#F0F1EC',
  paper: '#FAFAF7',
  mist: '#DFE6DF',
  line: '#D3D9D2',
  moss: '#3F7556',
  mossDeep: '#2C5A40',
  mossSoft: '#E1ECE3',
  leafLight: '#8DBF95',
  leaf: '#6FA37F',
  ember: '#E8914A',
  emberText: '#B5642A',
  emberSoft: '#F6E6D6',
  ink: '#1D2621',
  muted: '#5F6B63',
  // dusk palette (evening, streak at risk)
  dusk: '#1F2526',
  duskCard: '#2A3132',
  duskLine: '#4A5354',
  duskInk: '#E9ECE8',
  duskMuted: '#A9B2AC',
  // camera screens
  camera: '#172019',
  cameraFloor: '#1C2620',
  cameraInk: '#F0F2EE',
  jointOk: '#7FD19B',
  jointBad: '#F4B888',
  // boss / rank-up
  forest: '#23392D',
  // wilted Gus
  wiltStem: '#7C8A5E',
  wiltLeaf: '#B5A66B',
  wiltLeafDark: '#A39459',
  dormant: '#9A9A8A',
} as const;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
} as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Motion: slow and calm. */
export const motion = { calm: 400, slow: 700, breathInMs: 4000, breathOutMs: 6000 } as const;
