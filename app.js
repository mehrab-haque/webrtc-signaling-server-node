const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const uuidv4 = require("uuid/v4");

const app = express();

const port = process.env.PORT || 11000;
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

let users = {};

const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

const sendToAll = (clients, type, { id, name: userName }) => {
  Object.values(clients).forEach(client => {
    if(client.name !== userName) {
      client.send(
        JSON.stringify({
          type,
          user: { id, userName }
        })
      )
    }
  })
};

wss.on("connection", ws => {
  ws.on("message", msg => {
    console.log("Received message: %s", msg);
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }
    const { type, name, offer, answer, candidate } = data;
    switch (type) {
      case "login":
        if (users[name]) {
          sendTo(ws, {
            type: "login",
            success: false,
            message: "Username is unavailable"
          });
        } else {
          const id = uuidv4();
          const loggedIn = Object.values(
            users
          ).map(({ id, name: userName }) => ({ id, userName }));
          users[name] = ws;
          ws.name = name;
          ws.id = id;
          sendTo(ws, {
            type: "login",
            success: true,
            users: loggedIn
          });
          sendToAll(users, "updateUsers", ws);
        }
        break;
      case "offer":
        const offerRecipient = users[name];
        if (!!offerRecipient) {
          ws.otherName = name;
          sendTo(offerRecipient, {
            type: "offer",
            offer,
            name: ws.name
          });
        }
        break;
      case "answer":
        const answerRecipient = users[name];
        if (!!answerRecipient) {
          ws.otherName = name;
          sendTo(answerRecipient, {
            type: "answer",
            answer
          });
        }
        break;
      case "candidate":
        const candidateRecipient = users[name];
        if (!!candidateRecipient) {
          sendTo(candidateRecipient, {
            type: "candidate",
            candidate
          });
        }
        break;
      case "leave":
        recipient = users[name];
        if (!!recipient) {
          recipient.otherName = null;
          sendTo(recipient, {
            type: "leave"
          });
        }
        break;
      default:
        sendTo(ws, {
          type: "error",
          message: "Command not found: " + type
        });
        break;
    }
  });

  ws.on("close", function() {
    if (ws.name) {
      delete users[ws.name];
      if (ws.otherName) {
        console.log("Disconnecting from ", ws.otherName);
        const recipient = users[ws.otherName];
        if (!!recipient) {
          recipient.otherName = null;
        }
      }
      sendToAll(users, "removeUser", ws);
    }
  });
  ws.send(
    JSON.stringify({
      type: "connect",
      message: "Well hello there, I am a WebSocket server"
    })
  );
});

server.listen(port, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});
