# Discord Bot Features Overview

## 🎯 Core Features

### 1. Role Management System

#### Automated Role Creation
The bot automatically creates 9 roles with custom colors when it starts:

| Role | Color | Purpose |
|------|-------|---------|
| Admin | Red (#FF0000) | Server administrators |
| Moderator | Orange (#FFA500) | Server moderators |
| GM | Yellow (#FFFF00) | Game masters |
| Verified | Green (#00FF00) | Verified members |
| Unverified | Gray (#808080) | New/unverified members |
| SCUM Player | Blue (#0000FF) | Active game players |
| VIP | Magenta (#FF00FF) | VIP members |
| Muted | Black (#000000) | Muted members |
| Bot | Cyan (#00FFFF) | Bot accounts |

### 2. Verification System

#### New Member Flow
1. User joins server → Automatically receives "Unverified" role
2. User reads rules in #rules channel
3. User clicks "ยอมรับกฎ / Verify" button
4. Bot removes "Unverified" and grants "Verified" role
5. User gains access to main server channels

#### SCUM Player Role
- Button posted in #how-to-join channel
- Requires Verified role to obtain
- Grants access to trading-market channel

### 3. Channel Permissions System

#### Unverified Users
Can **only view** these channels:
- welcome
- rules
- how-to-join
- faq
- donation-info
- ticket-support

Cannot access general chat or other channels.

#### Verified Users
- View and send messages in general-chat
- View trading-market (but cannot send messages)
- Access to all non-restricted channels

#### SCUM Players
- All Verified permissions
- Can send messages in trading-market

#### Muted Users
- Cannot send messages in any channel
- Can still view channels based on other roles

### 4. Squad System

#### Creating a Squad
1. User clicks "➕・Create Squad" button in squad-control channel
2. Bot creates two paired channels:
   - **Voice**: "🎮・Squad NN" (limit: 6 members)
   - **Text**: "💬・squad-nn"
3. Both channels are private (only owner can see initially)

#### Squad Management Panel
In the squad text channel, the owner has access to:

**➕ Invite Friend**
- Opens modal to enter user ID or @mention
- Grants view/speak permissions in both channels
- Announces in squad text channel

**➖ Remove Friend**
- Opens modal to enter user ID or @mention
- Removes permissions from both channels
- Disconnects user from voice if currently connected
- Announces in squad text channel

**👑 Transfer Owner**
- Opens modal to enter new owner's ID or @mention
- Updates squad topic with new owner
- Ensures new owner has full permissions
- Announces ownership transfer

**🗑️ Delete Squad**
- Deletes both voice and text channels
- Only owner can delete
- Permanent action

#### Automatic Features

**Auto-Cleanup**
- When voice channel becomes empty (no non-bot members)
- Bot waits 10 seconds
- If still empty, deletes both voice and text channels
- Prevents abandoned squad channels

**Voice Limit Enforcement**
- Squad voice channels limited to 6 members
- If a 7th person tries to join:
  - Bot immediately disconnects them
  - Sends them a DM explaining the limit
  - Preserves the 6-member limit

### 5. Ticket System

#### Creating a Ticket
1. User clicks "Create Ticket" button in #ticket-support
2. Bot creates private channel: `ticket-username`
3. Channel permissions:
   - Ticket creator: Can view/send messages
   - Admin role: Can view/send messages
   - Everyone else: Cannot see the channel

#### Ticket Features

**Single Ticket Limit**
- Users can only have one open ticket at a time
- If user tries to create another, bot points to existing ticket
- Prevents ticket spam

**Username Sanitization**
- Removes special characters from username
- Creates clean channel name
- Limited to 20 characters

**Closing Tickets**
- "🔒 Close Ticket" button in ticket channel
- Can be clicked by:
  - Ticket owner
  - Admin role members
- 5-second delay before deletion
- Allows final messages/screenshots

## 🛠️ Technical Details

### Built With
- **discord.js v14** - Latest Discord API wrapper
- **Node.js** - Runtime environment
- **ES Modules** - Modern JavaScript syntax

### Configuration
All settings stored in `config.json`:
- Guild ID
- Channel IDs (10 channels)
- Squad category ID
- Role definitions with colors

### Security
- ✅ Bot token stored in `.env` (not committed to git)
- ✅ Permission checks on all actions
- ✅ Input sanitization for usernames
- ✅ Role hierarchy respected
- ✅ No SQL injection risks (no database)
- ✅ 0 vulnerabilities in CodeQL scan

### Error Handling
- Try-catch blocks around all interactions
- Graceful fallbacks for missing channels/roles
- User-friendly error messages (Thai/English)
- Detailed console logging for debugging

## 📋 Bot Permissions Required

### Administrator (Simplest)
Permission Integer: `8`

### Least-Privilege (Recommended)
- Manage Roles
- Manage Channels
- View Channels
- Send Messages
- Manage Messages
- Read Message History
- Add Reactions
- Move Members
- Use External Emojis

Permission Integer: `285220928`

## 🚀 Getting Started

1. Clone repository
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Add your bot token to `.env`
5. Update channel IDs in `config.json` if needed
6. Run `npm test` to verify configuration
7. Run `npm start` to start the bot

## 📝 Usage Examples

### For Regular Users

**Get Verified:**
```
#rules → Click "ยอมรับกฎ / Verify" → Access granted
```

**Get SCUM Player Role:**
```
#how-to-join → Click "รับยศ SCUM Player" → Role granted
```

**Create a Squad:**
```
squad-control → Click "➕・Create Squad" → Squad created
```

**Invite Friend to Squad:**
```
In squad text → Click "Invite Friend" → Enter @friend → Friend added
```

**Get Support:**
```
#ticket-support → Click "Create Ticket" → Private ticket created
```

### For Admins

**Close User Ticket:**
```
Any ticket channel → Click "Close Ticket" → Ticket deleted
```

**Manage Permissions:**
- All permissions set automatically on bot startup
- Roles managed through Discord's role system
- Manual adjustments persist (bot uses `edit` not `set`)

## 🎮 Squad System Details

### Voice Channel Features
- Name: 🎮・Squad NN (auto-numbered)
- Limit: 6 members exactly
- Private by default (only invited members)
- Auto-deletes when empty

### Text Channel Features
- Name: 💬・squad-nn (matches voice number)
- Topic: Shows owner and linked voice channel
- Control panel with 4 buttons
- Private (matches voice permissions)
- Auto-deletes with voice channel

### Owner Responsibilities
- Invite/remove members
- Transfer ownership if needed
- Delete squad when done
- Ownership shown in channel topic

## 🎫 Ticket System Details

### Channel Naming
- Format: `ticket-username`
- Sanitized (removes special characters)
- Limited to 20 characters
- Unique per user

### Access Control
- **Ticket Owner**: Full access
- **Admin Role**: Full access
- **Everyone Else**: No access

### Lifecycle
1. Created on demand
2. Tracked in memory (prevents duplicates)
3. Closed by owner or admin
4. 5-second deletion delay
5. Removed from tracking

## 🔄 Automatic Behaviors

### On Member Join
- Assign Unverified role immediately
- Welcome (if welcome channel configured)

### On Voice Channel Empty
- Wait 10 seconds
- Check again if still empty
- Delete squad if confirmed empty

### On 7th Member Join Squad Voice
- Immediately disconnect the joiner
- Send explanatory DM
- Preserve 6-member limit

### On Bot Startup
- Create missing roles
- Update role colors if changed
- Apply channel permissions
- Post all button panels
- Ready to accept interactions

## 📊 Statistics

- **Lines of Code**: ~900 in index.js
- **Features**: 15+ major features
- **Buttons**: 7 interactive buttons
- **Modals**: 3 input modals
- **Event Handlers**: 4 events
- **Roles Managed**: 9 roles
- **Channels Configured**: 10 channels
- **Permission Overwrites**: ~15 per channel

## 🎨 User Interface

All interactions use Discord's modern UI components:
- **Embeds**: Rich formatted messages with colors
- **Buttons**: Clickable interactions
- **Modals**: Pop-up forms for input
- **Emojis**: Visual indicators (✅ ❌ 🎮 💬 🎫 etc.)
- **Mentions**: @user and #channel mentions
- **Ephemeral Messages**: Private responses only visible to user
