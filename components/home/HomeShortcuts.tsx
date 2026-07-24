import Link from "next/link";
import { NavIcon } from "@/components/navigation/NavIcon";
import type { NavigationIconName } from "@/components/navigation/navigationTypes";

type ShortcutTone = "gold" | "green" | "blue" | "slate" | "red";

type Shortcut = {
  title: string;
  href: string;
  icon: NavigationIconName;
  subtitle: string;
  status: string;
  tone: ShortcutTone;
};

type HomeShortcutsProps = {
  fateStatus?: string;
  councilStatus?: string;
  chatStatus?: string;
};

function getToneClasses(tone: ShortcutTone) {
  switch (tone) {
    case "green":
      return "border-green-500/25 bg-green-500/5 text-green-300";
    case "blue":
      return "border-blue-500/25 bg-blue-500/5 text-blue-300";
    case "red":
      return "border-red-500/25 bg-red-500/5 text-red-300";
    case "slate":
      return "border-slate-700 bg-slate-900/70 text-slate-300";
    default:
      return "border-yellow-500/25 bg-yellow-500/5 text-yellow-300";
  }
}

export function HomeShortcuts({
  fateStatus = "Open",
  councilStatus = "Open",
  chatStatus = "Open channel",
}: HomeShortcutsProps) {
  const shortcuts: Shortcut[] = [
    {
      title: "Map",
      href: "/map",
      icon: "map",
      subtitle: "Explore the archipelago",
      status: "Open map",
      tone: "slate",
    },
    {
      title: "Council",
      href: "/council",
      icon: "council",
      subtitle: "Review expedition decisions",
      status: councilStatus,
      tone: councilStatus.startsWith("0") ? "slate" : "blue",
    },
    {
      title: "Threads of Fate",
      href: "/fate",
      icon: "fate",
      subtitle: "Reveal or review a blessing",
      status: fateStatus,
      tone: fateStatus.toLowerCase().includes("available") ? "gold" : "green",
    },
    {
      title: "GM Messages",
      href: "/gm-chat",
      icon: "chat",
      subtitle: "Private campaign channel",
      status: chatStatus,
      tone: "green",
    },
  ];

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
            Navigation
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">Shortcuts</h2>
        </div>
        <p className="hidden text-sm text-slate-500 sm:block">
          The four most useful destinations.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-yellow-600/30 hover:bg-slate-900 active:translate-y-0"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/70 text-slate-300 transition group-hover:border-yellow-600/30 group-hover:text-yellow-300">
                <NavIcon name={shortcut.icon} className="h-5 w-5" />
              </span>
              <span
                className={`max-w-[105px] truncate rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${getToneClasses(shortcut.tone)}`}
                title={shortcut.status}
              >
                {shortcut.status}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-100 sm:text-base">
              {shortcut.title}
            </h3>
            <p className="mt-1 hidden text-xs text-slate-500 sm:block">
              {shortcut.subtitle}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
