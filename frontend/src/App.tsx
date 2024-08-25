import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Lobby } from "./pages";

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="*"
            element={<Lobby />}
            // loader={async ({ params }) => {
            //   if (params.lobbyId != undefined) return getLobby(params.lobbyId);
            // }}
          />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
