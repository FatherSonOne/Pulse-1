// Frame registry. The wizard shell consumes FRAMES to render Step 1's
// frame-select grid and to look up the active frame's Step2Form,
// suggestTasks, and derivers.
//
// Each frame is typed as DecisionFrame<TStep2> with its own Step2 schema,
// so we cast at registration to the default-generic shape.

import type { DecisionFrame } from '../types';
import { hireFrame } from './hireFrame';
import { pickToolFrame } from './pickToolFrame';
import { buildFrame } from './buildFrame';
import { allocateFrame } from './allocateFrame';
import { strategyFrame } from './strategyFrame';
import { conflictFrame } from './conflictFrame';

export const FRAMES: DecisionFrame[] = [
  hireFrame as unknown as DecisionFrame,
  pickToolFrame as unknown as DecisionFrame,
  buildFrame as unknown as DecisionFrame,
  allocateFrame as unknown as DecisionFrame,
  strategyFrame as unknown as DecisionFrame,
  conflictFrame as unknown as DecisionFrame,
];

export function getFrame(id: string): DecisionFrame | undefined {
  return FRAMES.find((f) => f.id === id);
}
