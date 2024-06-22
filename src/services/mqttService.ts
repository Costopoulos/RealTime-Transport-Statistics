import mqtt from 'mqtt';

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

// Log the incoming messages
client.on('message', (topic, message) => {
    console.log(`Received message on topic ${topic}: ${message.toString()}`);
    // Save the message to the database
});

// Handle errors
client.on('error', (err) => {
    console.error(`Error: ${err.message}`);
});