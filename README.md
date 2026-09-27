# Pepak Doto

Pepak Doto is a web app for Dota 2 players who want to get better at the game. "Pepak" is Javanese for complete or thorough. The idea is to help you learn from your own games: spot the mistakes you keep making, understand why a draft or an item worked, and track whether you're actually improving.

It's still early. The project setup and the data layer exist, and the features below are being built one stage at a time.

## What it will do

- Draft assistant. Enter the enemy picks and your team's picks as the draft happens and get a ranked list of heroes to pick, with the reasons behind each one (matchups, synergy, how the hero does in your bracket, and how well you play it). It also suggests bans.
- Match assistant. Once the draft is done, it suggests an item build for your hero against that specific enemy lineup, plus a rough game plan for your team. Everything comes from what you enter. It does not read the game client.
- Post-match review. Paste a match ID and get a breakdown of your laning, farm, deaths, item timings and vision compared with other players on the same hero, plus the three things most worth fixing.
- Player profile. Trends across your recent matches, a look at your hero pool, practice goals that update after each game, and a ward heatmap.
- Optional coaching notes written by an LLM, based only on the numbers the app has already computed.

Turbo matches are not analyzed.

## Where the data comes from

- [OpenDota API](https://docs.opendota.com/) for hero stats, matches, benchmarks and replay parsing
- [STRATZ API](https://stratz.com/api) for hero matchups and synergy in public matches
- [Steam Web API](https://steamcommunity.com/dev) for sign-in and basic profile info

Your match data has to be public for any of this to work. In Dota 2, turn on "Expose Public Match Data" in the settings.

## Running it locally

You need Node.js 22 or newer.

```bash
git clone https://github.com/fazarashif/pepak-doto.git
cd pepak-doto
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000. None of the environment variables are required yet. `OPENDOTA_API_KEY` is optional and only raises the OpenDota rate limit.

## Built with

Next.js 16, React 19, TypeScript and Tailwind CSS, deployed on Vercel.

## Project docs

Planning documents are in [`docs/`](docs/) and are written in Indonesian:

- [PRD.md](docs/PRD.md): what the app should do and why
- [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md): stages, stack and architecture
- [PROGRESS.md](docs/PROGRESS.md): what's done and what's next

## Disclaimer

Dota 2 is a registered trademark of Valve Corporation. Pepak Doto is a fan project and is not affiliated with or endorsed by Valve.
