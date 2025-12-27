const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const BASE_DIR = __dirname;

// Middleware
app.use(express.json());
app.use(express.static(BASE_DIR));

// Cache for loaded chats
const chatsCache = new Map();

// Scan and load all chats on startup
function loadAllChats() {
    console.log('📂 Scanning for chat exports...');
    let count = 0;
    
    function scanDirectory(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // Skip node_modules and other common directories
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (entry.name === 'result.json') {
                try {
                    let data = fs.readFileSync(fullPath, 'utf8');
                    
                    // Try to fix common JSON issues
                    // Remove BOM if present
                    if (data.charCodeAt(0) === 0xFEFF) {
                        data = data.slice(1);
                    }
                    
                    // Try to fix control characters
                    data = data.replace(/[\x00-\x1F\x7F]/g, '');
                    
                    // Try parsing first without modifications
                    let chat;
                    try {
                        chat = JSON.parse(data);
                    } catch (firstError) {
                        // Only try to fix if initial parse fails
                        console.log(`First parse failed for ${path.basename(fullPath)}, attempting repairs...`);
                        
                        // Try to fix common JSON issues
                        // Fix trailing commas in arrays/objects
                        let repairedData = data.replace(/,(\s*[}\]])/g, '$1');
                        
                        // Try to fix incomplete JSON (missing closing brackets)
                        // Count opening and closing brackets
                        const openBraces = (repairedData.match(/\{/g) || []).length;
                        const closeBraces = (repairedData.match(/\}/g) || []).length;
                        const openBrackets = (repairedData.match(/\[/g) || []).length;
                        const closeBrackets = (repairedData.match(/\]/g) || []).length;
                        
                        // Add missing closing brackets
                        if (closeBrackets < openBrackets) {
                            repairedData = repairedData.trim();
                            // Remove trailing comma if present
                            repairedData = repairedData.replace(/,\s*$/, '');
                            // Add missing closing brackets
                            for (let i = 0; i < openBrackets - closeBrackets; i++) {
                                repairedData += '\n        ]';
                            }
                        }
                        
                        // Add missing closing braces
                        if (closeBraces < openBraces) {
                            repairedData = repairedData.trim();
                            for (let i = 0; i < openBraces - closeBraces; i++) {
                                repairedData += '\n    }';
                            }
                        }
                        
                        // Try parsing repaired data
                        try {
                            chat = JSON.parse(repairedData);
                        } catch (parseError) {
                            // If still fails, try to extract messages using regex
                            console.warn(`⚠️  JSON parse error for ${fullPath}, attempting message extraction...`);
                            
                            // Try to extract the name
                            const nameMatch = data.match(/"name"\s*:\s*"([^"]+)"/);
                            const name = nameMatch ? nameMatch[1] : path.basename(path.dirname(fullPath));
                            
                            // Try to extract messages using regex pattern matching
                            const messagePattern = /\{\s*"id"\s*:\s*(\d+)[^}]*"from"\s*:\s*"([^"]+)"[^}]*"from_id"\s*:\s*"([^"]+)"[^}]*"date"\s*:\s*"([^"]+)"[^}]*"text"\s*:\s*"([^"]*)"[^}]*\}/g;
                            const messages = [];
                            let match;
                            let msgId = 1;
                            
                            while ((match = messagePattern.exec(data)) !== null) {
                                try {
                                    messages.push({
                                        id: parseInt(match[1]) || msgId++,
                                        type: 'message',
                                        from: match[2] || 'Unknown',
                                        from_id: match[3] || 'unknown',
                                        date: match[4] || new Date().toISOString(),
                                        text: match[5] || '',
                                        text_entities: []
                                    });
                                } catch (e) {
                                    // Skip malformed messages
                                }
                            }
                            
                            chat = {
                                name: name,
                                type: 'personal_chat',
                                id: 0,
                                messages: messages,
                                _error: 'JSON parse error - extracted messages using regex'
                            };
                            
                            console.warn(`⚠️  Loaded ${name} with errors (extracted ${messages.length} messages)`);
                        }
                    }
                    
                    const relPath = path.relative(BASE_DIR, path.dirname(fullPath));
                    
                    // Ensure messages array exists
                    if (!chat.messages || !Array.isArray(chat.messages)) {
                        chat.messages = [];
                    }
                    
                    chat.path = relPath;
                    chatsCache.set(relPath, chat);
                    count++;
                    
                    if (chat._error) {
                        console.log(`⚠️  Loaded (with errors): ${chat.name} (${chat.messages.length} messages) - ${relPath}`);
                    } else {
                        console.log(`✅ Loaded: ${chat.name} (${chat.messages.length} messages) - ${relPath}`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading ${fullPath}:`, error.message);
                }
            }
            }
        } catch (error) {
            // Skip directories we can't read
            if (error.code !== 'EACCES') {
                console.error(`⚠️  Error scanning ${dir}:`, error.message);
            }
        }
    }
    
    scanDirectory(BASE_DIR);
    console.log(`\n🎉 Loaded ${count} chat(s) total\n`);
}

// API: Get all chats
app.get('/api/chats', (req, res) => {
    const summaries = Array.from(chatsCache.values()).map(chat => {
        const messageCount = chat.messages?.length || 0;
        const lastMessage = chat.messages && chat.messages.length > 0 
            ? chat.messages[chat.messages.length - 1] 
            : null;
        
        return {
            name: chat.name,
            type: chat.type,
            id: chat.id,
            path: chat.path,
            messageCount: messageCount,
            message_count: messageCount, // Also include snake_case for compatibility
            lastMessage: lastMessage,
            last_message: lastMessage, // Also include snake_case for compatibility
            messages: chat.messages // Include messages array for preview fallback
        };
    });
    
    res.json(summaries);
});

// API: Get specific chat
app.get('/api/chat/*', (req, res) => {
    const chatPath = req.params[0];
    const chat = chatsCache.get(chatPath);
    
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
});

// API: Serve media files
app.get('/api/media/*', (req, res) => {
    const mediaPath = req.params[0];
    const fullPath = path.join(BASE_DIR, mediaPath);
    
    // Security check
    if (!fullPath.startsWith(BASE_DIR)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(fullPath);
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Telegram Messenger running on http://localhost:${PORT}\n`);
    loadAllChats();
});

