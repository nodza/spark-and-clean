export type RugTypeOption = {
  id: string;
  title: string;
  description: string;
  /** Local path under /public — replace with Noel’s final reference photos */
  imageUrl: string;
};

export const RUG_TYPES: RugTypeOption[] = [
  {
    id: "Persian",
    title: "Persian / Oriental",
    description: "Hand-knotted wool or silk with detailed patterns.",
    imageUrl: "/rugs/persian.jpg",
  },
  {
    id: "Kilim",
    title: "Kilim / Dhurrie",
    description: "Flat-weave, lightweight, often geometric designs.",
    imageUrl: "/rugs/kilim.jpg",
  },
  {
    id: "Shaggy",
    title: "Shaggy / High Pile",
    description: "Deep, soft pile that feels plush underfoot.",
    imageUrl: "/rugs/shaggy.jpg",
  },
  {
    id: "Machine",
    title: "Machine Made / Synthetic",
    description: "Factory-made rugs in nylon, polypropylene, or blends.",
    imageUrl: "/rugs/machine.jpg",
  },
  {
    id: "Wool",
    title: "Wool / Berber",
    description: "Natural wool loop or cut pile, durable and warm.",
    imageUrl: "/rugs/wool.jpg",
  },
  {
    id: "Other",
    title: "Other",
    description: "Not sure, or a mix of styles? Pick this and tell us later.",
    imageUrl: "/rugs/other.jpg",
  },
];
