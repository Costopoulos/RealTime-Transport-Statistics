import { Router } from "express";
import { ingestData, getNClosestVehicles, getNUniqueClosestVehicles, getMetroMaxSpeedsNearOffice } from "../controllers/vehicleController";

const router = Router();

router.post("/ingest", ingestData);
router.get("/closest", getNClosestVehicles);
router.get("/unique-closest", getNUniqueClosestVehicles);
router.get("/metro-max-speeds", getMetroMaxSpeedsNearOffice);

export default router;