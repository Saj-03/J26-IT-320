// Compatibility wrapper for places that need the optional browser-only pose
// view. PoseTracker owns camera permission, cleanup, and the no-upload behavior.
import { PoseTracker } from './PoseTracker';

export default function PoseCoach({ exerciseName = '' }) {
  return <PoseTracker exerciseName={exerciseName} />;
}
