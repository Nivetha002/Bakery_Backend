const jwt = require("jsonwebtoken");

// Checks for a valid JWT in the Authorization header before
// letting the request reach the actual route handler.
// Usage: app.get("/api/dashboard", verifyToken, dashboardController)

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({
            message: "No token provided"
        });
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            message: "Token format is 'Bearer <token>'"
        });
    }

    const token = parts[1];

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    message: "Token expired, please login again"
                });
            }

            return res.status(401).json({
                message: "Invalid token"
            });
        }

        // decoded = { id, username, iat, exp } -- from auth.js login
        req.user = decoded;
        next();
    });
};

module.exports = verifyToken;