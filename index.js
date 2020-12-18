"use strict";
const sandbox = require("./sandbox")
const Discord = require('discord.js')
const client = new Discord.Client()

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`)
})

client.on('message', msg => {
    // console.log(msg)
    if (msg.author.bot)
        return
    let res = sandbox.run(msg.content, msg.author)
    if (res instanceof sandbox.Never)
        return
    if (typeof res === "number" && String(res) === msg.content)
        return
    if (typeof res === undefined)
        res = "<undefined>"
    else if (typeof res === "function")
        res = `<function:${res.name?res.name:"anonymous"}>`
    else if (typeof res === "number" || typeof res === "bigint" || typeof res === "symbol")
        res = String(res)
    else if (typeof res !== "string") {
        try {
            res = JSON.stringify(res)
        } catch (e) {
            res = e.message
        }
    }
    if (res.length > 2000)
        res = res.slice(0, 1998) + ".."
    msg.channel.send(res).catch(()=>{})
})

client.login(process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN : 'your-token')
