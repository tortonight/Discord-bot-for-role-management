// Simple test to verify bot imports and basic structure
import { Client } from 'discord.js';
import { readFileSync } from 'fs';

console.log('Testing bot configuration...');

// Test config.json can be loaded
try {
  const config = JSON.parse(readFileSync('./config.json', 'utf-8'));
  console.log('✓ config.json loaded successfully');
  console.log(`  Guild ID: ${config.guildId}`);
  console.log(`  Channels configured: ${Object.keys(config.channels).length}`);
  console.log(`  Roles configured: ${Object.keys(config.roles).length}`);
  
  // Verify all required fields
  const requiredChannels = ['welcome', 'rules', 'howToJoin', 'faq', 'donationInfo', 'ticketSupport', 'tradingMarket'];
  const missingChannels = requiredChannels.filter(ch => !config.channels[ch]);
  if (missingChannels.length > 0) {
    console.log(`  ⚠ Missing channels: ${missingChannels.join(', ')}`);
  } else {
    console.log('  ✓ All required channels configured');
  }
  
  // Verify roles
  const requiredRoles = ['Admin', 'Moderator', 'GM', 'Verified', 'Unverified', 'SCUM Player', 'VIP', 'Muted', 'Bot'];
  const missingRoles = requiredRoles.filter(role => !config.roles[role]);
  if (missingRoles.length > 0) {
    console.log(`  ⚠ Missing roles: ${missingRoles.join(', ')}`);
  } else {
    console.log('  ✓ All required roles configured');
  }
  
  // Verify squadCategoryId
  if (config.squadCategoryId) {
    console.log(`  ✓ Squad category ID configured: ${config.squadCategoryId}`);
  } else {
    console.log('  ⚠ Squad category ID not configured');
  }

  // Verify support center category config (optional)
  if (config.supportCenterCategory?.name) {
    console.log(`  ✓ Support Center category name: ${config.supportCenterCategory.name}`);
    if (config.supportCenterCategory.id) {
      console.log(`  ✓ Support Center category ID configured: ${config.supportCenterCategory.id}`);
    } else {
      console.log('  ℹ Support Center category ID not set (bot will find/create by name)');
    }
  }
  
} catch (error) {
  console.error('✗ Error loading config.json:', error.message);
  process.exit(1);
}

// Test that Discord client can be created
try {
  const client = new Client({ intents: [] });
  console.log('✓ Discord client created successfully');
} catch (error) {
  console.error('✗ Error creating Discord client:', error.message);
  process.exit(1);
}

// Test .env.example exists
try {
  readFileSync('.env.example', 'utf-8');
  console.log('✓ .env.example exists');
} catch (error) {
  console.error('✗ .env.example not found');
  process.exit(1);
}

console.log('\n✓ All tests passed! Bot is ready to run.');
console.log('  Next steps:');
console.log('  1. Create .env file with your bot token');
console.log('  2. Run: npm start');
