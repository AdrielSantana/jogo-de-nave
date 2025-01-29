import WebSocket from "ws";
import { Server } from "http";
import { GameService } from "../../application/services/GameService";
import { PlayerInput } from "../../domain/valueObjects/PlayerInput";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Input validation schemas
const playerInputSchema = z.object({
  type: z.literal("input"),
  keys: z.object({
    rollLeft: z.boolean(),
    rollRight: z.boolean(),
    accelerate: z.boolean(),
    shoot: z.boolean(),
  }),
});

const playerRotationSchema = z.object({
  type: z.literal("rotation"),
  rotation: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

const playerJoinSchema = z.object({
  type: z.literal("join"),
  name: z.string().min(2).max(15),
});

type WebSocketMessage =
  | z.infer<typeof playerInputSchema>
  | z.infer<typeof playerRotationSchema>
  | z.infer<typeof playerJoinSchema>;

export class WebSocketServer {
  private wss: WebSocket.Server;
  private gameService: GameService;
  private clients: Map<string, WebSocket>;
  private broadcastInterval: NodeJS.Timeout | null;

  constructor(server: Server, gameService: GameService) {
    this.wss = new WebSocket.Server({ server });
    this.gameService = gameService;
    this.clients = new Map();
    this.broadcastInterval = null;

    this.setupWebSocketServer();
    this.startBroadcastLoop();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      const playerId = uuidv4();
      console.log(`Player ${playerId} connected`);

      // Store client connection
      this.clients.set(playerId, ws);

      // Send initial game state
      this.sendInitialState(ws, playerId);

      // Handle messages
      ws.on("message", (message: string) =>
        this.handleMessage(playerId, message)
      );

      // Handle disconnection
      ws.on("close", () => this.handleDisconnection(playerId));

      // Handle errors
      ws.on("error", (error: Error) => {
        console.error(`WebSocket error for player ${playerId}:`, error);
      });
    });
  }

  private sendInitialState(ws: WebSocket, playerId: string): void {
    const initialState = {
      type: "init",
      playerId: playerId,
      gameState: this.gameService.getGameState(),
    };
    ws.send(JSON.stringify(initialState));
  }

  private handleMessage(playerId: string, message: string): void {
    try {
      const data = JSON.parse(message) as WebSocketMessage;

      switch (data.type) {
        case "join":
          try {
            const validatedData = playerJoinSchema.parse(data);
            this.gameService.addPlayer(playerId, validatedData.name);
          } catch (error) {
            console.error("Invalid join data:", error);
          }
          break;

        case "input":
          try {
            const validatedData = playerInputSchema.parse(data);
            this.gameService.handlePlayerInput(playerId, validatedData.keys);
          } catch (error) {
            console.error("Invalid input data:", error);
          }
          break;

        case "rotation":
          try {
            const validatedData = playerRotationSchema.parse(data);
            this.gameService.handlePlayerRotation(
              playerId,
              validatedData.rotation
            );
          } catch (error) {
            console.error("Invalid rotation data:", error);
          }
          break;

        default:
          console.warn(`Unknown message type received from player ${playerId}`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private handleDisconnection(playerId: string): void {
    console.log(`Player ${playerId} disconnected`);
    this.clients.delete(playerId);
    this.gameService.removePlayer(playerId);
  }

  private startBroadcastLoop(): void {
    // Clear any existing interval
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    // Start new broadcast loop
    this.broadcastInterval = setInterval(() => {
      this.gameService.update();
      this.broadcastGameState();
    }, 1000 / 60); // 60 FPS
  }

  private broadcastGameState(): void {
    const gameState = this.gameService.getGameState();
    const message = JSON.stringify({
      type: "gameState",
      state: gameState,
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public stop(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    this.wss.close();
  }
}
