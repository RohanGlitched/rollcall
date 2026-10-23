// UDISE+ 2024-25, Ministry of Education, Government of India: Table 2.5, State wise highlights:
// Infrastructure (report pages 35-36). Counts of schools.
export const UDISE_SOURCE = {
  label: "UDISE+ 2024-25, Ministry of Education, Table 2.5 (pp. 35–36)",
  url: "https://educationforallinindia.com/wp-content/uploads/2025/10/State-wise-share-of-schools-by-facilities-UDISEPlus-2024-25-Ministry-of-Education.pdf",
};

/** India totals: what is counted as present, and what is counted as working. */
export const UDISE_INDIA = {
  schools: 1471473,
  facilities: [
    { name: "Electricity", has: 1377945, works: 1352061 },
    { name: "Drinking water", has: 1461032, works: 1456968 },
    { name: "Girls’ toilet", has: 1421205, works: 1372881 },
    { name: "Computers", has: 951868, works: 852684 },
    { name: "Internet", has: 933987, works: null as number | null },
  ],
};

/** [state, total schools, schools with an internet facility] */
export const UDISE_STATES: [string, number, number][] = [
  ["Andaman and Nicobar Islands", 408, 264],
  ["Andhra Pradesh", 61317, 60731],
  ["Arunachal Pradesh", 3229, 1086],
  ["Assam", 55283, 48201],
  ["Bihar", 94339, 80035],
  ["Chandigarh", 207, 207],
  ["Chhattisgarh", 56802, 36511],
  ["Dadra and Nagar Haveli and Daman and Diu", 433, 431],
  ["Delhi", 5556, 5556],
  ["Goa", 1479, 1379],
  ["Gujarat", 53355, 51514],
  ["Haryana", 23494, 18539],
  ["Himachal Pradesh", 17330, 11011],
  ["Jammu and Kashmir", 24192, 11883],
  ["Jharkhand", 44376, 25715],
  ["Karnataka", 74859, 37921],
  ["Kerala", 15757, 14442],
  ["Ladakh", 961, 488],
  ["Lakshadweep", 36, 36],
  ["Madhya Pradesh", 122120, 55865],
  ["Maharashtra", 108250, 78084],
  ["Manipur", 4666, 1709],
  ["Meghalaya", 14587, 3858],
  ["Mizoram", 3974, 2580],
  ["Nagaland", 2750, 1622],
  ["Odisha", 61565, 51588],
  ["Puducherry", 763, 760],
  ["Punjab", 27281, 24249],
  ["Rajasthan", 106302, 74358],
  ["Sikkim", 1245, 643],
  ["Tamil Nadu", 57935, 49211],
  ["Telangana", 43154, 27309],
  ["Tripura", 4943, 2059],
  ["Uttar Pradesh", 262358, 120465],
  ["Uttarakhand", 22452, 16236],
  ["West Bengal", 93715, 17441],
];
