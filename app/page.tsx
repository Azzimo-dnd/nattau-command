import { Header } from "@/components/Header";
import { HomeWelcome } from "@/components/auth/HomeWelcome";
import { ResourceGrid } from "@/components/ResourceGrid";
import { SituationPanel } from "@/components/SituationPanel";
import { QuickAccess } from "@/components/QuickAccess";
import { MilitaryOverview } from "@/components/MilitaryOverview";
import { ChroniclePreview } from "@/components/ChroniclePreview";
import { WarRoom } from "@/components/WarRoom";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <Header />

        <HomeWelcome />

        <ResourceGrid />

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <SituationPanel />
          <QuickAccess />
        </section>

        <MilitaryOverview />

        <ChroniclePreview />

        <div id="war-room">
          <WarRoom />
        </div>
      </section>
    </main>
  );
}