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
                name,
                min_order_qty,
                uom,
                category,
                purchase_price,
                gst_applicable,
                hsn_code,
                barcode
             FROM products
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
// ADD PRODUCT
// POST /api/products
// =====================================================

router.post("/", verifyToken, async (req, res) => {

    try {

        const {
            name,
            min_order_qty,
            uom,
            category,
            purchase_price,
            gst_applicable,
            hsn_code,
            barcode
        } = req.body;


        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Product name is required"
            });
        }


        // -----------------------------
        // CHECK DUPLICATE BARCODE
        // -----------------------------

        if (barcode && barcode.trim()) {

            const barcodeCheck = await db.query(
                `SELECT id
                 FROM products
                 WHERE barcode = $1`,
                [barcode.trim()]
            );

            if (barcodeCheck.rows.length > 0) {

                return res.status(409).json({
                    success: false,
                    message: "Barcode already exists"
                });
            }
        }


        // -----------------------------
        // INSERT PRODUCT
        // -----------------------------

        const result = await db.query(
            `INSERT INTO products
            (
                name,
                min_order_qty,
                uom,
                category,
                purchase_price,
                gst_applicable,
                hsn_code,
                barcode
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
            )
            RETURNING
                id AS product_id,
                name,
                min_order_qty,
                uom,
                category,
                purchase_price,
                gst_applicable,
                hsn_code,
                barcode`,
            [
                name.trim(),
                min_order_qty || 1,
                uom || null,
                category || null,
                purchase_price || 0,
                gst_applicable === "No" ? false : true,
                hsn_code || null,
                barcode ? barcode.trim() : null
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
            name,
            min_order_qty,
            uom,
            category,
            purchase_price,
            gst_applicable,
            hsn_code,
            barcode
        } = req.body;


        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (!name || !name.trim()) {

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
             WHERE id = $1`,
            [product_id]
        );

        if (productCheck.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }


        // -----------------------------
        // CHECK DUPLICATE BARCODE
        // -----------------------------

        if (barcode && barcode.trim()) {

            const barcodeCheck = await db.query(
                `SELECT id
                 FROM products
                 WHERE barcode = $1
                 AND id != $2`,
                [
                    barcode.trim(),
                    product_id
                ]
            );

            if (barcodeCheck.rows.length > 0) {

                return res.status(409).json({
                    success: false,
                    message: "Barcode already exists"
                });
            }
        }


        // -----------------------------
        // UPDATE
        // -----------------------------

        const result = await db.query(
            `UPDATE products
             SET
                name = $1,
                min_order_qty = $2,
                uom = $3,
                category = $4,
                purchase_price = $5,
                gst_applicable = $6,
                hsn_code = $7,
                barcode = $8,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $9
             RETURNING
                id AS product_id,
                name,
                min_order_qty,
                uom,
                category,
                purchase_price,
                gst_applicable,
                hsn_code,
                barcode`,
            [
                name.trim(),
                min_order_qty || 1,
                uom || null,
                category || null,
                purchase_price || 0,
                gst_applicable === "No" ? false : true,
                hsn_code || null,
                barcode ? barcode.trim() : null,
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
// DELETE PRODUCT
// DELETE /api/products/:product_id
// =====================================================

router.delete("/:product_id", verifyToken, async (req, res) => {

    try {

        const { product_id } = req.params;


        const result = await db.query(
            `DELETE FROM products
             WHERE id = $1
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


module.exports = router;