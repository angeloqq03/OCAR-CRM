const express = require("express");
const app = express();
const mysql = require("mysql");
const path = require("path");
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "anzel_brew",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Database connected!");
});

app.get("/", (req, res) => {
  res.render("indexx");
});

app.get("/display", (req, res) => {
  const sqlSelect = "SELECT * FROM products";
  db.query(sqlSelect, (err, result) => {
    if (err) throw err;
    res.render("indexx", { products: result });
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
