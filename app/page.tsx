import { Header } from "../components/Header";
import { ResourceGrid } from "../components/ResourceGrid";
import { SituationPanel } from "../components/SituationPanel";
import { WarRoom } from "../components/WarRoom";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <Header />
        <ResourceGrid />
        <SituationPanel />
        <WarRoom />
      </section>
    </main>
  );
}