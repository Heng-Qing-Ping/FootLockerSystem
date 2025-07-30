const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 3000;

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Republic_C207', // replace with your password
  database: 'footlocker_db'
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'footlocker_secret',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// Globals for EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.messages = req.flash('success');
  next();
});

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + '-' + unique);
  }
});
const upload = multer({ storage });

// Routes

// Home
app.get('/', (req, res) => {
  res.render('index');
});

// ================= AUTH =================

// Register
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
    [username, email, hashed], (err) => {
    if (err) return res.render('register', { error: 'Email or username exists.' });
    res.redirect('/login');
  });
});

// Login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (results.length === 0 || !(await bcrypt.compare(password, results[0].password))) {
      return res.render('login', { error: 'Invalid credentials.' });
    }
    req.session.user = results[0];
    res.redirect('/products');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Auth check middleware
function isAdmin(req, res, next) {
  if (req.session.user?.role === 'admin') return next();
  res.status(403).send('Admins only.');
}

function isUser(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// ================= PRODUCTS =================

// View all
app.get('/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    res.render('products', { products: results });
  });
});

// Product detail
app.get('/products/:id', (req, res) => {
  db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, result) => {
    res.render('product', { product: result[0] });
  });
});

// Search
app.get('/products/search', (req, res) => {
  const keyword = `%${req.query.keyword}%`;
  db.query('SELECT * FROM products WHERE name LIKE ?', [keyword], (err, results) => {
    res.render('products', { products: results });
  });
});

// Add product
app.get('/products/add', isAdmin, (req, res) => {
  res.render('addproduct', { error: null });
});

app.post('/products/add', isAdmin, upload.single('image'), (req, res) => {
  const { name, brand, category, price, description, stock } = req.body;
  const image_url = req.file ? '/uploads/' + req.file.filename : null;

  db.query('INSERT INTO products (name, brand, category, price, description, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [name, brand, category, price, description, image_url, stock], (err) => {
    if (err) return res.render('addproduct', { error: 'Failed to add product.' });
    req.flash('success', 'Product added successfully!');
    res.redirect('/products');
  });
});

// Edit product
app.get('/products/edit/:id', isAdmin, (req, res) => {
  db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, result) => {
    res.render('editproduct', { product: result[0] });
  });
});

app.post('/products/edit/:id', isAdmin, upload.single('image'), (req, res) => {
  const { name, brand, category, price, description, stock, oldImage } = req.body;
  const image_url = req.file ? '/uploads/' + req.file.filename : oldImage;

  db.query('UPDATE products SET name=?, brand=?, category=?, price=?, description=?, image_url=?, stock=? WHERE id=?',
    [name, brand, category, price, description, image_url, stock, req.params.id], () => {
      req.flash('success', 'Product updated!');
      res.redirect('/products');
    });
});

// Delete product
app.post('/products/delete/:id', isAdmin, (req, res) => {
  db.query('DELETE FROM products WHERE id = ?', [req.params.id], () => {
    req.flash('success', 'Product deleted!');
    res.redirect('/products');
  });
});

// ================= CART =================

app.get('/cart', isUser, (req, res) => {
  const userId = req.session.user.id;
  db.query(`
    SELECT c.id, p.name, p.price, c.quantity, c.size
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?`, [userId], (err, cartItems) => {
    res.render('cart', { cartItems });
  });
});

app.post('/cart/add/:id', isUser, (req, res) => {
  const { size, quantity } = req.body;
  db.query('INSERT INTO cart (user_id, product_id, quantity, size) VALUES (?, ?, ?, ?)',
    [req.session.user.id, req.params.id, quantity, size], () => {
      res.redirect('/cart');
    });
});

app.post('/cart/update/:id', isUser, (req, res) => {
  db.query('UPDATE cart SET quantity = ? WHERE id = ?', 
    [req.body.quantity, req.params.id], () => {
      res.redirect('/cart');
    });
});

app.post('/cart/remove/:id', isUser, (req, res) => {
  db.query('DELETE FROM cart WHERE id = ?', [req.params.id], () => {
    res.redirect('/cart');
  });
});

// ================= START =================

app.listen(port, () => {
  console.log(`Footlocker app running on http://localhost:${port}`);
});


