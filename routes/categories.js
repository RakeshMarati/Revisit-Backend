// routes/categories.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const auth = require('../middleware/auth');

const router = express.Router();
const dbPath = path.resolve(__dirname, '../database/user.db');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to avoid overwriting
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Helper function to get database connection
const getDb = async () => {
  return await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
};

// @route   GET api/categories
// @desc    Get all categories
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const db = await getDb();
    const categories = await db.all('SELECT * FROM categories ORDER BY created_at DESC');
    
    // Transform the response to match frontend expectations
    const transformedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      itemCount: category.item_count,
      image: category.image ? `/uploads/${category.image}` : null,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }));
    
    res.json(transformedCategories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/categories
// @desc    Create a new category
// @access  Private
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, itemCount } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    const db = await getDb();
    
    // Check if the category already exists
    const existingCategory = await db.get('SELECT * FROM categories WHERE name = ?', name);
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    // Get the filename of the uploaded image
    const imageFilename = req.file ? req.file.filename : null;
    
    // Insert the new category
    const result = await db.run(
      'INSERT INTO categories (name, item_count, image) VALUES (?, ?, ?)',
      [name, itemCount || 0, imageFilename]
    );
    
    // Get the newly created category
    const newCategory = await db.get('SELECT * FROM categories WHERE id = ?', result.lastID);
    
    res.status(201).json({
      id: newCategory.id,
      name: newCategory.name,
      itemCount: newCategory.item_count,
      image: imageFilename ? `/uploads/${imageFilename}` : null,
      createdAt: newCategory.created_at,
      updatedAt: newCategory.updated_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/categories/:id
// @desc    Update a category
// @access  Private
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, itemCount } = req.body;
    
    const db = await getDb();
    
    // Check if the category exists
    const category = await db.get('SELECT * FROM categories WHERE id = ?', id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Get the filename of the uploaded image
    const imageFilename = req.file ? req.file.filename : category.image;
    
    // Update the category
    await db.run(
      'UPDATE categories SET name = ?, item_count = ?, image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name || category.name, itemCount !== undefined ? itemCount : category.item_count, imageFilename, id]
    );
    
    // Get the updated category
    const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', id);
    
    res.json({
      id: updatedCategory.id,
      name: updatedCategory.name,
      itemCount: updatedCategory.item_count,
      image: updatedCategory.image ? `/uploads/${updatedCategory.image}` : null,
      createdAt: updatedCategory.created_at,
      updatedAt: updatedCategory.updated_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/categories/:id
// @desc    Delete a category
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await getDb();
    
    // Check if the category exists
    const category = await db.get('SELECT * FROM categories WHERE id = ?', id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Remove the image if it exists
    if (category.image) {
      const imagePath = path.join(__dirname, '../uploads', category.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete the category
    await db.run('DELETE FROM categories WHERE id = ?', id);
    
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;