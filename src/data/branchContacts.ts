export type BranchPhone = {
  label: string;
  number: string;
};

export type BranchContact = {
  name: string;
  location: string;
  address: string;
  addressLines?: string[];
  email: string;
  phones: BranchPhone[];
  googleMapsQuery: string;
};

export const branchContacts: BranchContact[] = [
  {
    name: "Gauteng Branch",
    location: "Randburg, Gauteng",
    address: "Unit 1, Ohm Street Industrial Park, Ohm Street, Kya Sand, Randburg, 2163",
    addressLines: [
      "Unit 1, Ohm Street Industrial Park",
      "Ohm Street, Kya Sand",
      "Randburg",
      "2163"
    ],
    email: "info@sparkandclean.co.za",
    phones: [
      { label: "Phone 1", number: "064 289 2384" },
      { label: "Phone 2", number: "068 729 2869" }
    ],
    googleMapsQuery: "Unit 1, Ohm Street Industrial Park, Ohm Street, Kya Sand, Randburg, 2163"
  },
  {
    name: "Cape Town Branch",
    location: "Maitland, Cape Town",
    address: "969 Voortrekker Road, Unit 5, Olympic Park, Maitland, Cape Town",
    addressLines: [
      "969 Voortrekker Road",
      "Unit 5, Olympic Park, Maitland",
      "Cape Town"
    ],
    email: "capetown@sparkandclean.co.za",
    phones: [
      { label: "Phone 1", number: "064 043 6902" },
      { label: "Phone 2", number: "063 853 4499" }
    ],
    googleMapsQuery: "969 Voortrekker Road, Unit 5, Olympic Park, Maitland, Cape Town"
  }
];
