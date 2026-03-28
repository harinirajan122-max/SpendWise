require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// CRITICAL: This tells Render where to find your HTML/CSS/JS files
// Make sure your index.html is inside a folder named 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION (Optimized for TiDB Cloud) ---
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000, // TiDB default port
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'test',
    // SSL is mandatory for TiDB Cloud security
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to TiDB Cloud Database.');
});

// --- API ROUTES ---

// 1. Get all expenses
app.get('/api/expenses', (req, res) => {
    const sql = 'SELECT * FROM expenses ORDER BY log_date DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// 2. Add a new expense
app.post('/api/expenses', (req, res) => {
    const { item_name, amount, category } = req.body;
    const sql = 'INSERT INTO expenses (item_name, amount, category) VALUES (?, ?, ?)';
    db.query(sql, [item_name, amount, category], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId, item_name, amount, category });
    });
});

// 3. Delete an expense
app.delete('/api/expenses/:id', (req, res) => {
    const sql = 'DELETE FROM expenses WHERE id = ?';
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ message: 'Deleted successfully' });
    });
});

// --- SERVING THE FRONTEND ---
// This handles the "Not Found" error by sending index.html for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});