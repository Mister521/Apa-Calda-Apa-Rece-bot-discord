const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ====================== KEEP ALIVE (pentru Render) ======================
const app = express();
app.get('/', (req, res) => res.send('Botul Apa Calda Apa Rece e online!'));
app.get('/health', (req, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Keep-alive pornit pe portul ${PORT}`));

// ====================== COMENZI ======================
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Verifică dacă botul e online'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Informații despre server'),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Dă kick unui membru')
    .addUserOption(opt => opt.setName('user').setDescription('Utilizatorul').setRequired(true))
    .addStringOption(opt => opt.setName('motiv').setDescription('Motivul').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banează un membru')
    .addUserOption(opt => opt.setName('user').setDescription('Utilizatorul').setRequired(true))
    .addStringOption(opt => opt.setName('motiv').setDescription('Motivul').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute temporar)')
    .addUserOption(opt => opt.setName('user').setDescription('Utilizatorul').setRequired(true))
    .addIntegerOption(opt => opt.setName('minute').setDescription('Câte minute').setRequired(true))
    .addStringOption(opt => opt.setName('motiv').setDescription('Motivul').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Scoate timeout-ul')
    .addUserOption(opt => opt.setName('user').setDescription('Utilizatorul').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Șterge mesaje')
    .addIntegerOption(opt => opt.setName('numar').setDescription('Câte mesaje (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
];

// ====================== ÎNREGISTRARE COMENZI ======================
client.once('ready', async () => {
  console.log(`Logat ca ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('Se înregistrează comenzile...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('Comenzile au fost înregistrate cu succes!');
  } catch (error) {
    console.error(error);
  }
});

// ====================== WELCOME ======================
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.name.includes('welcome') || c.name.includes('general'));
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor('#00ff99')
    .setTitle('Bun venit!')
    .setDescription(`Salut ${member}! Bine ai venit pe **${member.guild.name}** 🔥`)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Acum suntem ${member.guild.memberCount} membri` });

  channel.send({ embeds: [embed] }).catch(() => {});
});

// ====================== HANDLER COMENZI ======================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'ping') {
      return interaction.reply(`🏓 Pong! Latency: **${client.ws.ping}ms**`);
    }

    if (commandName === 'serverinfo') {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(interaction.guild.name)
        .addFields(
          { name: '👥 Membri', value: `${interaction.guild.memberCount}`, inline: true },
          { name: '📅 Creat pe', value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '👑 Owner', value: `<@${interaction.guild.ownerId}>`, inline: true }
        )
        .setThumbnail(interaction.guild.iconURL());
      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'kick') {
      const user = interaction.options.getUser('user');
      const motiv = interaction.options.getString('motiv') || 'Fără motiv';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.reply({ content: 'Nu am găsit membrul.', ephemeral: true });
      if (!member.kickable) return interaction.reply({ content: 'Nu pot da kick acestui membru.', ephemeral: true });

      await member.kick(motiv);
      return interaction.reply(`✅ **${user.tag}** a primit kick.\nMotiv: ${motiv}`);
    }

    if (commandName === 'ban') {
      const user = interaction.options.getUser('user');
      const motiv = interaction.options.getString('motiv') || 'Fără motiv';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (member && !member.bannable) return interaction.reply({ content: 'Nu pot bana acest membru.', ephemeral: true });

      await interaction.guild.members.ban(user.id, { reason: motiv });
      return interaction.reply(`🔨 **${user.tag}** a fost banat.\nMotiv: ${motiv}`);
    }

    if (commandName === 'timeout') {
      const user = interaction.options.getUser('user');
      const minute = interaction.options.getInteger('minute');
      const motiv = interaction.options.getString('motiv') || 'Fără motiv';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.reply({ content: 'Nu am găsit membrul.', ephemeral: true });
      if (!member.moderatable) return interaction.reply({ content: 'Nu pot da timeout acestui membru.', ephemeral: true });

      await member.timeout(minute * 60 * 1000, motiv);
      return interaction.reply(`⏱️ **${user.tag}** a primit timeout **${minute} minute**.\nMotiv: ${motiv}`);
    }

    if (commandName === 'untimeout') {
      const user = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.reply({ content: 'Nu am găsit membrul.', ephemeral: true });

      await member.timeout(null);
      return interaction.reply(`✅ Timeout-ul lui **${user.tag}** a fost scos.`);
    }

    if (commandName === 'clear') {
      const numar = interaction.options.getInteger('numar');
      if (numar < 1 || numar > 100) return interaction.reply({ content: 'Alege între 1 și 100 mesaje.', ephemeral: true });

      const deleted = await interaction.channel.bulkDelete(numar, true);
      return interaction.reply({ content: `🧹 Am șters **${deleted.size}** mesaje.`, ephemeral: true });
    }

  } catch (error) {
    console.error(error);
    interaction.reply({ content: 'A apărut o eroare la executarea comenzii.', ephemeral: true }).catch(() => {});
  }
});

// ====================== LOGIN ======================
client.login(process.env.TOKEN);
