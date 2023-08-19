const Discord = require("discord.js");
const config = require("./config2.json");

const { AudioPlayerStatus, StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel } = require('@discordjs/voice');

const { GatewayIntentBits } = require('discord.js');

const ytdl = require('discord-ytdl-core');

const client = new Discord.Client({intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMessageReactions, 
GatewayIntentBits.GuildVoiceStates, 
]});

const prefix = "!";
const connections = new Map();
const helpResponse = "PRACTICE-BOT knows these commands: !play URL, !stop, !giveroles, !ping";

client.on('ready', handleBotReady);
client.on('messageReactionAdd', handleMessageReactionAdd);
client.on('messageCreate', handleMessageCreate);
client.login(config.BOT_TOKEN);



function handleBotReady() {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help for commands');
}



function handleMessageReactionAdd(reaction) {
    if (reaction.emoji.name === "🤖") {
        try {
            reaction.message.react('🤖');
        } catch {
            console.log('Error reacting');
        }
    }
}


async function handleMessageCreate(message) {
    if (message.author.bot) return;
    if (message.mentions.has(client.user.id)) return handleMentions(message);

    reactToKeywords(message);
    if (!message.content.startsWith(prefix)) return;

    const [command, ...args] = message.content.slice(prefix.length).split(' ');
    switch (command.toLowerCase()) {
        case "commands":
        case "help":
            message.reply(helpResponse);
            break;
        case "giveroles":
            handleGiveRoles(message);
            break;
        case "ping":
            handlePingCommand(message);
            break;
        case "stop":
            handleStopCommand(message);
            break;
        case "play":
            await handlePlayCommand(message, args);
            break;
        default:
            break;
    }
}

function handleMentions(message) {
    let hasReplied = false; 

    const responses = [
        {
            keywords: ["hello", "hi", "hey"],
            response: "heyo! use !help to see commands"
        },
        {
            keywords: ["help", "how", "what", "commands"],
            response: helpResponse
        }
    ];

    for (let r of responses) {
        if (r.keywords.some(kw => message.content.toLowerCase().includes(kw))) {
            message.reply(`${message.author} ${r.response}`);
            hasReplied = true;
            break;
        }
    }

    if (!hasReplied) {
        message.reply("Hey there! Use !help to see my commands.");
    }
}



function reactToKeywords(message) {
    if (message.content.includes("robot")) {
        message.react('🤖');
    }

    
    const regex = /\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/i;
    if (message.content.includes("-") && regex.test(message.content)) {
        const random = Math.round(Math.random());
        if (random === 0) {
            message.react('🙏');
        } else {
            message.react('❤');
        }
    }
}

function handleGiveRoles(message) {
    const member = message.guild.members.cache.get(message.author.id);
    const role = message.guild.roles.cache.find(role => role.name === "Member");
    if (role) {
        if (!member.roles.cache.has(role.id)) {
            member.roles.add(role);
            message.reply(`Updated roles!`);
        } else {
            message.reply('You already have the Member role!');
        }
    }
}

function handlePingCommand(message) {
    const timeTaken = Date.now() - message.createdTimestamp;
    message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
}

 
function handleStopCommand(message) {
    const connection = connections.get(message.guild.id);
    if (connection) {
        connection.destroy();
        connections.delete(message.guild.id);
    } else {
        message.reply(`There is no song to stop playing`);
    }
}
async function handlePlayCommand(message, args) {
    const url = args.join(' ');
    console.log(url);
    if (!url || !validURL(url)) {
        message.channel.send("Please provide a valid URL!");
        return;
    }

    if (!message.member.voice.channel) return message.channel.send("Please connect to a voice channel!");


    let connection = connections.get(message.guild.id);

    if (!connection) {
        connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        connection.on('error', error => {
            console.error(`Voice connection error in guild ${message.guild.id}`, error);
        });

        connections.set(message.guild.id, connection);
    } 

    let stream = ytdl(url, {
        filter: "audioonly",
        opusEncoded: false,
        fmt: "mp3",
        highWaterMark: 1 << 25,
        encoderArgs: ['-af', 'bass=g=10,dynaudnorm=f=200', '-vn']
    });

    const player = createAudioPlayer();

    player.on('stateChange', (oldState, newState) => {
        const oldNetworking = Reflect.get(oldState, 'networking');
        const newNetworking = Reflect.get(newState, 'networking');
    
        const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
            const newUdp = Reflect.get(newNetworkState, 'udp');
            clearInterval(newUdp?.keepAliveInterval);
        }
    
        oldNetworking?.off('stateChange', networkStateChangeHandler);
        newNetworking?.on('stateChange', networkStateChangeHandler);
    });
    
    const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
    });

    player.play(resource);
    connection.subscribe(player);

    player.on('error', err => console.error(err));
    player.on(AudioPlayerStatus.Idle, () => {

        message.member.voice.channel.leave();
        connections.delete(message.guild.id);
    });
}



  function validURL(str) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    return pattern.test(str);
}
