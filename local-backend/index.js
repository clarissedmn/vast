const express = require("express");
const cors = require("cors");
var path = require("path");
const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.get("/tracker/*", function (req, res) {
  console.log(
    `${new Date().toISOString().substring(11, 23)} - ${req.originalUrl}`
  );
});

app.get("/vmap", function (req, res) {
  res.contentType("application/xml");
  res.sendFile(path.join(__dirname, "vmap.xml"));
});

app.get("/vast", function (req, res) {
  res.contentType("application/xml");
  res.sendFile(path.join(__dirname, "vast.xml"));
});

// Setting the server to listen at port 3000
app.listen(3000, function (req, res) {
  console.log("Server is running at port 3000");
});
