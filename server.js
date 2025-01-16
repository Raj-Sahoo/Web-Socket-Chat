const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store active users
const activeUsers = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle setting nickname
    socket.on('setNickname', (nickname) => {
        // Store user info
        activeUsers.set(socket.id, {
            nickname,
            joinedAt: new Date()
        });
        socket.nickname = nickname;

        // Send welcome message to the new user
        socket.emit('message', {
            type: 'system',
            content: `Welcome to the chat, ${nickname}!`
        });

        // Notify others
        socket.broadcast.emit('message', {
            type: 'system',
            content: `${nickname} has joined the chat`
        });

        // Send active users list to everyone
        io.emit('activeUsers', Array.from(activeUsers.values()).map(user => user.nickname));
    });

    // Handle chat messages
    socket.on('chatMessage', (msg) => {
        const nickname = socket.nickname || 'Anonymous';
        
        // Create message object
        const messageObj = {
            type: 'chat',
            sender: nickname,
            content: msg,
            timestamp: new Date().toISOString()
        };

        io.emit('message', messageObj);
    });

    // Handle typing indicator
    socket.on('typing', (isTyping) => {
        if (socket.nickname) {
            socket.broadcast.emit('userTyping', {
                user: socket.nickname,
                isTyping
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const userInfo = activeUsers.get(socket.id);
        if (userInfo) {
            // Remove user from active users
            activeUsers.delete(socket.id);

            // Notify others
            io.emit('message', {
                type: 'system',
                content: `${userInfo.nickname} has left the chat`
            });

            // Update active users list
            io.emit('activeUsers', Array.from(activeUsers.values()).map(user => user.nickname));
        }
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        socket.emit('message', {
            type: 'system',
            content: 'An error occurred. Please try reconnecting.'
        });
    });
});

// Basic error handling for the server
server.on('error', (error) => {
    console.error('Server error:', error);
});

const PORT = process.env.PORT || 3100;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Clean up on server shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server shut down gracefully');
        process.exit(0);
    });
});