require("dotenv").config();

const express = require("express");
const auth = require("./auth");
const verifyToken = require("./middleware/verifyToken");

const app = express();

app.use(express.json());

app.post("/api/login", auth.login);
app.post("/api/logout", auth.logout);

app.get("/", (req, res) => {
    res.json({
        message: "Bakery backend is running"
    });
});

// Example protected route -- any route that needs a logged-in
// user goes through verifyToken first. req.user is available
// inside the handler after the token is verified.
app.get("/api/me", verifyToken, (req, res) => {
    res.json({
        message: "Token is valid",
        user: req.user
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});