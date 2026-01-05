const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.TOKEN;

const CLIENT_ID = "1457618494035202048";
const PREFIX = "h.";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= DATA =================
let data = {};
if (fs.existsSync("data.json")) {
  data = JSON.parse(fs.readFileSync("data.json"));
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("lb").setDescription("Message leaderboard"),
  new SlashCommandBuilder().setName("rank").setDescription("Your rank & level"),
  new SlashCommandBuilder().setName("top").setDescription("Top users"),
  new SlashCommandBuilder().setName("dev").setDescription("Developer info"),
  new SlashCommandBuilder().setName("reset").setDescription("Reset server stats (admin)")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Slash commands ready");
})();

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const now = new Date();
  const day = now.toDateString();
  const week = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
  const month = `${now.getFullYear()}-${now.getMonth()}`;
  const year = `${now.getFullYear()}`;

  const gid = message.guild.id;
  const uid = message.author.id;

  if (!data[gid]) data[gid] = {};
  if (!data[gid][uid]) {
    data[gid][uid] = {
      total: 0, today: 0, week: 0, month: 0, year: 0,
      lastDay: day, lastWeek: week, lastMonth: month, lastYear: year,
      xp: 0, level: 1
    };
  }

  const u = data[gid][uid];

  if (u.lastDay !== day) { u.today = 0; u.lastDay = day; }
  if (u.lastWeek !== week) { u.week = 0; u.lastWeek = week; }
  if (u.lastMonth !== month) { u.month = 0; u.lastMonth = month; }
  if (u.lastYear !== year) { u.year = 0; u.lastYear = year; }

  u.total++; u.today++; u.week++; u.month++; u.year++;

  // XP
  u.xp += 5;
  const need = u.level * 100;
  if (u.xp >= need) {
    u.xp -= need;
    u.level++;
    message.channel.send(`🎉 <@${uid}> reached **Level ${u.level}**!`);
  }

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

  // ===== h.m =====
  if (message.content === "h.m") {
    return message.reply({
      embeds: [{
        color: 0xffa500,
        author: {
          name: `${message.author.username}'s Messages`,
          icon_url: message.author.displayAvatarURL()
        },
        description:
`🕒 **Today:** ${u.today}
📆 **This Week:** ${u.week}
🗓 **This Month:** ${u.month}
📅 **This Year:** ${u.year}
📊 **Total:** ${u.total}

⭐ **Level:** ${u.level}
⚡ **XP:** ${u.xp}/${u.level * 100}`
      }]
    });
  }

  // ===== MOD COMMANDS =====
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return message.reply("❌ No permission.");
    const m = message.mentions.members.first();
    if (!m) return message.reply("❌ Mention someone.");
    await m.kick(args.join(" ") || "No reason");
    message.reply(`👢 Kicked **${m.user.tag}**`);
  }

  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ No permission.");
    const m = message.mentions.members.first();
    if (!m) return message.reply("❌ Mention someone.");
    await m.ban({ reason: args.join(" ") || "No reason" });
    message.reply(`🔨 Banned **${m.user.tag}**`);
  }

  if (cmd === "timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("❌ No permission.");
    const m = message.mentions.members.first();
    const time = args[1];
    if (!m || !time) return message.reply("❌ Usage: h.timeout @user 10m");
    const ms = parseInt(time) * (time.endsWith("m") ? 60000 : 1000);
    await m.timeout(ms, args.slice(2).join(" ") || "No reason");
    message.reply(`⏱ Timed out **${m.user.tag}**`);
  }
});

// ================= SLASH HANDLER =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const gid = i.guild.id;
  const users = Object.entries(data[gid] || {});

  if (i.commandName === "lb") {
    await i.deferReply();
    users.sort((a, b) => b[1].total - a[1].total);
    const list = users.slice(0, 10).map((u, n) =>
      `**${n + 1}.** <@${u[0]}> — ${u[1].total}`
    ).join("\n");
    return i.editReply({ embeds: [{ color: 0xffa500, title: "🏆 Leaderboard", description: list || "No data" }] });
  }

  if (i.commandName === "rank") {
    const u = data[gid][i.user.id];
    return i.reply({
      embeds: [{
        color: 0xffa500,
        title: "⭐ Your Rank",
        description:
`Level: **${u.level}**
XP: **${u.xp}/${u.level * 100}**
Messages: **${u.total}**`
      }]
    });
  }

  if (i.commandName === "top") {
    users.sort((a, b) => b[1].level - a[1].level);
    const list = users.slice(0, 10).map((u, n) =>
      `**${n + 1}.** <@${u[0]}> — Lvl ${u[1].level}`
    ).join("\n");
    return i.reply({ embeds: [{ color: 0xffa500, title: "🔥 Top Users", description: list || "No data" }] });
  }

  if (i.commandName === "dev") {
    return i.reply({
      embeds: [{
        color: 0xffa500,
        title: "👑 Developer",
        description:
`This bot qualifies for the **Active Developer Badge**.

🔗 Claim it here:
https://discord.com/developers/active-developer`
      }]
    });
  }

  if (i.commandName === "reset") {
    if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return i.reply({ content: "❌ Admin only.", ephemeral: true });
    data[gid] = {};
    fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
    return i.reply("♻ Server stats reset.");
  }
});

client.login(TOKEN).then(() => console.log("BOT ONLINE"));
