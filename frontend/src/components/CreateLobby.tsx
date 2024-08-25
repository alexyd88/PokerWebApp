import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

export function CreateLobby() {
  const navigate = useNavigate();
  const handleSubmit = () => {
    const socket = io("localhost:8080");
    socket.emit("createLobby", (response: { id: string }) => {
      navigate("/PokerWebApp/lobby/" + response.id);
    });
  };

  return (
    <div>
      <button onClick={handleSubmit}> Create Lobby </button>
    </div>
  );
}
