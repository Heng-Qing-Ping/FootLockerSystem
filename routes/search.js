
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/products/search', (req, res) => {
  const q = req.query.q || '';
  const query = `%${q}%`;

  const sql = "SELECT * FROM products WHERE name LIKE ? OR category LIKE ?";
  db.query(sql, [query, query], (err, results) => {
    if (err) return res.status(500).send("Database error");
    res.render('product', { products: results, query: q });
  });
});

module.exports = router;
