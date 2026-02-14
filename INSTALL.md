# Aura Installation Guide

## Quick Start - Chrome Extension

### Method 1: Load Unpacked (Developer Mode)

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd aura-extension
   npm install
   npm run build
   ```

2. **Open Chrome and go to:**
   ```
   chrome://extensions/
   ```

3. **Enable Developer Mode**
   - Toggle the switch in the top-right corner

4. **Click "Load Unpacked"**
   - Select the `dist` folder from this project

5. **Done!** You should see the Aura icon in your Chrome toolbar

### Method 2: Using the Built Extension

If you don't want to build from source:

1. Download the `dist` folder contents
2. Follow steps 2-5 above

## How to Use on WhatsApp

### Step 1: Open WhatsApp Web
1. Go to [https://web.whatsapp.com](https://web.whatsapp.com)
2. Scan the QR code with your phone
3. Open any chat

### Step 2: Activate Aura
1. Look for the **purple Aura button** in the bottom-right corner of the screen
2. Click it to open the Aura panel

### Step 3: Generate a Message
1. **Type your raw thought** in the "Your Raw Thought" box
   - Example: `i like her shoes but dont want to be a creep`
   
2. **Adjust the vibe slider** for the right tone:
   - **0-33 (Icebreaker)**: High energy, curious, low pressure
   - **34-66 (Deep-Dive)**: Philosophical, slower-paced, empathetic
   - **67-100 (The Close)**: Direct, confident, call to action

3. **Click "Generate Response"**
   - Aura will transform your raw thought into a socially calibrated message

4. **Click "Insert"**
   - The message is automatically inserted into WhatsApp's chat input
   - Press Enter to send!

### Step 4: Use Interest-Sync
1. **Add your interests** in the Aura popup (click the extension icon)
   - Examples: Radiohead, Sci-Fi, Dark Souls, Coffee, Hiking
   
2. **Open a chat** in WhatsApp
3. **Click the Aura button** - it will detect conversation context
4. **See suggested hooks** based on shared interests

### Step 5: Revive Dead Chats
1. **Open a stalled conversation** in WhatsApp
2. **Click the Aura button**
3. **Check the "Revive Dead Chat" section**
4. **Click "Generate Revival Message"**
5. **Click "Insert"** to send the revival message

## How to Use on Instagram

1. Open Instagram DMs at [https://www.instagram.com/direct/inbox/](https://www.instagram.com/direct/inbox/)
2. Click the Aura button in the bottom-right
3. Follow the same steps as WhatsApp

## How to Use on Dating Apps

### Tinder
1. Open [https://tinder.com](https://tinder.com) and log in
2. Open a match's chat
3. Click the Aura button

### Bumble
1. Open [https://bumble.com](https://bumble.com) and log in
2. Open a match's chat
3. Click the Aura button

### Hinge
1. Open [https://hinge.co](https://hinge.co) and log in
2. Open a match's chat
3. Click the Aura button

## Troubleshooting

### Aura button not appearing?
- Make sure you're on a supported platform (WhatsApp Web, Instagram, Tinder, Bumble, Hinge)
- Refresh the page
- Check that the extension is enabled in chrome://extensions/

### Can't insert message?
- Click in the chat input box first to focus it
- Make sure you're in an active chat
- Try clicking "Insert" again

### Interest-Sync not working?
- Add interests in the popup (click the extension icon in Chrome toolbar)
- Save your interests
- Refresh the chat page

## Keyboard Shortcuts

- **Ctrl+Shift+A** (or Cmd+Shift+A on Mac): Toggle Aura panel
- **Enter**: Send message after insertion

## Tips for Best Results

1. **Be specific in your raw thought**: Instead of "she's cute", try "I like how she mentioned hiking in her profile"

2. **Use the vibe slider appropriately**:
   - First message: Icebreaker (0-33)
   - Building rapport: Deep-Dive (34-66)
   - Asking for a date: The Close (67-100)

3. **Add your real interests**: The Interest-Sync engine works best with accurate information

4. **Don't overuse it**: Aura is a tool, not a crutch. Use it to overcome anxiety, then let your personality shine

5. **Read the "Why"**: Each suggestion comes with an explanation. Learn from these to improve your own skills

## Privacy

- All processing happens locally in your browser
- No messages are sent to external servers
- Your interests are stored in localStorage on your device
- The extension only works on the websites you grant permission to

## Support

For issues or questions, please refer to the README.md file or open an issue on the repository.
