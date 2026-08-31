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
  /** Mobile used for WhatsApp *support* (not booking). */
  whatsapp: string;
  googleMapsQuery: string;
  /** Official Google Maps place embed (same pins as sparkandclean.co.za) */
  mapsEmbedUrl: string;
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
    whatsapp: "064 289 2384",
    googleMapsQuery: "Spark and Clean, Unit 1 Ohm Street Industrial Park, Kya Sand, Randburg",
    mapsEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4145.431243294435!2d27.9483691!3d-26.025773199999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1e959f5d6b384ac3%3A0xabba2a49b41a73ff!2sSpark%20and%20Clean!5e1!3m2!1sen!2sza!4v1742759721488!5m2!1sen!2sza"
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
    whatsapp: "064 043 6902",
    googleMapsQuery: "Spark and Clean Cape Town, 969 Voortrekker Road, Olympic Park, Maitland",
    mapsEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3828.4205347460447!2d18.535237676225027!3d-33.91369037320963!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1dcc5ba239eda963%3A0xe2d25d1c05188002!2sSpark%20and%20Clean%20Cape%20Town!5e1!3m2!1sen!2sza!4v1742759943953!5m2!1sen!2sza"
  }
];
