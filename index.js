import { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Track squad channels
const squadChannels = new Map(); // voiceId -> { textId, ownerId }
const userTickets = new Map(); // userId -> channelId

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const guild = await client.guilds.fetch(config.guildId);
  
  // Create roles if they don't exist
  await setupRoles(guild);
  
  // Apply channel permissions
  await setupChannelPermissions(guild);
  
  // Post verification button in #rules
  await postVerificationButton(guild);
  
  // Post SCUM Player button in #how-to-join
  await postScumPlayerButton(guild);
  
  // Post squad creation button
  await postSquadButton(guild);
  
  // Post ticket creation button
  await postTicketButton(guild);
  
  console.log('Bot setup complete!');
});

// Auto-assign Unverified role on member join
client.on('guildMemberAdd', async (member) => {
  try {
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'Unverified');
    if (unverifiedRole) {
      await member.roles.add(unverifiedRole);
      console.log(`Assigned Unverified role to ${member.user.tag}`);
    }
  } catch (error) {
    console.error('Error assigning Unverified role:', error);
  }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', ephemeral: true });
    }
  }
});

// Handle voice state updates for squad auto-cleanup and member limit
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    // Check if someone joined a squad voice channel
    if (newState.channel && squadChannels.has(newState.channel.id)) {
      const members = newState.channel.members.filter(m => !m.user.bot);
      
      // Enforce 6 member limit
      if (members.size > 6) {
        // Disconnect the member who just joined
        await newState.member.voice.disconnect();
        await newState.member.send('ไม่สามารถเข้าร่วม Squad นี้ได้ เนื่องจากมีสมาชิกครบ 6 คนแล้ว').catch(() => {});
        return;
      }
    }
    
    // Auto cleanup when squad voice becomes empty
    if (oldState.channel && squadChannels.has(oldState.channel.id)) {
      const members = oldState.channel.members.filter(m => !m.user.bot);
      
      if (members.size === 0) {
        // Wait 10 seconds before cleanup
        setTimeout(async () => {
          const channel = await client.channels.fetch(oldState.channel.id).catch(() => null);
          if (!channel) return;
          
          const currentMembers = channel.members.filter(m => !m.user.bot);
          if (currentMembers.size === 0) {
            await cleanupSquad(oldState.channel.id);
          }
        }, 10000);
      }
    }
  } catch (error) {
    console.error('Error handling voice state update:', error);
  }
});

async function setupRoles(guild) {
  console.log('Setting up roles...');
  
  for (const [key, roleConfig] of Object.entries(config.roles)) {
    let role = guild.roles.cache.find(r => r.name === roleConfig.name);
    
    if (!role) {
      role = await guild.roles.create({
        name: roleConfig.name,
        color: roleConfig.color,
        reason: 'Automated role setup',
      });
      console.log(`Created role: ${roleConfig.name}`);
    } else {
      // Update color if it exists
      if (role.color !== parseInt(roleConfig.color.replace('#', '0x'))) {
        await role.setColor(roleConfig.color);
        console.log(`Updated color for role: ${roleConfig.name}`);
      }
    }
  }
}

