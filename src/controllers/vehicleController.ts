import { Request, Response } from 'express';
import client from '../services/mqttService';

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