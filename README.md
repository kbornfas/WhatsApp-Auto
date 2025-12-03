# WhatsApp-Auto

A WhatsApp CLI tool that enables you to text bulk contacts and add them to groups automatically.

## ⚠️ WARNING - BAN RISK

**Using this tool may result in your WhatsApp account being temporarily or permanently banned.** WhatsApp does not officially support automation, and this tool violates their Terms of Service.

**USE AT YOUR OWN RISK:**
- Always test with a secondary/burner account first
- Start with small batches (2-3 numbers)
- Never use for spam or unsolicited messages
- The developers are not responsible for any consequences

---

## Features

- ✅ **Session Persistence** - Uses LocalAuth to save your session (no QR scan every time)
- ✅ **QR Code in Terminal** - Authenticate by scanning QR code displayed in terminal
- ✅ **Smart Group Management** - Automatically finds or creates target group
- ✅ **Privacy Fallback** - Sends invite link if user's privacy settings block direct add
- ✅ **Anti-Ban Delays** - Random 5-15 second delays between actions
- ✅ **Detailed Logging** - Clear success/failure messages for every action

---

## Installation

### Prerequisites
- Node.js v16 or higher
- npm

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/WhatsApp-Auto.git
   cd WhatsApp-Auto
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your settings** (see Configuration section below)

4. **Run the tool**
   ```bash
   npm start
   ```

---

## Configuration

Edit the `config.json` file to set up your automation:

```json
{
  "groupName": "My Awesome Group",
  "numbers": [
    "1234567890",
    "0987654321",
    "5551234567"
  ],
  "messageTemplates": {
    "welcomeMessage": "Welcome to the group! 🎉",
    "inviteFallback": "Hey! I tried adding you to {groupName} but your privacy settings blocked it. Please join here: {inviteLink}",
    "bulkMessage": "Hello! This is an automated message."
  },
  "settings": {
    "minDelaySeconds": 5,
    "maxDelaySeconds": 15,
    "countryCode": "1"
  }
}
```

### Configuration Options

| Field | Description |
|-------|-------------|
| `groupName` | Name of the WhatsApp group to find or create |
| `numbers` | Array of phone numbers to process (without country code if `countryCode` is set) |
| `messageTemplates.inviteFallback` | Message sent when user can't be added directly. Use `{groupName}` and `{inviteLink}` placeholders |
| `messageTemplates.bulkMessage` | Default message for bulk messaging feature |
| `settings.minDelaySeconds` | Minimum delay between actions (recommended: 5+) |
| `settings.maxDelaySeconds` | Maximum delay between actions (recommended: 15+) |
| `settings.countryCode` | Default country code to prepend to 10-digit numbers |

---

## Directory Structure

```
WhatsApp-Auto/
├── index.js          # Main application logic
├── config.json       # Configuration file (you edit this)
├── package.json      # Dependencies and scripts
├── auth_info/        # Session data (auto-generated)
└── README.md         # This file
```

---

## How It Works

### Smart Group Adder Flow

1. **Authentication** - Displays QR code on first run, then uses saved session
2. **Find/Create Group** - Searches for existing group or creates new one
3. **Generate Invite Link** - Gets group invite link for fallback messages
4. **Process Numbers** - For each number:
   - Waits random 5-15 seconds (anti-ban)
   - Attempts to add to group
   - If fails (privacy settings), sends invite link via DM
5. **Summary** - Displays success/failure statistics

---

## Testing Recommendations

1. **First Run**: Test with only 2-3 numbers (your own secondary numbers or close friends)
2. **Monitor**: Watch for any unusual behavior or warnings from WhatsApp
3. **Increase Slowly**: Only increase batch size after successful small tests
4. **Delay Settings**: If you notice issues, increase `minDelaySeconds` and `maxDelaySeconds`

---

## Troubleshooting

### QR Code not appearing
- Delete the `auth_info` folder and restart

### Authentication failures
- Delete `auth_info` folder
- Make sure WhatsApp Web isn't open in a browser
- Check your internet connection

### "Cannot add participant" errors
- Normal behavior - this triggers the invite link fallback
- User's privacy settings prevent direct adds

### Session expires frequently
- This can happen with inactivity
- Delete `auth_info` and re-authenticate

---

## Dependencies

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - WhatsApp Web API client
- [qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal) - QR code display in terminal

---

## License

ISC

---

## Disclaimer

This project is for educational purposes only. The developers do not endorse or encourage any misuse of this tool. Users are responsible for ensuring they comply with WhatsApp's Terms of Service and all applicable laws.
