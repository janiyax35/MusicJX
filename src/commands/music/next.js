const { SlashCommandBuilder } = require('discord.js');
const { skipCurrent } = require('./skip');

module.exports = {
    data: new SlashCommandBuilder().setName('next').setDescription('Play the next song in the queue.'),
    execute: skipCurrent,
};
