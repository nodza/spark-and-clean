/**
 * Collection area: the City of Cape Town, and the whole Gauteng province.
 * Towns such as Pretoria, Centurion, Benoni, and Somerset West stay their own
 * city. A short place index is only for search bias and map fallbacks.
 * A geocoded pin inside the area is accepted even when the town is not listed.
 */

export type CollectionRegion = "cape-town" | "gauteng";

export interface AreaBias {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** City of Cape Town, padded. The north-east notch leaves out Stellenbosch. */
export const CAPE_TOWN_BOUNDS: AreaBias = {
  south: -34.45,
  north: -33.45,
  west: 18.22,
  east: 18.95,
};

/** Gauteng, padded to the provincial border. */
export const GAUTENG_BOUNDS: AreaBias = {
  south: -26.98,
  north: -25.05,
  west: 26.9,
  east: 29.1,
};

const SOUTH_AFRICA = {
  south: -35.2,
  north: -21.7,
  west: 16.2,
  east: 33.1,
};

type Place = { region: CollectionRegion; lat: number; lng: number };

const PLACES: Record<string, Place> = {
  "cape town": { region: "cape-town", lat: -33.9249, lng: 18.4241 },
  bellville: { region: "cape-town", lat: -33.9006, lng: 18.6296 },
  durbanville: { region: "cape-town", lat: -33.8333, lng: 18.65 },
  brackenfell: { region: "cape-town", lat: -33.874, lng: 18.698 },
  kraaifontein: { region: "cape-town", lat: -33.847, lng: 18.717 },
  "kuils river": { region: "cape-town", lat: -34.033, lng: 18.667 },
  parow: { region: "cape-town", lat: -33.9, lng: 18.585 },
  goodwood: { region: "cape-town", lat: -33.908, lng: 18.552 },
  milnerton: { region: "cape-town", lat: -33.8667, lng: 18.5 },
  "table view": { region: "cape-town", lat: -33.822, lng: 18.494 },
  bloubergstrand: { region: "cape-town", lat: -33.797, lng: 18.462 },
  parklands: { region: "cape-town", lat: -33.808, lng: 18.5 },
  atlantis: { region: "cape-town", lat: -33.5667, lng: 18.4833 },
  melkbosstrand: { region: "cape-town", lat: -33.7167, lng: 18.45 },
  "somerset west": { region: "cape-town", lat: -34.078, lng: 18.843 },
  strand: { region: "cape-town", lat: -34.117, lng: 18.833 },
  "gordons bay": { region: "cape-town", lat: -34.15, lng: 18.867 },
  "fish hoek": { region: "cape-town", lat: -34.137, lng: 18.425 },
  "simons town": { region: "cape-town", lat: -34.193, lng: 18.433 },
  "hout bay": { region: "cape-town", lat: -34.045, lng: 18.35 },
  "mitchells plain": { region: "cape-town", lat: -34.051, lng: 18.618 },
  khayelitsha: { region: "cape-town", lat: -34.04, lng: 18.677 },
  delft: { region: "cape-town", lat: -33.966, lng: 18.633 },
  "blue downs": { region: "cape-town", lat: -33.983, lng: 18.65 },
  "eerste river": { region: "cape-town", lat: -33.983, lng: 18.717 },
  mfuleni: { region: "cape-town", lat: -34.0, lng: 18.683 },
  belhar: { region: "cape-town", lat: -33.945, lng: 18.633 },
  muizenberg: { region: "cape-town", lat: -34.105, lng: 18.466 },
  noordhoek: { region: "cape-town", lat: -34.1, lng: 18.367 },
  kommetjie: { region: "cape-town", lat: -34.133, lng: 18.333 },
  wynberg: { region: "cape-town", lat: -34.003, lng: 18.47 },
  plumstead: { region: "cape-town", lat: -34.02, lng: 18.47 },
  retreat: { region: "cape-town", lat: -34.058, lng: 18.478 },
  "grassy park": { region: "cape-town", lat: -34.042, lng: 18.5 },
  athlone: { region: "cape-town", lat: -33.967, lng: 18.508 },
  gugulethu: { region: "cape-town", lat: -33.983, lng: 18.567 },
  langa: { region: "cape-town", lat: -33.945, lng: 18.53 },
  nyanga: { region: "cape-town", lat: -34.0, lng: 18.583 },
  philippi: { region: "cape-town", lat: -34.017, lng: 18.55 },
  pinelands: { region: "cape-town", lat: -33.933, lng: 18.517 },
  "century city": { region: "cape-town", lat: -33.893, lng: 18.511 },
  edgemead: { region: "cape-town", lat: -33.867, lng: 18.55 },
  bothasig: { region: "cape-town", lat: -33.858, lng: 18.542 },
  tokai: { region: "cape-town", lat: -34.067, lng: 18.433 },
  "sea point": { region: "cape-town", lat: -33.9167, lng: 18.3833 },
  claremont: { region: "cape-town", lat: -33.98, lng: 18.465 },
  rondebosch: { region: "cape-town", lat: -33.9667, lng: 18.4833 },
  constantia: { region: "cape-town", lat: -34.0333, lng: 18.4333 },
  woodstock: { region: "cape-town", lat: -33.9333, lng: 18.45 },
  observatory: { region: "cape-town", lat: -33.9333, lng: 18.4667 },
  "camps bay": { region: "cape-town", lat: -33.95, lng: 18.3833 },
  "green point": { region: "cape-town", lat: -33.9067, lng: 18.4167 },
  gardens: { region: "cape-town", lat: -33.9333, lng: 18.4167 },
  "city bowl": { region: "cape-town", lat: -33.9249, lng: 18.4241 },
  johannesburg: { region: "gauteng", lat: -26.2041, lng: 28.0473 },
  pretoria: { region: "gauteng", lat: -25.7479, lng: 28.2293 },
  centurion: { region: "gauteng", lat: -25.8603, lng: 28.1894 },
  midrand: { region: "gauteng", lat: -25.989, lng: 28.128 },
  sandton: { region: "gauteng", lat: -26.1076, lng: 28.0567 },
  rosebank: { region: "gauteng", lat: -26.146, lng: 28.0436 },
  fourways: { region: "gauteng", lat: -26.0207, lng: 28.0074 },
  randburg: { region: "gauteng", lat: -26.0936, lng: 27.975 },
  bryanston: { region: "gauteng", lat: -26.05, lng: 28.0167 },
  soweto: { region: "gauteng", lat: -26.2485, lng: 27.854 },
  roodepoort: { region: "gauteng", lat: -26.1625, lng: 27.8725 },
  alexandra: { region: "gauteng", lat: -26.1036, lng: 28.1003 },
  edenvale: { region: "gauteng", lat: -26.1408, lng: 28.1525 },
  "kempton park": { region: "gauteng", lat: -26.1011, lng: 28.2306 },
  tembisa: { region: "gauteng", lat: -25.9964, lng: 28.2268 },
  benoni: { region: "gauteng", lat: -26.1885, lng: 28.3207 },
  boksburg: { region: "gauteng", lat: -26.2126, lng: 28.2624 },
  germiston: { region: "gauteng", lat: -26.2256, lng: 28.1708 },
  alberton: { region: "gauteng", lat: -26.2672, lng: 28.1222 },
  springs: { region: "gauteng", lat: -26.2549, lng: 28.4428 },
  brakpan: { region: "gauteng", lat: -26.2364, lng: 28.3696 },
  nigel: { region: "gauteng", lat: -26.4314, lng: 28.4775 },
  heidelberg: { region: "gauteng", lat: -26.5042, lng: 28.3597 },
  vereeniging: { region: "gauteng", lat: -26.6731, lng: 27.9261 },
  vanderbijlpark: { region: "gauteng", lat: -26.6992, lng: 27.8376 },
  meyrton: { region: "gauteng", lat: -26.5586, lng: 28.0164 },
  krugersdorp: { region: "gauteng", lat: -26.0858, lng: 27.7752 },
  randfontein: { region: "gauteng", lat: -26.1844, lng: 27.7019 },
  westonaria: { region: "gauteng", lat: -26.3194, lng: 27.6486 },
  carletonville: { region: "gauteng", lat: -26.3609, lng: 27.3977 },
  bronkhorstspruit: { region: "gauteng", lat: -25.8106, lng: 28.7422 },
  hammanskraal: { region: "gauteng", lat: -25.4047, lng: 28.2825 },
  soshanguve: { region: "gauteng", lat: -25.5226, lng: 28.1008 },
  mabopane: { region: "gauteng", lat: -25.4975, lng: 28.0994 },
  mamelodi: { region: "gauteng", lat: -25.7172, lng: 28.3772 },
  atteridgeville: { region: "gauteng", lat: -25.7731, lng: 28.0814 },
  diepsloot: { region: "gauteng", lat: -25.9331, lng: 28.0125 },
  lanseria: { region: "gauteng", lat: -25.9375, lng: 27.9261 },
  "orange farm": { region: "gauteng", lat: -26.4667, lng: 27.8667 },
  lenasia: { region: "gauteng", lat: -26.3167, lng: 27.8167 },
  hatfield: { region: "gauteng", lat: -25.7486, lng: 28.2381 },
  gauteng: { region: "gauteng", lat: -25.8603, lng: 28.1894 },
};

const ALIASES: Record<string, string> = {
  cpt: "cape town",
  "city of cape town": "cape town",
  jhb: "johannesburg",
  joburg: "johannesburg",
  jozi: "johannesburg",
  "city of johannesburg": "johannesburg",
  "city of johannesburg metropolitan municipality": "johannesburg",
  tshwane: "pretoria",
  "city of tshwane": "pretoria",
  "city of tshwane metropolitan municipality": "pretoria",
  ekurhuleni: "germiston",
  "city of ekurhuleni": "germiston",
  "city of ekurhuleni metropolitan municipality": "germiston",
  sedibeng: "vereeniging",
  emfuleni: "vereeniging",
  "mogale city": "krugersdorp",
  "west rand": "krugersdorp",
  merafong: "carletonville",
  midvaal: "meyerton",
  lesedi: "heidelberg",
  "rand west": "randfontein",
  "rand west city": "randfontein",
  blouberg: "bloubergstrand",
  "tableview": "table view",
  kuilsriver: "kuils river",
  "mitchells plain": "mitchells plain",
  "simons town": "simons town",
  "gordons bay": "gordons bay",
};

const OUTSIDE_PLACES = new Set([
  "durban",
  "umhlanga",
  "ballito",
  "pietermaritzburg",
  "pinetown",
  "gqeberha",
  "port elizabeth",
  "east london",
  "bloemfontein",
  "polokwane",
  "mbombela",
  "nelspruit",
  "kimberley",
  "george",
  "knysna",
  "mossel bay",
  "stellenbosch",
  "paarl",
  "franschhoek",
  "wellington",
  "worcester",
  "hermanus",
  "rustenburg",
  "mahikeng",
  "mafikeng",
  "potchefstroom",
  "klerksdorp",
  "welkom",
  "witbank",
  "emalahleni",
  "secunda",
  "upington",
  "oudtshoorn",
  "makhanda",
  "grahamstown",
  "mthatha",
  "richards bay",
  "newcastle",
  "ladysmith",
  "beaufort west",
  "springbok",
  "komani",
  "queenstown",
]);

const OUTSIDE_PROVINCES = new Set([
  "kwazulu-natal",
  "kwazulu natal",
  "kzn",
  "eastern cape",
  "free state",
  "limpopo",
  "mpumalanga",
  "northern cape",
  "north west",
  "northwest",
]);

const PLACE_NAMES = [...Object.keys(PLACES), ...Object.keys(ALIASES)].sort(
  (a, b) => b.length - a.length
);

export function normalizePlaceKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalPlace(value: string): string | null {
  const key = normalizePlaceKey(value);
  if (!key) return null;
  if (key in PLACES) return key;
  const alias = ALIASES[key];
  if (alias && alias in PLACES) return alias;
  return null;
}

function lookupPlace(value: string): Place | null {
  const key = canonicalPlace(value);
  return key ? PLACES[key] : null;
}

export function placeRegion(value: string): CollectionRegion | null {
  return lookupPlace(value)?.region ?? null;
}

/** [lat, lng] for a known town, or null when the name is not in the index. */
export function centroidForPlace(value: string): [number, number] | null {
  const place = lookupPlace(value);
  return place ? [place.lat, place.lng] : null;
}

export function coordinateInCapeTown(lat: number, lng: number): boolean {
  if (!inside(lat, lng, CAPE_TOWN_BOUNDS)) return false;
  if (lng > 18.8 && lat > -34) return false;
  return true;
}

export function coordinateInGauteng(lat: number, lng: number): boolean {
  return inside(lat, lng, GAUTENG_BOUNDS);
}

export function coordinateInCollectionArea(lat: number, lng: number): boolean {
  return coordinateInGauteng(lat, lng) || coordinateInCapeTown(lat, lng);
}

function inside(
  lat: number,
  lng: number,
  box: { south: number; north: number; west: number; east: number }
): boolean {
  return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
}

function inSouthAfrica(lat: number, lng: number): boolean {
  return inside(lat, lng, SOUTH_AFRICA);
}

export function isOutsideCollectionPlace(value: string): boolean {
  const key = normalizePlaceKey(value);
  if (!key) return false;
  if (OUTSIDE_PLACES.has(key) || OUTSIDE_PROVINCES.has(key)) return true;
  for (const blocked of OUTSIDE_PLACES) {
    if (key.startsWith(`${blocked} `)) return true;
  }
  return false;
}

/** Which part of the collection area a typed city or query is asking for. */
export function regionMentionedIn(text: string): CollectionRegion | null {
  const key = normalizePlaceKey(text);
  if (!key) return null;
  const padded = ` ${key} `;
  for (const name of PLACE_NAMES) {
    if (!padded.includes(` ${name} `)) continue;
    const region = placeRegion(name);
    if (region) return region;
  }
  return null;
}

export function biasForText(text: string): AreaBias | null {
  const region = regionMentionedIn(text);
  if (region === "gauteng") return GAUTENG_BOUNDS;
  if (region === "cape-town") return CAPE_TOWN_BOUNDS;
  return null;
}

/**
 * Drop a suggestion whose label names a province or city outside the area.
 * A street with no town is kept, and checked again once it has coordinates.
 */
export function textMayBeOutsideCollectionArea(text: string): boolean {
  const key = normalizePlaceKey(text);
  if (!key) return false;
  if (regionMentionedIn(key)) return false;
  const padded = ` ${key} `;
  for (const province of OUTSIDE_PROVINCES) {
    if (padded.includes(` ${province} `)) return true;
  }
  for (const place of OUTSIDE_PLACES) {
    if (padded.includes(` ${place} `)) return true;
  }
  return false;
}

export function isCapeTownMunicipality(value: string): boolean {
  const key = normalizePlaceKey(value);
  return key === "cape town" || key === "city of cape town";
}

/**
 * Gauteng and the City of Cape Town are in the collection area.
 * Another province, or a Western Cape town such as Stellenbosch, is outside.
 */
export function collectionAreaOf(input: {
  region?: string;
  municipality?: string;
  city?: string;
  suburb?: string;
  latitude?: number;
  longitude?: number;
}): CollectionRegion | "outside" | "unknown" {
  const region = normalizePlaceKey(input.region ?? "");
  const municipality = normalizePlaceKey(input.municipality ?? "");
  const city = normalizePlaceKey(input.city ?? "");
  const suburb = normalizePlaceKey(input.suburb ?? "");
  const lat = input.latitude;
  const lng = input.longitude;
  const hasPoint =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const cityIsCapeTown =
    isCapeTownMunicipality(city) || isCapeTownMunicipality(municipality);
  const namedCapeTown =
    cityIsCapeTown ||
    placeRegion(city) === "cape-town" ||
    placeRegion(suburb) === "cape-town";
  const namedGauteng =
    region === "gauteng" ||
    placeRegion(city) === "gauteng" ||
    placeRegion(municipality) === "gauteng" ||
    (placeRegion(suburb) === "gauteng" && !cityIsCapeTown);

  if (
    !namedCapeTown &&
    !namedGauteng &&
    (isOutsideCollectionPlace(city) ||
      isOutsideCollectionPlace(suburb) ||
      isOutsideCollectionPlace(municipality) ||
      OUTSIDE_PROVINCES.has(region))
  ) {
    return "outside";
  }

  if (cityIsCapeTown) return "cape-town";
  if (namedGauteng) return "gauteng";
  if (namedCapeTown) return "cape-town";

  if (region === "western cape") {
    if (hasPoint && coordinateInCapeTown(lat, lng)) return "cape-town";
    if (municipality && !isCapeTownMunicipality(municipality)) return "outside";
    return "outside";
  }

  if (region && region !== "gauteng") return "outside";

  if (hasPoint && coordinateInGauteng(lat, lng)) return "gauteng";
  if (hasPoint && coordinateInCapeTown(lat, lng)) return "cape-town";
  if (hasPoint && inSouthAfrica(lat, lng)) return "outside";
  return "unknown";
}
