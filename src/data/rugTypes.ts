export type RugTypeOption = {
  id: string;
  title: string;
  description: string;
  /** Local path under /public — replace with Noel’s final reference photos */
  imageUrl: string;
  /** Starting price shown on type cards (display only). */
  fromPrice: number;
};

export const RUG_TYPES: RugTypeOption[] = [
  {
    id: "Persian",
    title: "Persian / Oriental",
    description: "Hand-knotted wool or silk with detailed patterns.",
    imageUrl: "/rugs/persian.jpg",
    fromPrice: 450,
  },
  {
    id: "Kilim",
    title: "Kilim / Dhurrie",
    description: "Flat-weave, lightweight, often geometric designs.",
    imageUrl: "/rugs/kilim.jpg",
    fromPrice: 320,
  },
  {
    id: "Shaggy",
    title: "Shaggy / High Pile",
    description: "Deep, soft pile that feels plush underfoot.",
    imageUrl: "/rugs/shaggy.jpg",
    fromPrice: 380,
  },
  {
    id: "Machine",
    title: "Machine Made / Synthetic",
    description: "Factory-made rugs in nylon, polypropylene, or blends.",
    imageUrl: "/rugs/machine.jpg",
    fromPrice: 300,
  },
  {
    id: "Wool",
    title: "Wool / Berber",
    description: "Natural wool loop or cut pile, durable and warm.",
    imageUrl: "/rugs/wool.jpg",
    fromPrice: 340,
  },
  {
    id: "Other",
    title: "Other",
    description: "Not sure, or a mix of styles? Pick this and tell us later.",
    imageUrl: "/rugs/other.jpg",
    fromPrice: 250,
  },
];

export function getRugTypeLabel(typeId?: string | null): string {
  if (!typeId) return "—";
  return RUG_TYPES.find((type) => type.id === typeId)?.title || typeId;
}
