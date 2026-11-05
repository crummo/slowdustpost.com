// The one list of projects. v2/index.html builds the work list and footage reels from it, and
// scripts/build-work-pages.mjs gives each project its own page at work/<slug>/.
// Pulled from cameronrumford.com/projects.json. After editing, run:
//   node scripts/build-work-pages.mjs
(() => {
  const PLAY = 'https://player.mediadelivery.net/play/650059/';
  const THUMBS = 'https://cameronrumford.com/thumbs/';

  // List order is page order: the brand and platform work leads, the documentaries follow, and
  // Big Boys closes as the one piece chosen for its own sake.
  // `short` labels the footage slate; `reel` puts the still in the footage rotation, in this order.
  window.SLOWDUST_WORK = [
    { slug: 'game-pass-vats', client: 'Xbox', title: 'Game Pass: V.A.T.S.', kind: 'Commercial', video: `${PLAY}c40a5892-a84b-4c3e-aace-dd8571b1466a`, thumb: `${THUMBS}xboxVATS.jpeg` },
    { slug: 'game-pass-zombie', client: 'Xbox', title: 'Game Pass: Zombie Games', kind: 'Commercial', video: `${PLAY}b41ed155-b38d-4eb9-a2a6-71bbc2033164`, thumb: `${THUMBS}xbox_zombie.jpeg` },
    { slug: 'azure-quantum', client: 'Microsoft', title: 'Azure Quantum + NASA’s JPL', kind: 'Documentary', video: `${PLAY}5812159b-4d7c-4084-bf11-4c16abeb7a5a`, thumb: `${THUMBS}MS_quantum_sml.jpeg` },
    { slug: 'rage-2', client: 'Bethesda', title: 'Rage 2: Insanity Never Ends', kind: 'Gaming', video: `${PLAY}d628212c-296a-4eaf-b06a-0fbb4843b511`, thumb: `${THUMBS}Rage2_Update2Highlights01.jpeg`, short: 'Rage 2', reel: 2 },
    { slug: 'minecraft-heros-path', client: 'Mojang', title: 'Minecraft: The Hero’s Path', kind: 'Gaming', video: `${PLAY}11602b63-f18d-4d76-b6d4-7111f2c9d573`, thumb: `${THUMBS}Minecraft_hero_sml.jpeg`, short: 'Minecraft', reel: 5 },
    { slug: 'flikshop', client: 'AWS', title: 'Flikshop: The Power of a Postcard', kind: 'Documentary', video: `${PLAY}48f1a2c0-a49b-41ea-82b7-74d10b3cb6d2`, thumb: `${THUMBS}AWS_Flikshop_sml.jpeg`, short: 'AWS — Flikshop', reel: 4 },
    { slug: 'farm-city-fence', client: 'AWS', title: 'Data Centered: Farm City Fence', kind: 'Documentary', video: `${PLAY}75b6d162-e72a-4925-bd6b-4c8a185e4ce8`, thumb: `${THUMBS}AWS_FarmCityFence01.jpeg` },
    { slug: 'gates-notes', client: 'Gates Ventures', title: 'The U.S. Military Versus the Mosquito', kind: 'Documentary', video: `${PLAY}82f7ce2b-81b1-40fd-ab2b-6be4d9d3ddb7`, thumb: `${THUMBS}GV_WRAIR_sml.jpeg`, short: 'Gates Ventures', reel: 6 },
    { slug: 'loreal-gloss', client: 'L’Oréal', title: 'Gloss', kind: 'Commercial', video: `${PLAY}7902c344-e04d-497e-a546-d5cc97f40813`, thumb: `${THUMBS}loreal_glossy01.jpeg`, short: 'L’Oréal', reel: 3 },
    { slug: 'big-boys', client: 'Light In The Attic', title: 'Big Boys: Looking Back, It’s Just Reflections', kind: 'Documentary', video: `${PLAY}37cb4570-6a6e-421c-8b4b-af5aa02e0ec0`, thumb: `${THUMBS}BigBoys02_sml.jpg`, short: 'Light In The Attic', reel: 7 },
  ];

  // Full-frame stills pulled from each film, in images/stills/<slug>.jpg, with the point a tall
  // crop should keep (CSS object-position). These back the preview behind the list and the share
  // image for each project page; `thumb` is the small legacy image the slate rotation still uses.
  const FOCUS = {
    'game-pass-vats': '60% 45%',
    'azure-quantum': '50% 45%',
    'rage-2': '50% 45%',
    'minecraft-heros-path': '55% 55%',
    flikshop: '45% 35%',
    'gates-notes': '50% 50%',
    'loreal-gloss': '62% 40%',
    'big-boys': '45% 55%',
  };
  for (const w of window.SLOWDUST_WORK) {
    w.still = `images/stills/${w.slug}.jpg`;
    w.focus = FOCUS[w.slug] || '50% 50%';
  }
})();
