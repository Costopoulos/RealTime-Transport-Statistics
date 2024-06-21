import express from 'express';
import { json } from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();
const app = express();


app.use(json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
