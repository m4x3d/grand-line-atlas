import c0 from './cast0.js'
import c1 from './cast1.js'
import c2 from './cast2.js'
import c3 from './cast3.js'
import isl from './islands.js'

// One char per arc, used in the cast files. '7ab+' = arcs 7, a and b, and the + marks b as the arc they joined the crew.
// 'g(banaro)' = seen in arc g, but on Banaro Island instead of the island the arc plays on.
// Capitals are the past (before Luffy sets sail), in chronological order. 'l!' = dies in arc l.
// 'o*' = lives on the island of arc o and goes back there once the story leaves them (from arc o on). 'v-' = leaves right after arc v.
export const CODES = 'ABPCDEFQGHRIJKSLMNO0123456789abcdefghijklmxnopqrstuvw'   // x = the two-year timeskip

const rows = s => s.trim().split('\n').map(l => l.split('|'))

const hex = h => parseInt(h, 16)
export const LAP = 2400   // world width, the map wraps around the globe
export const ISLANDS = rows(isl).map(([id, name, x, y, r, a, b, c, d, dens, special, note], i) =>
  ({ id, name, x: +x, y: +y, r: +r, cols: [a, b, c, d].map(hex), dens: +dens, special: +special, note, seed: i * 7.31 }))
// The Tarai Current links the three government strongholds: [x, y, radius] of the circle through all of them
export const TARAI = (([a, b, c]) => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)), q = p => p.x * p.x + p.y * p.y
  const x = (q(a) * (b.y - c.y) + q(b) * (c.y - a.y) + q(c) * (a.y - b.y)) / d
  const y = (q(a) * (c.x - b.x) + q(b) * (a.x - c.x) + q(c) * (b.x - a.x)) / d
  return [x, y, Math.hypot(a.x - x, a.y - y)]
})(['enies', 'impel', 'marineford'].map(id => ISLANDS.find(s => s.id === id)))
const island = id => ISLANDS.find(x => x.id === id) ?? (() => { throw new Error('unknown island ' + id) })()

