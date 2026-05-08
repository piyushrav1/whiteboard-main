import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { connectMongo } from "./src/server/db.js";
import { Room, Stroke, Message, Snapshot } from "./src/server/models.js";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const port = Number(process.env.PORT || 3000);

const activeStrokes = new Map();
const activeUsersByRoom = new Map();

function strokeKey(roomID, strokeID) {
  return `${roomID}:${strokeID}`;
}

function roomUsers(roomID) {
  if (!activeUsersByRoom.has(roomID)) activeUsersByRoom.set(roomID, new Map());
  return activeUsersByRoom.get(roomID);
}

function publicUsers(roomID) {
  return [...roomUsers(roomID).values()].map(({ id, name, color }) => ({ id, name, color }));
}

async function getRoomState(roomID) {
  const [snapshot, strokes, messages] = await Promise.all([
    Snapshot.findOne({ roomID }).sort({ createdAt: -1 }).lean(),
    Stroke.find({ roomID, isDeleted: false }).sort({ zIndex: 1 }).lean(),
    Message.find({ roomID }).sort({ createdAt: -1 }).limit(80).lean()
  ]);

  return {
    snapshot: snapshot ? { image: snapshot.image, strokeCount: snapshot.strokeCount } : null,
    strokes: strokes.map((stroke) => ({
      strokeID: stroke.strokeID,
      author: stroke.author,
      points: stroke.points,
      style: stroke.style,
      zIndex: stroke.zIndex
    })),
    messages: messages.reverse().map((message) => ({
      id: message._id.toString(),
      author: message.author,
      body: message.body,
      createdAt: message.createdAt
    }))
  };
}

await app.prepare();
await connectMongo();

const httpServer = createServer((req, res) => handle(req, res));
const io = new Server(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 8e6
});

io.on("connection", (socket) => {
  socket.on("join-room", async ({ roomID, user }) => {
    if (!/^\d{6}$/.test(roomID || "")) return socket.emit("room-error", "Invalid room code");

    const room = await Room.findOne({ code: roomID });
    if (!room) return socket.emit("room-error", "Room not found");

    const member = {
      id: user?.id || socket.id,
      name: user?.name?.trim()?.slice(0, 32) || "Guest",
      color: user?.color || "#2563eb"
    };

    socket.data.roomID = roomID;
    socket.data.user = member;
    socket.join(roomID);
    roomUsers(roomID).set(socket.id, member);

    socket.emit("room-state", await getRoomState(roomID));
    io.to(roomID).emit("users-update", publicUsers(roomID));
  });

  socket.on("cursor-move", ({ x, y }) => {
    const { roomID, user } = socket.data;
    if (!roomID || !user) return;
    socket.to(roomID).emit("cursor-move", { user, x, y });
  });

  socket.on("cursor-leave", () => {
    const { roomID, user } = socket.data;
    if (!roomID || !user) return;
    socket.to(roomID).emit("cursor-leave", { id: user.id });
  });

  socket.on("start-stroke", ({ strokeID, color, width, initialCoords }) => {
    const { roomID, user } = socket.data;
    if (!roomID || !user || !strokeID || !initialCoords) return;

    const stroke = {
      strokeID,
      roomID,
      author: { id: user.id, name: user.name },
      points: [initialCoords],
      style: { color, width },
      startedAt: Date.now()
    };

    activeStrokes.set(strokeKey(roomID, strokeID), stroke);
    socket.to(roomID).emit("start-stroke", {
      strokeID,
      author: stroke.author,
      point: initialCoords,
      style: stroke.style
    });
  });

  socket.on("stream-stroke", ({ strokeID, point }) => {
    const { roomID } = socket.data;
    if (!roomID || !strokeID || !point) return;

    const stroke = activeStrokes.get(strokeKey(roomID, strokeID));
    if (!stroke) return;

    stroke.points.push(point);
    socket.to(roomID).emit("stream-stroke", { strokeID, point });
  });

  socket.on("end-stroke", async ({ strokeID, snapshot }) => {
    const { roomID } = socket.data;
    if (!roomID || !strokeID) return;

    const key = strokeKey(roomID, strokeID);
    const active = activeStrokes.get(key);
    if (!active) return;

    activeStrokes.delete(key);
    const room = await Room.findOneAndUpdate({ code: roomID }, { $inc: { strokeCount: 1 } }, { new: true });
    const zIndex = room?.strokeCount || Date.now();

    await Stroke.create({
      strokeID: active.strokeID,
      roomID,
      author: active.author,
      points: active.points,
      style: active.style,
      zIndex
    });

    if (snapshot && zIndex % 50 === 0) {
      const saved = await Snapshot.create({ roomID, image: snapshot, strokeCount: zIndex });
      await Room.updateOne({ code: roomID }, { latestSnapshot: saved._id });
      io.to(roomID).emit("snapshot-saved", { strokeCount: zIndex });
    }

    socket.to(roomID).emit("end-stroke", { strokeID, zIndex });
  });

  socket.on("undo-request", async () => {
    const { roomID, user } = socket.data;
    if (!roomID || !user) return;

    const stroke = await Stroke.findOneAndUpdate(
      { roomID, "author.id": user.id, isDeleted: false },
      { isDeleted: true },
      { sort: { zIndex: -1 }, new: true }
    );

    if (stroke) io.to(roomID).emit("remove-stroke", { strokeID: stroke.strokeID });
  });

  socket.on("redo-request", async () => {
    const { roomID, user } = socket.data;
    if (!roomID || !user) return;

    const stroke = await Stroke.findOneAndUpdate(
      { roomID, "author.id": user.id, isDeleted: true },
      { isDeleted: false },
      { sort: { zIndex: -1 }, new: true }
    ).lean();

    if (stroke) {
      io.to(roomID).emit("restore-stroke", {
        strokeID: stroke.strokeID,
        author: stroke.author,
        points: stroke.points,
        style: stroke.style,
        zIndex: stroke.zIndex
      });
    }
  });

  socket.on("clear-canvas", async () => {
    const { roomID } = socket.data;
    if (!roomID) return;

    await Promise.all([
      Stroke.updateMany({ roomID }, { isDeleted: true }),
      Snapshot.deleteMany({ roomID }),
      Room.updateOne({ code: roomID }, { strokeCount: 0, latestSnapshot: null })
    ]);

    io.to(roomID).emit("clear-canvas");
  });

  socket.on("chat-message", async ({ body }) => {
    const { roomID, user } = socket.data;
    const clean = body?.trim();
    if (!roomID || !user || !clean) return;

    const message = await Message.create({
      roomID,
      author: { id: user.id, name: user.name },
      body: clean.slice(0, 1000)
    });

    io.to(roomID).emit("chat-message", {
      id: message._id.toString(),
      author: message.author,
      body: message.body,
      createdAt: message.createdAt
    });
  });

  socket.on("disconnect", () => {
    const { roomID } = socket.data;
    if (!roomID) return;

    for (const [key, stroke] of activeStrokes.entries()) {
      if (stroke.roomID === roomID && stroke.author.id === socket.data.user?.id) activeStrokes.delete(key);
    }

    roomUsers(roomID).delete(socket.id);
    io.to(roomID).emit("users-update", publicUsers(roomID));
    socket.to(roomID).emit("cursor-leave", { id: socket.data.user?.id || socket.id });
  });
});

httpServer.listen(port, () => {
  console.log(`Whiteboard ready on http://localhost:${port}`);
});
