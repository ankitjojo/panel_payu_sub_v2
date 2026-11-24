const express = require("express");
const { initiate, verify } = require("../controllers/payment.controller");

const router = express.Router();
router.post("/initiate", initiate);
router.post("/verify", verify);

module.exports = router;
