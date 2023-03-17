const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const app = express();
app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server is running at http://localhost:3001");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// AuthenticationToken Verification

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRETE_TOKEN", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const existUserDetails = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(existUserDetails);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparedPassword = await bcrypt.compare(
      password,
      userDetails.password
    );
    let payLoad = { username: username };
    if (comparedPassword === true) {
      const jwtToken = jwt.sign(payLoad, "MY_SECRETE_TOKEN");
      response.send(jwtToken);
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2 GET Method

app.get("/states/", authentication, async (request, response) => {
  const details = `
        SELECT 
            state_id AS stateId,
            state_name AS stateName,
            population 
        FROM 
            state
        ORDER BY 
            state_id;
    `;
  const dbResponse = await db.all(details);
  response.send(dbResponse);
});

// API 3 GET Method

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const details = `
        SELECT 
            state_id AS stateId,
            state_name AS stateName,
            population 
        FROM 
            state
        WHERE 
            state_id = '${stateId}';
    `;
  const dbResponse = await db.get(details);
  response.send(dbResponse);
});

// API 4 POST Method
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertDist = `
        INSERT INTO 
            district(district_name, state_id, cases, cured, active, deaths)
        VALUES(
            '${districtName}',
            '${stateId}',
            '${cases}',
            '${cured}',
            '${active}',
            '${deaths}'
        );
  `;
  const dbResponse = await db.run(insertDist);
  const districtId = dbResponse.district_id;
  response.send("District Successfully Added");
});

// API 5 GET Method

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const details = `
        SELECT 
            district_id AS districtId,
            district_name AS districtName,
             state_id AS stateId,
            cases,
            cured, 
            active,
            deaths
        FROM 
            district
        WHERE 
            district_id = '${districtId}';
    `;
    const dbResponse = await db.get(details);
    response.send(dbResponse);
  }
);

// API 6 DELETE Method

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDist = `
        DELETE FROM
            district
        WHERE 
            district_id = '${districtId}';
    `;
    await db.run(deleteDist);
    response.send("District Removed");
  }
);

// PUT METHOD API 7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDist = `
        UPDATE 
            district
        SET
            district_name = '${districtName}',
            state_id = '${stateId}',
            cases = '${cases}',
            cured = '${cured}',
            active = '${active}',
            district_name = '${deaths}'
        WHERE 
            district_id = '${districtId}';
    `;
    await db.run(updateDist);
    response.send("District Details Updated");
  }
);

// API 8 GET

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const caseDetails = `
            SELECT 
                SUM(cases) AS totalCases,
                SUM(cured) AS totalCured,
                SUM(active) AS totalActive,
                 SUM(deaths) AS totalDeaths
            FROM 
                district
            WHERE 
                state_Id = '${stateId}';
    `;
    const dbResponse = await db.get(caseDetails);
    response.send(dbResponse);
  }
);

module.exports = app;
