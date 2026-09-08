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

        const result = await db.query(`
            SELECT
                u.id AS user_id,
                u.user_code,
                u.username,
                u.phone,
                u.address,

                u.organization_id,
                o.organization_code,
                o.organization_name,

                u.role_id,
                r.role_name,

                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', b.id,
                            'branch_code', b.branch_code,
                            'branch_name', b.branch_name
                        )
                    ) FILTER (WHERE b.id IS NOT NULL),
                    '[]'
                ) AS branches

            FROM users u

            INNER JOIN organizations o
                ON o.id = u.organization_id
                AND o.is_deleted = FALSE

            INNER JOIN roles r
                ON r.id = u.role_id
                AND r.is_deleted = FALSE

            LEFT JOIN user_branch_access uba
                ON uba.user_id = u.id

            LEFT JOIN branches b
                ON b.id = uba.branch_id
                AND b.is_deleted = FALSE

            WHERE u.is_deleted = FALSE

            GROUP BY
                u.id,
                u.user_code,
                u.username,
                u.phone,
                u.address,
                u.organization_id,
                o.organization_code,
                o.organization_name,
                u.role_id,
                r.role_name

            ORDER BY u.id DESC
        `);

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
// GET USER BY ID
// GET /api/users/:user_id
// =====================================================

