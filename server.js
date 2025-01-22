const dotenv = require('dotenv');
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const expressLayouts = require('express-ejs-layouts');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const pagesRouter = require('./src/routes/pages');

// Load environment variables
dotenv.config();

// Environment setup
const isDevelopment = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 10000;
const isRender = process.env.RENDER === 'true';

// Initialize Express
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.use('/', pagesRouter);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Set up database path
const dbPath = path.join(__dirname, 'messages.sqlite');
console.log('Database path:', dbPath);

// Initialize SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        // Create messages table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                email TEXT NOT NULL,
                delivery_date DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent BOOLEAN DEFAULT 0
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('Messages table ready');
            }
        });
    }
});

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Check for messages to send
function checkAndSendMessages() {
    console.log('\n=== Checking for messages to send ===');
    const now = new Date();
    console.log('Current time:', now.toISOString());

    // Modified query to be more lenient with time matching
    const query = `
        SELECT * FROM messages 
        WHERE sent = 0 
        AND datetime(delivery_date) <= datetime('now', 'localtime')
    `;

    db.all(query, [], async (err, messages) => {
        if (err) {
            console.error('Database query error:', err);
            return;
        }

        console.log(`Found ${messages.length} messages to send`);
        
        if (messages.length > 0) {
            console.log('Messages to send:', messages.map(m => ({
                id: m.id,
                email: m.email,
                delivery_date: m.delivery_date,
                should_send: new Date(m.delivery_date) <= now
            })));
        }
        
        for (const message of messages) {
            try {
                console.log(`\nAttempting to send message ${message.id}:`, {
                    to: message.email,
                    scheduled_for: message.delivery_date,
                    current_time: now.toISOString()
                });

                // Verify email configuration before sending
                await transporter.verify();
                
                const info = await transporter.sendMail({
                    from: '"Future Me" <futuremewisdom@gmail.com>',
                    to: message.email,
                    subject: "A Message from Your Past Self",
                    text: message.message,
                    html: DOMPurify.sanitize(marked.parse(message.message))
                });

                console.log('Email sent successfully:', {
                    messageId: info.messageId,
                    response: info.response,
                    accepted: info.accepted,
                    rejected: info.rejected
                });

                // Mark as sent
                db.run('UPDATE messages SET sent = 1 WHERE id = ?', [message.id], (updateErr) => {
                    if (updateErr) {
                        console.error('Error marking message as sent:', updateErr);
                    } else {
                        console.log(`Message ${message.id} marked as sent`);
                    }
                });
            } catch (error) {
                console.error('Error sending message:', {
                    messageId: message.id,
                    error: error.message,
                    code: error.code,
                    command: error.command,
                    delivery_date: message.delivery_date
                });
            }
        }
    });
}

// Schedule message checking
cron.schedule('* * * * *', checkAndSendMessages);

// Message submission endpoint
app.post('/api/messages', async (req, res) => {
    const { message, deliveryTime, email } = req.body;
    
    console.log('Received message submission:', {
        email,
        deliveryTime,
        messageLength: message?.length
    });
    
    const deliveryDate = new Date();
    if (deliveryTime <= 5) {
        deliveryDate.setMinutes(deliveryDate.getMinutes() + parseInt(deliveryTime));
    } else {
        deliveryDate.setDate(deliveryDate.getDate() + parseInt(deliveryTime));
    }
    
    const query = `
        INSERT INTO messages (message, email, delivery_date)
        VALUES (?, ?, ?)
    `;
    
    db.run(query, [message, email, deliveryDate.toISOString()], function(err) {
        if (err) {
            console.error('Error saving message:', err);
            res.status(500).json({ error: 'Failed to save message' });
            return;
        }
        
        console.log('Message saved successfully:', {
            id: this.lastID,
            deliveryDate: deliveryDate
        });
        
        res.status(201).json({ 
            message: 'Message scheduled successfully',
            deliveryDate: deliveryDate
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 