async function setupChannelPermissions(guild) {
  console.log('Setting up channel permissions...');
  
  const roles = {
    unverified: guild.roles.cache.find(r => r.name === 'Unverified'),
    verified: guild.roles.cache.find(r => r.name === 'Verified'),
    scumPlayer: guild.roles.cache.find(r => r.name === 'SCUM Player'),
    muted: guild.roles.cache.find(r => r.name === 'Muted'),
  };
  
  // Channels where Unverified can only view
  const unverifiedViewOnly = [
    config.channels.welcome,
    config.channels.rules,
    config.channels.howToJoin,
    config.channels.faq,
    config.channels.donationInfo,
    config.channels.ticketSupport,
  ];
  
  for (const channelId of unverifiedViewOnly) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      await channel.permissionOverwrites.edit(roles.unverified, {
        ViewChannel: true,
        SendMessages: false,
        AddReactions: false,
      });
      console.log(`Set view-only permissions for Unverified in ${channel.name}`);
    }
  }
  
  // General chat - Unverified cannot send messages
  const generalChat = await guild.channels.fetch(config.channels.generalChat).catch(() => null);
  if (generalChat) {
    await generalChat.permissionOverwrites.edit(roles.unverified, {
      ViewChannel: false,
      SendMessages: false,
    });
    await generalChat.permissionOverwrites.edit(roles.verified, {
      ViewChannel: true,
      SendMessages: true,
    });
    console.log(`Set permissions for general chat`);
  }
  
  // Trading market - requires SCUM Player to send messages
  const tradingMarket = await guild.channels.fetch(config.channels.tradingMarket).catch(() => null);
  if (tradingMarket) {
    await tradingMarket.permissionOverwrites.edit(roles.unverified, {
      ViewChannel: false,
    });
    await tradingMarket.permissionOverwrites.edit(roles.verified, {
      ViewChannel: true,
      SendMessages: false,
    });
    await tradingMarket.permissionOverwrites.edit(roles.scumPlayer, {
      ViewChannel: true,
      SendMessages: true,
    });
    console.log(`Set permissions for trading market`);
  }
  
  // Muted role - cannot send messages anywhere
  const channels = await guild.channels.fetch();
  for (const [, channel] of channels) {
    if (channel.type === ChannelType.GuildText) {
      await channel.permissionOverwrites.edit(roles.muted, {
        SendMessages: false,
        AddReactions: false,
      });
    }
  }
  console.log(`Set muted permissions across all text channels`);
}

async function postVerificationButton(guild) {
  const channel = await guild.channels.fetch(config.channels.rules).catch(() => null);
  if (!channel) return;
  
  // Delete old bot messages
  const messages = await channel.messages.fetch({ limit: 10 });
  for (const [, msg] of messages) {
    if (msg.author.id === client.user.id) {
      await msg.delete().catch(() => {});
    }
  }
  
  const embed = new EmbedBuilder()
    .setTitle('📜 กฎของเซิร์ฟเวอร์')
    .setDescription('กรุณาอ่านกฎของเซิร์ฟเวอร์และกดปุ่มด้านล่างเพื่อยืนยัน')
    .setColor('#00FF00');
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('verify')
        .setLabel('ยอมรับกฎ / Verify')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );
  
  await channel.send({ embeds: [embed], components: [row] });
  console.log('Posted verification button in #rules');
}

async function postScumPlayerButton(guild) {
  const channel = await guild.channels.fetch(config.channels.howToJoin).catch(() => null);
  if (!channel) return;
  
  // Delete old bot messages
  const messages = await channel.messages.fetch({ limit: 10 });
  for (const [, msg] of messages) {
    if (msg.author.id === client.user.id) {
      await msg.delete().catch(() => {});
    }
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🎮 รับยศ SCUM Player')
    .setDescription('กดปุ่มด้านล่างเพื่อรับยศ SCUM Player')
    .setColor('#0000FF');
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('scum_player')
        .setLabel('รับยศ SCUM Player')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎮')
    );
  
  await channel.send({ embeds: [embed], components: [row] });
  console.log('Posted SCUM Player button in #how-to-join');
}

async function postSquadButton(guild) {
  const category = await guild.channels.fetch(config.squadCategoryId).catch(() => null);
  if (!category) return;
  
  // Find or create a squad-control text channel
  let squadControl = guild.channels.cache.find(c => c.name === 'squad-control' && c.parentId === config.squadCategoryId);
  
  if (!squadControl) {
    squadControl = await guild.channels.create({
      name: 'squad-control',
      type: ChannelType.GuildText,
      parent: config.squadCategoryId,
      topic: 'ใช้ปุ่มด้านล่างเพื่อสร้าง Squad ของคุณ',
    });
  }
  
  // Delete old bot messages
  const messages = await squadControl.messages.fetch({ limit: 10 });
  for (const [, msg] of messages) {
    if (msg.author.id === client.user.id) {
      await msg.delete().catch(() => {});
    }
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🎮 Squad System')
    .setDescription('กดปุ่มด้านล่างเพื่อสร้าง Squad ของคุณ\n\nSquad จะมีห้องเสียงและห้องแชท สูงสุด 6 คน\nเมื่อห้องเสียงว่างเปล่า Squad จะถูกลบอัตโนมัติ')
    .setColor('#FF00FF');
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_squad')
        .setLabel('Create Squad')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕')
    );
  
  await squadControl.send({ embeds: [embed], components: [row] });
  console.log('Posted squad creation button');
}

