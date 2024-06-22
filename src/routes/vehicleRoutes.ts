import { Router } from "express";
import { ingestData, getNClosestVehicles, getNUniqueClosestVehicles } from "../controllers/vehicleController";

const router = Router();

router.post("/ingest", ingestData);
router.get("/closest", getNClosestVehicles);
router.get("/unique-closest", getNUniqueClosestVehicles);

export default router;