// name|saga|island|chapters (flashbacks: when, and the chapter that first tells it)|crew present ('*' all who joined, else initials)|summary|optional view ('crew' = frame the whole scattered crew)
export const ARCS = rows(`
Void Century|Past|mary|900 to 800 years ago, told in ch. 1114||A great kingdom falls, Joy Boy leaves a promise unkept and twenty kings found the World Government.
Noland and Calgara|Past|jaya|400 years ago, told in ch. 287||The explorer Noland befriends the Shandian warrior Calgara, before half of Jaya is blown into the sky.
Noland's Trial|Past|lvneel|400 years ago, told in ch. 228||Back in Lvneel the king finds no city of gold. Noland is executed as a liar and lives on as a fairy tale.
The Rumbar Pirates|Past|reverse|52 years ago, told in ch. 487||Brook's crew leaves the young whale Laboon at Twin Cape with a promise to come back.
God Valley|Past|godvalley|38 years ago, told in ch. 957||Roger and Garp join forces against the Rocks Pirates. The island disappears from every map.
Laugh Tale|Past|laugh|25 years ago, told in ch. 967||The Roger Pirates reach the final island, learn the true history and laugh.
Roger's Execution|Past|logue|24 years ago, told in ch. 1||The King of the Pirates dies smiling in Loguetown and the great pirate era begins.
Ace's Birth|Past|baterilla|22 years ago, told in ch. 550||Portgas D. Rouge hides Roger's child for twenty months and dies giving birth. Garp takes the boy to Dawn Island.
The Ohara Incident|Past|ohara|22 years ago, told in ch. 391||A Buster Call burns the island of scholars and eight-year-old Robin escapes alone.
Oden's Last Stand|Past|wano|20 years ago, told in ch. 960||Kozuki Oden falls to Kaido and Orochi. Toki sends his retainers twenty years into the future.
The White City|Past|flevance|16 years ago, told in ch. 762||Amber Lead poisons Flevance and its neighbours wipe the city out. Ten-year-old Law escapes hidden among the dead.
The Sun Pirates|Past|fishman|15 to 10 years ago, told in ch. 621||Fisher Tiger frees the slaves of Mary Geoise, and Queen Otohime gives her life for peace with humans.
Law and Corazon|Past|minion|13 years ago, told in ch. 761||Rosinante steals the Ope Ope no Mi for a dying boy from Flevance and pays for it with his life.
Shanks in Foosha|Past|dawn|12 years ago, told in ch. 1||Shanks loses an arm saving seven-year-old Luffy and leaves him his straw hat.
Kuma and Bonney|Past|sorbet|12 years ago, told in ch. 1095||In the Sorbet Kingdom Kuma raises Ginny's daughter Bonney and searches for a cure for her illness.
Brothers of the Gray Terminal|Past|dawn|12 years ago, told in ch. 582||Luffy, Ace and Sabo swear brotherhood. Sabo's boat is shot down by a Celestial Dragon.
Bell-mere|Past|conomi|10 years ago, told in ch. 77||Arlong takes Cocoyasi Village. Bell-mere dies for her daughters and Nami is forced to draw his maps.
Tom's Workers|Past|water7|10 years ago, told in ch. 353||Spandam frames the shipwright who built the Oro Jackson and the sea train. Franky is run over trying to stop it.
Hiriluk's Cherry Blossoms|Past|drum|7 years ago, told in ch. 141||A quack doctor gives a lonely reindeer a name and a flag, and makes it snow pink.
Romance Dawn|East Blue|shells|1-7|*|Luffy sets out from Foosha Village, frees Koby from Alvida and recruits Zoro in Shells Town.
Orange Town|East Blue|orange|8-21|*|Nami teams up with the crew to bring down Buggy the Clown.
Syrup Village|East Blue|syrup|22-41|*|Usopp helps stop Captain Kuro's plot against Kaya and the crew receives the Going Merry.
Baratie|East Blue|baratie|42-68|*|At the sea restaurant Sanji fights off Don Krieg and Zoro challenges Mihawk.
Arlong Park|East Blue|conomi|69-95|*|The crew frees Nami's village from Arlong's fish-man pirates.
Loguetown|East Blue|logue|96-100|*|Last stop before the Grand Line. Smoker gives chase and Dragon steps in.
Reverse Mountain|Alabasta|reverse|101-105|*|Up and over the Red Line into the Grand Line, where the whale Laboon waits at Twin Cape.
Whisky Peak|Alabasta|whisky|106-114|*|A town of bounty hunters turns out to be a Baroque Works front and Vivi's identity is revealed.
Little Garden|Alabasta|garden|115-129|*|On a prehistoric island two giants have duelled for a century until Mr. 3 interferes.
Drum Island|Alabasta|drum|130-154|*|Searching for a doctor for Nami, the crew meets Chopper and ousts Wapol.
Alabasta|Alabasta|alabasta|155-217|*|Crocodile's civil war scheme is undone and Robin comes aboard.
Jaya|Sky Island|jaya|218-236|*|In Mock Town dreams are laughed at, but Cricket points the way to the sky.
Skypiea|Sky Island|skypiea|237-302|*|10,000 metres up Luffy rings the golden bell and ends Enel's reign.
Long Ring Long Land|Water 7|longring|303-321|*|The Davy Back Fight against Foxy, then Admiral Aokiji appears.
Water 7|Water 7|water7|322-374|*|The Merry cannot be repaired, Usopp leaves and CP9 takes Robin.
Enies Lobby|Water 7|enies|375-430|*|The crew declares war on the World Government to bring Robin back.
Post-Enies Lobby|Water 7|water7|431-441|*|Franky joins, the Thousand Sunny is launched and Garp pays a visit.
Thriller Bark|Thriller Bark|thriller|442-489|*|On a ghost ship the size of an island Moria steals shadows, and Brook joins.
Sabaody Archipelago|Summit War|sabaody|490-513|*|The Supernovas gather, Luffy punches a Celestial Dragon and Kuma scatters the crew.
Amazon Lily|Summit War|amazon|514-524|L|Luffy lands on the island of women and wins over Boa Hancock.
Impel Down|Summit War|impel|525-549|L|Luffy breaks into the great undersea prison to save Ace.
Marineford|Summit War|marineford|550-580|L|Whitebeard goes to war with the Marines. Ace and Whitebeard fall.
Post-War|Summit War|amazon|581-597|L|Luffy grieves, recovers and sends his crew a message: not in three days, in two years.
The Timeskip|Summit War|rusukaina|597-598, two years|L|Scattered across the world by Kuma, every Straw Hat trains where they landed to be ready for the New World.|crew
Return to Sabaody|Fish-Man Island|sabaody|598-602|*|Two years later the Straw Hats reunite.
Fish-Man Island|Fish-Man Island|fishman|603-653|*|10,000 metres under the sea the crew stops Hody Jones's coup.
Punk Hazard|Dressrosa|punk|654-699|*|On an island of fire and ice an alliance with Law takes down Caesar Clown.
Dressrosa|Dressrosa|dressrosa|700-801|*|Doflamingo's kingdom of toys collapses, Sabo returns and the Grand Fleet forms.
Zou|Whole Cake Island|zou|802-824|*|On the back of a giant elephant the minks reveal the Road Poneglyphs.
Whole Cake Island|Whole Cake Island|wholecake|825-902|LNSCB|Luffy's team crashes Big Mom's tea party to bring Sanji home.
Levely|Whole Cake Island|mary|903-908||The world's rulers gather at Mary Geoise while the Straw Hats sail for Wano.
Wano Country|Wano|wano|909-1057|*|Samurai, minks and pirates raid Onigashima to free Wano from Kaido and Orochi.
Egghead|Final|egghead|1058-1125|*|On Vegapunk's island of the future the World Government strikes and a message reaches the whole world.
Elbaph|Final|elbaf|1126-|*|The crew finally reaches the land of the giants and its accursed prince Loki.
`).map(([name, saga, isl, ch, only, text, view], i) => ({ i, name, saga, ch, only, text, past: saga === 'Past', wide: view === 'crew', isl: island(isl),
  reveal: +(ch.match(/ch\. (\d+)/) ?? ch.match(/^(\d+)/))[1] }))   // the chapter a reader first sees it