async function postTicketButton(guild) {
  const channel = await guild.channels.fetch(config.channels.ticketSupport).catch(() => null);
  if (!channel) return;
  
  // Delete old bot messages
  const messages = await channel.messages.fetch({ limit: 10 });
  for (const [, msg] of messages) {
    if (msg.author.id === client.user.id) {
      await msg.delete().catch(() => {});
    }
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Support')
    .setDescription('หากคุณต้องการความช่วยเหลือ กดปุ่มด้านล่างเพื่อสร้าง Ticket')
    .setColor('#FFA500');
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );
  
  await channel.send({ embeds: [embed], components: [row] });
  console.log('Posted ticket creation button');
}

async function handleButtonInteraction(interaction) {
  const { customId, member, guild } = interaction;
  
  if (customId === 'verify') {
    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
    const unverifiedRole = guild.roles.cache.find(r => r.name === 'Unverified');
    
    if (member.roles.cache.has(verifiedRole.id)) {
      return await interaction.reply({ content: 'คุณได้รับการยืนยันแล้ว!', ephemeral: true });
    }
    
    await member.roles.add(verifiedRole);
    await member.roles.remove(unverifiedRole);
    
    await interaction.reply({ content: '✅ ยืนยันสำเร็จ! ยินดีต้อนรับสู่เซิร์ฟเวอร์', ephemeral: true });
  }
  
  else if (customId === 'scum_player') {
    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
    const scumPlayerRole = guild.roles.cache.find(r => r.name === 'SCUM Player');
    
    if (!member.roles.cache.has(verifiedRole.id)) {
      return await interaction.reply({ content: '❌ คุณต้องยืนยันตัวตนก่อน! กรุณาไปที่ช่อง #rules', ephemeral: true });
    }
    
    if (member.roles.cache.has(scumPlayerRole.id)) {
      return await interaction.reply({ content: 'คุณมียศ SCUM Player แล้ว!', ephemeral: true });
    }
    
    await member.roles.add(scumPlayerRole);
    await interaction.reply({ content: '✅ คุณได้รับยศ SCUM Player แล้ว!', ephemeral: true });
  }
  
  else if (customId === 'create_squad') {
    await createSquad(interaction);
  }
  
  else if (customId === 'invite_friend') {
    await showInviteFriendModal(interaction);
  }
  
  else if (customId === 'remove_friend') {
    await showRemoveFriendModal(interaction);
  }
  
  else if (customId === 'transfer_owner') {
    await showTransferOwnerModal(interaction);
  }
  
  else if (customId === 'delete_squad') {
    await deleteSquad(interaction);
  }
  
  else if (customId === 'create_ticket') {
    await createTicket(interaction);
  }
  
  else if (customId === 'close_ticket') {
    await closeTicket(interaction);
  }
}

async function createSquad(interaction) {
  const { member, guild } = interaction;
  
  // Check if user already has a squad
  for (const [voiceId, data] of squadChannels.entries()) {
    if (data.ownerId === member.id) {
      return await interaction.reply({ content: '❌ คุณมี Squad อยู่แล้ว!', ephemeral: true });
    }
  }
  
  await interaction.deferReply({ ephemeral: true });
  
  // Find next squad number
  const existingSquads = guild.channels.cache.filter(c => 
    c.parentId === config.squadCategoryId && c.name.startsWith('🎮・squad-')
  );
  let squadNumber = 1;
  while (existingSquads.some(c => c.name === `🎮・squad-${squadNumber.toString().padStart(2, '0')}`)) {
    squadNumber++;
  }
  const squadName = squadNumber.toString().padStart(2, '0');
  
  // Create voice channel
  const voiceChannel = await guild.channels.create({
    name: `🎮・Squad ${squadName}`,
    type: ChannelType.GuildVoice,
    parent: config.squadCategoryId,
    userLimit: 6,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
    ],
  });
  
  // Create text channel
  const textChannel = await guild.channels.create({
    name: `💬・squad-${squadName}`,
    type: ChannelType.GuildText,
    parent: config.squadCategoryId,
    topic: `Owner: <@${member.id}> | Voice: <#${voiceChannel.id}>`,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
    ],
  });
  
  // Store squad data
  squadChannels.set(voiceChannel.id, {
    textId: textChannel.id,
    ownerId: member.id,
  });
  
  // Send control panel in text channel
  const embed = new EmbedBuilder()
    .setTitle(`🎮 Squad ${squadName} Control Panel`)
    .setDescription(`Owner: <@${member.id}>\nVoice Channel: <#${voiceChannel.id}>\n\nใช้ปุ่มด้านล่างเพื่อจัดการ Squad`)
    .setColor('#FF00FF');
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('invite_friend')
        .setLabel('Invite Friend')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('remove_friend')
        .setLabel('Remove Friend')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖'),
      new ButtonBuilder()
        .setCustomId('transfer_owner')
        .setLabel('Transfer Owner')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👑'),
      new ButtonBuilder()
        .setCustomId('delete_squad')
        .setLabel('Delete Squad')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );
  
  await textChannel.send({ embeds: [embed], components: [row] });
  
  await interaction.editReply({ content: `✅ สร้าง Squad สำเร็จ!\nVoice: <#${voiceChannel.id}>\nText: <#${textChannel.id}>` });
}

