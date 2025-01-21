const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
    res.render('pages/index');
});

// About page
router.get('/about', (req, res) => {
    res.render('pages/about');
});

// Privacy Policy page
router.get('/privacy', (req, res) => {
    res.render('pages/privacy');
});

// Terms of Service page
router.get('/terms', (req, res) => {
    res.render('pages/terms');
});

module.exports = router; 