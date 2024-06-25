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

Calculates the average speed of all vehicles for each route, **without the response time depending on the size of the data ingested so far.**

### Get Metro Max Speeds Near Office

**GET** `/api/vehicles/metro-speeds-timestamp`

Retrieves the maximum speeds and the time since those speeds were achieved for metro vehicles near the office.

## Design Process and Insights

### Database Choice and Setup
I chose PostgreSQL as the relational database for this project due to its high scalability and efficiency in handling large volumes of data. PostgreSQL's support for advanced indexing makes it an optimal choice for an application that manages data spanning multiple days.

Initially, I set up a service to retrieve data from Digitransit's MQTT broker to inspect the incoming data. Based on the data structure, I designed the database schema and stored it in the `db/setup.sql` file, which I later refined as the project evolved. I connected to the `/hfp/v2/journey/#` topic by default to capture all relevant data without using multiple wildcard characters. The connection was then narrowed down to `ongoing` trips (`/hfp/v2/journey/ongoing/vp/#`) to align with the API's requirements for endpoints involving real-time data.

### Schema Design
Key fields from the `VP` event type (`desi` for route number, `veh` for vehicle number, `spd` for speed, `lat` and `long` for latitude and longitude, and `tst` for timestamp) were selected for the schema due to their relevance for the application's queries.

### Error Handling in MQTT Messages
For error handling, I considered using `ON CONFLICT DO NOTHING` to ignore null values, but this approach would increase space and time complexity. Instead, I opted to drop messages if any of the critical fields (`desi`, `veh`, `spd`, `lat`, `long`, `tst`) were null or NaN. Using `==` for comparison allowed me to catch `null` and `NaN` values effectively. Notably, vehicle number `0` is considered valid (despite JavaScript & TypeScript considering it falsy), so it is ingested if all other fields are valid too.

### Indexing Strategy
Indexes were added to the following columns to optimize query performance:
1. `timestamp`: For time-based queries.
2. `route_number` and `vehicle_number`: For filtering and calculating statistics per route and vehicle.
3. `latitude` and `longitude`: For finding the closest vehicles.

I chose B-tree indexes for `timestamp`, `route_number`, and `vehicle_number` due to their suitability for high-cardinality (containing many unique values) columns. For geographical queries involving latitude and longitude, I selected `GiST` indexes over `SP-GiST` since `GiST` is well-suited for multi-dimensional data and supports distance queries, which are crucial for this application.

### Justification for Index Choices
Indexing has trade-offs, including:
1. **Write Performance**: Index maintenance during insertions, updates, and deletions can slow down write operations.
2. **Storage Space**: Each index requires additional storage.

I did not index the `speed` column because it is primarily used for aggregation (calculating averages) rather than direct lookups or filtering. Indexing `speed` would be more appropriate if it were used in `WHERE` clauses, joins, or as sort keys.

### Closest Vehicles Query
For the second endpoint (Get N Closest Vehicles), I encountered duplicate entries for the same vehicle at different timestamps. Adding a constraint on the fields (`route_number`, `vehicle_number`, `latitude`, `longitude`, `speed`) to prevent duplicates would not be feasible as it could exclude valid future entries, since public transportation vehicles follow the same routes and often travel at the same speeds. Instead, I used `SELECT DISTINCT ON (vehicle_number)` to return unique vehicles. However, this approach can yield incorrect distances because `DISTINCT ON` selects the first row for each `vehicle_number` based on the order specified, not necessarily the closest distance.

To ensure the closest unique vehicles are retrieved, I implemented a `Common Table Expression (CTE)` to rank the distances and then select the closest entries. The `ranked_vehicles` CTE ranks each vehicle's distances using `ROW_NUMBER()` with a `PARTITION BY vehicle_number` clause, ensuring each vehicle is considered once based on the closest distance. The outer query selects rows with `rank = 1` and orders them by distance, ensuring the top `n` closest unique vehicles are returned.

### Average Speed Per Route Endpoint
For the fourth endpoint (Get Average Speed Per Route), the response time must be independent of the total database size. There are several approaches to achieve this:
1. **Summary (Aggregate) Table & Trigger Function with Triggers**
2. **Materialized View & cronJob**
3. **Materialized View & Trigger Function with Triggers**

The second solution, while easier, involves running the same query repeatedly, effectively caching the results, which is kinda cheating. The first solution stores average speed per route in a summary table, updated via triggers on insertions or updates. The third solution, which refreshes a materialized view, can be resource-intensive for large datasets.

Given the real-time nature of the data, the summary table approach is preferred. Updates to the summary table are incremental and immediate, reducing the need for costly full-table scans or materialized view refreshes. Using triggers ensures real-time updates without periodic refreshes. Indexing the `route_number` column in the summary table optimizes read performance, crucial for real-time data applications. The response time is independent of the data size since the summary table stores pre-aggregated data for each route.

### Conclusion
This approach ensures efficient data ingestion, storage, and retrieval while maintaining performance. The design choices, particularly regarding indexing and data handling, optimize the application's ability to manage large datasets and provide real-time statistics effectively.

The correctness of the average speed per route endpoint was verified by cross-checking results with the following PostgreSQL query:
```sql
SELECT route_number, AVG(speed) AS average_speed
FROM vehicles
GROUP BY route_number;
```

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
