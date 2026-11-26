// Official sources for each pizza chain. The scraper opens these pages in a real
// (headless) mobile browser, so it sees the same offers the official app/site shows.
// Several URLs per brand: the first one that yields offers wins.
export const BRANDS = [
  {
    id: "dominos",
    name: "Domino's",
    match: "domino",
    website: "https://pizzaonline.dominos.co.in/",
    urls: [
      "https://www.dominos.co.in/offers",
      "https://pizzaonline.dominos.co.in/offers",
      "https://pizzaonline.dominos.co.in/",
    ],
  },
  {
    id: "pizzahut",
    name: "Pizza Hut",
    match: "pizza ?hut",
    website: "https://www.pizzahut.co.in/",
    urls: [
      "https://www.pizzahut.co.in/order/deals/",
      "https://online.pizzahut.co.in/offers",
      "https://www.pizzahut.co.in/",
    ],
  },
  {
    id: "lapinoz",
    name: "La Pino'z",
    match: "pino",
    website: "https://www.lapinozpizza.in/",
    urls: [
      "https://www.lapinozpizza.in/offers",
      "https://www.lapinozpizza.in/",
    ],
  },
  {
    id: "ovenstory",
    name: "Oven Story",
    match: "oven ?story",
    website: "https://www.ovenstory.in/",
    urls: [
      "https://www.ovenstory.in/offers",
      "https://www.ovenstory.in/",
    ],
  },
  {
    id: "mojo",
    name: "Mojo Pizza",
    match: "mojo",
    website: "https://www.mojopizza.in/",
    urls: [
      "https://www.mojopizza.in/offers",
      "https://www.mojopizza.in/",
    ],
  },
];
