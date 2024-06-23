import { Request, Response } from 'express';
import client from '../services/mqttService';
import pool from '../services/dbService';

// Define the office location and the radius to search for metro vehicles
const OFFICE_LAT = 60.18408281913011;
const OFFICE_LONG = 24.960090696148473;
const RADIUS = 400; // 400 meters

export const ingestData = (req: Request, res: Response) => {
    // Define the duration of the data collection
    const duration = parseFloat(req.query.duration as string) || 10; // define as string to avoid TS error because it could be ParsedQuery which is not assignable to number

    // Subscribe to the topic
    client.subscribe('/hfp/v2/journey/ongoing/vp/#', (err) => {
        if (err) {
            console.error(`Failed to subscribe to topic: ${err.message}`);
            res.status(500).send('Failed to subscribe to the topic');
        }
        console.log('Subscribed to the topic');

        // Set a timeout to unsubscribe after the specified duration
        setTimeout(() => {
            client.unsubscribe('/hfp/v2/journey/ongoing/vp/#', (err) => {
                if (err) {
                    console.error(`Failed to unsubscribe from topic: ${err.message}`);
                    res.status(500).send('Failed to unsubscribe from the topic');
                }
                console.log('Unsubscribed from the topic');
                res.status(200).send('Data ingestion complete');
            });
        }, duration * 1000);
    });
};

export const getNClosestVehicles = async (req: Request, res: Response) => {
    // Retrieve the query parameters
    const latitude = req.query.latitude;
    const longitude = req.query.longitude;
    const n = parseInt(req.query.n as string) || 3;

    if (latitude == undefined || longitude == undefined) {
        return res.status(400).send('Latitude and longitude are required');
    }

    // Query the database for the n closest vehicles
    try {
        // ST_SetSRID(ST_MakePoint($1, $2), 4326) is also an option, but it is treating it as flat geometry, not taking
        // into account the curvature of the Earth. With SRID 4326 the units are degrees, so the distance is in degrees.
        // To get the distance in meters, we use the geography type.
        const query = `
            SELECT route_number, vehicle_number, speed, latitude, longitude,
                   ST_Distance(
                       ST_MakePoint($1, $2)::geography,
                       ST_MakePoint(longitude, latitude)::geography
                   ) as distance
            FROM vehicles
            ORDER BY distance
            LIMIT $3;
        `;
        const result = await pool.query(query, [longitude, latitude, n]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(`Error fetching closest vehicles: ${err.message}`);
        res.status(500).send('Internal server error');
    }
};

export const getNUniqueClosestVehicles = async (req: Request, res: Response) => {
    // Retrieve the query parameters
    const latitude = req.query.latitude;
    const longitude = req.query.longitude;
    const n = parseInt(req.query.n as string) || 3;

    if (latitude == undefined || longitude == undefined) {
        return res.status(400).send('Latitude and longitude are required');
    }

    // Query the database for the n closest vehicles
    try {
        // Common Table Expression (CTE) to first rank the distances and then select the closest entries.
        const query = `
            WITH ranked_vehicles AS (
                SELECT route_number, vehicle_number, speed, latitude, longitude,
                       ST_Distance(
                           ST_MakePoint($1, $2)::geography,
                           ST_MakePoint(longitude, latitude)::geography
                       ) as distance,
                       ROW_NUMBER() OVER (PARTITION BY vehicle_number ORDER BY ST_Distance(
                           ST_MakePoint($1, $2)::geography,
                           ST_MakePoint(longitude, latitude)::geography
                       )) as rank
                FROM vehicles
            )
            SELECT route_number, vehicle_number, speed, latitude, longitude, distance
            FROM ranked_vehicles
            WHERE rank = 1
            ORDER BY distance
            LIMIT $3;
        `;
        const result = await pool.query(query, [longitude, latitude, n]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(`Error fetching closest vehicles: ${err.message}`);
        res.status(500).send('Internal server error');
    }
};

export const getMetroMaxSpeedsNearOffice = async (req: Request, res: Response) => {
    try {
        const query = `
            WITH max_speeds AS (
                SELECT route_number, vehicle_number, MAX(speed) AS max_speed, timestamp,
                       ST_Distance(
                           ST_MakePoint(longitude, latitude)::geography,
                           ST_MakePoint($1, $2)::geography
                       ) AS distance
                FROM vehicles
                WHERE route_number IN ('M1', 'M2')
                  AND ST_DWithin(
                        ST_MakePoint(longitude, latitude)::geography,
                        ST_MakePoint($1, $2)::geography,
                        $3
                    )
                GROUP BY route_number, vehicle_number, timestamp, latitude, longitude
            )
            SELECT route_number, vehicle_number, max_speed,
                   EXTRACT(EPOCH FROM (NOW() - timestamp)) * 1000 AS milliseconds_ago,
                   distance
            FROM max_speeds
            ORDER BY max_speed DESC;
        `;
        const result = await pool.query(query, [OFFICE_LONG, OFFICE_LAT, RADIUS]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching metro max speeds:', err);
        res.status(500).send('Internal server error');
    }
};
