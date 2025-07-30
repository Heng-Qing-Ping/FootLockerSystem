const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const multer = require('multer');

const app = express();
const { isLoggedIn, isAdmin } = require('./middleware/auth');

// Database connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207',
    database: 'c237_ca2'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'footlocker-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Access denied');
    }
}

// Routes

// Home page - show all products
app.get('/', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY created_at DESC';
    db.query(sql, (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Database error');
        }
        res.render('index', { 
            products: products, 
            user: req.session.user 
        });
    });
});

// Register page
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { username, email, password, role } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
        
        db.query(sql, [username, email, hashedPassword, role || 'user'], (err) => {
            if (err) {
                console.error('Registration error:', err);
                return res.render('register', { error: 'Registration failed' });
            }
            res.redirect('/login');
        });
    } catch (error) {
        console.error('Hashing error:', error);
        res.render('register', { error: 'Registration failed' });
    }
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    
    db.query(sql, [username], async (err, results) => {
        if (err) {
            console.error('Login error:', err);
            return res.render('login', { error: 'Login failed' });
        }
        
        if (results.length && await bcrypt.compare(password, results[0].password)) {
            req.session.user = results[0];
            res.redirect('/');
        } else {
            res.render('login', { error: 'Invalid credentials' });
        }
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Products page with search and filter
app.get('/products', (req, res) => {
    const { search, category, brand, sort } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (search) {
        sql += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    if (brand) {
        sql += ' AND brand = ?';
        params.push(brand);
    }
    
    // Sorting
    if (sort === 'price_asc') {
        sql += ' ORDER BY price ASC';
    } else if (sort === 'price_desc') {
        sql += ' ORDER BY price DESC';
    } else if (sort === 'name') {
        sql += ' ORDER BY name ASC';
    } else {
        sql += ' ORDER BY created_at DESC';
    }
    
    db.query(sql, params, (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Database error');
        }
        
        res.render('products', { 
            products: products, 
            user: req.session.user,
            filters: { search, category, brand, sort }
        });
    });
});

// Cart functionality
app.get('/cart', requireAuth, (req, res) => {
    const sql = `
        SELECT c.*, p.name, p.price, p.image_url, p.brand 
        FROM cart c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.user_id = ?
    `;
    
    db.query(sql, [req.session.user.id], (err, cartItems) => {
        if (err) {
            console.error('Error fetching cart:', err);
            return res.status(500).send('Database error');
        }
        
        res.render('cart', { 
            cartItems: cartItems, 
            user: req.session.user 
        });
    });
});

app.post('/cart/add', requireAuth, (req, res) => {
    const { product_id, quantity, size } = req.body;
    const user_id = req.session.user.id;
    
    // Check if item already exists in cart
    const checkSql = 'SELECT * FROM cart WHERE user_id = ? AND product_id = ? AND size = ?';
    
    db.query(checkSql, [user_id, product_id, size || ''], (err, existing) => {
        if (err) {
            console.error('Error checking cart:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing.length > 0) {
            // Update quantity
            const updateSql = 'UPDATE cart SET quantity = quantity + ? WHERE id = ?';
            db.query(updateSql, [quantity, existing[0].id], (err) => {
                if (err) {
                    console.error('Error updating cart:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ success: true });
            });
        } else {
            // Add new item
            const insertSql = 'INSERT INTO cart (user_id, product_id, quantity, size) VALUES (?, ?, ?, ?)';
            db.query(insertSql, [user_id, product_id, quantity, size || ''], (err) => {
                if (err) {
                    console.error('Error adding to cart:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ success: true });
            });
        }
    });
});

// Admin panel
app.get('/admin', requireAdmin, (req, res) => {
    const productsSql = 'SELECT * FROM products ORDER BY created_at DESC';
    const usersSql = 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC';
    const ordersSql = 'SELECT * FROM orders ORDER BY created_at DESC';
    
    db.query(productsSql, (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Database error');
        }
        
        db.query(usersSql, (err2, users) => {
            if (err2) {
                console.error('Error fetching users:', err2);
                return res.status(500).send('Database error');
            }
            
            db.query(ordersSql, (err3, orders) => {
                if (err3) {
                    console.error('Error fetching orders:', err3);
                    return res.status(500).send('Database error');
                }
                
                res.render('admin', { 
                    products: products, 
                    users: users, 
                    orders: orders, 
                    user: req.session.user 
                });
            });
        });
    });
});

// Add product
app.post('/admin/products', requireAdmin, upload.single('image'), (req, res) => {
    const { name, brand, category, price, description, stock } = req.body;
    const image_url = req.file ? `/images/${req.file.filename}` : null;
    
    const sql = 'INSERT INTO products (name, brand, category, price, description, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)';
    
    db.query(sql, [name, brand, category, price, description, image_url, stock], (err) => {
        if (err) {
            console.error('Error adding product:', err);
            return res.status(500).send('Database error');
        }
        res.redirect('/admin');
    });
});

// Edit product
app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
    const sql = 'SELECT * FROM products WHERE id = ?';
    
    db.query(sql, [req.params.id], (err, results) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).send('Database error');
        }
        
        if (results.length === 0) {
            return res.status(404).send('Product not found');
        }
        
        res.render('edit-product', { 
            product: results[0], 
            user: req.session.user 
        });
    });
});

app.post('/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
    const { name, brand, category, price, description, stock } = req.body;
    let image_url = req.body.current_image;
    
    if (req.file) {
        image_url = `/images/${req.file.filename}`;
    }
    
    const sql = 'UPDATE products SET name = ?, brand = ?, category = ?, price = ?, description = ?, image_url = ?, stock = ? WHERE id = ?';
    
    db.query(sql, [name, brand, category, price, description, image_url, stock, req.params.id], (err) => {
        if (err) {
            console.error('Error updating product:', err);
            return res.status(500).send('Database error');
        }
        res.redirect('/admin');
    });
});

// Delete product
app.delete('/admin/products/:id', requireAdmin, (req, res) => {
    const sql = 'DELETE FROM products WHERE id = ?';
    
    db.query(sql, [req.params.id], (err) => {
        if (err) {
            console.error('Error deleting product:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Checkout
app.post('/checkout', requireAuth, (req, res) => {
    const user_id = req.session.user.id;
    
    // Get cart items
    const cartSql = `
        SELECT c.*, p.price 
        FROM cart c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.user_id = ?
    `;
    
    db.query(cartSql, [user_id], (err, cartItems) => {
        if (err) {
            console.error('Error fetching cart for checkout:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (cartItems.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        // Calculate total
        const total = cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);
        
        // Create order
        const orderSql = 'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)';
        
        db.query(orderSql, [user_id, total, 'pending'], (err, orderResult) => {
            if (err) {
                console.error('Error creating order:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const order_id = orderResult.insertId;
            
            // Add order items
            const orderItemsSql = 'INSERT INTO order_items (order_id, product_id, quantity, price, size) VALUES ?';
            const orderItemsData = cartItems.map(item => [
                order_id, item.product_id, item.quantity, item.price, item.size
            ]);
            
            db.query(orderItemsSql, [orderItemsData], (err) => {
                if (err) {
                    console.error('Error creating order items:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Clear cart
                const clearCartSql = 'DELETE FROM cart WHERE user_id = ?';
                
                db.query(clearCartSql, [user_id], (err) => {
                    if (err) {
                        console.error('Error clearing cart:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    res.json({ success: true, order_id: order_id });
                });
            });
        });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.end((err) => {
        if (err) {
            console.error('Error closing database connection:', err);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
app.use('/', require('./routes/search'));