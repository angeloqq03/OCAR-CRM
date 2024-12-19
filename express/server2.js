const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();
const path = require("path");
// MySQL Database connection setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // change this if needed
  password: "", // change this if needed
  database: "express_log", // replace with your actual database name
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    return;
  }
  console.log("Connected to the database.");
});
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Set view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
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
app.post("/log", (req, res) => {
  const { sender, message } = req.body;

  if (!sender || !message) {
    return res
      .status(400)
      .send("Invalid request: 'sender' and 'message' fields are required.");
  }

  const checkQuery =
    "SELECT * FROM request_logs WHERE sender = ? AND message = ?";
  db.query(checkQuery, [sender, message], (err, results) => {
    if (err) {
      console.error("Error checking message:", err.message);
      return res.status(500).send("Server Error");
    }

    if (results.length > 0) {
      console.log(`Message already logged: ${message}`);
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

app.use(bodyParser.json());

// Route to assign an agent to a log and initiate the call
app.post("/assign-agent", (req, res) => {
  const { agentId, logId } = req.body;

  if (!agentId || !logId) {
    return res.status(400).json({ message: "Agent and log ID are required." });
  }

  // Check if the agent is available
  const checkAgentQuery =
    "SELECT * FROM agents WHERE id = ? AND availability = 'Available'";
  db.query(checkAgentQuery, [agentId], (err, agentResults) => {
    if (err) {
      console.error("Error checking agent availability:", err.message);
      return res.status(500).json({ message: "Server Error" });
    }

    if (agentResults.length === 0) {
      console.log("Agent not found or not available:", agentId);
      return res.status(400).json({ message: "Agent not available." });
    }

    // Fetch the sender (phone number) from the request log
    const fetchPhoneNumberQuery =
      "SELECT sender FROM request_logs WHERE id = ?";
    db.query(fetchPhoneNumberQuery, [logId], (err, logResults) => {
      if (err) {
        console.error("Error fetching sender number:", err.message);
        return res.status(500).json({ message: "Server Error" });
      }

      if (logResults.length === 0) {
        return res.status(404).json({ message: "Log not found." });
      }

      const senderPhoneNumber = logResults[0].sender;
      if (!senderPhoneNumber) {
        return res.status(400).json({ message: "No phone number available." });
      }

      // Assign the agent to the log and update agent availability
      const assignAgentQuery =
        "UPDATE request_logs SET agent_id = ? WHERE id = ?";
      db.query(assignAgentQuery, [agentId, logId], (err, updateResults) => {
        if (err) {
          console.error("Error assigning agent to request log:", err.message);
          return res.status(500).json({ message: "Server Error" });
        }

        // Update agent availability to 'Assigned'
        const updateAgentQuery =
          "UPDATE agents SET availability = 'Assigned' WHERE id = ?";
        db.query(updateAgentQuery, [agentId], (err, updateAgentResults) => {
          if (err) {
            console.error("Error updating agent availability:", err.message);
            return res.status(500).json({ message: "Server Error" });
          }

          // Return the phone number and a success message to the Android app
          res.json({
            message: "Agent assigned successfully and call initiated!",
            phoneNumber: senderPhoneNumber,
          });
        });
      });
    });
  });
});

// Route to update agent availability after the call ends
app.post("/end-call", (req, res) => {
  const { agentId, logId } = req.body;

  if (!agentId || !logId) {
    return res
      .status(400)
      .json({ message: "Agent ID and log ID are required." });
  }

  // Update agent availability to 'Available' after the call ends
  const updateAgentQuery =
    "UPDATE agents SET availability = 'Available' WHERE id = ?";
  db.query(updateAgentQuery, [agentId], (err, results) => {
    if (err) {
      console.error("Error updating agent availability:", err.message);
      return res.status(500).json({ message: "Server Error" });
    }

    // Clear agent assignment in the request log
    const clearAssignmentQuery =
      "UPDATE request_logs SET agent_id = NULL WHERE id = ?";
    db.query(clearAssignmentQuery, [logId], (err) => {
      if (err) {
        console.error("Error clearing agent assignment:", err.message);
        return res.status(500).json({ message: "Server Error" });
      }

      console.log(
        "Agent availability set to 'Available' and unassigned from log."
      );
      res.json({
        message: "Agent availability updated and unassigned from log.",
      });
    });
  });
});

// Start the Express server
const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
