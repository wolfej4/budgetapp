const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/split-payments', require('./routes/splitPayments'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/budgets', require('./routes/budgets'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
