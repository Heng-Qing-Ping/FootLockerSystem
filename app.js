const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const multer = require('multer');

const app = express();
const port = 3000;

// ===== Middleware =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'footlocker_secret',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});

// ===== MySQL =====
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Republic_C207',
  database: 'footlocker_db'
});
connection.connect(err => {
  if (err) console.error(err);
  else console.log(' MySQL Connected!');
});

// ===== Multer for Image Upload =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ===== Middleware Guards =====
function isLoggedIn(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function isAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.send('Access Denied');
  next();
}

// ===== Home =====
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.redirect('/products');
});

// ===== AUTH =====
app.get('/login', (req, res) => {
  res.render('login', {
    error: req.flash('error'),
    success: req.flash('success')
  });
});

app.get('/register', (req, res) => {
  res.render('register', {
    error: req.flash('error')
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  connection.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err || results.length === 0) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect('/products');
  });
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  connection.query(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    [username, email, hashed, 'user'],
    (err) => {
      if (err) {
        req.flash('error', 'Username or email already exists.');
        return res.redirect('/register');
      }
      req.flash('success', 'Account created. Please login.');
      res.redirect('/login');
    }
  );
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ===== PRODUCTS =====
app.get('/products', isLoggedIn, (req, res) => {
  connection.query('SELECT * FROM products', (err, results) => {
    if (err) throw err;
    res.render('products', { products: results });
  });
});

// ===== SEARCH PRODUCTS =====
app.get('/products/search', isLoggedIn, (req, res) => {
    const keyword = `%${req.query.keyword || ''}%`;

    connection.query('SELECT * FROM products WHERE name LIKE ?', [keyword], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'No products found for "' + req.query.keyword + '"');
        }

        res.render('products', { products: results });
    });
});


// ===== ADD PRODUCT =====
app.get('/products/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('addproduct', { error: null });
});

app.post('/products/add', isLoggedIn, isAdmin, upload.single('image'), (req, res) => {
  const { name, price, sizes, stocks } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  connection.query(
    'INSERT INTO products (name, price, image_url) VALUES (?, ?, ?)',
    [name, price, image_url],
    (err, result) => {
      if (err) throw err;
      const productId = result.insertId;

      // Insert sizes if provided
      if (sizes && stocks) {
        const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
        const stockArray = Array.isArray(stocks) ? stocks : [stocks];

        const sizeData = sizeArray.map((size, i) => [productId, size, stockArray[i]]);
        connection.query('INSERT INTO product_sizes (product_id, size, stock) VALUES ?', [sizeData]);
      }

      req.flash('success', ' Product added with sizes!');
      res.redirect('/products');
    }
  );
});

// ===== EDIT PRODUCT =====
app.get('/products/edit/:id', isLoggedIn, isAdmin, (req, res) => {
  const productId = req.params.id;

  connection.query('SELECT * FROM products WHERE id = ?', [productId], (err, productResults) => {
    if (err || productResults.length === 0) return res.send('Product not found');

    const product = productResults[0];

    connection.query('SELECT * FROM product_sizes WHERE product_id = ?', [productId], (err, sizeResults) => {
      if (err) throw err;
      product.sizes = sizeResults;
      res.render('editproduct', { product });
    });
  });
});

app.post('/products/edit/:id', isLoggedIn, isAdmin, upload.single('image'), (req, res) => {
  const { name, price, oldImage, sizes, stocks } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : oldImage;

  connection.query('UPDATE products SET name=?, price=?, image_url=? WHERE id=?',
    [name, price, image_url, req.params.id], (err) => {
      if (err) throw err;

      // Delete old sizes first
      connection.query('DELETE FROM product_sizes WHERE product_id=?', [req.params.id], () => {
        if (sizes && stocks) {
          const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
          const stockArray = Array.isArray(stocks) ? stocks : [stocks];

          const sizeData = sizeArray.map((size, i) => [req.params.id, size, stockArray[i]]);
          connection.query('INSERT INTO product_sizes (product_id, size, stock) VALUES ?', [sizeData]);
        }

        req.flash('success', ' Product updated with sizes!');
        res.redirect('/products');
      });
    });
});

// ===== DELETE PRODUCT =====
app.post('/products/delete/:id', isLoggedIn, isAdmin, (req, res) => {
  connection.query('DELETE FROM products WHERE id=?', [req.params.id], err => {
    if (err) throw err;
    req.flash('success', ' Product deleted successfully!');
    res.redirect('/products');
  });
});

// ===== PRODUCT DETAILS =====
app.get('/products/:id', isLoggedIn, (req, res) => {
  const productId = req.params.id;

  connection.query('SELECT * FROM products WHERE id = ?', [productId], (err, productResults) => {
    if (err || productResults.length === 0) return res.send('Product not found');

    const product = productResults[0];

    connection.query('SELECT * FROM product_sizes WHERE product_id = ?', [productId], (err, sizeResults) => {
      if (err) throw err;
      res.render('productdetails', { product, sizes: sizeResults });
    });
  });
});

// ===== CART =====
app.post('/cart/add/:id', isLoggedIn, (req, res) => {
    const productId = req.params.id;
    const sizeId = req.body.size_id;

    if (!sizeId) {
        req.flash('error', 'Please select a size.');
        return res.redirect('/products/' + productId);
    }

    // Check stock for the selected size
    connection.query('SELECT * FROM product_sizes WHERE id = ?', [sizeId], (err, results) => {
        if (err) throw err;
        if (results.length === 0 || results[0].stock <= 0) {
            req.flash('error', 'This size is out of stock.');
            return res.redirect('/products/' + productId);
        }

        // Deduct 1 from stock
        connection.query('UPDATE product_sizes SET stock = stock - 1 WHERE id = ?', [sizeId]);

        // Add to session cart
        if (!req.session.cart) req.session.cart = [];
        req.session.cart.push({ productId, sizeId });

        req.flash('success', 'Item added to cart!');
        res.redirect('/products');
    });
});

app.get('/cart', isLoggedIn, (req, res) => {
    const cart = req.session.cart || [];

    if (cart.length === 0) return res.render('cart', { cartItems: [] });

    // Join cart with product and size details
    const sizeIds = cart.map(item => item.sizeId);
    connection.query(
        `SELECT ps.id AS sizeId, ps.size, p.id AS productId, p.name, p.price, p.image_url
         FROM product_sizes ps
         JOIN products p ON ps.product_id = p.id
         WHERE ps.id IN (?)`, [sizeIds], 
         (err, results) => {
            if (err) throw err;
            res.render('cart', { cartItems: results });
         }
    );
});

app.get('/cart/remove/:sizeId', isLoggedIn, (req, res) => {
    const sizeId = req.params.sizeId;
    req.session.cart = (req.session.cart || []).filter(item => item.sizeId != sizeId);

    // Optionally return stock
    connection.query('UPDATE product_sizes SET stock = stock + 1 WHERE id = ?', [sizeId]);

    req.flash('success', 'Item removed from cart!');
    res.redirect('/cart');
});


// ===== START SERVER =====
app.listen(port, () => console.log(` Server running at http://localhost:${port}`));
