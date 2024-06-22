import { Router } from "express";
import { ingestData } from "../controllers/vehicleController";

const router = Router();

router.post("/ingest", ingestData);

export default router;