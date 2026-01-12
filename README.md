# Discord Bot for Role Management

A comprehensive Discord bot built with discord.js v14 that manages roles, verification, squad systems, and ticket support.

## Features

### 1. Automated Role Setup & Verification
- **Automated Role Creation**: Creates 9 roles with custom colors (Admin, Moderator, GM, Verified, Unverified, SCUM Player, VIP, Muted, Bot)
- **Verification Flow**: 
  - Posts a "ยอมรับกฎ / Verify" button in #rules channel that grants Verified and removes Unverified role
  - Auto-assigns Unverified role when new members join
- **SCUM Player Role**: Posts a "รับยศ SCUM Player" button in #how-to-join (requires Verified role)

### 2. Channel Permission System
- **Unverified Users**: Can only view welcome, rules, how-to-join, faq, donation-info, and ticket-support channels
- **Verified Users**: Gain access to general chat and other channels
- **SCUM Player Role**: Required to send messages in trading-market channel
- **Muted Role**: Prevents sending messages across all channels

### 3. Squad System
- **Create Squad**: Users can create private squad channels (1 voice + 1 text channel)
  - Voice channel: "🎮・Squad NN" with 6-member limit
  - Text channel: "💬・squad-nn" with control panel
- **Squad Management**:
  - **Invite Friend**: Add users to your squad (via modal with user ID/mention)
  - **Remove Friend**: Remove users and disconnect them from voice
  - **Transfer Owner**: Transfer squad ownership to another user
  - **Delete Squad**: Delete both voice and text channels
- **Auto-Cleanup**: Squads automatically deleted when voice channel is empty for 10 seconds
- **Voice Limit Enforcement**: Automatically disconnects users if more than 6 members try to join

### 4. Ticket System
- **Create Ticket**: Users can create private support tickets
- **Private Channels**: Only ticket owner and Admin role can view
- **Single Ticket Limit**: Prevents multiple open tickets per user
- **Close Ticket**: Owner or Admin can close (deletes channel after 5-second delay)

## Setup Instructions

### Prerequisites
- Node.js 16.x or higher
- A Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- Administrator permissions on your Discord server

### Installation

1. Clone the repository:
```bash
git clone https://github.com/tortonight/Discord-bot-for-role-management.git
cd Discord-bot-for-role-management
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Add your Discord bot token to `.env`:
```
DISCORD_TOKEN=your_bot_token_here
```

5. Review and update `config.json` with your server's channel IDs if needed:
   - The file includes pre-configured IDs for guild 1443821243370573836
   - Update channel IDs if you're using a different server

6. Test the configuration (optional):
```bash
npm test
```

This will verify that all configuration files are properly set up.

### Bot Permissions

The bot requires the following permissions:

#### Option 1: Administrator (Simplest)
- Permission Integer: `8`
- This grants all permissions needed for the bot to function

#### Option 2: Least-Privilege (Recommended for Production)
Required permissions:
- Manage Roles (`268435456`)
- Manage Channels (`16`)
- View Channels (`1024`)
- Send Messages (`2048`)
- Manage Messages (`8192`)
- Read Message History (`65536`)
- Add Reactions (`64`)
- Move Members (`16777216`)
- Use External Emojis (`262144`)

Combined Permission Integer: `285220928`

### Invite URL
Replace `YOUR_BOT_CLIENT_ID` with your bot's client ID:

**Administrator:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=8&scope=bot
```

**Least-Privilege:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=285220928&scope=bot
```

### Running the Bot

Start the bot:
```bash
npm start
```

The bot will:
1. Connect to Discord
2. Create all required roles (if they don't exist)
3. Apply channel permissions
4. Post verification, squad, and ticket buttons
5. Start listening for interactions

## Configuration

### config.json Structure

```json
{
  "guildId": "your_guild_id",
  "channels": {
    "welcome": "channel_id",
    "rules": "channel_id",
    "howToJoin": "channel_id",
    "faq": "channel_id",
    "donationInfo": "channel_id",
    "ticketSupport": "channel_id",
    "announcements": "channel_id",
    "generalChat": "channel_id",
    "reportCenter": "channel_id",
    "tradingMarket": "channel_id"
  },
  "squadCategoryId": "category_id_for_squads",
  "roles": {
    "Admin": { "name": "Admin", "color": "#FF0000" },
    // ... other roles
  }
}
```

## Usage

### For Server Members

1. **Verification**: Go to #rules and click "ยอมรับกฎ / Verify" to get verified
2. **Get SCUM Player Role**: After verification, go to #how-to-join and click "รับยศ SCUM Player"
3. **Create Squad**: Find the squad-control channel and click "➕・Create Squad"
4. **Create Ticket**: Go to #ticket-support and click "Create Ticket"

### For Squad Owners

In your squad's text channel:
- **Invite Friend**: Click button and enter user ID or @mention
- **Remove Friend**: Click button and enter user ID or @mention
- **Transfer Owner**: Click button and enter new owner's ID or @mention
- **Delete Squad**: Click button to delete both voice and text channels

## Technical Details

- **Framework**: discord.js v14
- **Node.js**: ES Modules (type: "module")
- **Environment Variables**: Managed via dotenv
- **Configuration**: JSON-based configuration file

## Troubleshooting

### Bot doesn't respond
- Check that the bot has proper permissions in your server
- Verify the token in `.env` is correct
- Check console for error messages

### Interaction Failed / "การโต้ตอบนี้ล้มเหลว"
- **Verify button fails**: Ensure the bot's role is positioned higher than "Verified" and "Unverified" roles in the server's role hierarchy
- **Role not found**: Check that roles were created during bot startup (look for "Created role:" messages in console)
- **Permission denied**: Bot needs "Manage Roles" permission
- **Timing issue**: If bot just started, wait a few seconds and try again

### Roles not being assigned
- Ensure bot's role is higher than the roles it's trying to assign
- Check bot has "Manage Roles" permission
- Verify roles exist (check role list in server settings)

### Channels not being created
- Verify bot has "Manage Channels" permission
- Check that the squad category ID in config.json is correct

### Buttons not working
- Ensure bot has "Send Messages" and "Read Message History" permissions
- Check console for interaction errors
- Try restarting the bot to re-post button panels

## License

ISC

## Support

For issues or questions, please create a ticket in your Discord server or open an issue on GitHub.