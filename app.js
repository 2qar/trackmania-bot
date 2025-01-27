import 'dotenv/config';
import express from 'express';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
    verifyKeyMiddleware,
} from 'discord-interactions';
import * as schedule from 'node-schedule';
import * as trackmania from './trackmania.js';
import { DiscordRequest } from './utils.js';
import { MongoClient, ServerApiVersion } from 'mongodb';
import * as fs from 'fs';
const uri = process.env.MONGODB_URI;

// Create an express app
const app = express();
const PORT = process.env.PORT || 3000;
const totdfile = 'totd.json';

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db('admin').command({ ping: 1});
        console.log('Pinged your deployment. You successfully connected to MongoDB!');
    } finally {
        await client.close();
    }
}
run().catch(console.dir);

const core_service = new trackmania.CoreService();
const live_service = new trackmania.LiveService();
const meet_service = new trackmania.MeetService();

/**
 * Returns up-to-date TOTD info. Checks if stored TOTD info is out of date and replaces with up-to-date info.
 * @param {string} filepath 
 * @param {Promise<JSON>} callback 
 * @returns {Promise<JSON>}
 */
async function getUpToDateTOTDInfo(filepath, callback) {
    let json = await fs.promises.readFile(filepath, { encoding: 'utf8' }).then(data => JSON.parse(data));
    if (json.endTimestamp < (Math.floor(Date.now() / 1000))) {
        if (await fs.promises.writeFile(filepath, await callback.then(data => JSON.stringify(data, null, 2)), 'utf8') === undefined)
            json = await fs.promises.readFile(filepath, { encoding: 'utf8' }).then(data => JSON.parse(data));
    }
    return json;
}

console.log(await getUpToDateTOTDInfo(totdfile, trackmania.trackOfTheDay(core_service, live_service)));

const startDate = new Date(2020, 6, 1);
let totd_channel = '1183478764856942642';

app.get('/', (req, res) => {
    res.send('whats up');
});

