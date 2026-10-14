import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { Target, Users, Bot, Bell, CalendarClock, type LucideIcon } from 'lucide-react';

interface MonitorConfig {
  brand: string | null;
  competitors: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  models: string[];
  alert_metric: string | null;
  alert_threshold: number | null;
  enabled: boolean;
}

type NodeGroup = 'brand' | 'competitor' | 'model' | 'alert';

interface GraphNode {
  id: string;
  label: string;
  group: NodeGroup;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

const GROUP_COLOR: Record<NodeGroup, string> = {
  brand: '#8B79F6',
  competitor: '#D97706',
  model: '#22D3EE',
  alert: '#F87171',
};

const GROUP_NAME: Record<NodeGroup, string> = {
  brand: 'Brand',
  competitor: 'Competitors',
  model: 'AI models',
  alert: 'Alert rule',
};

/* The map — what each node color/shape means, in plain language. */
const LEGEND: { group: NodeGroup; icon: LucideIcon; desc: string }[] = [
  { group: 'brand', icon: Target, desc: 'Your tracked brand — the center of the graph' },
  { group: 'competitor', icon: Users, desc: "Brands you're compared against" },
  { group: 'model', icon: Bot, desc: 'AI models queried on every scan' },
  { group: 'alert', icon: Bell, desc: 'Notifies you when a metric crosses your threshold' },
];

const FREQUENCY_LABEL: Record<MonitorConfig['frequency'], string> = {
  daily: 'Daily scan',
  weekly: 'Weekly scan',
  monthly: 'Monthly scan',
};

/* Turns the saved monitor config into a brand-centered node graph — competitors, models and the alert rule all orbit the brand node. */
function buildGraph(config: MonitorConfig | null): { nodes: GraphNode[]; links: GraphLink[] } {
  const brandId = 'brand';
  const nodes: GraphNode[] = [{ id: brandId, label: config?.brand || 'Your brand', group: 'brand', val: 7 }];
  const links: GraphLink[] = [];

  (config?.competitors ?? []).forEach(c => {
    const id = `c:${c}`;
    nodes.push({ id, label: c, group: 'competitor', val: 3 });
    links.push({ source: brandId, target: id });
  });

  const models = config?.models?.length ? config.models : ['GPT-4o', 'Claude', 'Gemini'];
  models.forEach(m => {
    const id = `m:${m}`;
    nodes.push({ id, label: m, group: 'model', val: 4 });
    links.push({ source: brandId, target: id });
  });

  if (config?.alert_metric) {
    nodes.push({
      id: 'alert',
      label: `${config.alert_metric} < ${config.alert_threshold}`,
      group: 'alert',
      val: 3,
    });
    links.push({ source: brandId, target: 'alert' });
  }

  return { nodes, links };
}

export const AutomationGraph3D = ({ config }: { config: MonitorConfig | null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => buildGraph(config), [config]);

  useEffect(() => {
    if (!fgRef.current || !size.width) return;
    const controls = fgRef.current.controls() as { autoRotate?: boolean; autoRotateSpeed?: number };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    fgRef.current.cameraPosition({ z: 260 }, undefined, 0);
  }, [size.width, size.height]);

  return (
    <div className="flex flex-col gap-3">
      {/* Map — what's what before you look at the graph */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {LEGEND.map(({ group, icon: Icon, desc }) => (
          <div key={group} className="rounded-lg border border-border bg-card/30 p-2.5 flex items-start gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${GROUP_COLOR[group]}22` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: GROUP_COLOR[group] }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{GROUP_NAME[group]}</p>
              <p className="text-[10.5px] text-muted-foreground leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative h-[420px] rounded-xl border border-border bg-linear-to-b from-card/50 via-background to-card/30 overflow-hidden"
      >
        <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-foreground">
          <CalendarClock className="w-3 h-3 text-primary" />
          {FREQUENCY_LABEL[config?.frequency ?? 'weekly']}
        </div>

        {size.width > 0 && (
          <ForceGraph3D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={data}
            backgroundColor="rgba(0,0,0,0)"
            showNavInfo={false}
            enableNodeDrag={false}
            nodeLabel={(n) => (n as unknown as GraphNode).label}
            nodeColor={(n) => GROUP_COLOR[(n as unknown as GraphNode).group]}
            nodeVal={(n) => (n as unknown as GraphNode).val}
            nodeOpacity={0.95}
            nodeResolution={16}
            linkColor={() => 'rgba(139,121,246,0.35)'}
            linkWidth={0.6}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={1.6}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalParticleColor={() => '#c4b5fd'}
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground italic px-1">Drag to rotate · scroll to zoom</p>
    </div>
  );
};

export default AutomationGraph3D;
