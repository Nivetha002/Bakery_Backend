const express = require("express");
const db = require("./db");
const verifyToken = require("./middleware/verifyToken");

const router = express.Router();


// =====================================================
// GET ALL PRODUCTS
// GET /api/products
// =====================================================

router.get("/", verifyToken, async (req, res) => {
    try {

        const result = await db.query(
            `SELECT
                id AS product_id,
                organization_id,
                branch_id,
                product_code,
                product_name,
                description,
                price,
                cost_price,
                created_at,
                updated_at
             FROM products
             WHERE is_deleted = FALSE
             ORDER BY id DESC`
        );

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error("Get products error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch products"
        });
    }
});


// =====================================================
// GET PRODUCT BY ID
// GET /api/products/:product_id
// =====================================================

router.get("/:product_id", verifyToken, async (req, res) => {

    try {

        const { product_id } = req.params;

        const result = await db.query(
            `SELECT
                id AS product_id,
                organization_id,
                branch_id,
                product_code,
                product_name,
                description,
                price,
                cost_price,
                created_at,
                updated_at
             FROM products
             WHERE id = $1
             AND is_deleted = FALSE`,
            [product_id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error("Get product error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch product"
        });
    }
});


// =====================================================
// ADD PRODUCT
// POST /api/products
// =====================================================

router.post("/", verifyToken, async (req, res) => {

    try {

        const {
            organization_id,
            branch_id,
            product_code,
            product_name,
            description,
            price,
            cost_price
        } = req.body;


        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (!organization_id) {

            return res.status(400).json({
                success: false,
                message: "Organization is required"
            });
        }

        if (!branch_id) {

            return res.status(400).json({
                success: false,
                message: "Branch is required"
            });
        }

        if (!product_code || !product_code.trim()) {

            return res.status(400).json({
                success: false,
                message: "Product code is required"
            });
        }

        if (!product_name || !product_name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }


        // -----------------------------
        // CHECK ORGANIZATION
        // -----------------------------

        const organizationCheck = await db.query(
            `SELECT id
             FROM organizations
             WHERE id = $1
             AND is_deleted = FALSE`,
            [organization_id]
        );

        if (organizationCheck.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Organization not found"
            });
        }


        // -----------------------------
        // CHECK BRANCH
        // -----------------------------

        const branchCheck = await db.query(
            `SELECT id
             FROM branches
             WHERE id = $1
             AND organization_id = $2
             AND is_deleted = FALSE`,
            [
                branch_id,
                organization_id
            ]
        );

        if (branchCheck.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Branch not found for this organization"
            });
        }


        // -----------------------------
        // CHECK DUPLICATE PRODUCT CODE
        // -----------------------------

        const productCodeCheck = await db.query(
            `SELECT id
             FROM products
             WHERE branch_id = $1
             AND product_code = $2
             AND is_deleted = FALSE`,
            [
                branch_id,
                product_code.trim()
            ]
        );

        if (productCodeCheck.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Product code already exists in this branch"
            });
        }


        // -----------------------------
        // INSERT PRODUCT
        // -----------------------------

        const result = await db.query(
            `INSERT INTO products
            (
                organization_id,
                branch_id,
                product_code,
                product_name,
                description,
                price,
                cost_price
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
                id AS product_id,
                organization_id,
                branch_id,
                product_code,
                product_name,
                description,
                price,
                cost_price,
                created_at,
                updated_at`,
            [
                organization_id,
                branch_id,
                product_code.trim(),
                product_name.trim(),
                description ? description.trim() : null,
                price || 0,
                cost_price || 0
            ]
        );


        res.status(201).json({
            success: true,
            message: "Product added successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error("Add product error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add product"
        });
    }
});


// =====================================================
// UPDATE PRODUCT
// PUT /api/products/:product_id
// =====================================================

