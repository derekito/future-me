const dotenv = require('dotenv');

// Load environment variables at the very start
dotenv.config();

// Simple environment check
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('Environment Status:', {
        EMAIL_USER: EMAIL_USER ? 'present' : 'missing',
        EMAIL_PASS: EMAIL_PASS ? 'present' : 'missing',
        NODE_ENV: process.env.NODE_ENV,
        RENDER: process.env.RENDER
    });
    throw new Error('Required environment variables are missing');
}

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const net = require('net');
const expressLayouts = require('express-ejs-layouts');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const pagesRouter = require('./src/routes/pages');
const fs = require('fs');

// Log environment status
console.log('Environment Configuration:', {
    NODE_ENV: process.env.NODE_ENV,
    RENDER: process.env.RENDER,
    PORT: process.env.PORT,
    EMAIL_CONFIG: {
        user: process.env.EMAIL_USER ? 'set' : 'not set',
        pass: process.env.EMAIL_PASS ? 'set' : 'not set'
    }
});

function loadEnvironmentVariables() {
    // Log environment status (without exposing sensitive data)
    console.log('Environment Configuration:', {
        NODE_ENV: process.env.NODE_ENV,
        RENDER: process.env.RENDER,
        PORT: process.env.PORT,
        EMAIL_USER_EXISTS: !!process.env.EMAIL_USER,
        EMAIL_PASS_EXISTS: !!process.env.EMAIL_PASS,
        EMAIL_USER_LENGTH: process.env.EMAIL_USER?.length || 0,
        EMAIL_PASS_LENGTH: process.env.EMAIL_PASS?.length || 0
    });

    // Validate required environment variables
    const required = ['EMAIL_USER', 'EMAIL_PASS'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('Environment variables check failed:', {
            NODE_ENV: process.env.NODE_ENV,
            RENDER: process.env.RENDER,
            missing
        });
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please ensure these are set in your environment or .env file.'
        );
    }
}

// Call this before any other setup
loadEnvironmentVariables();

const isDevelopment = process.env.NODE_ENV === 'development';
const isRender = process.env.RENDER === 'true';

const app = express();
const PORT = process.env.PORT || (isRender ? 10000 : 3000);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));  // Serve all static files from public
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.use('/', pagesRouter);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Initialize SQLite database
const db = new sqlite3.Database('messages.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);  // Exit if we can't open the database
    } else {
        console.log('Connected to SQLite database');
        // Initialize database and then start the server
        initializeDatabase();
    }
});

function initializeDatabase() {
    return new Promise((resolve, reject) => {
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
                reject(err);
            } else {
                console.log('Database initialized successfully');
                resolve();
            }
        });
    });
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// Verify email configuration
transporter.verify()
    .then(() => console.log('Email configuration verified successfully'))
    .catch(error => console.error('Email verification failed:', error));

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Update the checkAndSendMessages function with more detailed logging
async function checkAndSendMessages() {
    console.log('\n=== Checking for messages to send ===');
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // More lenient query that looks for messages in a wider window
    const query = `
        SELECT * FROM messages 
        WHERE sent = 0 
        AND datetime(delivery_date) <= datetime('now', '+2 minutes')
    `;

    db.all(query, [], async (err, messages) => {
        if (err) {
            console.error('Database query error:', err);
            return;
        }

        console.log(`Found ${messages.length} pending messages`);
        
        if (messages.length > 0) {
            console.log('Pending messages:', messages.map(m => ({
                id: m.id,
                email: m.email,
                delivery_date: m.delivery_date,
                current_time: now.toISOString()
            })));
        }
        
        for (const message of messages) {
            try {
                console.log(`\nAttempting to send message ${message.id}:`, {
                    to: message.email,
                    scheduled_for: message.delivery_date,
                    current_time: now.toISOString()
                });
                
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

                // Update the message status
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE messages SET sent = 1 WHERE id = ?',
                        [message.id],
                        function(updateErr) {
                            if (updateErr) {
                                console.error('Failed to mark message as sent:', updateErr);
                                reject(updateErr);
                            } else {
                                console.log(`Message ${message.id} marked as sent`);
                                resolve();
                            }
                        }
                    );
                });
            } catch (error) {
                console.error('Failed to send message:', {
                    messageId: message.id,
                    error: error.message,
                    stack: error.stack,
                    delivery_date: message.delivery_date
                });
            }
        }
    });
}

// Update the server startup code
const startServer = async () => {
    try {
        // Wait for database initialization
        await initializeDatabase();
        
        let port = PORT;
        if (!isRender) {
            port = await getAvailablePort(PORT);
        }

        const server = app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            console.log('Checking for pending messages on startup...');
            checkAndSendMessages();
        });

        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
            }
        });

    } catch (error) {
        console.error('Error during startup:', error);
        process.exit(1);
    }
};

// Update the cron schedule to run more frequently
cron.schedule('*/30 * * * * *', () => {
    console.log('\nCron job triggered at:', new Date().toISOString());
    checkAndSendMessages();
});

// Start the server
startServer();

// Routes
// app.get('/', (req, res) => {
//     res.render('pages/index', {
//         env: process.env.NODE_ENV || 'development'
//     });
// });

// app.get('/about', (req, res) => {
//     res.render('pages/about');
// });

app.post('/api/messages', async (req, res) => {
    const { message, deliveryTime, email } = req.body;
    
    console.log('Received message submission:', {
        email,
        deliveryTime,
        messageLength: message.length
    });
    
    // Calculate delivery date
    const deliveryDate = new Date();
    if (deliveryTime <= 5) {
        // For test intervals (1 or 5 minutes)
        deliveryDate.setMinutes(deliveryDate.getMinutes() + parseInt(deliveryTime));
        console.log('Test mode: Delivery scheduled for', deliveryDate);
    } else {
        // For production intervals (90, 180, 365 days)
        deliveryDate.setDate(deliveryDate.getDate() + parseInt(deliveryTime));
    }
    
    const query = `
        INSERT INTO messages (message, email, delivery_date)
        VALUES (?, ?, ?)
    `;
    
    try {
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
                id: this.lastID,
                deliveryDate: deliveryDate
            });
        });
    } catch (error) {
        console.error('Error in message submission:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const getAvailablePort = async (startPort) => {
    const isPortAvailable = (port) => {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, () => {
                server.close();
                resolve(true);
            });
            server.on('error', () => {
                resolve(false);
            });
        });
    };

    let port = startPort;
    while (!(await isPortAvailable(port))) {
        port++;
    }
    return port;
};

// Routes
// app.get('/', (req, res) => {
//     res.render('pages/index', {
//         env: process.env.NODE_ENV || 'development'
//     });
// });

// app.get('/about', (req, res) => {
//     res.render('pages/about');
// });

// Add this near the top of your file with other requires
const dbPath = path.join(__dirname, 'messages.sqlite');
const dbDir = path.dirname(dbPath);

// Create the directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true }); 