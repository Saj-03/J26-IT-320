import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";

// Placeholder shapes shown while saved results load, so the page keeps its layout (no jumping).
const Bone = ({ className }) => <div className={cn("rounded-xl bg-[#9ADBCC]/25 animate-pulse", className)} />;

function Block({ children, className }) {
  return <div className={cn("rounded-4xl border p-5 sm:p-7", ui.card, className)}>{children}</div>;
}

const LAYOUTS = {
  // recommendations: ring + text, five cards
  cards: () => [0, 1, 2].map((i) => (
    <Block key={i} className="flex flex-col sm:flex-row gap-5">
      <Bone className="w-24 h-24 rounded-full shrink-0 self-center sm:self-start" />
      <div className="flex-1 space-y-3">
        <Bone className="h-4 w-1/4" /><Bone className="h-6 w-1/2" /><Bone className="h-4 w-full" /><Bone className="h-4 w-5/6" />
        <div className="flex gap-2 pt-1"><Bone className="h-7 w-20 rounded-full" /><Bone className="h-7 w-24 rounded-full" /><Bone className="h-7 w-16 rounded-full" /></div>
      </div>
    </Block>
  )),
  // gap analysis: readiness ring, then bars
  gap: () => [
    <Block key="a" className="flex flex-col sm:flex-row items-center gap-6">
      <Bone className="w-28 h-28 rounded-full shrink-0" />
      <div className="flex-1 w-full space-y-3"><Bone className="h-5 w-1/3" /><Bone className="h-4 w-full" /><Bone className="h-10 w-40 rounded-full" /></div>
    </Block>,
    <Block key="b" className="space-y-4">
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="space-y-2"><Bone className="h-4 w-1/3" /><Bone className="h-3 w-full rounded-full" /></div>)}
    </Block>,
  ],
  // roadmap: progress card, then timeline steps
  roadmap: () => [
    <Block key="p" className="grid md:grid-cols-2 gap-5"><div className="space-y-3"><Bone className="h-4 w-1/3" /><Bone className="h-8 w-20" /><Bone className="h-2.5 w-full rounded-full" /></div><Bone className="h-28" /></Block>,
    ...[0, 1].map((i) => (
      <div key={i} className="relative pl-14">
        <Bone className="absolute left-0 top-3 w-12 h-12 rounded-full" />
        <Block className="space-y-3"><Bone className="h-6 w-1/3" /><Bone className="h-4 w-3/4" />
          <div className="grid sm:grid-cols-3 gap-3"><Bone className="h-20" /><Bone className="h-20" /><Bone className="h-20" /></div></Block>
      </div>
    )),
  ],
};

export default function CareerSkeleton({ variant = "cards", label }) {
  return (
    <div className={cn(ui.page, "space-y-5")} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-2"><Bone className="h-8 w-2/3 sm:w-1/3" /><Bone className="h-4 w-full sm:w-1/2" /></div>
      {LAYOUTS[variant]()}
    </div>
  );
}