router.put("/:product_id", verifyToken, async (req, res) => {

    try {

        const { product_id } = req.params;

        const {
            organization_id,
            branch_id,
            product_code,
            product_name,
            description,
            price,
            cost_price
        } = req.body;


        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (!organization_id) {

            return res.status(400).json({
                success: false,
                message: "Organization is required"
            });
        }

        if (!branch_id) {

            return res.status(400).json({
                success: false,
                message: "Branch is required"
            });
        }

        if (!product_code || !product_code.trim()) {

            return res.status(400).json({
                success: false,
                message: "Product code is required"
            });
        }

        if (!product_name || !product_name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }


        // -----------------------------
        // CHECK PRODUCT
        // -----------------------------

        const productCheck = await db.query(
            `SELECT id
             FROM products
             WHERE id = $1
             AND is_deleted = FALSE`,
            [product_id]
        );

        if (productCheck.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        // -----------------------------
        // CHECK ORGANIZATION
        // -----------------------------

        const organizationCheck = await db.query(
            `SELECT id
             FROM organizations
             WHERE id = $1
             AND is_deleted = FALSE`,
            [organization_id]
        );

        if (organizationCheck.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Organization not found"
            });
        }


        // -----------------------------
        // CHECK BRANCH
        // -----------------------------

        const branchCheck = await db.query(
            `SELECT id
             FROM branches
             WHERE id = $1
             AND organization_id = $2
             AND is_deleted = FALSE`,
            [
                branch_id,
                organization_id
            ]
        );

        if (branchCheck.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Branch not found for this organization"
            });
        }


        // -----------------------------
        // CHECK DUPLICATE PRODUCT CODE
        // -----------------------------

        const productCodeCheck = await db.query(
            `SELECT id
             FROM products
             WHERE branch_id = $1
             AND product_code = $2
             AND id != $3
             AND is_deleted = FALSE`,
            [
                branch_id,
                product_code.trim(),
                product_id
            ]
        );

        if (productCodeCheck.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Product code already exists in this branch"
            });
        }


        // -----------------------------
        // UPDATE PRODUCT
        // -----------------------------

        const result = await db.query(
            `UPDATE products
             SET
                organization_id = $1,
                branch_id = $2,
                product_code = $3,
                product_name = $4,
                description = $5,
                price = $6,
                cost_price = $7,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             AND is_deleted = FALSE
             RETURNING
                id AS product_id,
                organization_id,
                branch_id,
                product_code,
                product_name,
                description,
                price,
                cost_price,
                created_at,
                updated_at`,
            [
                organization_id,
                branch_id,
                product_code.trim(),
                product_name.trim(),
                description ? description.trim() : null,
                price || 0,
                cost_price || 0,
                product_id
            ]
        );


        res.json({
            success: true,
            message: "Product updated successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error("Update product error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update product"
        });
    }
});


// =====================================================
// DELETE PRODUCT - SOFT DELETE
// DELETE /api/products/:product_id
// =====================================================

router.delete("/:product_id", verifyToken, async (req, res) => {

    try {

        const { product_id } = req.params;

        const result = await db.query(
            `UPDATE products
             SET
                is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             AND is_deleted = FALSE
             RETURNING id`,
            [product_id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        res.json({
            success: true,
            message: "Product deleted successfully"
        });

    } catch (error) {

        console.error("Delete product error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete product"
        });
    }
});


// =====================================================
// RESTORE PRODUCT
// PUT /api/products/:product_id/restore
// =====================================================

router.put("/:product_id/restore", verifyToken, async (req, res) => {

    try {

        const { product_id } = req.params;

        const result = await db.query(
            `UPDATE products
             SET
                is_deleted = FALSE,
                deleted_at = NULL,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             AND is_deleted = TRUE
             RETURNING
                id AS product_id,
                organization_id,
                branch_id,
                product_code,
                product_name,
                description,
                price,
                cost_price`,
            [product_id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Deleted product not found"
            });
        }


        res.json({
            success: true,
            message: "Product restored successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error("Restore product error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to restore product"
        });
    }
});


module.exports = router;