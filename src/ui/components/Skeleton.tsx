/**
 * Live skeleton over the camera preview (Skia). Joints are green when the pose is valid, peach when not;
 * the calibrated floor line is dashed. Landmarks are normalized to the camera image; the preview is
 * drawn with resizeMode "cover", so points are mapped with the same cover crop.
 */
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { LM, type Landmark, type PoseFrame } from '../../core/types';
import { color } from '../theme';

interface Props {
  frame: PoseFrame | null;
  valid: boolean;
  /** calibrated floor line, normalized image y; null before calibration */
  floorY: number | null;
  width: number;
  height: number;
  /** flip x (front camera preview is mirrored) */
  mirror?: boolean;
  /** show joints at all (hidden during rest) */
  visible?: boolean;
}

const MIN_VIS = 0.4;

const LIMBS: [number, number][] = [
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_SHOULDER, LM.L_HIP],
  [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_SHOULDER, LM.L_ELBOW],
  [LM.L_ELBOW, LM.L_WRIST],
  [LM.R_SHOULDER, LM.R_ELBOW],
  [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_HIP, LM.L_KNEE],
  [LM.L_KNEE, LM.L_ANKLE],
  [LM.R_HIP, LM.R_KNEE],
  [LM.R_KNEE, LM.R_ANKLE],
  [LM.L_ANKLE, LM.L_HEEL],
  [LM.L_HEEL, LM.L_FOOT_INDEX],
  [LM.R_ANKLE, LM.R_HEEL],
  [LM.R_HEEL, LM.R_FOOT_INDEX],
];

const JOINTS = [
  LM.L_SHOULDER,
  LM.R_SHOULDER,
  LM.L_ELBOW,
  LM.R_ELBOW,
  LM.L_WRIST,
  LM.R_WRIST,
  LM.L_HIP,
  LM.R_HIP,
  LM.L_KNEE,
  LM.R_KNEE,
  LM.L_ANKLE,
  LM.R_ANKLE,
  LM.L_FOOT_INDEX,
  LM.R_FOOT_INDEX,
];

/** Maps normalized image coords into a view of size w×h under "cover" scaling. */
export function coverMapper(aspect: number, w: number, h: number, mirror: boolean) {
  const viewAspect = w / h;
  // image size in view pixels after cover scaling
  const imgW = aspect > viewAspect ? h * aspect : w;
  const imgH = aspect > viewAspect ? h : w / aspect;
  const ox = (w - imgW) / 2;
  const oy = (h - imgH) / 2;
  return (lm: { x: number; y: number }) => ({
    x: ox + (mirror ? 1 - lm.x : lm.x) * imgW,
    y: oy + lm.y * imgH,
  });
}

function SkeletonImpl({ frame, valid, floorY, width, height, mirror = false, visible = true }: Props) {
  const pose = frame?.landmarks ?? null;
  const aspect = frame?.aspect ?? width / Math.max(1, height);
  const map = useMemo(() => coverMapper(aspect, width, height, mirror), [aspect, width, height, mirror]);

  const { bones, joints, head } = useMemo(() => {
    const path = Skia.Path.Make();
    const pts: { x: number; y: number }[] = [];
    let headPt: { x: number; y: number; r: number } | null = null;
    if (pose && visible) {
      const ok = (lm: Landmark | undefined): lm is Landmark => !!lm && lm.visibility >= MIN_VIS;
      for (const [a, b] of LIMBS) {
        const la = pose[a];
        const lb = pose[b];
        if (!ok(la) || !ok(lb)) continue;
        const pa = map(la);
        const pb = map(lb);
        path.moveTo(pa.x, pa.y);
        path.lineTo(pb.x, pb.y);
      }
      for (const j of JOINTS) {
        const lm = pose[j];
        if (ok(lm)) pts.push(map(lm));
      }
      const nose = pose[LM.NOSE];
      const ls = pose[LM.L_SHOULDER];
      const rs = pose[LM.R_SHOULDER];
      if (ok(nose)) {
        const p = map(nose);
        const shoulder = ok(ls) ? map(ls) : ok(rs) ? map(rs) : null;
        const r = shoulder ? Math.max(14, Math.min(32, Math.hypot(shoulder.x - p.x, shoulder.y - p.y) * 0.45)) : 22;
        headPt = { ...p, r };
      }
    }
    return { bones: path, joints: pts, head: headPt };
  }, [pose, map, visible]);

  const floorPx = floorY != null ? map({ x: 0, y: floorY }).y : null;
  const jointColor = valid ? color.jointOk : color.jointBad;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {floorPx != null && (
        <Line p1={vec(24, floorPx)} p2={vec(width - 24, floorPx)} color={color.floorLine} strokeWidth={1.5} opacity={0.7} style="stroke">
          <DashPathEffect intervals={[6, 6]} />
        </Line>
      )}
      <Group opacity={visible ? 1 : 0}>
        <Path path={bones} color={color.cameraInk} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" />
        {head && <Circle cx={head.x} cy={head.y} r={head.r} color={color.cameraInk} style="stroke" strokeWidth={5} />}
        {joints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={7} color={jointColor} />
        ))}
      </Group>
    </Canvas>
  );
}

/** memoized: the session screen re-renders on phase / live changes, not per frame */
export const Skeleton = memo(SkeletonImpl);