router.get("/:user_id", verifyToken, async (req, res) => {
    try {

        const { user_id } = req.params;

        const result = await db.query(`
            SELECT
                u.id AS user_id,
                u.user_code,
                u.username,
                u.phone,
                u.address,

                u.organization_id,
                o.organization_code,
                o.organization_name,

                u.role_id,
                r.role_name,

                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', b.id,
                            'branch_code', b.branch_code,
                            'branch_name', b.branch_name
                        )
                    ) FILTER (WHERE b.id IS NOT NULL),
                    '[]'
                ) AS branches

            FROM users u

            INNER JOIN organizations o
                ON o.id = u.organization_id
                AND o.is_deleted = FALSE

            INNER JOIN roles r
                ON r.id = u.role_id
                AND r.is_deleted = FALSE

            LEFT JOIN user_branch_access uba
                ON uba.user_id = u.id

            LEFT JOIN branches b
                ON b.id = uba.branch_id
                AND b.is_deleted = FALSE

            WHERE u.id = $1
            AND u.is_deleted = FALSE

            GROUP BY
                u.id,
                u.user_code,
                u.username,
                u.phone,
                u.address,
                u.organization_id,
                o.organization_code,
                o.organization_name,
                u.role_id,
                r.role_name
        `, [user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error("Get user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch user"
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
            user_code,
            username,
            password,
            phone,
            address,
            organization_id,
            role_id,
            branch_ids
        } = req.body;


        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (!user_code || !user_code.trim()) {
            return res.status(400).json({
                success: false,
                message: "User code is required"
            });
        }

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

        if (!organization_id) {
            return res.status(400).json({
                success: false,
                message: "Organization is required"
            });
        }

        if (!role_id) {
            return res.status(400).json({
                success: false,
                message: "Role is required"
            });
        }

        if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one branch is required"
            });
        }


        // -------------------------------------------------
        // CHECK DUPLICATE USER CODE
        // -------------------------------------------------

        const existingCode = await db.query(
            `SELECT id
             FROM users
             WHERE user_code = $1`,
            [user_code.trim()]
        );

        if (existingCode.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "User code already exists"
            });
        }


        // -------------------------------------------------
        // CHECK DUPLICATE USERNAME
        // -------------------------------------------------

        const existingUser = await db.query(
            `SELECT id
             FROM users
             WHERE username = $1`,
            [username.trim()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }


        // -------------------------------------------------
        // CHECK ORGANIZATION
        // -------------------------------------------------

        const organization = await db.query(
            `SELECT id
             FROM organizations
             WHERE id = $1
             AND is_deleted = FALSE`,
            [organization_id]
        );

        if (organization.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }


        // -------------------------------------------------
        // CHECK ROLE
        // Role must belong to same organization
        // -------------------------------------------------

        const role = await db.query(
            `SELECT id
             FROM roles
             WHERE id = $1
             AND organization_id = $2
             AND is_deleted = FALSE`,
            [
                role_id,
                organization_id
            ]
        );

        if (role.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Role not found for this organization"
            });
        }


        // -------------------------------------------------
        // CHECK BRANCHES
        // All branches must belong to organization
        // -------------------------------------------------

        const branchResult = await db.query(
            `SELECT id
             FROM branches
             WHERE id = ANY($1::int[])
             AND organization_id = $2
             AND is_deleted = FALSE`,
            [
                branch_ids,
                organization_id
            ]
        );

        if (branchResult.rows.length !== branch_ids.length) {
            return res.status(400).json({
                success: false,
                message: "One or more branches are invalid for this organization"
            });
        }


        // -------------------------------------------------
        // HASH PASSWORD
        // -------------------------------------------------

        const hashedPassword = await bcrypt.hash(
            password.trim(),
            10
        );


        // -------------------------------------------------
        // INSERT USER
        // -------------------------------------------------

        const result = await db.query(
            `INSERT INTO users
            (
                user_code,
                username,
                password,
                phone,
                address,
                organization_id,
                role_id
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            RETURNING
                id AS user_id,
                user_code,
                username,
                phone,
                address,
                organization_id,
                role_id`,
            [
                user_code.trim(),
                username.trim(),
                hashedPassword,
                phone || null,
                address || null,
                organization_id,
                role_id
            ]
        );


        const userId = result.rows[0].user_id;


        // -------------------------------------------------
        // INSERT BRANCH ACCESS
        // -------------------------------------------------

        for (const branchId of branch_ids) {

            await db.query(
                `INSERT INTO user_branch_access
                (
                    user_id,
                    branch_id
                )
                VALUES
                ($1, $2)`,
                [
                    userId,
                    branchId
                ]
            );
        }


        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

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
            address,
            organization_id,
            role_id,
            branch_ids
        } = req.body;


        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (!username || !username.trim()) {
            return res.status(400).json({
                success: false,
                message: "Username is required"
            });
        }

        if (!organization_id) {
            return res.status(400).json({
                success: false,
                message: "Organization is required"
            });
        }

        if (!role_id) {
            return res.status(400).json({
                success: false,
                message: "Role is required"
            });
        }

        if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one branch is required"
            });
        }


        // -------------------------------------------------
        // CHECK USER
        // -------------------------------------------------

        const userExists = await db.query(
            `SELECT id
             FROM users
             WHERE id = $1
             AND is_deleted = FALSE`,
            [user_id]
        );

        if (userExists.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // -------------------------------------------------
        // CHECK DUPLICATE USERNAME
        // -------------------------------------------------

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


        // -------------------------------------------------
        // CHECK ORGANIZATION
        // -------------------------------------------------

        const organization = await db.query(
            `SELECT id
             FROM organizations
             WHERE id = $1
             AND is_deleted = FALSE`,
            [organization_id]
        );

        if (organization.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }


        // -------------------------------------------------
        // CHECK ROLE
        // -------------------------------------------------

        const role = await db.query(
            `SELECT id
             FROM roles
             WHERE id = $1
             AND organization_id = $2
             AND is_deleted = FALSE`,
            [
                role_id,
                organization_id
            ]
        );

        if (role.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Role not found for this organization"
            });
        }


        // -------------------------------------------------
        // CHECK BRANCHES
        // -------------------------------------------------

        const branchResult = await db.query(
            `SELECT id
             FROM branches
             WHERE id = ANY($1::int[])
             AND organization_id = $2
             AND is_deleted = FALSE`,
            [
                branch_ids,
                organization_id
            ]
        );

        if (branchResult.rows.length !== branch_ids.length) {
            return res.status(400).json({
                success: false,
                message: "One or more branches are invalid for this organization"
            });
        }


        // -------------------------------------------------
        // UPDATE USER
        // -------------------------------------------------

        let result;

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
                    organization_id = $5,
                    role_id = $6,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7
                 AND is_deleted = FALSE
                 RETURNING
                    id AS user_id,
                    user_code,
                    username,
                    phone,
                    address,
                    organization_id,
                    role_id`,
                [
                    username.trim(),
                    hashedPassword,
                    phone || null,
                    address || null,
                    organization_id,
                    role_id,
                    user_id
                ]
            );

        } else {

            result = await db.query(
                `UPDATE users
                 SET
                    username = $1,
                    phone = $2,
                    address = $3,
                    organization_id = $4,
                    role_id = $5,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6
                 AND is_deleted = FALSE
                 RETURNING
                    id AS user_id,
                    user_code,
                    username,
                    phone,
                    address,
                    organization_id,
                    role_id`,
                [
                    username.trim(),
                    phone || null,
                    address || null,
                    organization_id,
                    role_id,
                    user_id
                ]
            );
        }


        // -------------------------------------------------
        // UPDATE BRANCH ACCESS
        // -------------------------------------------------

        await db.query(
            `DELETE FROM user_branch_access
             WHERE user_id = $1`,
            [user_id]
        );


        for (const branchId of branch_ids) {

            await db.query(
                `INSERT INTO user_branch_access
                (
                    user_id,
                    branch_id
                )
                VALUES
                ($1, $2)`,
                [
                    user_id,
                    branchId
                ]
            );
        }


        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

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
// DELETE USER - SOFT DELETE
// DELETE /api/users/:user_id
// =====================================================

router.delete("/:user_id", verifyToken, async (req, res) => {
    try {

        const { user_id } = req.params;

        const result = await db.query(
            `UPDATE users
             SET
                is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             AND is_deleted = FALSE
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


// =====================================================
// RESTORE USER
// PUT /api/users/:user_id/restore
// =====================================================

router.put("/:user_id/restore", verifyToken, async (req, res) => {
    try {

        const { user_id } = req.params;

        const result = await db.query(
            `UPDATE users
             SET
                is_deleted = FALSE,
                deleted_at = NULL,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             AND is_deleted = TRUE
             RETURNING
                id AS user_id,
                user_code,
                username`,
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Deleted user not found"
            });
        }

        res.json({
            success: true,
            message: "User restored successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error("Restore user error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to restore user"
        });
    }
});


module.exports = router;