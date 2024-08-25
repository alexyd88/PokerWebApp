import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home, Lobby } from "./pages";

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/lobby/:lobbyId"
            element={<Lobby />}
            // loader={async ({ params }) => {
            //   if (params.lobbyId != undefined) return getLobby(params.lobbyId);
            // }}
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
