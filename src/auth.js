
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Validate input
        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        console.log("Login request:", username);

        // =====================================================
        // 2. CHECK SUPER ADMIN
        // =====================================================

        const superAdminResult = await db.query(
            `
            SELECT id, username, password
            FROM super_admins
            WHERE username = $1
              AND is_deleted = FALSE
            `,
            [username]
        );

        if (superAdminResult.rows.length > 0) {

            const superAdmin = superAdminResult.rows[0];

            const passwordMatch = await bcrypt.compare(
                password,
                superAdmin.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid username or password"
                });
            }

            // Create Super Admin token
            const token = jwt.sign(
                {
                    id: superAdmin.id,
                    username: superAdmin.username,
                    user_type: "SUPER_ADMIN"
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h"
                }
            );

            console.log("Super Admin login successful:", username);

            return res.json({
                message: "Login successful",
                token,
                user: {
                    id: superAdmin.id,
                    username: superAdmin.username,
                    user_type: "SUPER_ADMIN"
                }
            });
        }

        // =====================================================
        // 3. CHECK ORGANIZATION USER
        // =====================================================

        const userResult = await db.query(
            `
            SELECT
                u.id,
                u.user_code,
                u.username,
                u.password,
                u.phone,
                u.address,
                u.organization_id,
                o.organization_code,
                o.organization_name,
                u.role_id,
                r.role_name
            FROM users u
            INNER JOIN organizations o
                ON o.id = u.organization_id
            INNER JOIN roles r
                ON r.id = u.role_id
            WHERE u.username = $1
              AND u.is_deleted = FALSE
              AND o.is_deleted = FALSE
              AND r.is_deleted = FALSE
            `,
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const user = userResult.rows[0];

        // =====================================================
        // 4. VERIFY PASSWORD
        // =====================================================

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        // =====================================================
        // 5. GET USER BRANCH ACCESS
        // =====================================================

        const branchResult = await db.query(
            `
            SELECT
                b.id,
                b.branch_code,
                b.branch_name
            FROM user_branch_access uba
            INNER JOIN branches b
                ON b.id = uba.branch_id
            WHERE uba.user_id = $1
              AND b.organization_id = $2
              AND b.is_deleted = FALSE
            ORDER BY b.id
            `,
            [user.id, user.organization_id]
        );

        const branches = branchResult.rows;

        // User must have at least one branch
        if (branches.length === 0) {
            return res.status(403).json({
                message: "No branch access assigned to this user"
            });
        }

        // =====================================================
        // 6. CREATE JWT
        // =====================================================

        const token = jwt.sign(
            {
                id: user.id,
                user_code: user.user_code,
                username: user.username,
                organization_id: user.organization_id,
                role_id: user.role_id,
                user_type: "ORGANIZATION_USER"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        console.log("Login successful:", username);

        // =====================================================
        // 7. RETURN LOGIN RESPONSE
        // =====================================================

        return res.json({
            message: "Login successful",
            token,

            user: {
                id: user.id,
                user_code: user.user_code,
                username: user.username,

                organization: {
                    id: user.organization_id,
                    code: user.organization_code,
                    name: user.organization_name
                },

                role: {
                    id: user.role_id,
                    name: user.role_name
                },

                branches: branches
            }
        });

    } catch (error) {

        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};


// =====================================================
// LOGOUT
// =====================================================

const logout = (req, res) => {

    console.log("Logout request");

    res.json({
        message: "Logout successful"
    });
};


module.exports = {
    login,
    logout
};
