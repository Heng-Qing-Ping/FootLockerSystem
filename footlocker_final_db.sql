
-- Final SQL for Footlocker E-Commerce App
CREATE DATABASE IF NOT EXISTS footlocker_db;
USE footlocker_db;

-- Users table
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
DROP TABLE IF EXISTS products;
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart table
DROP TABLE IF EXISTS cart;
CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT DEFAULT 1,
    size VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Orders table
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Order items table
DROP TABLE IF EXISTS order_items;
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    size VARCHAR(10),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@footlocker.com', '$2b$10$K7L/8YGmW8aEy.V2kYE8JO7qKp4EQB8f7VRX5YgZ9H3wL2mW8aEy', 'admin');

-- Insert sample products
INSERT INTO products (name, brand, category, price, description, image_url, stock) VALUES
('Air Jordan 1 High', 'Nike', 'Basketball', 170.00, 'Classic basketball shoe with premium leather upper', NULL, 25),
('Ultraboost 22', 'Adidas', 'Running', 190.00, 'Energy-returning running shoe with Boost technology', NULL, 30),
('Classic Leather', 'Reebok', 'Lifestyle', 75.00, 'Timeless casual sneaker with soft leather upper', NULL, 40),
('Suede Classic', 'Puma', 'Lifestyle', 65.00, 'Iconic lifestyle sneaker with suede upper', NULL, 35),
('Chuck Taylor All Star', 'Converse', 'Lifestyle', 55.00, 'The original basketball shoe, now a lifestyle icon', NULL, 50),
('Fresh Foam X', 'New Balance', 'Running', 130.00, 'Cushioned running shoe with Fresh Foam technology', NULL, 20);
