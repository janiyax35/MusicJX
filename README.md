# 📟 MusicJX

Discord music bot by **JaniyaX**. Built on `discord.js` v14 + `discord-player` v7.
Plays YouTube (search, videos, playlists), Spotify (tracks, albums, playlists — audio bridged via YouTube), SoundCloud, Apple Music, Vimeo and direct audio links.

## Two styles

Each user picks how MusicJX talks to them with `/mode`:

- **Normal** (default) — plain, everyday words: "🎶 Now Playing", "⏭️ Skipped".
- **Tech** — netrunner / hacker-terminal style: `[ ACTIVE_AUDIO_STREAM ]`, `[ BYPASSING_NODE ]`.

Messages the bot posts on its own (now playing, queue finished…) use the style of whoever queued the song.

## Commands

| Command | What it does |
| --- | --- |
| `/play <song or link>` | Play a song, or a YouTube / Spotify playlist or album |
| `/search <query> [source]` | Pick YouTube / Spotify / SoundCloud / all, browse results, then **Play now**, **Add to queue** or **Save to playlist** (new or existing) |
| `/nowplaying` | Live panel: progress bar, Previous / Pause / Next / Loop / Stop, ±10s and a "jump to position" menu |
| `/pause` · `/resume` | Pause / continue |
| `/next` (or `/skip`) · `/previous` | Next song / go back one song |
| `/seek <time>` | Jump to a time, e.g. `90`, `1:30`, `1:02:03` |
| `/loop [off / this song / whole queue]` | Repeat mode (no option = switch to the next one) |
| `/queue [page]` | Songs waiting to play |
| `/stop` | Stop, clear the queue and leave |
| `/playlist create · add · savequeue · play · view · list · remove · rename · delete` | Personal saved playlists |
| `/mode <normal / tech>` | Choose your style |
| `/help` | Command list |

A now-playing panel is posted automatically whenever a new song starts; its progress bar updates every 15 seconds.
Discord has no slider control for bots, so seeking uses the "jump to position" menu, the ±10s buttons, or `/seek`.

`/search` lets users choose by clicking, or by typing the number in chat if **Message Content Intent** is enabled
(Developer Portal → your app → Bot → Privileged Gateway Intents). Spotify search needs `SPOTIFY_CLIENT_ID` /
`SPOTIFY_CLIENT_SECRET` from a free app at https://developer.spotify.com/dashboard; without them the Spotify option is shown as "not set up".

Playlists and style choices are saved in `data/` (`playlists.json`, `settings.json`). Back that folder up if you move servers.

## Requirements

- Node.js **22.12+** (tested on 24)
- ffmpeg is bundled via `ffmpeg-static` — nothing to install separately.

## Setup

```bash
npm install
cp .env.example .env      # then fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm run deploy            # register slash commands (re-run whenever commands change)
npm start                 # start the bot
```

On npm 11+/12, if `npm install` warns that `ffmpeg-static`'s install script was blocked, run
`npm rebuild ffmpeg-static` (it's already allow-listed in `package.json`).

## Project layout

```
src/
├── index.js               # client + player bootstrap
├── deploy-commands.js     # slash command registration
├── handlers/              # command + event loaders
├── commands/music/        # one file per music slash command
├── commands/general/      # /mode, /help
├── components/            # now-playing panel buttons + seek menu
├── events/client/         # discord.js events (ready, interactionCreate)
├── events/player/         # discord-player queue events (playerStart, emptyQueue, ...)
├── player/                # search, seek/loop helpers, live panel manager
├── storage/               # JSON-file storage for playlists and user settings
├── ui/                    # all user-facing text (normal + tech) and list/panel views
└── utils/                 # theme (colors/footer/bars), guards, logger, notify, time
```

## Troubleshooting

- **Commands don't show up** — set `GUILD_ID` and re-run `npm run deploy`; global commands can take up to an hour.
- **YouTube: "Sign in to confirm you're not a bot"** — YouTube is rate-limiting your IP. Put a YouTube cookie string in `YOUTUBE_COOKIE`, or host somewhere other than a datacenter IP.
- **Bot joins but no sound** — set `DEBUG=true` in `.env`, restart, and check the dependency report printed at boot.
