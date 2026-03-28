// 1. IMPORT DEPENDENCIES
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();

// 2. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 3. FORCEFUL STATIC FILE HANDLING
// path.resolve ensures the server finds the absolute path on Render's Linux system
const publicPath = path.resolve(__dirname, 'public'); 
app.use(express.static(publicPath));

// 4. DATABASE CONNECTION (TiDB Cloud)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000, 
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'test',
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true // Required for TiDB Cloud security
    }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to TiDB Cloud Database.');
});

// 5. API ENDPOINTS
// GET all expenses
app.get('/api/expenses', (req, res) => {
    const sql = 'SELECT * FROM expenses ORDER BY log_date DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST a new expense
app.post('/api/expenses', (req, res) => {
    const { item_name, amount, category } = req.body;
    const sql = 'INSERT INTO expenses (item_name, amount, category) VALUES (?, ?, ?)';
    db.query(sql, [item_name, amount, category], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: result.insertId, item_name, amount, category });
    });
});

// DELETE an expense
app.delete('/api/expenses/:id', (req, res) => {
    const sql = 'DELETE FROM expenses WHERE id = ?';
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted successfully' });
    });
});

// 6. ROOT ROUTE (The Fix for "Not Found")
// This explicitly sends index.html when the base URL is visited
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// 7. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});