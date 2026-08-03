import type { ReactNode } from "react";

type TarokkaArtworkProps = {
  artKey: string;
  sigil: string;
  className?: string;
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 300"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M25 246C56 220 184 220 215 246" stroke="currentColor" strokeOpacity=".26" />
      <path d="M39 263C76 244 164 244 201 263" stroke="currentColor" strokeOpacity=".14" />
      <circle cx="120" cy="132" r="91" stroke="currentColor" strokeOpacity=".14" />
      <circle cx="120" cy="132" r="76" stroke="currentColor" strokeOpacity=".1" strokeDasharray="4 8" />
      {children}
    </svg>
  );
}

function Lantern() {
  return (
    <Frame>
      <path d="M94 96h52l-7 91H101l-7-91Z" stroke="currentColor" strokeWidth="4" />
      <path d="M103 96c0-24 34-24 34 0" stroke="currentColor" strokeWidth="4" />
      <path d="M110 122c8-15 13-15 21 0 10 19-2 40-11 40s-20-21-10-40Z" fill="currentColor" fillOpacity=".72" />
      <path d="M82 194h76M104 207h32" stroke="currentColor" strokeWidth="3" />
      <path d="m69 70 8 8m94-8-8 8M120 43v17" stroke="currentColor" strokeWidth="3" />
    </Frame>
  );
}

function Raven() {
  return (
    <Frame>
      <path d="M57 177c24-6 31-31 55-40-18-12-15-32 3-42 22-12 43 6 45 30 20 8 31 22 34 44-19-11-34-10-49 0-18 12-45 25-88 8Z" fill="currentColor" fillOpacity=".76" />
      <path d="M117 96c8-17 34-28 56-18-11 4-18 10-23 19" stroke="currentColor" strokeWidth="4" />
      <circle cx="143" cy="108" r="3.5" fill="#0b090c" />
      <path d="M66 191c24 7 77 4 111-5M91 199l-8 27m31-27-4 31" stroke="currentColor" strokeWidth="4" />
    </Frame>
  );
}

function Crown() {
  return (
    <Frame>
      <path d="m64 101 28 30 27-54 29 54 29-30-10 82H75l-11-82Z" stroke="currentColor" strokeWidth="5" />
      <path d="M78 158h87M87 184l67-59" stroke="currentColor" strokeWidth="4" />
      <circle cx="92" cy="132" r="6" fill="currentColor" />
      <circle cx="147" cy="132" r="6" fill="currentColor" />
      <path d="M107 195h26" stroke="currentColor" strokeWidth="4" />
    </Frame>
  );
}

function GallowsTree() {
  return (
    <Frame>
      <path d="M120 211c-6-55 8-79 0-129M119 123 82 87M120 111l35-38M116 145 66 127M122 152l57-37" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M73 87c-18-4-27 5-34 18M154 73c20-11 35-7 48 8M65 126c-24-10-38-3-48 8M179 115c24-5 37 4 44 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M154 72v59c0 18 26 18 26 0v-9" stroke="currentColor" strokeWidth="3" />
      <path d="M88 215c19-13 45-13 65 0" stroke="currentColor" strokeWidth="4" />
    </Frame>
  );
}

function Stag() {
  return (
    <Frame>
      <path d="M90 156c0-40 60-40 60 0 0 31-17 58-30 58s-30-27-30-58Z" stroke="currentColor" strokeWidth="4" />
      <path d="M98 139c-27-15-40-41-35-75m37 57C79 98 76 80 80 58m62 81c27-15 40-41 35-75m-37 57c21-23 24-41 20-63" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M66 86 46 72m34 23-4-25m98 16 20-14m-34 23 4-25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="107" cy="158" r="3" fill="currentColor" />
      <circle cx="133" cy="158" r="3" fill="currentColor" />
      <path d="M114 177h12" stroke="currentColor" strokeWidth="3" />
    </Frame>
  );
}

function Hound() {
  return (
    <Frame>
      <path d="m75 112 24-33 20 25 22-25 24 33-8 75-37 31-38-31-7-75Z" stroke="currentColor" strokeWidth="5" />
      <path d="m91 139 18 10m40-10-18 10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="104" cy="151" r="4" fill="currentColor" />
      <circle cx="136" cy="151" r="4" fill="currentColor" />
      <path d="m108 176 12 9 12-9M104 197c10 7 22 7 32 0" stroke="currentColor" strokeWidth="4" />
      <path d="M57 205c21-8 39-5 52 6m74-6c-21-8-39-5-52 6" stroke="currentColor" strokeOpacity=".45" strokeWidth="3" />
    </Frame>
  );
}

