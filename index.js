// index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Example route: GET request
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend API!' });
});

// Example route: POST request
app.post('/api/data', (req, res) => {
  const data = req.body;
  res.json({ received: data });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});