-- =============================
-- 1️⃣ Create Database
-- =============================
DROP DATABASE IF EXISTS footlocker_db;
CREATE DATABASE footlocker_db;
USE footlocker_db;

-- =============================
-- 2️⃣ Create Users Table
-- =============================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NULL,
    role ENUM('admin','user') DEFAULT 'user'
);

-- Insert default admin
-- Password = admin123 (bcrypt hash)
INSERT INTO users (username, password, email, role) VALUES
('admin', '$2b$10$D4G5f18o7aMMfwasBlR.CeHf1jhkK/qZc7Mx3ZZx6j07dQ0oGBp9a', 'admin@example.com', 'admin');

-- =============================
-- 3️⃣ Create Products Table
-- =============================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image VARCHAR(255) NULL
);

-- Optional: Sample products
INSERT INTO products (name, price) VALUES
('Air Jordan 1 High', 170.00),
('Ultraboost 22', 190.00),
('Classic Leather', 75.00),
('Suede Classic', 65.00),
('Chuck Taylor All Star', 55.00);

-- =============================
-- ✅ Done
-- =============================
