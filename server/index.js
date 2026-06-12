const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const db = require('./db');
const { scheduleReminders } = require('./reminders');
const { version } = require('./package.json');

app.use(cors());
app.use(express.json());

app.get('/api/version', (req, res) => res.json({ version }));

app.use('/api/auth/oidc', require('./routes/oidc'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/split-payments', require('./routes/splitPayments'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/savings-goals', require('./routes/savingsGoals'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/export', require('./routes/exportData'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/recurring-transactions', require('./routes/recurringTransactions'));
app.use('/api/category-budgets', require('./routes/categoryBudgets'));
app.use('/api/user-settings', require('./routes/userSettings'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve built React client when running in Docker / production
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

scheduleReminders(db);
