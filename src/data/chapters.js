// Chapter registry for "The Legacy of Magnolia Robertson".
// Only Chapter Six is populated for now. To add a family member's submitted
// chapter later, append another entry here and drop its assets into public/ —
// no component changes needed.

export const chapters = [
  {
    id: 6,
    title: 'Chapter Six',
    subtitle: 'The Journey of Lydia Robertson',
    status: 'complete',
    image: './images/chapter-06.jpeg',
    voice: 'af_heart', // mature, warm American-female Kokoro voice
    paragraphs: [
      `Born in 1922, Lydia Mae Robertson was the sixth of nine children born to Magnolia "Big Ma" Robertson. Her story began in the stole cow fields of Iberville Parish—the home of Rosedale, Louisiana. Wrapped in the warmth of a bustling household of siblings, Lydia's early years were shaped by the simple, comforting rhythms of country life. During her childhood, the family relocated to Pine Grove, laying the loving foundation for a country girl who was getting ready to take on the world.`,
      `As time went on, the magnetic pull of the city called to her, sparked by the encouragement of her sister, Beulah. Beulah had already made the move to New Orleans, quickly taking advantage of the endless opportunities and possibilities the city had to offer. Inspired by her sister, Lydia packed up her dreams and journeyed south, trading the peaceful pastures of her youth for the vibrant promise of the Big Easy. It was a classic, beautiful tale of a country girl stepping into the big city to find her way. As she soon discovered, the greatest of those new opportunities was love—for it was along that path she found the absolute love of her life, Mr. Peter Brown.`,
    ],
    sections: [
      {
        heading: 'Her Pride & Her Joy!',
        body: `Lydia and Peter eventually found their forever home just south of the city, putting down deep, lasting roots in Violet, Louisiana. In this close-knit corner of St. Bernard Parish, they built a life anchored in unwavering devotion. To this beautiful union, four daughters were born: Gloria Williams, Deloras Brown, Arelita Griflin, and the dearly remembered Patricia Brown. Lydia poured her whole heart into raising her girls, creating a home overflowing with warmth, laughter, and the comforting traditions of southern family life. Her daughters were, without a doubt, her greatest pride and joy.`,
      },
      {
        heading: 'Her Legacy!',
        body: `Over the decades, the fierce love Lydia cultivated in Violet cascaded down through the branches of her family tree. Today, her legacy continues to blossom beautifully into rich layers of generations, expanding to include a remarkable eight grandchildren, eighteen great-grandchildren, and fourteen great-great-grandchildren.

To truly know Mrs. Lydia was to know a woman with a bright, contagious joy who celebrated the magnificent life she built. She was a lively spirit who loved the thrill of a good road trip and the ringing lights of the casino. Best of all, she was the beloved matriarch who, when the Fourth of July arrived or a New Year rang in, could always be found joyfully shooting Roman candles to light up the night sky. Hers remains a story of boundless devotion—a brilliant, enduring spark in the beautiful history of Big Ma's family.`,
      },
    ],
  },
]

export const getChapter = (id) => chapters.find((c) => c.id === id)

export const fullChapterText = (chapter) =>
  [...chapter.paragraphs, ...chapter.sections.flatMap((s) => [s.heading, s.body])].join('\n\n')
