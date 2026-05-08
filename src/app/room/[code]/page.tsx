import { WhiteboardRoom } from "@/components/WhiteboardRoom";

export default function RoomPage({ params }: { params: { code: string } }) {
  return <WhiteboardRoom roomID={params.code} />;
}
