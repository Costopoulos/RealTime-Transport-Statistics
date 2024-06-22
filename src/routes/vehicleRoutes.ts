import { Router } from "express";
import { ingestData, getNClosestVehicles } from "../controllers/vehicleController";

const router = Router();

router.post("/ingest", ingestData);
router.get("/closest", getNClosestVehicles);

export default router;