async function showInviteFriendModal(interaction) {
  const { channel } = interaction;
  
  // Check if this is a squad text channel
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในช่อง Squad เท่านั้น', ephemeral: true });
  }
  
  const [voiceId, data] = squadData;
  
  // Check if user is the owner
  if (interaction.user.id !== data.ownerId) {
    return await interaction.reply({ content: '❌ เฉพาะเจ้าของ Squad เท่านั้นที่สามารถเชิญเพื่อนได้', ephemeral: true });
  }
  
  const modal = new ModalBuilder()
    .setCustomId('invite_friend_modal')
    .setTitle('Invite Friend to Squad');
  
  const userInput = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('User ID หรือ Mention')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('123456789012345678 หรือ @username')
    .setRequired(true);
  
  const row = new ActionRowBuilder().addComponents(userInput);
  modal.addComponents(row);
  
  await interaction.showModal(modal);
}

async function showRemoveFriendModal(interaction) {
  const { channel } = interaction;
  
  // Check if this is a squad text channel
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในช่อง Squad เท่านั้น', ephemeral: true });
  }
  
  const [voiceId, data] = squadData;
  
  // Check if user is the owner
  if (interaction.user.id !== data.ownerId) {
    return await interaction.reply({ content: '❌ เฉพาะเจ้าของ Squad เท่านั้นที่สามารถลบเพื่อนได้', ephemeral: true });
  }
  
  const modal = new ModalBuilder()
    .setCustomId('remove_friend_modal')
    .setTitle('Remove Friend from Squad');
  
  const userInput = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('User ID หรือ Mention')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('123456789012345678 หรือ @username')
    .setRequired(true);
  
  const row = new ActionRowBuilder().addComponents(userInput);
  modal.addComponents(row);
  
  await interaction.showModal(modal);
}

async function showTransferOwnerModal(interaction) {
  const { channel } = interaction;
  
  // Check if this is a squad text channel
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะในช่อง Squad เท่านั้น', ephemeral: true });
  }
  
  const [voiceId, data] = squadData;
  
  // Check if user is the owner
  if (interaction.user.id !== data.ownerId) {
    return await interaction.reply({ content: '❌ เฉพาะเจ้าของ Squad เท่านั้นที่สามารถโอนสิทธิ์ได้', ephemeral: true });
  }
  
  const modal = new ModalBuilder()
    .setCustomId('transfer_owner_modal')
    .setTitle('Transfer Squad Ownership');
  
  const userInput = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('User ID หรือ Mention ของเจ้าของคนใหม่')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('123456789012345678 หรือ @username')
    .setRequired(true);
  
  const row = new ActionRowBuilder().addComponents(userInput);
  modal.addComponents(row);
  
  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  const { customId } = interaction;
  
  if (customId === 'invite_friend_modal') {
    await inviteFriendToSquad(interaction);
  }
  
  else if (customId === 'remove_friend_modal') {
    await removeFriendFromSquad(interaction);
  }
  
  else if (customId === 'transfer_owner_modal') {
    await transferSquadOwner(interaction);
  }
}

