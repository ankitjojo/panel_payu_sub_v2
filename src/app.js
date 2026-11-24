const path = require("path");
const express = require("express");
const pagesRoutes = require("./routes/pages.routes");
const apiRoutes = require("./routes/api.routes");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.json({ limit: "1mb" }));
// PayU redirects the browser back to surl/furl with a form POST
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/", pagesRoutes);
app.use("/api", apiRoutes);

// Unexpected errors come back as JSON so the page can show them
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || "Internal error" });
});

module.exports = app;
