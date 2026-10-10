import { cn } from "../../../../shared/lib/cn";

// Live, mirrored camera preview with a simple presence indicator.
// Nothing is recorded: the <video> only displays the local stream.
export default function CameraPreview({ videoRef, status, error, live }) {
  let label = "Starting camera…";
  let tone = "bg-[#D0F2F7] text-[#24566A]";
  if (status === "error") {
    label = error;
    tone = "bg-red-50 text-red-700";
  } else if (status === "ready") {
    if (!live.face) {
      label = "Face not detected - move into the frame";
      tone = "bg-[#9EB2DB] text-[#1E2D57]";
    } else if (!live.facing) {
      label = "Look toward the camera";
      tone = "bg-[#D0F2F7] text-[#24566A]";
    } else {
      label = "Good - in frame and facing the camera";
      tone = "bg-[#C7F2D1] text-[#1F5E3D]";
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden bg-charcoal aspect-video max-w-full">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover -scale-x-100" />
        <span className="absolute top-2 left-2 rounded-full bg-black/50 text-white text-[10px] font-bold px-2 py-0.5">
          Not recorded
        </span>
      </div>
      <p className={cn("text-xs font-semibold rounded-full px-3 py-1.5 w-fit", tone)}>{label}</p>
    </div>
  );
}
