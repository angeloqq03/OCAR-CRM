const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Set view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// MySQL Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "express_log",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err.message);
    return;
  }
  console.log("Connected to MySQL");
});

// Route to get all available agents
app.get("/agents", (req, res) => {
  const query = "SELECT * FROM agents WHERE availability = 'Available'";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching agents:", err.message);
      return res.status(500).send("Server Error");
    }
    res.render("index", { agents: results });
  });
});

// Route to get all request logs
app.get("/", (req, res) => {
  const query = "SELECT * FROM request_logs ORDER BY timestamp DESC";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching logs:", err.message);
      return res.status(500).send("Server Error");
    }
    const agentsQuery = "SELECT * FROM agents WHERE availability = 'Available'";
    db.query(agentsQuery, (agentErr, agents) => {
      if (agentErr) {
        console.error("Error fetching agents:", agentErr.message);
        return res.status(500).send("Server Error");
      }
      res.render("index", { logs: results, agents: agents });
    });
  });
});

// Route to check agent assignment
app.get("/check-agent-assignment", (req, res) => {
  const { agentName } = req.query;

  if (!agentName) {
    return res.status(400).send("Agent name is required.");
  }

  // Query to check if the agent exists and is assigned
  const agentQuery =
    "SELECT * FROM agents WHERE name = ? AND availability = 'Assigned'";
  db.query(agentQuery, [agentName], (err, agentResults) => {
    if (err) {
      console.error("Error checking agent in agents table:", err.message);
      return res.status(500).send("Server Error");
    }

    if (agentResults.length === 0) {
      return res.send("null"); // Agent not assigned
    }

    // Query to fetch the assigned phone number from request_logs
    const logQuery = "SELECT sender FROM request_logs WHERE agentName = ?";
    db.query(logQuery, [agentName], (err, logResults) => {
      if (err) {
        console.error("Error checking agent in request_logs:", err.message);
        return res.status(500).send("Server Error");
      }

      if (logResults.length === 0) {
        return res.send("null"); // No request assigned
      }

      // Return the phone number from the sender column
      const phoneNumber = logResults[0].sender;
      res.send(phoneNumber);
    });
  });
});

// Route to check if a message is already logged
app.get("/checkMessage", (req, res) => {
  const { sender, message } = req.query;

  if (!sender || !message) {
    return res.status(400).send("Sender and message fields are required.");
  }

  const query = "SELECT * FROM request_logs WHERE sender = ? AND message = ?";
  db.query(query, [sender, message], (err, results) => {
    if (err) {
      console.error("Error checking message:", err.message);
      return res.status(500).send("Server Error");
    }
    res.send(results.length > 0 ? "found" : "not found");
  });
});

// Route to log a new message
app.post("/log", (req, res) => {
  const { sender, message } = req.body;

  if (!sender || !message) {
    return res.status(400).send("Sender and message fields are required.");
  }

  const checkQuery =
    "SELECT * FROM request_logs WHERE sender = ? AND message = ?";
  db.query(checkQuery, [sender, message], (err, results) => {
    if (err) {
      console.error("Error checking message:", err.message);
      return res.status(500).send("Server Error");
    }

    if (results.length > 0) {
      return res.send("Duplicate message detected, skipping log.");
    }

    const insertQuery =
      "INSERT INTO request_logs (sender, message) VALUES (?, ?)";
    db.query(insertQuery, [sender, message], (err) => {
      if (err) {
        console.error("Error logging request:", err.message);
        return res.status(500).send("Server Error");
      }
      res.send("Message logged successfully!");
    });
  });
});

// Route to assign an agent to a log
// Route to assign an agent to a log
app.post("/assign-agent", (req, res) => {
  console.log("Received request:", req.body); // Log the received data

  const { agentName, logId } = req.body; // Expecting agentName from frontend

  if (!agentName || !logId) {
    console.log("Missing agentName or logId");
    return res.status(400).json({ message: "Agent and log ID are required." });
  }

  const checkAgentQuery =
    "SELECT * FROM agents WHERE name = ? AND availability = 'Available'";
  db.query(checkAgentQuery, [agentName], (err, agentResults) => {
    if (err) {
      console.error("Error checking agent availability:", err.message);
      return res.status(500).json({ message: "Server Error" });
    }

    if (agentResults.length === 0) {
      console.log("Agent not available:", agentName);
      return res.status(400).json({ message: "Agent not available." });
    }

    // Query to fetch the log using the logId, not agentName
    const fetchLogQuery = "SELECT sender FROM request_logs WHERE logId = ?"; // Changed agentName to id
    db.query(fetchLogQuery, [logId], (err, logResults) => {
      if (err) {
        console.error("Error fetching log details:", err.message);
        return res.status(500).json({ message: "Server Error" });
      }

      if (logResults.length === 0) {
        console.log("Log not found with id:", logId);
        return res.status(404).json({ message: "Log not found." });
      }

      const phoneNumber = logResults[0].sender;

      const assignAgentQuery =
        "UPDATE request_logs SET agentName = ? WHERE logId = ?"; // Corrected condition
      db.query(assignAgentQuery, [agentName, logId], (err) => {
        if (err) {
          console.error("Error assigning agent:", err.message);
          return res.status(500).json({ message: "Server Error" });
        }

        const updateAgentQuery =
          "UPDATE agents SET availability = 'Assigned' WHERE name = ?";
        db.query(updateAgentQuery, [agentName], (err) => {
          if (err) {
            console.error("Error updating agent availability:", err.message);
            return res.status(500).json({ message: "Server Error" });
          }

          res.json({
            message: "Agent assigned successfully!",
            phoneNumber,
          });
        });
      });
    });
  });
});

// Route to update agent availability after the call ends
app.get("/update-agent-availability", (req, res) => {
  const { agentName, availability } = req.query;

  if (!agentName || !availability) {
    return res.status(400).send("Agent name and availability are required.");
  }

  const query = "UPDATE agents SET availability = ? WHERE name = ?";
  db.query(query, [availability, agentName], (err, results) => {
    if (err) {
      console.error("Error updating agent availability:", err.message);
      return res.status(500).send("Server Error");
    }

    res.send(
      results.affectedRows > 0
        ? "Agent availability updated successfully"
        : "Agent not found"
    );
  });
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});