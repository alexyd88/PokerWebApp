import { createLobby } from "../api/lobbies";
import { useNavigate } from "react-router-dom";

export function CreateLobby() {
  const navigate = useNavigate();
  const handleSubmit = () => {
    createLobby().then((result) => {
      if (result.success) {
        navigate("/lobby/" + result.data.id);
      } else {
        console.log("NO SUCCESS");
      }
    });
  };

  return (
    <div>
      <button onClick={handleSubmit}> Create Lobby </button>
    </div>
  );
}
