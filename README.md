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
I decided to use PostgreSQL for my relational database, since it is highly scalable and can handle loads of data very efficiently, while it can also support indexing, thus making it optimal for an application that will host data spanning multiple days. I initially set up a service for retrieving the data from Digitransit's MQTT broker so I look into them, and then I designed the database schema. I saved the database schema in the `db/setup.sql` file, which I later altered due to the design choices I was making along the way. I connected to the `/hfp/v2/journey/#` by default, since it allows me to access any number of words, instead of having to use multiple `+` wildcard characters which would limit me to exactly one word at a time. Then, I narrowed it down to `ongoing` trips due to the endpoints of the API ('3 closest vehicles at the moment' -> ongoing, 'average speed of all vehicles observed on a route so far' -> ongoing, and 'maximum speed of a vehicle while driving close to the office' -> ongoing) and, of course, `vp`. Looking into the field types of `VP`'s event-type, immediate attention is drawn to `desi` (aka route number), `veh` (vehicle number), `spd` (vehicle speed), `lat`&`long` (latitude and longitude, respectively) and `tst` (UTC timestamp with milliseconds precision, particularly useful for the 3rd endpoint). That's why these data only was used for defining the schema.

Regarding MQTT messages' error handling, I could have also run a query having the parameter `ON CONFLICT DO NOTHING`, meaning that `null` values would not be ingested (as expected), but this would result in an increase in space and time complexity. Therefore, I chose to drop the message if any of its important fields - `desi`, `veh`, `spd`, `lat`, `long`, `tst` - were `null` or `NaN`, aka `undefined` with `==` instead of `===`, because the latter signifies truly undefined, whereas `null` and `NaN` fall under the category of `==`. Side note: `0` is perceived as falsy in JavaScript and TypeScript and there is a `veh` with the value of `0`, so I decided to ingest that value, since it seems that vehicle 0 actually seems to exist, having all the other values correct.

Regarding indexing, I decided to proceed only with the following columns:
1) `timestamp` -> since I will be querying data based on time
2,3) `route_number` and `vehicle_number` -> filtering and calculating statistics per route and vehicle
4) `latitude` and `longitude` -> for finding the closest vehicles

I chose B-tree indexes for 1-3 since they are suitable for columns with high cardinality (many unique values). I could go with `GiST` or `SP-GiST` indexes for geographical queries involving latitude and longitude; `GiST` is a Generalized Search Tree, similar to a binary tree, but can be used for a wide variety of data types, including geometrical and textual data. It is particularly useful for multi-dimensional data and supports operations such as containment, adjacency, and distance queries. `SP-GiST` is a Space-Partitioned Generalized Search Tree, but is optimized for space-partitioning. It is used for partitioning data into non-overlapping regions, which is efficient for certain types of queries, such as nearest-neighbor searches. I chose `GiST`, since space-partitioning is not relevant to the scope of this project.

Why didn't I choose to index other columns? Indexing comes with tradeoffs, namely
1) Write Performance: Each index requires maintenance during insertions, updates, and deletions, which can slow down write operations.
2) Storage Space
Also, I specifically chose not to use `speed` as an index, since it is used for aggregation (in this case calculating averages) rather than a direct lookup or filtering. I would choose it if it was to be used in `WHERE` clauses, joins or as sort keys.

Regarding the 2nd endpoint (Get N Closest Vehicles), I noticed that while fetching the closest `n` vehicles to a position appointed with a specific latitude & longitude, there are same entries for `route_number`, `vehicle_number`, `latitude`, `longitude` and `speed`, but with different `timestamps`. I could add a constraint on the 5 fields in order not to include the multiple entries of them, but this would result in further complications since, for instance, a metro line's vehicle will have the exact combination of those 5 values again, in a much later `timestamp`. Using the constraint would mean that the entry with the new timestamp would not be registered, resulting in fewer, and false technically, data. That is why I  chose to enrich the query with the `SELECT DISTINCT ON (vehicle_number)` keyword, since I want to return different vehicles. However, the distances returned with the use of `DISTINCT ON` are different, and, for what is worth, wrong. That happens because this command removes duplicate entries based on the specified columns but it doesn't guarantee the closest distances since it only ensures distinct `vehicle_number` values are selected first based on the order specified. In other words, the query first removes duplicate `vehicle_number` entries (the first row for each `vehicle_number` encountered is selected), then orders by distance; this means the order by distance only applies within groups of `vehicle_number`, not globally, which does not result in the actual closest vehicles. To ensure that the closest unique vehicles are retrieved, I used a `Common Table Expression (CTE)` to first rank the distances and then select the closest entries. The `ranked_vehicles` CTE ranks each vehicle's distances using `ROW_NUMBER()` with a `PARTITION BY vehicle_number` clause. This ensures each vehicle is only considered once based on the closest distance. The outer query selects only the rows with `rank = 1` (i.e., the closest distance for each vehicle) and orders them by distance, ensuring the top `n` closest unique vehicles are returned. I created this as a `uniqueclosest/` endpoint, in addition to the `closest/` one. A similar approach could have been followed for the `metro_max_speeds` endpoint.

As for the 4th endpoint's (Get Average Speed Per Route) response time being irrelevant to the total amount of the database size, there are several ways to achieve it:
1) Summary (Aggregate) Table & Trigger Function with its Triggers or
2) Materialized View & cronJob
3) Materialized View & Trigger Function with its Triggers.

The second solution is easier, but it feels like cheating in a way because the same query is run many times - each time for the whole dataset - with the difference that it keeps already queried data in a cache. The first solution stores the average speed per route and a trigger can update this table whenever a new record is inserted or an existing record is updated. The third solution stores pre-computed average speeds for each route in the materialized view and that view can be refreshed periodically to ensure it remains up-to-date (caching); the updates are going to be done using a trigger to refresh the materialized view after each insert into the `vehicles` table. Since the dataset is going to be enormous, the materialized view solution should be avoided because refreshing a materialized view can be resource-intensive for large datasets. Furthermore, the aggregate table can use `ON CONFLICT` to handle specific conflicts during updates and can generally be more flexible with complex update logic, but it doesn't seem that `UPDATE` is needed in such a system given that it ingests data in real time from Helsinki Transportation System's API. Still, though, updates to the aggregate table are incremental and immediate, reducing the need for costly full-table scans or materialized view refreshes and using triggers ensures that the aggregate data is updated in real-time with each new insertion, providing up-to-date average speeds without the need for periodic refreshes. Moreover, given the real-time nature of the data with new timestamps received from Helsinki Transportation Service API's MQTT broker, the trigger function can be simplified to handle only `INSERT` operations. This reduces complexity and improves performance.
Summing up endpoint number 2, indexing the `route_number` in the summary table is chosen, given that the primary usage involves querying average speeds for specific routes. This will optimize the read performance, making queries more efficient, which is crucial for real-time data applications. The response time of the endpoint is independant from the amount of data ingested, since the summary table stores pre-aggregated data (`total speed`, `count`, and `average_speed`) for each route, meaning that the endpoint query only needs to read from this relatively small table, not scan the entire dataset.
The correctness of this endpoint was tested easily by cross-checking the results with the following query in PostgreSQL:
```
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
