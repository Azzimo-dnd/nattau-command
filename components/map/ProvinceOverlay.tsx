import type { FactionId, Province } from "./provinceData";
import { provinceControl, provinces } from "./provinceData";

type Props = {
  selectedProvinceId: string;
  selectedFactionId: FactionId | null;
  onSelectProvince: (provinceId: string) => void;
};

function getFactionHighlightClass(factionId: FactionId) {
  switch (factionId) {
    case "kainites":
      return "fill-yellow-500/20 stroke-yellow-300/80 hover:fill-yellow-500/30";
    case "empire":
      return "fill-orange-500/20 stroke-orange-300/80 hover:fill-orange-500/30";
    case "mazamundi-cult":
      return "fill-purple-500/20 stroke-purple-300/80 hover:fill-purple-500/30";
    case "wild-lizardfolk":
      return "fill-red-500/20 stroke-red-300/80 hover:fill-red-500/30";
    case "merrydock":
      return "fill-green-500/20 stroke-green-300/80 hover:fill-green-500/30";
    default:
      return "fill-slate-500/15 stroke-slate-300/60 hover:fill-slate-500/25";
  }
}

function getProvinceStyle(
  province: Province,
  isSelected: boolean,
  selectedFactionId: FactionId | null
) {
  const controlledBy = provinceControl[province.number] ?? ["unknown"];

  const isFactionHighlighted =
    selectedFactionId !== null && controlledBy.includes(selectedFactionId);

  if (isSelected && selectedFactionId === null) {
    return "fill-yellow-500/25 stroke-yellow-300";
  }

  if (isFactionHighlighted && selectedFactionId !== null) {
    return getFactionHighlightClass(selectedFactionId);
  }

  if (selectedFactionId !== null) {
    return "fill-transparent stroke-slate-300/10 hover:fill-slate-500/10 hover:stroke-slate-300/40";
  }

  switch (province.status) {
    case "controlled":
      return "fill-transparent stroke-green-300/25 hover:fill-green-500/10 hover:stroke-green-300/70";
    case "hostile":
      return "fill-transparent stroke-red-300/25 hover:fill-red-500/10 hover:stroke-red-300/70";
    case "contested":
      return "fill-transparent stroke-orange-300/25 hover:fill-orange-500/10 hover:stroke-orange-300/70";
    case "neutral":
      return "fill-transparent stroke-slate-300/25 hover:fill-slate-500/10 hover:stroke-slate-300/70";
    default:
      return "fill-transparent stroke-blue-300/25 hover:fill-blue-500/10 hover:stroke-blue-300/70";
  }
}

export function ProvinceOverlay({
  selectedProvinceId,
  selectedFactionId,
  onSelectProvince,
}: Props) {
  const selectedProvince = provinces.find(
    (province) => province.id === selectedProvinceId
  );

  const unselectedProvinces = provinces.filter(
    (province) => province.id !== selectedProvinceId
  );

  const orderedProvinces = selectedProvince
    ? [...unselectedProvinces, selectedProvince]
    : provinces;

  return (
    <svg
      className="absolute inset-0 z-10 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {orderedProvinces.map((province) => {
        const isSelected = province.id === selectedProvinceId;

        return (
          <polygon
            key={province.id}
            points={province.points}
            onClick={() => onSelectProvince(province.id)}
            className={`cursor-pointer stroke-[0.22] transition ${getProvinceStyle(
              province,
              isSelected,
              selectedFactionId
            )}`}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}