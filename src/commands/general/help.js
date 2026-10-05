const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { baseEmbed, readout, COLORS, ICONS } = require('../../utils/theme');
const { modeOf } = require('../../ui/text');

const SECTIONS = [
    {
        normal: '🎵 Music',
        tech: 'AUDIO_CORE',
        commands: [
            ['/play', 'Play a song or playlist (name or link)', 'inject track / playlist'],
            ['/search', 'Search YouTube, Spotify or SoundCloud and pick a result', 'multi-node packet sniff'],
            ['/nowplaying', 'Current song with controls and a progress bar', 'live stream panel + seek'],
            ['/pause', 'Pause the music', 'intercept stream'],
            ['/resume', 'Continue paused music', 'release intercept'],
            ['/next', 'Play the next song (same as /skip)', 'bypass node'],
            ['/previous', 'Go back to the previous song', 'restore last node'],
            ['/seek', 'Jump to a time, e.g. 1:30', 'relocate offset'],
            ['/loop', 'Repeat this song or the whole queue', 'set repeat protocol'],
            ['/queue', 'See the songs waiting to play', 'dump buffer'],
            ['/stop', 'Stop, clear the queue and leave', 'terminate connection'],
        ],
    },
    {
        normal: '📁 Your playlists',
        tech: 'PERSONAL_VAULT',
        commands: [
            ['/playlist create', 'Make a new playlist', 'allocate archive'],
            ['/playlist add', 'Add a song (or the one playing now)', 'write packet'],
            ['/playlist savequeue', 'Save everything in the queue', 'snapshot buffer'],
            ['/playlist play', 'Play one of your playlists', 'mount archive'],
            ['/playlist view · list', 'See your playlists and their songs', 'ls vault'],
            ['/playlist remove · rename · delete', 'Manage your playlists', 'edit / purge archive'],
        ],
    },
    {
        normal: '⚙️ Settings',
        tech: 'SYSTEM',
        commands: [['/mode', 'Choose simple words or hacker style', 'swap interface skin']],
    },
];

module.exports = {
    data: new SlashCommandBuilder().setName('help').setDescription('Show everything MusicJX can do.'),

    async execute(interaction) {
        const mode = modeOf(interaction.user);

        const embed =
            mode === 'tech'
                ? baseEmbed('tech', {
                      color: COLORS.CYAN,
                      title: `${ICONS.pager} [ MUSICJX_MANUAL ]`,
                      description: SECTIONS.map((s) => `**${s.tech}**\n${readout(s.commands.map(([cmd, , tech]) => [cmd, tech]))}`).join('\n'),
                  })
                : baseEmbed('normal', {
                      color: COLORS.CYAN,
                      title: '🎧 MusicJX — Commands',
                      description: 'Join a voice channel, then use `/play` to start. Tip: `/nowplaying` gives you buttons for everything.',
                  }).addFields(
                      SECTIONS.map((s) => ({
                          name: s.normal,
                          value: s.commands.map(([cmd, normal]) => `\`${cmd}\` — ${normal}`).join('\n'),
                      })),
                  );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
