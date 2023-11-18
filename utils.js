import 'dotenv/config';
import fetch from 'node-fetch';
import { verifyKey } from 'discord-interactions';

export async function DiscordRequest(endpoint, options) {
    const url = 'https://discord.com/api/v10/' + endpoint;
    
    if (options.body) options.body = JSON.stringify(options.body);

    const res = await fetch (url, {
        headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        ...options
    });

    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res;
}

export async function InstallGlobalCommands(appId, commands) {
    const endpoint = `applications/${appId}/commands`;

    try {
        await DiscordRequest(endpoint, { method: 'PUT', body: commands });
    } catch (err) {
        console.error(err);
    }
}

export async function TMRequest() {
    const url = 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/basic';
    const login_password_base64 = Buffer.from(`${process.env.LOGIN}:${process.env.PASSWORD}`).toString('base64');

    const res = await fetch (url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${login_password_base64}`,
        },
        body: JSON.stringify({
            'audience' : 'NadeoClubServices',
        }),
        
    });

    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res.json();
}