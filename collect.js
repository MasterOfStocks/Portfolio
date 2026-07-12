/* Stats collector — runs on GitHub Actions every ~20 minutes.
   Fetches live Roblox stats and appends a snapshot to history.json,
   which the portfolio site loads as the shared growth-history bank. */

const fs = require("fs");

const GROUP_ID = 675478;
const UNIVERSE_IDS = [
  7113599041,   // vivid memory - cozy house (main)
  1704127601,   // Resting Place RP (main)
  10093245780,  // Sudoku 'N Chill (main)
  7372155552,   // The Last Hour (main)
  4522741629,   // something (sub)
  6416859968,   // Floral Garden (sub)
  4480123443,   // the attic (sub)
];
const HISTORY_FILE = "history.json";

async function getJson(url) {
  const r = await fetch(url, { headers: { "accept": "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
  return r.json();
}

async function main() {
  const games = await getJson(
    "https://games.roblox.com/v1/games?universeIds=" + UNIVERSE_IDS.join(",")
  );
  const group = await getJson("https://groups.roblox.com/v1/groups/" + GROUP_ID);

  let v = 0, c = 0, f = 0;
  const g = {};
  for (const game of games.data || []) {
    v += game.visits || 0;
    c += game.playing || 0;
    f += game.favoritedCount || 0;
    g[game.id] = [game.visits || 0, game.playing || 0, game.favoritedCount || 0];
  }
  if (!Object.keys(g).length) throw new Error("no game data returned");

  const point = { t: Date.now(), v, c, f, m: group.memberCount || 0, g };

  let history = [];
  try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); } catch (e) {}
  if (!Array.isArray(history)) history = [];
  history.push(point);

  // prune: 20-min detail for 2 days, hourly for 30 days, daily beyond
  const now = Date.now();
  const seen = new Set();
  const out = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i];
    if (!s || !s.t) continue;
    const age = now - s.t;
    const bucketSize = age < 2 * 86400000 ? 1200000 : age < 30 * 86400000 ? 3600000 : 86400000;
    const key = bucketSize + ":" + Math.floor(s.t / bucketSize);
    if (!seen.has(key)) { seen.add(key); out.push(s); }
  }
  out.reverse();

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(out));
  console.log(
    "snapshot saved:", new Date(point.t).toISOString(),
    "visits=" + v, "ccu=" + c, "members=" + point.m,
    "(" + out.length + " points total)"
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