function Moon() {
  return (
    <Frame>
      <path d="M151 66c-37 9-55 52-35 84 15 24 44 34 69 24-14 27-48 44-81 32-42-15-62-63-43-103 16-34 55-51 90-37Z" fill="currentColor" fillOpacity=".72" />
      <path d="M36 188c31-18 55-16 82 4 31-26 58-29 88-8M45 206c26-13 50-10 73 7 27-19 52-21 77-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="169" cy="90" r="3" fill="currentColor" />
      <circle cx="190" cy="114" r="2" fill="currentColor" />
      <circle cx="153" cy="121" r="2.5" fill="currentColor" />
    </Frame>
  );
}

function Rose() {
  return (
    <Frame>
      <path d="M120 194c-40-9-53-50-25-70-7-31 31-49 51-26 33-1 43 38 19 54 2 25-18 46-45 42Z" stroke="currentColor" strokeWidth="4" />
      <path d="M120 192c-13-25-10-47 9-64-19 5-31 18-34 38m36-36c15 10 24 25 25 45" stroke="currentColor" strokeWidth="4" />
      <path d="M120 194v43M120 215l-23-13m23 23 25-14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M95 201c-19-15-34-15-46-2m96 12c19-15 34-15 46-2" stroke="currentColor" strokeOpacity=".5" strokeWidth="3" />
    </Frame>
  );
}

function Bell() {
  return (
    <Frame>
      <path d="M76 184h88l-13-24v-41c0-39-62-39-62 0v41l-13 24Z" stroke="currentColor" strokeWidth="5" />
      <path d="M101 188c3 21 35 21 38 0" stroke="currentColor" strokeWidth="5" />
      <path d="M120 77V53M91 67 77 48m72 19 14-19M67 103l-23-8m129 8 23-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M61 215h118" stroke="currentColor" strokeOpacity=".45" strokeWidth="4" />
    </Frame>
  );
}

function Throne() {
  return (
    <Frame>
      <path d="M82 83h76v87H82V83Z" stroke="currentColor" strokeWidth="5" />
      <path d="M70 151h100v57H70v-57Z" stroke="currentColor" strokeWidth="5" />
      <path d="M81 207v30m78-30v30M97 83V62m46 21V62" stroke="currentColor" strokeWidth="6" />
      <path d="M90 132h60M104 169h32" stroke="currentColor" strokeOpacity=".45" strokeWidth="3" />
      <path d="m96 104 24 22 24-22" stroke="currentColor" strokeWidth="4" />
    </Frame>
  );
}

function Blade() {
  return (
    <Frame>
      <path d="m120 48 17 111-17 28-17-28 17-111Z" stroke="currentColor" strokeWidth="5" />
      <path d="M78 176h84M103 188h34M120 188v48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="m61 112 20 15m98-15-20 15M67 159l22 4m84-4-22 4" stroke="currentColor" strokeOpacity=".5" strokeWidth="3" />
    </Frame>
  );
}

function Mists() {
  return (
    <Frame>
      <path d="M33 102c27-20 55-19 83 2 28-22 58-22 91 1M22 137c31-20 62-18 94 5 31-24 65-24 102 0M33 177c29-20 56-19 83 3 31-24 61-23 91 1M50 213c22-14 44-13 66 3 24-17 48-17 72 0" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M91 137c8-13 19-20 29-20s22 7 30 20c-8 13-19 20-30 20s-21-7-29-20Z" stroke="currentColor" strokeWidth="3" />
      <circle cx="120" cy="137" r="8" fill="currentColor" />
    </Frame>
  );
}

export function TarokkaArtwork({ artKey, sigil, className }: TarokkaArtworkProps) {
  const artwork = (() => {
    switch (artKey) {
      case "lantern": return <Lantern />;
      case "raven": return <Raven />;
      case "crown": return <Crown />;
      case "gallows-tree": return <GallowsTree />;
      case "stag": return <Stag />;
      case "hound": return <Hound />;
      case "moon": return <Moon />;
      case "rose": return <Rose />;
      case "bell": return <Bell />;
      case "throne": return <Throne />;
      case "blade": return <Blade />;
      case "mists": return <Mists />;
      default:
        return (
          <div className="flex h-full w-full items-center justify-center font-serif text-7xl">
            {sigil}
          </div>
        );
    }
  })();

  return <div className={className}>{artwork}</div>;
}