async function inviteFriendToSquad(interaction) {
  const { channel, guild } = interaction;
  const userIdInput = interaction.fields.getTextInputValue('user_id');
  
  await interaction.deferReply({ ephemeral: true });
  
  // Get squad data
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.editReply({ content: '❌ ไม่พบข้อมูล Squad' });
  }
  
  const [voiceId, data] = squadData;
  
  // Parse user ID
  const userId = userIdInput.replace(/[<@!>]/g, '');
  const member = await guild.members.fetch(userId).catch(() => null);
  
  if (!member) {
    return await interaction.editReply({ content: '❌ ไม่พบผู้ใช้งาน' });
  }
  
  if (member.id === data.ownerId) {
    return await interaction.editReply({ content: '❌ คุณเป็นเจ้าของ Squad อยู่แล้ว' });
  }
  
  // Add permissions
  const voiceChannel = await guild.channels.fetch(voiceId);
  const textChannel = channel;
  
  await voiceChannel.permissionOverwrites.create(member, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
  });
  
  await textChannel.permissionOverwrites.create(member, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  
  await interaction.editReply({ content: `✅ เชิญ <@${member.id}> เข้า Squad สำเร็จ!` });
  await textChannel.send(`<@${member.id}> ถูกเชิญเข้า Squad โดย <@${interaction.user.id}>`);
}

async function removeFriendFromSquad(interaction) {
  const { channel, guild } = interaction;
  const userIdInput = interaction.fields.getTextInputValue('user_id');
  
  await interaction.deferReply({ ephemeral: true });
  
  // Get squad data
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.editReply({ content: '❌ ไม่พบข้อมูล Squad' });
  }
  
  const [voiceId, data] = squadData;
  
  // Parse user ID
  const userId = userIdInput.replace(/[<@!>]/g, '');
  const member = await guild.members.fetch(userId).catch(() => null);
  
  if (!member) {
    return await interaction.editReply({ content: '❌ ไม่พบผู้ใช้งาน' });
  }
  
  if (member.id === data.ownerId) {
    return await interaction.editReply({ content: '❌ ไม่สามารถลบเจ้าของ Squad ได้' });
  }
  
  // Remove permissions
  const voiceChannel = await guild.channels.fetch(voiceId);
  const textChannel = channel;
  
  await voiceChannel.permissionOverwrites.delete(member);
  await textChannel.permissionOverwrites.delete(member);
  
  // Disconnect from voice if in the channel
  if (member.voice.channelId === voiceId) {
    await member.voice.disconnect();
  }
  
  await interaction.editReply({ content: `✅ ลบ <@${member.id}> ออกจาก Squad สำเร็จ!` });
  await textChannel.send(`<@${member.id}> ถูกลบออกจาก Squad โดย <@${interaction.user.id}>`);
}

async function transferSquadOwner(interaction) {
  const { channel, guild } = interaction;
  const userIdInput = interaction.fields.getTextInputValue('user_id');
  
  await interaction.deferReply({ ephemeral: true });
  
  // Get squad data
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.editReply({ content: '❌ ไม่พบข้อมูล Squad' });
  }
  
  const [voiceId, data] = squadData;
  
  // Parse user ID
  const userId = userIdInput.replace(/[<@!>]/g, '');
  const member = await guild.members.fetch(userId).catch(() => null);
  
  if (!member) {
    return await interaction.editReply({ content: '❌ ไม่พบผู้ใช้งาน' });
  }
  
  if (member.id === data.ownerId) {
    return await interaction.editReply({ content: '❌ ผู้ใช้งานนี้เป็นเจ้าของ Squad อยู่แล้ว' });
  }
  
  // Update owner
  data.ownerId = member.id;
  
  // Update permissions to ensure new owner has full access
  const voiceChannel = await guild.channels.fetch(voiceId);
  const textChannel = channel;
  
  await voiceChannel.permissionOverwrites.create(member, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
  });
  
  await textChannel.permissionOverwrites.create(member, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  
  // Update topic
  await textChannel.setTopic(`Owner: <@${member.id}> | Voice: <#${voiceId}>`);
  
  await interaction.editReply({ content: `✅ โอนสิทธิ์ Squad ให้ <@${member.id}> สำเร็จ!` });
  await textChannel.send(`<@${member.id}> เป็นเจ้าของ Squad คนใหม่แล้ว!`);
}

