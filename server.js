const express = require('express');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

app.get('/get-expenses', (req, res) => {
    db.query("SELECT * FROM expenses ORDER BY log_date DESC", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.post('/add-expense', (req, res) => {
    const { item, amount, category, currentBudget } = req.body;
    const limit = parseFloat(currentBudget) || 0;

    db.query("INSERT INTO expenses (item_name, amount, category) VALUES (?, ?, ?)", [item, amount, category], (err) => {
        if (err) return res.status(500).json({ message: "Error" });

        db.query("SELECT SUM(amount) as total FROM expenses", (err, results) => {
            // FIX: Wraps the result in Number() to prevent .toFixed() errors
            const currentTotal = Number(results[0].total) || 0;

            transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: 'SpendWise: New Expense Logged',
                text: `Confirmed: ${item} for Rs. ${amount} (${category})`
            });

            if (limit > 0 && currentTotal > limit) {
                transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: process.env.EMAIL_USER,
                    subject: '🚨 SPENDING LIMIT EXCEEDED',
                    text: `Critical Alert: Your total spend is Rs. ${currentTotal.toFixed(2)}, which exceeds your budget of Rs. ${limit.toFixed(2)}!`
                });
            }
            res.json({ message: "Success" });
        });
    });
});

app.post('/delete-all', (req, res) => {
    db.query("DELETE FROM expenses", (err) => res.json({ message: "Cleared" }));
});

app.get('/export-csv', (req, res) => {
    db.query("SELECT item_name, amount, category, log_date FROM expenses", (err, results) => {
        if (err) return res.status(500).send(err);
        const parser = new Parser();
        const csv = parser.parse(results);
        res.header('Content-Type', 'text/csv').attachment('SpendWise_Report.csv').send(csv);
    });
});

app.listen(3000, () => console.log(`🚀 SpendWise Pro live at http://localhost:3000`));
