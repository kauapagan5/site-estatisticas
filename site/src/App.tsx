import { useEffect } from "react";
import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import FootballPlayer from "./pages/FootballPlayer";
import FootballTeam from "./pages/FootballTeam";
import Home from "./pages/Home";
import { FootballLeague, NbaLeague } from "./pages/Leagues";
import { FootballMatch, NbaMatch } from "./pages/Matchup";
import NbaPlayer from "./pages/NbaPlayer";
import NbaTeam from "./pages/NbaTeam";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/futebol/time/:id" element={<FootballTeam />} />
          <Route path="/futebol/jogador/:id" element={<FootballPlayer />} />
          <Route path="/futebol/jogo/:id" element={<FootballMatch />} />
          <Route path="/futebol/:liga" element={<FootballLeague />} />
          <Route path="/nba" element={<NbaLeague />} />
          <Route path="/nba/time/:id" element={<NbaTeam />} />
          <Route path="/nba/jogador/:id" element={<NbaPlayer />} />
          <Route path="/nba/jogo/:id" element={<NbaMatch />} />
          <Route path="*" element={<p className="pad">Página não encontrada. <Link to="/">Voltar ao início</Link></p>} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
