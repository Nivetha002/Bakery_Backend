const { Pool } = require("pg");

const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

db.connect()
    .then(() => {
        console.log("PostgreSQL connected successfully");
    })
    .catch((error) => {
        console.error("PostgreSQL connection error:", error);
    });

module.exports = db;