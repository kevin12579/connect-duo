const express = require("express");
const { listRanking, createProfile } = require("../controllers/tax.controller");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/ranking", listRanking);
router.post("/profile", requireAuth, createProfile);

module.exports = router;