const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const net = require('net');
const expressLayouts = require('express-ejs-layouts');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const pagesRouter = require('./src/routes/pages');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
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
}

// Add email configuration (we'll use a test account for development)
let transporter;

async function setupEmailTransporter() {
    if (process.env.NODE_ENV === 'development') {
        try {
            console.log('Creating test email account...');
            const testAccount = await nodemailer.createTestAccount();
            console.log('Test account created:', testAccount.user);
            
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            console.log('Email transporter configured for development');
        } catch (error) {
            console.error('Error setting up test email account:', error);
        }
    } else {
        // Configure for production (you'll need to add these to your .env file)
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
}

// Initialize email setup
setupEmailTransporter();

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Add this function to check and send due messages
async function checkAndSendMessages() {
    console.log('\n=== Checking for messages to send ===');
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
        
        if (messages.length > 0) {
            console.log('Message delivery dates:', messages.map(m => ({
                id: m.id,
                delivery_date: m.delivery_date,
                email: m.email
            })));
        }

        for (const message of messages) {
            try {
                console.log(`\nAttempting to send message ${message.id} to ${message.email}`);
                const info = await transporter.sendMail({
                    from: '"Future Me" <noreply@futureme.com>',
                    to: message.email,
                    subject: "A Message from Your Past Self",
                    text: message.message,
                    html: DOMPurify.sanitize(marked.parse(message.message))
                });

                console.log('Message sent successfully');
                
                if (process.env.NODE_ENV === 'development') {
                    const previewUrl = nodemailer.getTestMessageUrl(info);
                    console.log('\n=== TEST EMAIL PREVIEW ===');
                    console.log('Preview URL:', previewUrl);
                    console.log('========================\n');
                }

                // Mark message as sent
                db.run('UPDATE messages SET sent = 1 WHERE id = ?', [message.id]);
                console.log(`Message ${message.id} marked as sent`);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    });
}

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

// Set up cron job to check for messages every minute
cron.schedule('* * * * *', () => {
    checkAndSendMessages();
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

// Update the server start section
const startServer = async () => {
    try {
        const port = await getAvailablePort(process.env.PORT || 3000);
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

startServer(); 