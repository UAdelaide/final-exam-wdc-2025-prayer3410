var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;

(async () => {
  try {

    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root'
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();


    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      database: 'DogWalkService'
    });

    await db.execute(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner', 'walker') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS Dogs (
        dog_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        size ENUM('small', 'medium', 'large') NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )
    `);


    const [userCount] = await db.execute('SELECT COUNT(*) as count FROM Users');
    if (userCount[0].count === 0) {
      await db.execute(`
        INSERT INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('lucaswalker', 'lucas@walkers.net', 'hashedabc', 'walker'),
        ('ninaowner', 'nina@doglovers.org', 'hashednina', 'owner')
      `);
    }

    const [dogCount] = await db.execute('SELECT COUNT(*) as count FROM Dogs');
    if (dogCount[0].count === 0) {
      await db.execute(`
        INSERT INTO Dogs (owner_id, name, size)
        VALUES
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
        ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small')
      `);
    }

  } catch (err) {
    console.error('Error setting up database:', err);
  }
})();


app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        d.name AS dog_name,
        d.size,
        u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching /api/dogs:', err);
    res.status(500).json({ error: 'Failed to retrieve' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;
