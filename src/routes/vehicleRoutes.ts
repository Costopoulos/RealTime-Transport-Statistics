import { Router } from "express";
import { ingestData, getNClosestVehicles, getNUniqueClosestVehicles, getAverageSpeedPerRoute, getMetroMaxSpeedsNearOffice } from "../controllers/vehicleController";

const router = Router();

// Define the routes for the vehicle data
router.post("/ingest", ingestData);
router.get("/closest", getNClosestVehicles);
router.get("/unique-closest", getNUniqueClosestVehicles);
router.get("/average-speed", getAverageSpeedPerRoute);
router.get("/metro-max-speeds", getMetroMaxSpeedsNearOffice);

export default router;