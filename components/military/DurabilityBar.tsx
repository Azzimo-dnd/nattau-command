type Props = {
  current: number;
  max: number;
};

export function DurabilityBar({ current, max }: Props) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>Durability</span>
        <span>
          {current}/{max}
        </span>
      </div>

      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${max}, 1fr)` }}>
        {Array.from({ length: max }).map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full ${
              index < current ? "bg-yellow-500" : "bg-slate-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}