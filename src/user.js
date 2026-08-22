const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("./db");
const verifyToken = require("./middleware/verifyToken");

const router = express.Router();


// =====================================================
// GET ALL USERS
// GET /api/users
// =====================================================

router.get("/", verifyToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                id AS user_id,
                username,
                phone,
                address
             FROM users
             ORDER BY id DESC`
        );

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("Get users error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch users"
        });
    }
});


// =====================================================
// ADD USER
// POST /api/users
// =====================================================

router.post("/", verifyToken, async (req, res) => {
    try {
        const {
            username,
            password,
            phone,
            address
        } = req.body;

        // Validation
        if (!username || !username.trim()) {
            return res.status(400).json({
                success: false,
                message: "Username is required"
            });
        }

        if (!password || !password.trim()) {
            return res.status(400).json({
                success: false,
                message: "Password is required"
            });
        }

        // Check duplicate username
        const existingUser = await db.query(
            "SELECT id FROM users WHERE username = $1",
            [username.trim()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(
            password.trim(),
            10
        );

        // Insert user
        const result = await db.query(
            `INSERT INTO users
                (username, password, phone, address)
             VALUES
                ($1, $2, $3, $4)
             RETURNING
                id AS user_id,
                username,
                phone,
                address`,
            [
                username.trim(),
                hashedPassword,
                phone || null,
                address || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "User added successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Add user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add user"
        });
    }
});


// =====================================================
// UPDATE USER
// PUT /api/users/:user_id
// =====================================================

router.put("/:user_id", verifyToken, async (req, res) => {
    try {
        const { user_id } = req.params;

        const {
            username,
            password,
            phone,
            address
        } = req.body;

        // Validation
        if (!username || !username.trim()) {
            return res.status(400).json({
                success: false,
                message: "Username is required"
            });
        }

        // Check user exists
        const userExists = await db.query(
            "SELECT id FROM users WHERE id = $1",
            [user_id]
        );

        if (userExists.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check duplicate username
        const duplicateUser = await db.query(
            `SELECT id
             FROM users
             WHERE username = $1
             AND id != $2`,
            [
                username.trim(),
                user_id
            ]
        );

        if (duplicateUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        let result;

        // ---------------------------------------------
        // UPDATE WITH PASSWORD
        // ---------------------------------------------

        if (password && password.trim()) {

            const hashedPassword = await bcrypt.hash(
                password.trim(),
                10
            );

            result = await db.query(
                `UPDATE users
                 SET
                    username = $1,
                    password = $2,
                    phone = $3,
                    address = $4,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5
                 RETURNING
                    id AS user_id,
                    username,
                    phone,
                    address`,
                [
                    username.trim(),
                    hashedPassword,
                    phone || null,
                    address || null,
                    user_id
                ]
            );

        }

        // ---------------------------------------------
        // UPDATE WITHOUT PASSWORD
        // ---------------------------------------------

        else {

            result = await db.query(
                `UPDATE users
                 SET
                    username = $1,
                    phone = $2,
                    address = $3,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                 RETURNING
                    id AS user_id,
                    username,
                    phone,
                    address`,
                [
                    username.trim(),
                    phone || null,
                    address || null,
                    user_id
                ]
            );

        }

        res.json({
            success: true,
            message: "User updated successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Update user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update user"
        });
    }
});


// =====================================================
// DELETE USER
// DELETE /api/users/:user_id
// =====================================================

router.delete("/:user_id", verifyToken, async (req, res) => {
    try {
        const { user_id } = req.params;

        const result = await db.query(
            `DELETE FROM users
             WHERE id = $1
             RETURNING id`,
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error("Delete user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete user"
        });
    }
});


module.exports = router;