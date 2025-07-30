// ====== IMPORTS ======
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const { isLoggedIn, isAdmin } = require('./middleware/auth');

const app = express();
const port = 3000;

// ====== MIDDLEWARE ======
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

// ====== DATABASE CONNECTION ======
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207',
    database: 'footlocker_db'
});

connection.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MySQL database!');
    }
});

// ====== MULTER SETUP FOR IMAGE UPLOADS ======
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ====== ROUTES ======

// Home page
app.get('/', (req, res) => {
    res.send('FootLocker website is running!');
});

// ===== CREATE PRODUCT =====
app.get('/products/add', isLoggedIn, isAdmin, (req, res) => {
    res.render('addProduct'); // ejs form to add product
});

app.post('/products/add', upload.single('image'), (req, res) => {
    const { name, price } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    connection.query(
        'INSERT INTO products (name, price, image) VALUES (?, ?, ?)',
        [name, price, image],
        (err) => {
            if (err) throw err;
            req.flash('success', 'Product added successfully!');
            res.redirect('/products');
        }
    );
});

// ===== READ / VIEW PRODUCTS =====
app.get('/products', (req, res) => {
    connection.query('SELECT * FROM products', (err, results) => {
        if (err) throw err;
        res.render('viewProducts', { products: results });
    });
});

// ===== UPDATE PRODUCT =====
app.get('/products/edit/:id', isLoggedIn, isAdmin, (req, res) => {
    connection.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.send('Product not found');
        res.render('editProduct', { product: results[0] });
    });
});

app.post('/products/edit/:id', upload.single('image'), (req, res) => {
    const { name, price } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.oldImage;

    connection.query(
        'UPDATE products SET name=?, price=?, image=? WHERE id=?',
        [name, price, image, req.params.id],
        (err) => {
            if (err) throw err;
            req.flash('success', 'Product updated successfully!');
            res.redirect('/products');
        }
    );
});

// ===== DELETE PRODUCT =====
app.get('/products/delete/:id', isLoggedIn, isAdmin, (req, res) => {
    connection.query('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Product deleted successfully!');
        res.redirect('/products');
    });
});

// ===== SEARCH PRODUCTS =====
app.get('/products/search', (req, res) => {
    const keyword = `%${req.query.keyword || ''}%`;
    connection.query(
        'SELECT * FROM products WHERE name LIKE ?',
        [keyword],
        (err, results) => {
            if (err) throw err;
            res.render('viewProducts', { products: results });
        }
    );
});

// ===== START SERVER =====
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

