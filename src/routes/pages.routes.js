const express = require("express");
const { home, payuReturn } = require("../controllers/pages.controller");

const router = express.Router();
router.get("/", home);
router.all("/payu/return", payuReturn); // PayU POSTs here; GET just shows an empty result

module.exports = router;
