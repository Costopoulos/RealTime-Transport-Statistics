import mqtt from 'mqtt';
import pool from './dbService';

// Connect to the MQTT broker
const client = mqtt.connect('mqtts://mqtt.hsl.fi:8883'); //8883 for TLS
const topic = '/hfp/v2/journey/ongoing/vp/#';

// Subscribe to the topic
client.on('connect', () => {
    console.log('Connected to MQTT broker');
    client.subscribe(topic, (err) => {
        if (err) {
            console.error(`Failed to subscribe to topic: ${err.message}`);
        }
        console.log(`Subscribed to ${topic}`);
    });
});

// Receive the messages and ingest them to the database
client.on('message', async (topic, message) => {
    // Parse message and retrieve the necessary fields
    const data = JSON.parse(message.toString())
    const {desi: route, veh: vehicle, tst: timestamp, spd: speed, lat: latitude, long: longitude} = data.VP;

    // Skip message if any critical field is missing
    if (route == undefined || vehicle == undefined || timestamp == undefined ||
        speed == undefined || latitude == undefined || longitude == undefined) {
        return;
    }

    // Parse the timestamp to a Date object
    const tst = new Date(timestamp);
    if (isNaN(tst.getTime())) {
        console.error('Invalid timestamp');
        return;
    }

    // Insert the data to the database
    try {
        const query = `
            INSERT INTO vehicles (route_number, vehicle_number, timestamp, speed, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await pool.query(query,
            [route, vehicle, tst, parseFloat(speed), parseFloat(latitude), parseFloat(longitude)
        ]);
        console.log('Data inserted successfully');
    } catch (err) {
        console.error(`Failed to insert data: ${err.message}`);
    }
});

// Handle errors
client.on('error', (err) => {
    console.error(`Error: ${err.message}`);
});