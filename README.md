# RealTime-Transport-Statistics
Veri's Take Home Exam

## Project Description
The task is defined in the `dev-challenge-backend-transport-2024.pdf` file.

## Application Installation
First make sure to install PostGIS
```
sudo apt update
sudo apt install postgresql-15-postgis-3
```

Install requirements
```
npm install
```

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
