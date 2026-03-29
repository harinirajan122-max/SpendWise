const express = require('express');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
const path = require('path'); // ESSENTIAL: To find files on Vercel
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 1. Database Connection (Added SSL for TiDB Cloud)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    ssl: { rejectUnauthorized: true } // Required for Vercel -> TiDB
});

// 2. Email Setup (Your exact logic)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// FEATURE: Get Expenses (Your exact logic)
app.get('/get-expenses', (req, res) => {
    db.query("SELECT * FROM expenses ORDER BY log_date DESC", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// FEATURE: Add Expense & Alerts (Optimized for Vercel/TiDB)
app.post('/add-expense', async (req, res) => {
    const { item, amount, category, currentBudget } = req.body;
    const limit = parseFloat(currentBudget) || 0;

    // 1. Insert the expense into TiDB
    db.query("INSERT INTO expenses (item_name, amount, category) VALUES (?, ?, ?)", [item, amount, category], (err) => {
        if (err) {
            console.error("Database Insert Error:", err);
            return res.status(500).json({ message: "Error" });
        }

        // 2. Get the new total for the budget check
        db.query("SELECT SUM(amount) as total FROM expenses", async (err, results) => {
            if (err) return res.status(500).json({ message: "Error fetching total" });

            const currentTotal = Number(results[0].total) || 0;
            const emailPromises = [];

            // 3. Prepare the Confirmation Email
            emailPromises.push(
                transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: process.env.EMAIL_USER,
                    subject: 'SpendWise: New Expense Logged',
                    text: `Confirmed: ${item} for Rs. ${amount} (${category})`
                })
            );

            // 4. Prepare the Alert Email (if limit exceeded)
            if (limit > 0 && currentTotal > limit) {
                emailPromises.push(
                    transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: process.env.EMAIL_USER,
                        subject: '🚨 SPENDING LIMIT EXCEEDED',
                        text: `Critical Alert: Your total spend is Rs. ${currentTotal.toFixed(2)}, which exceeds your budget of Rs. ${limit.toFixed(2)}!`
                    })
                );
            }

            // 5. CRITICAL: Wait for all emails to finish before sending 'Success'
            try {
                await Promise.all(emailPromises);
                console.log("✅ All emails sent successfully");
                res.json({ message: "Success" });
            } catch (mailErr) {
                console.error("❌ Email failed but DB saved:", mailErr);
                // We still send success because the data is in the DB
                res.json({ message: "Success" }); 
            }
        });
    });
});
// FEATURE: Delete All (Your exact logic)
app.post('/delete-all', (req, res) => {
    db.query("DELETE FROM expenses", (err) => res.json({ message: "Cleared" }));
});

// FEATURE: CSV Export (Your exact logic)
app.get('/export-csv', (req, res) => {
    db.query("SELECT item_name, amount, category, log_date FROM expenses", (err, results) => {
        if (err) return res.status(500).send(err);
        const parser = new Parser();
        const csv = parser.parse(results);
        res.header('Content-Type', 'text/csv').attachment('SpendWise_Report.csv').send(csv);
    });
});

// 3. ESSENTIAL: Route to serve index.html when people visit the link
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. ESSENTIAL: Dynamic Port for Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 SpendWise Pro live at port ${PORT}`));

// 5. ESSENTIAL: Export the app for Vercel deployment
module.exports = app;