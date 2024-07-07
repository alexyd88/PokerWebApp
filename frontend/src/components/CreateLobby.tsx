import { useState } from "react";
import { createLobby } from "../api/lobbies";
import { useNavigate } from "react-router-dom";

export function CreateLobby() {
  const [players] = useState<string[]>(["me"]);

  const navigate = useNavigate();
  const handleSubmit = () => {
    createLobby({ players }).then((result) => {
      if (result.success) {
        console.log("success");
        navigate("/lobby/" + result.data._id);
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