// name|epithet|affiliation|devil fruit|look (see sprites.js)|arcs|optional: what they are doing while off the map
export const CAST = rows([c0, c1, c2, c3].join('\n').replace(/\n+/g, '\n')).map(([name, epithet, crew, fruit, look, a, away], id) => {
  const c = { id, name, epithet, crew, fruit, look, away, key: name.split(' ').pop()[0], giant: look.slice(7).includes('G'), arcs: [], at: {}, homes: [] }
  for (const [, ch, plus, dies, where, home, leaves] of a.matchAll(/(.)(\+)?(!)?(?:\((\w+)\))?(\*)?(-)?/g)) {
    const i = CODES.indexOf(ch)
    c.arcs.push(i)
    if (plus) c.join = i
    if (dies) c.dies = i
    if (where) c.at[i] = island(where)
    if (home) c.homes.push([i, c.at[i] ?? ARCS[i].isl])
    if (leaves) c.leaves = i
  }
  return c
})

// Spoiler guard: the last chapter the reader has read. Stops told after it do not exist for inArc and everything built on it.
export let LIMIT = Infinity
export const setLimit = n => { LIMIT = n > 0 ? n : Infinity }
export const known = a => ARCS[a].reveal <= LIMIT
export const inArc = (c, a) => known(a) && (c.arcs.includes(a) ||
  (c.join !== undefined && a > c.join && (ARCS[a].only === '*' || ARCS[a].only.includes(c.key))))
export const where = (c, a) => c.at[a] ?? ARCS[a].isl

export const SAIL = CODES.indexOf('0')   // first arc of the voyage, everything before it is the past
const SKIP = CODES.indexOf('x')
// Where is a character at arc `now`? prev/next are the nearest appearances (-1 = none), shown = drawn on the map, isl = where.
// A position carries over until the saga ends (or the timeskip passes); after that only people who live there stay on the map.
export function locate(c, now) {
  let prev = now
  while (prev >= 0 && !inArc(c, prev)) prev--
  const next = ARCS.findIndex(a => a.i > now && inArc(c, a.i))
  const dead = now > c.dies
  const stale = prev >= 0 && prev < now && (c.leaves === prev || ARCS[prev].saga !== ARCS[now].saga || prev < SKIP && now >= SKIP)
  const home = stale && prev >= SAIL && c.homes.findLast(([i]) => i <= now)?.[1]   // the latest home they had moved to by now
  const isl = prev < 0 ? null : home || where(c, prev)
  return { prev, next, dead, home: !!home, isl, shown: prev >= 0 && !dead && !(now >= SAIL && prev < SAIL) && (!stale || home) }   // flashbacks do not carry into the voyage
}

// Emperor territories on the map: name, ring colour, then island:from-to:told per entry, as stop codes. 'told' is the stop
// that reveals the claim to the reader (the spoiler guard waits until that stop is read to its end).
// ponytail: from memory, not wiki-checked; only islands on this map, so most of the New World stays blank
export const REALMS = rows(`
Whitebeard|#4fc3f7|sphinx:gl:g fishman:gl:o
Big Mom|#ff8fd8|wholecake:ou:o fishman:ou:o
Kaido|#9b6bff|wano:qu:r
Blackbeard|#b0b0b8|hachinosu:uw:u
Buggy|#ffa040|karaibari:vw:v
Monkey D. Luffy|#ffe066|wano:vw:v fishman:vw:v
Shanks|#ff4a3d|gartel:ww:w
`).map(([name, col, land]) => ({ name, col, land: land.split(' ').map(e => e.split(':')).map(([id, [a, b], t]) =>
  ({ isl: island(id), from: CODES.indexOf(a), to: CODES.indexOf(b), told: CODES.indexOf(t) })) }))

// Poneglyphs the story shows: island, kind, stop where they appear, stop where Luffy's side copies a Road Poneglyph
export const STONES = rows(`
alabasta|Historical|a|
skypiea|Historical, with Roger's message|c|
fishman|Joy Boy's apology|o|
zou|Road|r|r
wholecake|Road|s|s
wano|Road|u|u
`).map(([id, kind, at, copied]) => ({ isl: island(id), kind, at: CODES.indexOf(at), copied: copied ? CODES.indexOf(copied) : Infinity }))