// Interactions endpoint URL where Discord will send HTTP requests
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
    // Interaction type and data
    const { type, id, data, token, message } = req.body;

    // Handle verification requests
    if (type === InteractionResponseType.PING) {
        return res.send({ type: InteractionResponseType.PONG});
    }

    // Handle slash command requests
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data;
        const postendpoint = `webhooks/${process.env.APP_ID}/${token}`;
        const endpoint = `${postendpoint}/messages/@original`;

        if (name === 'test') {
            res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            })
            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: {
                    content: 'hello world',
                    embeds: [{
                        title: 'hello world',
                        color: 39423,
                        description: 'example embed',
                        image: {
                            url: 'https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?q=80&w=1364&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
                            height: 100,
                            width: 100,
                        },
                        fields: [{
                            name: 'field name',
                            value: 'field value\nfield value',
                        },],
                        author: {
                            name: 'Brungus',
                            url: 'https://github.com/Khujou/trackmania-bot',
                            icon_url: 'https://media.discordapp.net/attachments/501929280729513994/1175598105178152991/IMG_0778.jpg?ex=657e450d&is=656bd00d&hm=b71379906b73849aa7e3fc05e8d20669f93b237ed45a93ce870e099c902f8776&=&format=webp',
                        },
                        footer: {
                            text: 'bungus',
                            icon_url: 'https://media.discordapp.net/attachments/501929280729513994/1154607848437858374/image.png?ex=657bbc5a&is=6569475a&hm=1a8904ebb68181710d0d9808f20516b2f1f35ce1b09706af3e89a18915ca9f54&=&format=webp&quality=lossless',
                        },
                        provider: {
                            name: 'blehg',
                            url: 'https://www.youtube.com',
                        },
                    },],
                    components: [{
                        type: MessageComponentTypes.ACTION_ROW,
                        components: [{
                            type: MessageComponentTypes.BUTTON,
                            style: 1,
                            label: 'test',
                            custom_id: 'test_button',
                        },{
                            type: MessageComponentTypes.BUTTON,
                            url: 'https://raw.githubusercontent.com/2qar/bigheadgeorge.github.io/master/ogdog.gif',
                            label: 'Click for win',
                            style: 5,
                        },{
                            type: MessageComponentTypes.BUTTON,
                            url: 'https://media.tenor.com/FDxMOf3iWhIAAAAM/angry-cute-cat-cat.gif',
                            label: 'Click for lose',
                            style: 5,
                        },
                        ],
                    },
                    ],
                }
            }).catch(err => embeddedErrorMessage(endpoint, err));
        }

        else if (name ==='tucker') {
            try {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: 'i miss him <@203284058673774592>',
                        flags: InteractionResponseFlags.EPHEMERAL,
                    },
                });
            } catch (err) {
                embeddedErrorMessage(endpoint, err);
            }
        }

        else if (name === 'totd') {
            res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                /* data: { flags: InteractionResponseFlags.EPHEMERAL, } */
            });

            let track_json = null;
            const totdDate = new Date();
            if (options[0].name === 'past') {
                const fields = options[0].options;
                let inputDate = new Date(fields[0].value, fields[1].value - 1, fields[2].value);
                if (inputDate > totdDate)
                    inputDate = totdDate;
                else if (inputDate < startDate)
                    embeddedErrorMessage(endpoint, Error('Date given is before Trackmania came out, silly :)'));

                track_json = await trackmania.trackOfTheDay(core_service, live_service, inputDate).catch(err => embeddedErrorMessage(endpoint, err));
            } else {
                console.log('about to open file');
                track_json = await getUpToDateTOTDInfo(totdfile, trackmania.trackOfTheDay(core_service, live_service)).catch(err => embeddedErrorMessage(endpoint, err));
                console.log('finished file ops');
            }

            console.log(track_json);
            
            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: await trackmania.embedTrackInfo(live_service, track_json),
            })
            .catch(err => embeddedErrorMessage(endpoint, err));
        }

    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
        const componentId = data.custom_id;
        const endpoint = `channels/${message.channel_id}/messages/${message.id}`;
        const args = componentId.split(';');

        res.send({
            type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
        });

        if (args[0] === 'test') {
            console.log(message);
        }

        else if (args[0] === 'cotd') {
            const res = await trackmania.cupOfTheDay(meet_service);
            console.log(res);
        }

        else if (args[0].slice(0,2) === 'lb') {

            const lbargs = args[0].split('_');
            if (lbargs[1] === 'f') {
                args.push(undefined)
            } else if (lbargs[1] === 'l') {
                args.push(1000-args[2]);
            } else if (lbargs[1] === 'p') {
                data.values[0].split(';').forEach((e) => {
                    args.push(e);
                });
            }

            console.log(args);

            const track_info = {
                author: message.embeds[0].author.name,
                groupUid: args[1],
                mapUid: args[2],
            };

            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: await trackmania.leaderboard(live_service, track_info, args[3], true, args[4]),
            })
            .catch(err => {
                console.error(JSON.stringify(err));
                embeddedErrorMessage(endpoint, err)
            });
        }
        
        else if (args[0] === 'track') {
            let command;
            if (args[1] === 'totd') command = `Track of the Day - ${args[4]}`;
            else { command = 'Map Search'; }

            console.log(args);

            await DiscordRequest(endpoint, {
                method: 'PATCH',
                body: await trackmania.embedTrackInfo(live_service, await trackmania.getTrackInfo(core_service, command, args[2], args[3])).catch(err => embeddedErrorMessage(endpoint, err)),
            })
            .catch(err => embeddedErrorMessage(endpoint, err));
        }

    }
});

const daily_totd = schedule.scheduleJob('0 13 * * *', async() => {
    await DiscordRequest(`channels/${totd_channel}/messages`, {
        method: 'POST',
        body: await trackmania.trackOfTheDay(core_service, live_service),
    });
});

async function embeddedErrorMessage(endpoint, err) {
    console.log(err.stack);
    try {
        await DiscordRequest(endpoint, {
            method: 'PATCH',
            body: {
                flags: InteractionResponseFlags.EPHEMERAL,
                embeds: [{
                    title: 'Error: Unable to handle request',
                    color: parseInt('ff0000', 16),
                    fields: [{
                        name: 'Reason',
                        value: `${err}`,
                    }]
                }],
                components: [{
                    type: MessageComponentTypes.ACTION_ROW,
                    components: [{
                        type: MessageComponentTypes.BUTTON,
                        label: 'Back',
                        style: ButtonStyleTypes.PRIMARY,
                        custom_id: 'back',
                    }],
                }],
            }
        });
    } catch (error) {
        console.error(`Error sending error message: ${error}`);
    }
}


app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});