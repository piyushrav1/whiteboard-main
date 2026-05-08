# Stream-Sync Whiteboard

Real-time collaborative whiteboard built with Next.js, Tailwind CSS, HTML5 Canvas, Socket.io, and MongoDB Atlas.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `MONGODB_URI` to your MongoDB Atlas connection string before starting the server.

## Socket Flow

- `start-stroke`: creates an in-memory active stroke with `strokeID`, author, style, and the first point.
- `stream-stroke`: appends throttled points every 10-15ms and broadcasts them immediately.
- `end-stroke`: commits the full point array to MongoDB and clears the active stroke map.
- `undo-request` / `redo-request`: flips `isDeleted` on the latest matching stroke and broadcasts removal or restore.
- `cursor-move`: streams named live cursor positions to other users in the room.

## Persistence

MongoDB stores rooms, strokes, chat messages, and canvas snapshots. Strokes include `roomID`, `author`, `points`, `style`, `zIndex`, and `isDeleted`. Chat history and non-deleted strokes are loaded when a user joins a 6-digit room.
