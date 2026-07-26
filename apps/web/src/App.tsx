import { Activity, CalendarCheck, Map, RadioTower, ShieldAlert } from 'lucide-react';

const modules = [
  {
    title: 'Booking Control',
    description: 'Monitor campsite slot availability and prevent overbooking with Redis locks.',
    icon: CalendarCheck,
  },
  {
    title: 'Trail Operations',
    description: 'Configure checkpoints, porter assignments, routes, and trekker sync status.',
    icon: Map,
  },
  {
    title: 'Emergency Broadcasts',
    description: 'Send low-latency WebSocket alerts for weather risks, trail closures, and incidents.',
    icon: RadioTower,
  },
  {
    title: 'Safety Intelligence',
    description: 'Review rule-based weather scores and AI-generated survival advisories.',
    icon: ShieldAlert,
  },
];

export function App() {
  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">CTMS Host Dashboard</p>
          <h1>Camping and trekking operations control center</h1>
        </div>
        <div className="status">
          <Activity size={18} />
          <span>System scaffold ready</span>
        </div>
      </section>

      <section className="metrics" aria-label="System modules">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <article className="module-card" key={module.title}>
              <Icon aria-hidden="true" size={24} />
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
