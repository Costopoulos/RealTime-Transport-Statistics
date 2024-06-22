import express from 'express';
import { json } from 'body-parser';
import dotenv from 'dotenv';
import vehicleRoutes from './routes/vehicleRoutes';

dotenv.config();
const app = express();


app.use(json());
app.use('/api/vehicles', vehicleRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
