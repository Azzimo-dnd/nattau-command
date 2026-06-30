export type MapLocation = {
  id: string;
  name: string;
  type: "capital" | "fortress" | "port" | "city";
  owner: string;
  description: string;
  x: number;
  y: number;
};

export const mapLocations: MapLocation[] = [
  {
    id: "uc",
    name: "UĆ",
    type: "capital",
    owner: "Kainites",
    description:
      "Main headquarters of the Kainite Expedition and the center of their growing influence on Hinewai.",
    x: 44.8,
    y: 43.6,
  },
  {
    id: "guardian",
    name: "House of the Guardian",
    type: "fortress",
    owner: "Kainites",
    description:
      "An ancient fortress securing one of the key provinces controlled by the expedition.",
    x: 33.4,
    y: 34.2,
  },
  {
    id: "merrydock",
    name: "Merrydock",
    type: "port",
    owner: "Merrydock",
    description:
      "A northern port settlement and trade partner known for its halflings and lucky cabbage.",
    x: 37.0,
    y: 23.2,
  },
  {
    id: "whangaroa",
    name: "Whangaroa",
    type: "city",
    owner: "Jin Yan Chao",
    description:
      "Imperial city of the Jin Yan Chao and a major political power on Hinewai.",
    x: 33.0,
    y: 45.8,
  },
  {
    id: "pipdock",
    name: "Pipdock",
    type: "port",
    owner: "Kainites",
    description:
      "A new port founded by Pippo, intended to strengthen Kainite access to the sea.",
    x: 52.0,
    y: 50.0,
  },
];