# Telegram Messenger Viewer

A beautiful Telegram-like UI for viewing exported Telegram chat conversations.

## Features

✨ **Telegram-like Design**
- Dark theme matching Telegram's aesthetic
- Smooth animations and transitions
- Responsive layout

💬 **Chat Features**
- View all your exported chats in a sidebar
- Message bubbles with proper alignment (sent/received)
- Reply indicators showing quoted messages
- Date separators for easy navigation
- Message timestamps and edit indicators

📷 **Media Support**
- Photos with click-to-view
- Videos with player controls
- Voice messages with play button
- Stickers and animated stickers
- File attachments

🔍 **Search**
- Search chats by name
- Real-time filtering

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser:
```
http://localhost:8080
```

## How it works

The app automatically scans for `result.json` files in your directory structure and loads all chats. Make sure your Telegram export folders contain `result.json` files with the chat data.

## Project Structure

- `server.js` - Express server that serves the API and static files
- `index.html` - Main HTML structure
- `styles.css` - Telegram-like styling
- `app.js` - Frontend JavaScript for chat rendering
- `package.json` - Node.js dependencies

Enjoy browsing your Telegram chats! 🎉

