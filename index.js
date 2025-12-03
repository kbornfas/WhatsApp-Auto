/**
 * WhatsApp Automation CLI Tool
 * 
 * ⚠️  WARNING - BAN RISK NOTICE ⚠️
 * ================================
 * This tool automates WhatsApp actions. Using automation with WhatsApp
 * violates their Terms of Service and can result in:
 * - Temporary account suspension
 * - Permanent account ban
 * - Loss of all chat history
 * 
 * USE AT YOUR OWN RISK. The developers are not responsible for any
 * consequences resulting from the use of this tool.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const {
    groupName,
    numbers,
    messageTemplates,
    settings
} = config;

const { minDelaySeconds, maxDelaySeconds, countryCode } = settings;

// Readline interface for user input
let rl;

// Store WhatsApp contacts fetched from connected account
let whatsappContacts = [];

// Store imported contacts from file (txt, csv, vcf)
let importedContacts = [];

// Current working contact list (can be config, WhatsApp, or imported contacts)
let activeContactList = numbers;
let activeContactSource = 'config';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitizes a phone number to WhatsApp ID format (number@c.us)
 */
function sanitizeNumber(number) {
    let cleaned = number.toString().replace(/\D/g, '');
    if (cleaned.length === 10) {
        cleaned = countryCode + cleaned;
    }
    return `${cleaned}@c.us`;
}

/**
 * Generates a random delay between min and max seconds
 */
function getRandomDelay() {
    const delaySeconds = Math.floor(Math.random() * (maxDelaySeconds - minDelaySeconds + 1)) + minDelaySeconds;
    return delaySeconds * 1000;
}

/**
 * Waits for a specified amount of time
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Logs a message with timestamp
 */
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
        info: 'ℹ️ ',
        success: '✅',
        warning: '⚠️ ',
        error: '❌',
        menu: '📋'
    };
    console.log(`[${timestamp}] ${icons[type] || ''} ${message}`);
}

/**
 * Prompts user for input
 */
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

/**
 * Clears console and shows header
 */
