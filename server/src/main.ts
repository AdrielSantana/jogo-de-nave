import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "./infrastructure/websocket/WebSocketServer";
import { GameService } from "./application/services/GameService";
import { InMemoryGameStateRepository } from "./infrastructure/repositories/InMemoryGameStateRepository";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, "../../public")));

// Create game dependencies
const gameStateRepository = new InMemoryGameStateRepository();
const gameService = new GameService(gameStateRepository);
const wsServer = new WebSocketServer(server, gameService);

// Start server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
