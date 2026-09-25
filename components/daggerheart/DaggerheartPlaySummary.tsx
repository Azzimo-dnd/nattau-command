"use client";

type TrackKey = "hope" | "hp" | "stress" | "armor";

type Track = {
  key: TrackKey;
  label: string;
  current: number;
  max: number;
  currentLabel: string;
};

type DefenseStat = {
  label: string;
  value: number;
};

export function DaggerheartPlaySummary({
  tracks,
  defense,
  classStatus,
  disabled = false,
  onTrackChange,
}: {
  tracks: Track[];
  defense: DefenseStat[];
  classStatus?: Array<{ label: string; value: string }>;
  disabled?: boolean;
  onTrackChange: (key: TrackKey, nextValue: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#4c2d39] bg-[#120c10]/92 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#a9687b]">
            Play state
          </p>
          <h3 className="mt-1 font-serif text-xl font-black text-[#ead7dc]">
            Current resources & defense
          </h3>
        </div>
        <span className="rounded-full border border-[#4b313a] bg-black/20 px-3 py-1 text-xs font-semibold text-[#9e858e]">
          Session controls
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tracks.map((track) => {
          const percent =
            track.max > 0
              ? Math.max(0, Math.min(100, (track.current / track.max) * 100))
              : 0;
          const decreaseLabel =
            track.key === "hope"
              ? "Spend 1 Hope"
              : track.key === "armor"
                ? "Clear 1 Armor slot"
                : `Clear 1 ${track.label}`;
          const increaseLabel =
            track.key === "hope"
              ? "Gain 1 Hope"
              : track.key === "armor"
                ? "Mark 1 Armor slot"
                : `Mark 1 ${track.label}`;

          return (
            <div
              key={track.key}
              className="rounded-xl border border-[#3d2830] bg-black/20 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#bfa7af]">{track.label}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-[#f0dce2]">
                    {track.current}
                    <span className="text-sm font-semibold text-[#826d74]">
                      /{track.max}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#806b73]">
                    {track.currentLabel}
                  </p>
                </div>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#24171d]">
                <div
                  className="h-full rounded-full bg-[#8d465b] transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={disabled || track.current <= 0}
                  onClick={() =>
                    onTrackChange(track.key, Math.max(0, track.current - 1))
                  }
                  className="min-h-11 rounded-lg border border-[#48313a] bg-black/20 text-sm font-black text-[#baa1aa] transition hover:border-[#6f4352] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={decreaseLabel}
                  title={decreaseLabel}
                >
                  −
                </button>
                <button
                  type="button"
                  disabled={disabled || track.current >= track.max}
                  onClick={() =>
                    onTrackChange(
                      track.key,
                      Math.min(track.max, track.current + 1)
                    )
                  }
                  className="min-h-11 rounded-lg border border-[#744153] bg-[#3c1724] text-sm font-black text-[#e2c4cd] transition hover:border-[#9a5369] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={increaseLabel}
                  title={increaseLabel}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {defense.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[#36242b] bg-black/15 px-3 py-2.5"
          >
            <p className="text-xs font-semibold text-[#927b83]">{item.label}</p>
            <p className="mt-1 text-xl font-black tabular-nums text-[#dfcbd1]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {classStatus && classStatus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {classStatus.map((item) => (
            <span
              key={`${item.label}:${item.value}`}
              className="rounded-full border border-[#563543] bg-[#211219] px-3 py-1.5 text-xs text-[#c4a8b1]"
            >
              <strong className="font-black text-[#e4cbd2]">{item.label}:</strong>{" "}
              {item.value}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
