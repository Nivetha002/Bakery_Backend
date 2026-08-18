require("dotenv").config();

const express = require("express");
const auth = require("./auth");

const app = express();

app.use(express.json());

app.post("/api/login", auth.login);
app.post("/api/logout", auth.logout);

app.get("/", (req, res) => {
    res.json({
        message: "Bakery backend is running"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});