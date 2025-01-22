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

// Initialize SQLite database
const db = new sqlite3.Database('messages.sqlite', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

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
`);

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
    const query = `
        SELECT * FROM messages 
        WHERE sent = 0 
        AND delivery_date <= datetime('now')
    `;

    db.all(query, [], async (err, messages) => {
        if (err) {
            console.error('Error checking messages:', err);
            return;
        }

        console.log(`Found ${messages.length} messages to send`);
        
        for (const message of messages) {
            try {
                const info = await transporter.sendMail({
                    from: '"Future Me" <futuremewisdom@gmail.com>',
                    to: message.email,
                    subject: "A Message from Your Past Self",
                    text: message.message,
                    html: DOMPurify.sanitize(marked.parse(message.message))
                });

                console.log('Message sent:', info.messageId);
                db.run('UPDATE messages SET sent = 1 WHERE id = ?', [message.id]);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    });
}

// Schedule message checking
cron.schedule('* * * * *', checkAndSendMessages);

// Message submission endpoint
app.post('/api/messages', async (req, res) => {
    const { message, deliveryTime, email } = req.body;
    
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