import request from 'supertest';
import app from '../../src/index';
import pool from '../../src/services/dbService';

// Mock the dbService module
jest.mock('../../src/services/dbService');

// Mock the MQTT client
jest.mock('../../src/services/mqttService', () => {
    return {
        subscribe: jest.fn((topic, callback) => {
            callback(null);
        }),
        unsubscribe: jest.fn((topic, callback) => {
            callback(null);
        }),
        on: jest.fn((event, callback) => {
            if (event === 'message') {
                callback('/hfp/v2/journey/ongoing/vp/#', JSON.stringify({
                    VP: {
                        desi: 'test-route',
                        veh: 'test-vehicle',
                        tst: new Date().toISOString(),
                        spd: 50,
                        lat: 60.192059,
                        long: 24.945831
                    }
                }));
            }
        }),
        end: jest.fn()
    };
});

// Silence console logs during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Ingest Data Test
describe('POST /api/vehicles/ingest', () => {
    it('should fail with non-numeric duration', async () => {
        const res = await request(app).post('/api/vehicles/ingest').query({duration: 'xyz'});
        expect(res.status).toBe(400);
        expect(res.text).toBe('Invalid duration');
    });
});


// Get N Closest Vehicles Test
describe('GET /api/vehicles/closest', () => {
    it('should fail when latitude and longitude are missing', async () => {
        const res = await request(app).get('/api/vehicles/closest');
        expect(res.status).toBe(400);
        expect(res.text).toBe('Latitude and longitude are required');
    });

    it('should return closest vehicles when lat and long are provided', async () => {
        (pool.query as jest.Mock).mockResolvedValue({
            rows: [
                {
                    route_number: 'M1',
                    vehicle_number: '123',
                    speed: 50,
                    latitude: 60.192059,
                    longitude: 24.945831,
                    distance: 1.7135  // Mocking the distance value
                }
            ]
        });

        const res = await request(app).get('/api/vehicles/closest').query({
            latitude: 60.192059,
            longitude: 24.945862,
            n: 1
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toEqual(expect.objectContaining({
            route_number: 'M1',
            vehicle_number: '123',
            speed: 50,
            latitude: 60.192059,
            longitude: 24.945831,
        }));
        expect(res.body[0].distance).toBeCloseTo(1.7135, 4);
    });
});


// Get Average Speed Per Route Test
describe('GET /api/vehicles/average-speed', () => {
    it('should return average speed per route', async () => {
        (pool.query as jest.Mock).mockResolvedValue({
            rows: [
                {route_number: 'M1', average_speed: 45.5}
            ]
        });

        const res = await request(app).get('/api/vehicles/average-speed');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            {route_number: 'M1', average_speed: 45.5}
        ]);
    });
});

// Get Metro Max Speeds Near Office Test
describe('GET /api/vehicles/metro-max-speeds', () => {
    it('should return max speeds near office', async () => {
        (pool.query as jest.Mock).mockResolvedValue({
            rows: [
                {route_number: 'M1', vehicle_number: '123', max_speed: 80, milliseconds_ago: 10000, distance: 50}
            ]
        });

        const res = await request(app).get('/api/vehicles/metro-max-speeds');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            {route_number: 'M1', vehicle_number: '123', max_speed: 80, milliseconds_ago: 10000, distance: 50}
        ]);
    });
});

// Clean up mocks after tests
afterAll(() => {
    jest.restoreAllMocks();
    app.close(); // Close the server to avoid Jest open handle error
});
