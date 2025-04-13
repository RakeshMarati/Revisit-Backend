// database/init.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Define the path to the database file
const dbPath = path.resolve(__dirname, './user.db');

// Sample categories data
const sampleCategories = [
  { name: 'Summer Clothes', itemCount: 26, image: 'summer.jpg' },
  { name: 'Winter Collection', itemCount: 32, image: 'winter.jpg' },
  { name: 'Casual Wear', itemCount: 45, image: 'casual.jpg' },
  { name: 'Formal Attire', itemCount: 18, image: 'formal.jpg' },
  { name: 'Sports & Outdoor', itemCount: 29, image: 'sports.jpg' },
  { name: 'Accessories', itemCount: 52, image: 'accessories.jpg' }
];

// Function to initialize the database
const initDb = async () => {
  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open the database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create categories table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      item_count INTEGER DEFAULT 0,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add sample data if the tables are empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    await db.run(`
      INSERT INTO users (username, email, password)
      VALUES ('admin', 'admin@example.com', ?)
    `, hashedPassword);
    
    console.log('Test user created: admin / password123');
  }

  const categoryCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (categoryCount.count === 0) {
    // Prepare statement for inserting categories
    const stmt = await db.prepare(`
      INSERT INTO categories (name, item_count, image)
      VALUES (?, ?, ?)
    `);
    
    // Insert sample categories
    for (const category of sampleCategories) {
      await stmt.run(category.name, category.itemCount, category.image);
    }
    
    await stmt.finalize();
    console.log('Sample categories added');
    
    // Copy sample images to uploads folder
    const sourcePath = path.join(__dirname, '../sample-images');
    const destPath = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    // Note: In a real implementation, you'd need to provide these images
    console.log('Note: You need to manually add images to the uploads folder');
  }

  return db;
};

module.exports = initDb;