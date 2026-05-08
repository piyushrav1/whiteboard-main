import { Room } from "./models.js";

export function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createRoom() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeRoomCode();
    try {
      return await Room.create({ code });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  throw new Error("Could not allocate a room code");
}
