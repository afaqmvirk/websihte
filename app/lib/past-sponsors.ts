type PastSponsor = {
  name: string;
  src: string;
  width: number;
  height: number;
  displayWidth: number;
  monochromeSrc?: string;
  href?: string;
  preserveDetail?: boolean;
  lightArtwork?: boolean;
  monochromeOnly?: boolean;
};

export const PAST_SPONSORS: PastSponsor[] = [
  {
    name: "Jeff Nguyen (BobaTalks)",
    src: "/sponsors/past/jeff-nguyen-bobatalks.png",
    width: 76,
    height: 76,
    displayWidth: 60,
    preserveDetail: true,
  },
  {
    name: "Code-Talent",
    src: "/sponsors/past/code-talent.svg",
    width: 73,
    height: 61,
    displayWidth: 80,
  },
  {
    name: "AI Valley",
    src: "/sponsors/past/ai-valley.webp",
    width: 256,
    height: 72,
    displayWidth: 174,
    lightArtwork: true,
  },
  {
    name: "Hack Western",
    // Transparent horse from https://archive.hackwestern.com/.
    src: "/sponsors/past/hackwestern.svg",
    width: 125,
    height: 183,
    displayWidth: 49,
    preserveDetail: true,
    href: "https://www.hackwestern.com/",
  },
  {
    name: "Strik Baldinelli Moniz",
    // Dark-background logo from https://www.sbmltd.ca/.
    src: "/sponsors/past/strik-baldinelli-moniz.svg",
    width: 360,
    height: 151,
    displayWidth: 186,
    href: "https://www.sbmltd.ca/",
    preserveDetail: true,
  },
  {
    name: "TextQL",
    src: "/sponsors/past/textql.png",
    width: 154,
    height: 81,
    displayWidth: 170,
    href: "https://textql.com/",
  },
  {
    name: "Jerry Zhou",
    src: "/sponsors/past/jerry-zhou.png",
    width: 74,
    height: 74,
    displayWidth: 60,
    preserveDetail: true,
  },
  {
    name: "Builders Club",
    src: "/sponsors/past/builders-club.png",
    width: 77,
    height: 77,
    displayWidth: 64,
    href: "https://buildersclub.ca/",
    lightArtwork: true,
  },
  {
    name: "New",
    src: "/sponsors/past/new.png",
    width: 76,
    height: 76,
    displayWidth: 62,
    href: "https://newsystems.ca/",
    preserveDetail: true,
  },
  {
    name: "Chatforce",
    src: "/sponsors/past/chatforce.png",
    width: 69,
    height: 69,
    displayWidth: 64,
  },
  {
    name: "Framer",
    src: "/sponsors/past/framer.png",
    width: 106,
    height: 107,
    displayWidth: 54,
    href: "https://www.framer.com/",
    monochromeOnly: true,
  },
  {
    name: "Crackd",
    src: "/sponsors/past/crackd.png",
    width: 215,
    height: 80,
    displayWidth: 156,
    href: "https://crackd.it/",
  },
  {
    name: "Akatos",
    src: "/sponsors/past/akatos.png",
    width: 142,
    height: 26,
    displayWidth: 148,
    href: "https://x.com/akatoshouse",
    monochromeOnly: true,
  },
  {
    name: "Backboard.io",
    // Official variants: https://news.backboard.io/assets/categories/4178/.
    src: "/sponsors/past/backboard-color.svg",
    width: 306,
    height: 45,
    displayWidth: 190,
    monochromeSrc: "/sponsors/past/backboard-monochrome.svg",
    href: "https://news.backboard.io/",
    lightArtwork: true,
  },
  {
    name: "Singapore Management University Institute of Innovation & Entrepreneurship",
    src: "/sponsors/past/smu.svg",
    width: 131,
    height: 70,
    displayWidth: 164,
    href: "https://iie.smu.edu.sg/",
  },
  {
    name: "Amplitude",
    src: "/sponsors/amplitude.svg",
    width: 3840,
    height: 800,
    displayWidth: 182,
    href: "https://amplitude.com/",
    monochromeOnly: true,
  },
  {
    name: "Shopify",
    // Official variants: https://www.shopify.com/brand-assets.
    src: "/sponsors/past/shopify-color.svg",
    width: 304,
    height: 87,
    displayWidth: 174,
    monochromeSrc: "/sponsors/past/shopify-monochrome.svg",
    href: "https://www.shopify.com/",
    lightArtwork: true,
  },
  {
    name: "MathemaTech",
    src: "/sponsors/mathematech-logo.png",
    width: 2000,
    height: 372,
    displayWidth: 190,
    href: "https://mthm.tech/",
    monochromeOnly: true,
  },
  {
    name: "Lovable",
    // Official dark-background lockup: https://lovable.dev/brand.
    src: "/sponsors/lovable-white.svg",
    width: 950,
    height: 173,
    displayWidth: 190,
    href: "https://lovable.dev/",
    lightArtwork: true,
  },
  {
    name: "Anakin",
    src: "/sponsors/anakin.png",
    width: 954,
    height: 312,
    displayWidth: 156,
    href: "https://anakin.io/",
  },
  {
    name: "Carleton Computer Science Society",
    src: "/sponsors/ccss.png",
    width: 1000,
    height: 204,
    displayWidth: 196,
    href: "https://ccss.carleton.ca/",
  },
  {
    name: "Invest Ottawa",
    src: "/sponsors/invest-ottawa.svg",
    width: 98,
    height: 35,
    displayWidth: 166,
    href: "https://www.investottawa.ca/",
  },
  {
    name: "CU There",
    src: "/sponsors/cu-there.png",
    width: 1010,
    height: 496,
    displayWidth: 124,
    href: "https://cuthere.app/",
  },
  {
    name: "Kariaa",
    // Official transparent wordmark: https://www.kariaa.com/press.
    src: "/sponsors/kariaa.svg",
    width: 884,
    height: 338,
    displayWidth: 174,
    href: "https://www.kariaa.com/",
  },
];