function showHeader() {
    console.clear();
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         📱 WhatsApp Automation CLI Tool                  ║');
    console.log('║         ⚠️  Use at your own risk - Ban possible!         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
}

// ============================================
// MAIN CLIENT INITIALIZATION
// ============================================

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './auth_info'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// ============================================
// EVENT HANDLERS
// ============================================

client.on('qr', (qr) => {
    console.log('\n');
    log('Scan this QR code with WhatsApp to authenticate:', 'info');
    console.log('');
    qrcode.generate(qr, { small: true });
    console.log('');
    log('QR Code will refresh if not scanned in time', 'warning');
});

client.on('ready', async () => {
    log('WhatsApp client is ready!', 'success');
    log(`Logged in as: ${client.info.pushname}`, 'info');
    console.log('');
    
    // Initialize readline for user input
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    // Show the main menu
    await showMainMenu();
});

client.on('authenticated', () => {
    log('Session authenticated successfully!', 'success');
});

client.on('auth_failure', (msg) => {
    log(`Authentication failed: ${msg}`, 'error');
    log('Please delete the auth_info folder and try again', 'warning');
});

client.on('disconnected', (reason) => {
    log(`Client disconnected: ${reason}`, 'warning');
});

// ============================================
// MENU SYSTEM
// ============================================

/**
 * Displays the main menu and handles user selection
 */
async function showMainMenu() {
    showHeader();
    
    console.log(`📊 Config contacts: ${numbers.length}`);
    console.log(`📱 WhatsApp contacts: ${whatsappContacts.length}`);
    console.log(`📁 Imported contacts: ${importedContacts.length}`);
    console.log(`✅ Active source: ${activeContactSource.toUpperCase()} (${activeContactList.length} contacts)\n`);
    
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                      MAIN MENU                          │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  1. 📤 Send Messages                                    │');
    console.log('│  2. 👥 Create Group & Add Contacts                      │');
    console.log('│  3. 📋 View Contacts                                    │');
    console.log('│  4. 📱 Fetch WhatsApp Contacts                          │');
    console.log('│  5. 📥 Import Contacts (TXT/CSV/VCF)                    │');
    console.log('│  6. 🔄 Switch Contact Source                            │');
    console.log('│  7. ⚙️  Settings Info                                    │');
    console.log('│  8. 🚪 Exit                                             │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');
    
    const choice = await prompt('Select an option (1-8): ');
    
    switch (choice) {
        case '1':
            await showMessageMenu();
            break;
        case '2':
            await showGroupMenu();
            break;
        case '3':
            await viewContacts();
            break;
        case '4':
            await fetchWhatsAppContacts();
            break;
        case '5':
            await importContactsMenu();
            break;
        case '6':
            await switchContactSource();
            break;
        case '7':
            await showSettings();
            break;
        case '8':
            await exitApp();
            break;
        default:
            log('Invalid option. Please try again.', 'warning');
            await sleep(1500);
            await showMainMenu();
    }
}

/**
 * Message sending menu - Choose mode first, then compose message
 */
async function showMessageMenu() {
    showHeader();
    
    console.log(`📊 Active source: ${activeContactSource.toUpperCase()} (${activeContactList.length} contacts)\n`);
    
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                   📤 SEND MESSAGES                      │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  Choose who to send to:                                 │');
    console.log('│                                                         │');
    console.log('│  1. 📝 Single Contact (enter phone number)              │');
    console.log('│  2. 📦 Batch of Contacts (50, 100, 200, 500, 1000)      │');
    console.log('│  3. 📢 ALL Contacts                                     │');
    console.log('│  4. 🔙 Back to Main Menu                                │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');
    
    const choice = await prompt('Select send mode (1-4): ');
    
    if (choice === '4') {
        await showMainMenu();
        return;
    }
    
    if (!['1', '2', '3'].includes(choice)) {
        log('Invalid option. Please try again.', 'warning');
        await sleep(1500);
        await showMessageMenu();
        return;
    }
    
    // Store the send mode and get recipients
    let sendMode = choice;
    let recipients = [];
    let batchInfo = '';
    
    // Step 1: Determine recipients based on mode
    if (sendMode === '1') {
        // Single contact
        showHeader();
        console.log('📝 SINGLE CONTACT MODE\n');
        const phoneNumber = await prompt('Enter phone number (with country code, e.g., 1234567890): ');
        
        if (!phoneNumber) {
            log('No number provided.', 'warning');
            await sleep(1500);
            await showMessageMenu();
            return;
        }
        recipients = [phoneNumber];
        batchInfo = `1 contact: ${phoneNumber}`;
        
    } else if (sendMode === '2') {
        // Batch mode
        showHeader();
        console.log('📦 BATCH MODE\n');
        console.log(`Active source: ${activeContactSource.toUpperCase()}`);
        console.log(`Total contacts: ${activeContactList.length}\n`);
        
        console.log('Select batch size:');
        console.log('  1. 50 contacts');
        console.log('  2. 100 contacts');
        console.log('  3. 200 contacts');
        console.log('  4. 500 contacts');
        console.log('  5. 1000 contacts');
        console.log('  6. Custom batch size');
        console.log('  7. Back\n');
        
        const batchChoice = await prompt('Select batch size (1-7): ');
        
        if (batchChoice === '7') {
            await showMessageMenu();
            return;
        }
        
        const batchSizes = { '1': 50, '2': 100, '3': 200, '4': 500, '5': 1000 };
        let batchSize;
        
        if (batchChoice === '6') {
            const customSize = await prompt('Enter custom batch size: ');
            batchSize = parseInt(customSize);
        } else if (batchSizes[batchChoice]) {
            batchSize = batchSizes[batchChoice];
        } else {
            log('Invalid option.', 'warning');
            await sleep(1500);
            await showMessageMenu();
            return;
        }
        
        if (isNaN(batchSize) || batchSize <= 0) {
            log('Invalid batch size.', 'warning');
            await sleep(1500);
            await showMessageMenu();
            return;
        }
        
        const totalBatches = Math.ceil(activeContactList.length / batchSize);
        console.log(`\nTotal batches available: ${totalBatches}`);
        
        const startBatch = await prompt('Start from batch number (default 1): ') || '1';
        const batchNum = parseInt(startBatch) - 1;
        
        const startIdx = batchNum * batchSize;
        const endIdx = Math.min(startIdx + batchSize, activeContactList.length);
        recipients = activeContactList.slice(startIdx, endIdx);
        batchInfo = `Batch ${batchNum + 1}: ${recipients.length} contacts (${startIdx + 1} to ${endIdx})`;
        
    } else if (sendMode === '3') {
        // All contacts
        recipients = activeContactList;
        batchInfo = `ALL ${activeContactList.length} contacts`;
    }
    
    if (recipients.length === 0) {
        log('No recipients selected.', 'warning');
        await sleep(1500);
        await showMessageMenu();
        return;
    }
    
    // Step 2: Compose the message
    showHeader();
    console.log('✍️  COMPOSE YOUR MESSAGE\n');
    console.log(`Recipients: ${batchInfo}\n`);
    console.log('─'.repeat(57));
    console.log(`Default message: "${messageTemplates.bulkMessage}"`);
    console.log('─'.repeat(57));
    console.log('');
    
    const useDefault = await prompt('Use default message? (y/n): ');
    
    let message;
    if (useDefault.toLowerCase() === 'y') {
        message = messageTemplates.bulkMessage;
    } else {
        console.log('\nType your message below (press Enter when done):');
        message = await prompt('> ');
    }
    
    if (!message) {
        log('No message provided.', 'warning');
        await sleep(1500);
        await showMessageMenu();
        return;
    }
    
    // Step 3: Confirm and send
    showHeader();
    console.log('📨 CONFIRM & SEND\n');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                    MESSAGE PREVIEW                      │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  To: ${batchInfo.substring(0, 49).padEnd(49)}│`);
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  Message:                                               │');
    
    // Word wrap the message for display
    const msgLines = message.match(/.{1,53}/g) || [message];
    msgLines.slice(0, 5).forEach(line => {
        console.log(`│  ${line.padEnd(53)}│`);
    });
    if (msgLines.length > 5) {
        console.log(`│  ... (${msgLines.length - 5} more lines)                                   │`);
    }
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');
    
    // Different confirmation for different modes
    let confirm;
    if (sendMode === '3' && recipients.length > 10) {
        console.log(`⚠️  WARNING: You are about to send to ${recipients.length} contacts!`);
        console.log('This action cannot be undone!\n');
        confirm = await prompt('Type "SEND" to confirm: ');
        confirm = confirm === 'SEND' ? 'y' : 'n';
    } else {
        confirm = await prompt('Send message now? (y/n): ');
    }
    
    if (confirm.toLowerCase() === 'y') {
        await sendMessagesToList(recipients, message);
    } else {
        log('Operation cancelled.', 'info');
    }
    
    await prompt('\nPress Enter to continue...');
    await showMessageMenu();
}

/**
 * Sends messages to a list of numbers
 */
async function sendMessagesToList(numberList, message) {
    let successCount = 0;
    let failCount = 0;
    
    console.log('');
    log(`Starting to send messages to ${numberList.length} contacts...`, 'info');
    console.log('');
    
    for (let i = 0; i < numberList.length; i++) {
        const contact = numberList[i];
        // Handle both WhatsApp contact objects and plain numbers
        const isWhatsAppContact = typeof contact === 'object' && contact.id;
        const numberId = isWhatsAppContact ? contact.id._serialized : sanitizeNumber(contact);
        const displayName = isWhatsAppContact ? (contact.name || contact.pushname || contact.number) : contact;
        
        log(`[${i + 1}/${numberList.length}] Sending to: ${displayName}`, 'info');
        
        // Anti-ban delay
        const delay = getRandomDelay();
        log(`Waiting ${Math.round(delay / 1000)} seconds (anti-ban)...`, 'warning');
        await sleep(delay);
        
        try {
            await client.sendMessage(numberId, message);
            log(`Message sent to ${displayName}`, 'success');
            successCount++;
        } catch (error) {
            log(`Failed to send to ${displayName}: ${error.message}`, 'error');
            failCount++;
        }
    }
    
    console.log('');
    log('═'.repeat(50), 'info');
    log('SUMMARY', 'info');
    log('═'.repeat(50), 'info');
    log(`Total: ${numberList.length}`, 'info');
    log(`Sent successfully: ${successCount}`, 'success');
    log(`Failed: ${failCount}`, 'error');
}

// ============================================
// GROUP MENU
// ============================================

/**
 * Group management menu
 */
async function showGroupMenu() {
    showHeader();
    
    console.log(`📊 Group Name: "${groupName}"`);
    console.log(`📊 Active source: ${activeContactSource.toUpperCase()}`);
    console.log(`📊 Contacts loaded: ${activeContactList.length}\n`);
    
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│               👥 GROUP MANAGEMENT                       │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  1. ➕ Create Group & Add in Batches of 50              │');
    console.log('│  2. ➕ Create Group & Add in Batches of 100             │');
    console.log('│  3. ➕ Create Group & Add in Batches of 200             │');
    console.log('│  4. ➕ Create Group & Add in Batches of 500             │');
    console.log('│  5. ➕ Create Group & Add in Batches of 1000            │');
    console.log('│  6. ➕ Create Group & Add ALL Contacts                  │');
    console.log('│  7. 🔗 Get Invite Link for Existing Group               │');
    console.log('│  8. 🔙 Back to Main Menu                                │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');
    
    const choice = await prompt('Select an option (1-8): ');
    
    const batchSizes = { '1': 50, '2': 100, '3': 200, '4': 500, '5': 1000, '6': activeContactList.length };
    
    switch (choice) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
            await createGroupAndAddContacts(batchSizes[choice]);
            break;
        case '7':
            await getGroupInviteLink();
            break;
        case '8':
            await showMainMenu();
            break;
        default:
            log('Invalid option. Please try again.', 'warning');
            await sleep(1500);
            await showGroupMenu();
    }
}

/**
 * Creates a group and adds contacts in specified batch size
 */
async function createGroupAndAddContacts(batchSize) {
    showHeader();
    
    const actualBatch = Math.min(batchSize, activeContactList.length);
    console.log(`👥 CREATE GROUP & ADD ${actualBatch} CONTACTS\n`);
    console.log(`Using contacts from: ${activeContactSource.toUpperCase()}\n`);
    
    const customGroupName = await prompt(`Group name (default: "${groupName}"): `) || groupName;
    
    console.log(`\n⚠️  This will:`);
    console.log(`   - Find or create group "${customGroupName}"`);
    console.log(`   - Attempt to add ${actualBatch} contacts`);
    console.log(`   - Send invite link to those who can't be added directly\n`);
    
    const confirm = await prompt('Proceed? (y/n): ');
    
    if (confirm.toLowerCase() !== 'y') {
        log('Operation cancelled.', 'info');
        await prompt('\nPress Enter to continue...');
        await showGroupMenu();
        return;
    }
    
    try {
        // Step 1: Find or create group
        log('Searching for existing group...', 'info');
        const chats = await client.getChats();
        let groupChat = chats.find(chat => 
            chat.isGroup && chat.name.toLowerCase() === customGroupName.toLowerCase()
        );
        
        if (groupChat) {
            log(`Found existing group: "${groupChat.name}"`, 'success');
        } else {
            log(`Creating new group: "${customGroupName}"...`, 'info');
            
            await sleep(getRandomDelay());
            
            const firstNumberId = activeContactSource === 'whatsapp' 
                ? activeContactList[0].id._serialized 
                : sanitizeNumber(activeContactList[0]);
            const createResult = await client.createGroup(customGroupName, [firstNumberId]);
            groupChat = await client.getChatById(createResult.gid._serialized);
            log(`Created new group: "${customGroupName}"`, 'success');
        }
        
        // Step 2: Get invite link
        await sleep(getRandomDelay());
        let inviteLink;
        try {
            const inviteCode = await groupChat.getInviteCode();
            inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            log(`Invite link: ${inviteLink}`, 'info');
        } catch (e) {
            inviteLink = '[Invite link unavailable]';
            log('Could not get invite link', 'warning');
        }
        
        // Step 3: Add contacts
        const contactsToAdd = activeContactList.slice(0, actualBatch);
        await addContactsToGroup(groupChat, contactsToAdd, inviteLink, customGroupName);
        
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
    
    await prompt('\nPress Enter to continue...');
    await showGroupMenu();
}

/**
 * Adds contacts to a group with fallback invite
 */
async function addContactsToGroup(groupChat, contactList, inviteLink, grpName) {
    let successCount = 0;
    let fallbackCount = 0;
    let failCount = 0;
    
    console.log('');
    log(`Adding ${contactList.length} contacts to group...`, 'info');
    console.log('');
    
    for (let i = 0; i < contactList.length; i++) {
        const contact = contactList[i];
        // Handle both WhatsApp contact objects and plain numbers
        const isWhatsAppContact = typeof contact === 'object' && contact.id;
        const numberId = isWhatsAppContact ? contact.id._serialized : sanitizeNumber(contact);
        const displayName = isWhatsAppContact ? (contact.name || contact.pushname || contact.number) : contact;
        
        log(`[${i + 1}/${contactList.length}] Processing: ${displayName}`, 'info');
        
        // Anti-ban delay
        const delay = getRandomDelay();
        log(`Waiting ${Math.round(delay / 1000)} seconds (anti-ban)...`, 'warning');
        await sleep(delay);
        
        try {
            const addResult = await groupChat.addParticipants([numberId]);
            const resultStatus = addResult[numberId];
            
            if (resultStatus === 200 || resultStatus === true) {
                log(`Added ${displayName} to group`, 'success');
                successCount++;
            } else if (resultStatus === 409) {
                log(`${displayName} is already in the group`, 'info');
                successCount++;
            } else {
                throw new Error(`Status: ${resultStatus}`);
            }
        } catch (addError) {
            log(`Failed to add ${displayName}: ${addError.message}`, 'warning');
            
            // Send fallback invite
            try {
                await sleep(2000);
                const fallbackMsg = messageTemplates.inviteFallback
                    .replace('{groupName}', grpName)
                    .replace('{inviteLink}', inviteLink);
                await client.sendMessage(numberId, fallbackMsg);
                log(`Sent invite link to ${displayName}`, 'success');
                fallbackCount++;
            } catch (sendError) {
                log(`Could not send invite to ${displayName}: ${sendError.message}`, 'error');
                failCount++;
            }
        }
    }
    
    console.log('');
    log('═'.repeat(50), 'info');
    log('SUMMARY', 'info');
    log('═'.repeat(50), 'info');
    log(`Total processed: ${contactList.length}`, 'info');
    log(`Successfully added: ${successCount}`, 'success');
    log(`Sent invite link: ${fallbackCount}`, 'warning');
    log(`Failed completely: ${failCount}`, 'error');
}

/**
 * Get invite link for existing group
 */
async function getGroupInviteLink() {
    showHeader();
    console.log('🔗 GET GROUP INVITE LINK\n');
    
    const searchName = await prompt(`Enter group name to search (default: "${groupName}"): `) || groupName;
    
    log(`Searching for group "${searchName}"...`, 'info');
    
    try {
        const chats = await client.getChats();
        const groupChat = chats.find(chat => 
            chat.isGroup && chat.name.toLowerCase() === searchName.toLowerCase()
        );
        
        if (groupChat) {
            const inviteCode = await groupChat.getInviteCode();
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            
            console.log('');
            log(`Group found: "${groupChat.name}"`, 'success');
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║  INVITE LINK:                                            ║');
            console.log(`║  ${inviteLink}`);
            console.log('╚══════════════════════════════════════════════════════════╝');
        } else {
            log(`Group "${searchName}" not found.`, 'error');
        }
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
    
    await prompt('\nPress Enter to continue...');
    await showGroupMenu();
}

// ============================================
// OTHER MENU OPTIONS
// ============================================

/**
 * View loaded contacts
 */
async function viewContacts() {
    showHeader();
    console.log('📋 VIEW CONTACTS\n');
    
    console.log('Select which contacts to view:');
    console.log(`  1. Config contacts (${numbers.length})`);
    console.log(`  2. WhatsApp contacts (${whatsappContacts.length})`);
    console.log(`  3. Imported contacts (${importedContacts.length})`);
    console.log(`  4. Active contacts - ${activeContactSource} (${activeContactList.length})`);
    console.log('  5. Back\n');
    
    const source = await prompt('Select option (1-5): ');
    
    let contactsToShow;
    let sourceName;
    
    switch (source) {
        case '1':
            contactsToShow = numbers;
            sourceName = 'Config';
            break;
        case '2':
            contactsToShow = whatsappContacts;
            sourceName = 'WhatsApp';
            break;
        case '3':
            contactsToShow = importedContacts;
            sourceName = 'Imported';
            break;
        case '4':
            contactsToShow = activeContactList;
            sourceName = activeContactSource;
            break;
        case '5':
            await showMainMenu();
            return;
        default:
            contactsToShow = activeContactList;
            sourceName = activeContactSource;
    }
    
    if (contactsToShow.length === 0) {
        log('No contacts in this list.', 'warning');
        await prompt('\nPress Enter to continue...');
        await viewContacts();
        return;
    }
    
    console.log(`\n📋 ${sourceName.toUpperCase()} CONTACTS`);
    console.log(`Total: ${contactsToShow.length} contacts\n`);
    
    const showAll = await prompt('Show all contacts? (y/n, default shows first 20): ');
    
    const displayCount = showAll.toLowerCase() === 'y' ? contactsToShow.length : Math.min(20, contactsToShow.length);
    
    console.log('');
    
    if (sourceName === 'WhatsApp' || sourceName === 'Imported' || (sourceName === activeContactSource && (activeContactSource === 'whatsapp' || activeContactSource === 'imported'))) {
        // WhatsApp/Imported contacts have name and number
        console.log('┌──────┬─────────────────────────┬─────────────────────────┐');
        console.log('│  #   │  Name                   │  Number                 │');
        console.log('├──────┼─────────────────────────┼─────────────────────────┤');
        
        for (let i = 0; i < displayCount; i++) {
            const contact = contactsToShow[i];
            const name = (contact.name || contact.pushname || 'Unknown').substring(0, 20).padEnd(20);
            const num = (contact.number || '').toString().padEnd(20);
            const idx = (i + 1).toString().padStart(4);
            console.log(`│ ${idx} │  ${name}   │  ${num}   │`);
        }
        
        if (displayCount < contactsToShow.length) {
            console.log(`│ ...  │  (${contactsToShow.length - displayCount} more contacts)       │                         │`);
        }
        
        console.log('└──────┴─────────────────────────┴─────────────────────────┘');
    } else {
        // Config contacts are just numbers
        console.log('┌──────┬─────────────────────────┐');
        console.log('│  #   │  Phone Number           │');
        console.log('├──────┼─────────────────────────┤');
        
        for (let i = 0; i < displayCount; i++) {
            const num = contactsToShow[i].toString().padEnd(20);
            const idx = (i + 1).toString().padStart(4);
            console.log(`│ ${idx} │  ${num}   │`);
        }
        
        if (displayCount < contactsToShow.length) {
            console.log(`│ ...  │  (${contactsToShow.length - displayCount} more contacts)    │`);
        }
        
        console.log('└──────┴─────────────────────────┘');
    }
    
    await prompt('\nPress Enter to continue...');
    await showMainMenu();
}

/**
 * Show settings info
 */
async function showSettings() {
    showHeader();
    console.log('⚙️  CURRENT SETTINGS\n');
    
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  Setting                │  Value                        │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Group Name             │  ${groupName.padEnd(29)}│`);
    console.log(`│  Country Code           │  ${countryCode.toString().padEnd(29)}│`);
    console.log(`│  Min Delay (seconds)    │  ${minDelaySeconds.toString().padEnd(29)}│`);
    console.log(`│  Max Delay (seconds)    │  ${maxDelaySeconds.toString().padEnd(29)}│`);
    console.log(`│  Config Contacts        │  ${numbers.length.toString().padEnd(29)}│`);
    console.log(`│  WhatsApp Contacts      │  ${whatsappContacts.length.toString().padEnd(29)}│`);
    console.log(`│  Imported Contacts      │  ${importedContacts.length.toString().padEnd(29)}│`);
    console.log(`│  Active Source          │  ${activeContactSource.toUpperCase().padEnd(29)}│`);
    console.log(`│  Active Contacts        │  ${activeContactList.length.toString().padEnd(29)}│`);
    console.log('└─────────────────────────────────────────────────────────┘');
    
    console.log('\n📝 MESSAGE TEMPLATES:\n');
    console.log(`Bulk Message:\n  "${messageTemplates.bulkMessage}"\n`);
    console.log(`Invite Fallback:\n  "${messageTemplates.inviteFallback}"\n`);
    
    console.log('ℹ️  Edit config.json to change these settings.\n');
    
    await prompt('Press Enter to continue...');
    await showMainMenu();
}

/**
 * Fetch contacts from connected WhatsApp account
 */
async function fetchWhatsAppContacts() {
    showHeader();
    console.log('📱 FETCH WHATSAPP CONTACTS\n');
    
    log('Fetching contacts from your WhatsApp account...', 'info');
    log('This may take a moment...', 'warning');
    console.log('');
    
    try {
        const contacts = await client.getContacts();
        
        // Filter to only get actual contacts (not groups, broadcast lists, etc.)
        whatsappContacts = contacts.filter(contact => {
            return contact.isUser && 
                   !contact.isMe && 
                   !contact.isGroup && 
                   contact.id && 
                   contact.id._serialized &&
                   contact.id._serialized.endsWith('@c.us');
        });
        
        log(`Successfully fetched ${whatsappContacts.length} contacts!`, 'success');
        console.log('');
        
        // Show some stats
        const withNames = whatsappContacts.filter(c => c.name || c.pushname).length;
        const withoutNames = whatsappContacts.length - withNames;
        
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│                  CONTACTS SUMMARY                       │');
        console.log('├─────────────────────────────────────────────────────────┤');
        console.log(`│  Total contacts fetched     │  ${whatsappContacts.length.toString().padEnd(24)}│`);
        console.log(`│  With saved names           │  ${withNames.toString().padEnd(24)}│`);
        console.log(`│  Without names (unsaved)    │  ${withoutNames.toString().padEnd(24)}│`);
        console.log('└─────────────────────────────────────────────────────────┘');
        
        console.log('');
        const switchNow = await prompt('Switch to WhatsApp contacts as active source? (y/n): ');
        
        if (switchNow.toLowerCase() === 'y') {
            activeContactList = whatsappContacts;
            activeContactSource = 'whatsapp';
            log('Switched to WhatsApp contacts!', 'success');
        }
        
    } catch (error) {
        log(`Error fetching contacts: ${error.message}`, 'error');
    }
    
    await prompt('\nPress Enter to continue...');
    await showMainMenu();
}

/**
 * Switch between config and WhatsApp contacts
 */
async function switchContactSource() {
    showHeader();
    console.log('🔄 SWITCH CONTACT SOURCE\n');
    
    console.log(`Current active source: ${activeContactSource.toUpperCase()} (${activeContactList.length} contacts)\n`);
    
    console.log('Select contact source:');
    console.log(`  1. Config contacts (${numbers.length})`);
    console.log(`  2. WhatsApp contacts (${whatsappContacts.length})`);
    console.log(`  3. Imported contacts (${importedContacts.length})`);
    console.log('  4. Back\n');
    
    const choice = await prompt('Select option (1-4): ');
    
    switch (choice) {
        case '1':
            activeContactList = numbers;
            activeContactSource = 'config';
            log('Switched to config contacts!', 'success');
            break;
        case '2':
            if (whatsappContacts.length === 0) {
                log('No WhatsApp contacts fetched yet!', 'warning');
                log('Use option 4 from main menu to fetch contacts first.', 'info');
            } else {
                activeContactList = whatsappContacts;
                activeContactSource = 'whatsapp';
                log('Switched to WhatsApp contacts!', 'success');
            }
            break;
        case '3':
            if (importedContacts.length === 0) {
                log('No contacts imported yet!', 'warning');
                log('Use option 5 from main menu to import contacts first.', 'info');
            } else {
                activeContactList = importedContacts;
                activeContactSource = 'imported';
                log('Switched to imported contacts!', 'success');
            }
            break;
        case '4':
            await showMainMenu();
            return;
        default:
            log('Invalid option.', 'warning');
    }
    
    await prompt('\nPress Enter to continue...');
    await showMainMenu();
}

/**
 * Import contacts menu - Import from TXT, CSV, or VCF files
 */
async function importContactsMenu() {
    showHeader();
    console.log('📥 IMPORT CONTACTS\n');
    
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                  IMPORT CONTACTS                        │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  Supported formats:                                     │');
    console.log('│    • TXT - One number per line                          │');
    console.log('│    • CSV - Name,Number format                           │');
    console.log('│    • VCF - vCard format (exported from phone)           │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  1. 📄 Import from TXT file                             │');
    console.log('│  2. 📊 Import from CSV file                             │');
    console.log('│  3. 📇 Import from VCF file                             │');
    console.log('│  4. 🔙 Back to Main Menu                                │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('');
    
    const choice = await prompt('Select option (1-4): ');
    
    switch (choice) {
        case '1':
            await importFromTxt();
            break;
        case '2':
            await importFromCsv();
            break;
        case '3':
            await importFromVcf();
            break;
        case '4':
            await showMainMenu();
            return;
        default:
            log('Invalid option.', 'warning');
            await sleep(1500);
            await importContactsMenu();
    }
}

/**
 * Import contacts from TXT file (one number per line)
 */
async function importFromTxt() {
    showHeader();
    console.log('📄 IMPORT FROM TXT FILE\n');
    console.log('Expected format: One phone number per line');
    console.log('Example:');
    console.log('  1234567890');
    console.log('  0987654321');
    console.log('  5551234567\n');
    
    const filePath = await prompt('Enter file path (or drag & drop file here): ');
    
    if (!filePath) {
        log('No file path provided.', 'warning');
        await prompt('\nPress Enter to continue...');
        await importContactsMenu();
        return;
    }
    
    // Clean the file path (remove quotes if dragged)
    const cleanPath = filePath.replace(/^["']|["']$/g, '').trim();
    
    try {
        if (!fs.existsSync(cleanPath)) {
            log(`File not found: ${cleanPath}`, 'error');
            await prompt('\nPress Enter to continue...');
            await importContactsMenu();
            return;
        }
        
        const content = fs.readFileSync(cleanPath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        const newContacts = [];
        for (const line of lines) {
            const number = line.replace(/\D/g, '').trim();
            if (number && number.length >= 10) {
                newContacts.push({
                    name: 'Contact ' + (newContacts.length + 1),
                    number: number,
                    id: { _serialized: sanitizeNumber(number) }
                });
            }
        }
        
        if (newContacts.length === 0) {
            log('No valid phone numbers found in file.', 'warning');
        } else {
            importedContacts = newContacts;
            log(`Successfully imported ${newContacts.length} contacts!`, 'success');
            
            const switchNow = await prompt('\nSwitch to imported contacts as active source? (y/n): ');
            if (switchNow.toLowerCase() === 'y') {
                activeContactList = importedContacts;
                activeContactSource = 'imported';
                log('Switched to imported contacts!', 'success');
            }
        }
    } catch (error) {
        log(`Error reading file: ${error.message}`, 'error');
    }
    
    await prompt('\nPress Enter to continue...');
    await importContactsMenu();
}

/**
 * Import contacts from CSV file (Name,Number format)
 */
async function importFromCsv() {
    showHeader();
    console.log('📊 IMPORT FROM CSV FILE\n');
    console.log('Expected format: Name,Number (with or without header)');
    console.log('Example:');
    console.log('  Name,Phone');
    console.log('  John Doe,1234567890');
    console.log('  Jane Smith,0987654321\n');
    
    const filePath = await prompt('Enter file path (or drag & drop file here): ');
    
    if (!filePath) {
        log('No file path provided.', 'warning');
        await prompt('\nPress Enter to continue...');
        await importContactsMenu();
        return;
    }
    
    const cleanPath = filePath.replace(/^["']|["']$/g, '').trim();
    
    try {
        if (!fs.existsSync(cleanPath)) {
            log(`File not found: ${cleanPath}`, 'error');
            await prompt('\nPress Enter to continue...');
            await importContactsMenu();
            return;
        }
        
        const content = fs.readFileSync(cleanPath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        const newContacts = [];
        let skipHeader = false;
        
        // Check if first line is a header
        if (lines.length > 0 && lines[0].toLowerCase().includes('name')) {
            skipHeader = true;
        }
        
        for (let i = skipHeader ? 1 : 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
            
            if (parts.length >= 2) {
                const name = parts[0] || 'Contact ' + (newContacts.length + 1);
                const number = parts[1].replace(/\D/g, '');
                
                if (number && number.length >= 10) {
                    newContacts.push({
                        name: name,
                        number: number,
                        id: { _serialized: sanitizeNumber(number) }
                    });
                }
            } else if (parts.length === 1) {
                // Single column - treat as number only
                const number = parts[0].replace(/\D/g, '');
                if (number && number.length >= 10) {
                    newContacts.push({
                        name: 'Contact ' + (newContacts.length + 1),
                        number: number,
                        id: { _serialized: sanitizeNumber(number) }
                    });
                }
            }
        }
        
        if (newContacts.length === 0) {
            log('No valid contacts found in file.', 'warning');
        } else {
            importedContacts = newContacts;
            log(`Successfully imported ${newContacts.length} contacts!`, 'success');
            
            const switchNow = await prompt('\nSwitch to imported contacts as active source? (y/n): ');
            if (switchNow.toLowerCase() === 'y') {
                activeContactList = importedContacts;
                activeContactSource = 'imported';
                log('Switched to imported contacts!', 'success');
            }
        }
    } catch (error) {
        log(`Error reading file: ${error.message}`, 'error');
    }
    
    await prompt('\nPress Enter to continue...');
    await importContactsMenu();
}

/**
 * Import contacts from VCF (vCard) file
 */
async function importFromVcf() {
    showHeader();
    console.log('📇 IMPORT FROM VCF FILE\n');
    console.log('VCF (vCard) files are exported from:');
    console.log('  • Android Contacts app');
    console.log('  • iPhone Contacts');
    console.log('  • Google Contacts');
    console.log('  • Outlook/Microsoft Contacts\n');
    
    const filePath = await prompt('Enter file path (or drag & drop file here): ');
    
    if (!filePath) {
        log('No file path provided.', 'warning');
        await prompt('\nPress Enter to continue...');
        await importContactsMenu();
        return;
    }
    
    const cleanPath = filePath.replace(/^["']|["']$/g, '').trim();
    
    try {
        if (!fs.existsSync(cleanPath)) {
            log(`File not found: ${cleanPath}`, 'error');
            await prompt('\nPress Enter to continue...');
            await importContactsMenu();
            return;
        }
        
        const content = fs.readFileSync(cleanPath, 'utf-8');
        const newContacts = parseVcf(content);
        
        if (newContacts.length === 0) {
            log('No valid contacts found in VCF file.', 'warning');
        } else {
            importedContacts = newContacts;
            log(`Successfully imported ${newContacts.length} contacts!`, 'success');
            
            // Show preview
            console.log('\n📋 Preview (first 5 contacts):');
            for (let i = 0; i < Math.min(5, newContacts.length); i++) {
                console.log(`   ${i + 1}. ${newContacts[i].name} - ${newContacts[i].number}`);
            }
            if (newContacts.length > 5) {
                console.log(`   ... and ${newContacts.length - 5} more`);
            }
            
            const switchNow = await prompt('\nSwitch to imported contacts as active source? (y/n): ');
            if (switchNow.toLowerCase() === 'y') {
                activeContactList = importedContacts;
                activeContactSource = 'imported';
                log('Switched to imported contacts!', 'success');
            }
        }
    } catch (error) {
        log(`Error reading file: ${error.message}`, 'error');
    }
    
    await prompt('\nPress Enter to continue...');
    await importContactsMenu();
}

/**
 * Parse VCF (vCard) file content
 * @param {string} content - VCF file content
 * @returns {Array} - Array of contact objects
 */
function parseVcf(content) {
    const contacts = [];
    
    // Split into individual vCards
    const vCards = content.split(/(?=BEGIN:VCARD)/i).filter(card => card.trim());
    
    for (const vCard of vCards) {
        let name = '';
        let numbers = [];
        
        // Extract name (FN or N field)
        const fnMatch = vCard.match(/FN[;:](.+?)(?:\r?\n|\r)/i);
        if (fnMatch) {
            name = fnMatch[1].trim();
        } else {
            const nMatch = vCard.match(/N[;:](.+?)(?:\r?\n|\r)/i);
            if (nMatch) {
                // N field format: Last;First;Middle;Prefix;Suffix
                const nameParts = nMatch[1].split(';').filter(p => p.trim());
                name = nameParts.reverse().join(' ').trim();
            }
        }
        
        // Extract phone numbers (TEL field) - can have multiple
        const telMatches = vCard.matchAll(/TEL[^:]*:([^\r\n]+)/gi);
        for (const match of telMatches) {
            const phoneRaw = match[1].trim();
            const phoneClean = phoneRaw.replace(/\D/g, '');
            if (phoneClean && phoneClean.length >= 10) {
                numbers.push(phoneClean);
            }
        }
        
        // Add each number as a contact
        for (let i = 0; i < numbers.length; i++) {
            const contactName = numbers.length > 1 
                ? `${name || 'Unknown'} (${i + 1})` 
                : (name || 'Unknown');
            
            contacts.push({
                name: contactName,
                number: numbers[i],
                id: { _serialized: sanitizeNumber(numbers[i]) }
            });
        }
    }
    
    return contacts;
}

/**
 * Exit application
 */
async function exitApp() {
    console.log('');
    log('Shutting down WhatsApp client...', 'info');
    
    if (rl) rl.close();
    
    await client.destroy();
    log('Goodbye! 👋', 'success');
    process.exit(0);
}

/**
 * Check if existing session exists
 */
function hasExistingSession() {
    const sessionPath = path.join('./auth_info', 'session');
    const wwebjsPath = path.join('./auth_info', '.wwebjs_auth');
    return fs.existsSync(sessionPath) || fs.existsSync(wwebjsPath) || fs.existsSync('./auth_info/Default');
}

/**
 * Delete existing session to force new login
 */
function deleteSession() {
    const authPath = './auth_info';
    if (fs.existsSync(authPath)) {
        try {
            fs.rmSync(authPath, { recursive: true, force: true });
            return true;
        } catch (error) {
            return false;
        }
    }
    return true;
}

/**
 * Show startup menu to choose account
 */
async function showStartupMenu() {
    // Create readline for startup menu
    const startupRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const startupPrompt = (question) => {
        return new Promise((resolve) => {
            startupRl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    };
    
    console.clear();
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         📱 WhatsApp Automation CLI Tool                  ║');
    console.log('║         ⚠️  Use at your own risk - Ban possible!         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    
    const sessionExists = hasExistingSession();
    
    if (sessionExists) {
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│              🔐 ACCOUNT SELECTION                       │');
        console.log('├─────────────────────────────────────────────────────────┤');
        console.log('│  An existing WhatsApp session was found.                │');
        console.log('│                                                         │');
        console.log('│  1. ✅ Use existing account (quick login)               │');
        console.log('│  2. 🔄 Login with a different account (new QR)          │');
        console.log('│  3. 🚪 Exit                                             │');
        console.log('└─────────────────────────────────────────────────────────┘');
        console.log('');
        
        const choice = await startupPrompt('Select an option (1-3): ');
        
        startupRl.close();
        
        switch (choice) {
            case '1':
                // Use existing session
                console.log('');
                log('Using existing session...', 'info');
                return true;
                
            case '2':
                // Delete session and login fresh
                console.log('');
                log('Clearing existing session...', 'info');
                if (deleteSession()) {
                    log('Session cleared. You will need to scan a new QR code.', 'success');
                } else {
                    log('Could not clear session. Please manually delete the auth_info folder.', 'error');
                }
                return true;
                
            case '3':
                console.log('');
                log('Goodbye! 👋', 'success');
                process.exit(0);
                
            default:
                log('Invalid option. Using existing account...', 'warning');
                return true;
        }
    } else {
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│              🔐 FIRST TIME SETUP                        │');
        console.log('├─────────────────────────────────────────────────────────┤');
        console.log('│  No existing session found.                             │');
        console.log('│  You will need to scan a QR code to login.              │');
        console.log('│                                                         │');
        console.log('│  1. 📱 Continue to login                                │');
        console.log('│  2. 🚪 Exit                                             │');
        console.log('└─────────────────────────────────────────────────────────┘');
        console.log('');
        
        const choice = await startupPrompt('Select an option (1-2): ');
        
        startupRl.close();
        
        switch (choice) {
            case '1':
                console.log('');
                log('Starting login process...', 'info');
                return true;
                
            case '2':
                console.log('');
                log('Goodbye! 👋', 'success');
                process.exit(0);
                
            default:
                log('Continuing to login...', 'info');
                return true;
        }
    }
}

// ============================================
// START THE CLIENT
// ============================================

// Main entry point - show startup menu first
(async () => {
    await showStartupMenu();
    
    console.log('');
    log('Initializing WhatsApp client...', 'info');
    log('This may take a moment on first run...', 'info');
    console.log('');
    
    client.initialize();
})();

// ============================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================

process.on('SIGINT', async () => {
    console.log('');
    log('Received interrupt signal. Shutting down...', 'warning');
    if (rl) rl.close();
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    log('Received terminate signal. Shutting down...', 'warning');
    if (rl) rl.close();
    await client.destroy();
    process.exit(0);
});

module.exports = {
    client,
    sanitizeNumber,
    getRandomDelay
};