async function deleteSquad(interaction) {
  const { channel, guild, member } = interaction;
  
  // Get squad data
  const squadData = [...squadChannels.entries()].find(([, data]) => data.textId === channel.id);
  if (!squadData) {
    return await interaction.reply({ content: '❌ ไม่พบข้อมูล Squad', ephemeral: true });
  }
  
  const [voiceId, data] = squadData;
  
  // Check if user is the owner
  if (member.id !== data.ownerId) {
    return await interaction.reply({ content: '❌ เฉพาะเจ้าของ Squad เท่านั้นที่สามารถลบได้', ephemeral: true });
  }
  
  await interaction.reply({ content: '🗑️ กำลังลบ Squad...', ephemeral: true });
  
  await cleanupSquad(voiceId);
}

async function cleanupSquad(voiceId) {
  const data = squadChannels.get(voiceId);
  if (!data) return;
  
  try {
    const voiceChannel = await client.channels.fetch(voiceId).catch(() => null);
    const textChannel = await client.channels.fetch(data.textId).catch(() => null);
    
    if (voiceChannel) await voiceChannel.delete();
    if (textChannel) await textChannel.delete();
    
    squadChannels.delete(voiceId);
    console.log(`Cleaned up squad: voice ${voiceId}, text ${data.textId}`);
  } catch (error) {
    console.error('Error cleaning up squad:', error);
  }
}

async function createTicket(interaction) {
  const { member, guild } = interaction;
  
  // Check if user already has an open ticket
  const existingTicketId = userTickets.get(member.id);
  if (existingTicketId) {
    const existingChannel = await guild.channels.fetch(existingTicketId).catch(() => null);
    if (existingChannel) {
      return await interaction.reply({ 
        content: `❌ คุณมี Ticket เปิดอยู่แล้ว: <#${existingTicketId}>`, 
        ephemeral: true 
      });
    } else {
      // Clean up stale entry
      userTickets.delete(member.id);
    }
  }
  
  await interaction.deferReply({ ephemeral: true });
  
  // Sanitize username
  const sanitizedUsername = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const channelName = `ticket-${sanitizedUsername}`;
  
  // Get Admin role
  const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
  
  // Create ticket channel
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    topic: `Ticket for <@${member.id}>`,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: adminRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
    ],
  });
  
  // Store ticket
  userTickets.set(member.id, ticketChannel.id);
  
  // Send welcome message in ticket
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Support')
    .setDescription(`สวัสดี <@${member.id}>!\n\nกรุณาอธิบายปัญหาของคุณ และทีมงานจะมาช่วยเหลือในเร็วๆ นี้`)
    .setColor('#FFA500');
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );
  
  await ticketChannel.send({ content: `<@${member.id}> ${adminRole}`, embeds: [embed], components: [row] });
  
  await interaction.editReply({ content: `✅ สร้าง Ticket สำเร็จ! <#${ticketChannel.id}>` });
}

async function closeTicket(interaction) {
  const { channel, member, guild } = interaction;
  
  // Get ticket owner from topic
  const topicMatch = channel.topic?.match(/<@(\d+)>/);
  if (!topicMatch) {
    return await interaction.reply({ content: '❌ ไม่พบข้อมูล Ticket', ephemeral: true });
  }
  
  const ticketOwnerId = topicMatch[1];
  const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
  
  // Check if user is ticket owner or admin
  if (member.id !== ticketOwnerId && !member.roles.cache.has(adminRole.id)) {
    return await interaction.reply({ content: '❌ เฉพาะเจ้าของ Ticket หรือ Admin เท่านั้นที่สามารถปิดได้', ephemeral: true });
  }
  
  await interaction.reply({ content: '🔒 กำลังปิด Ticket... (ช่องนี้จะถูกลบในอีก 5 วินาที)' });
  
  // Remove from tracking
  userTickets.delete(ticketOwnerId);
  
  // Delete after delay
  setTimeout(async () => {
    await channel.delete().catch(() => {});
  }, 5000);
}

client.login(process.env.DISCORD_TOKEN);
