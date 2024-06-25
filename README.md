# RealTime-Transport-Statistics
This project provides a real-time transport statistics application using data from [Helsinki's Transportation Service API's MQTT broker](https://digitransit.fi/en/developers/apis/4-realtime-api/vehicle-positions/high-frequency-positioning/). The application ingests vehicle data, stores it in a PostgreSQL database, and provides endpoints to query the data.

## Project Description
The task is defined in detail in the `dev-challenge-backend-transport-2024.pdf` file. Its endpoint-wise definition is as follows:

### Ingest Data

**POST** `/api/vehicles/ingest?duration={seconds}`

Ingests vehicle data from MQTT (after preprocessing them) for the specified duration (in seconds).

### Get N Closest Vehicles

**GET** `/api/vehicles/closest?latitude={lat}&longitude={long}&n={number}`

Retrieves the N closest vehicles to the given latitude and longitude.

### Get N Closest Unique Vehicles

**GET** `/api/vehicles/unique-closest?latitude={lat}&longitude={long}&n={number}`

Retrieves the N closest _distinct_ vehicles to the given latitude and longitude.

### Get Average Speed Per Route

**GET** `/api/vehicles/average-speed`

Calculates the average speed of all vehicles for each route.

### Get Metro Max Speeds Near Office

**GET** `/api/vehicles/metro-speeds-timestamp`

Retrieves the maximum speeds and the time since those speeds were achieved for metro vehicles near the office.


## Application Installation
1. **First make sure to install PostGIS**
```
sudo apt update
sudo apt install postgresql-15-postgis-3
```

2. **Clone the repository:**
```bash
git clone https://github.com/Costopoulos/RealTime-Transport-Statistics.git
cd RealTime-Transport-Statistics
```

3. **Install requirements**
```
npm install
```

4. **Configure the environment variables:**

Create a `.env` file in the root of the project and add the following environment variables:
```env
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transport_db
```

5. **Set up the database:**

Make sure PostgreSQL is running and create the database:
```bash
psql -U postgres -c "CREATE DATABASE transport_db;"
```

Run the SQL script to set up the tables and indexes:
```bash
psql -U postgres -d transport_db -f db/setup.sql
```

Alternatively, if you're not working in a Unix environment, you can manually copy paste the contents of `db/setup.sql` in the `transport_db` after having created the latter.

## Running the App
```
npm start
```

## Test
Testing is performed using `Jest`, being configured in `jest.config.js`. `Mocking` as well as actual endpoint testing is included. The following command runs the tests while making sure to detect open handles.
```
npm run test
```

This is the result of `npm run test`:
```
> realtime-transport-statistics@1.0.0 test
> jest --detectOpenHandles

 PASS  tests/controllers/vehicleController.test.ts
  POST /api/vehicles/ingest
    ✓ should fail with non-numeric duration (55 ms)
  GET /api/vehicles/closest
    ✓ should fail when latitude and longitude are missing (11 ms)
    ✓ should return closest vehicles when lat and long are provided (10 ms)
  GET /api/vehicles/average-speed
    ✓ should return average speed per route (17 ms)
  GET /api/vehicles/metro-max-speeds
    ✓ should return max speeds near office (11 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        1.607 s, estimated 3 s
Ran all test suites.
```
