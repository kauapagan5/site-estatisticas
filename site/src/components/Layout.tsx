import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { dateTime } from "../lib/format";
import { Meta, useJson } from "../lib/data";
import { useTheme } from "../lib/storage";

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const meta = useJson<Meta>("meta.json");
  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="brand">Estatísticas</Link>
        <nav>
          <Link to="/futebol/premier-league">Premier</Link>
          <Link to="/futebol/brasileirao">Brasileirão</Link>
          <Link to="/nba">NBA</Link>
        </nav>
        <button type="button" className="theme" onClick={toggle} aria-label="Trocar tema">
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>
      <main>{children}</main>
      <footer className="foot">
        {meta.status === "ok" && (
          <>
            <div>Última atualização dos dados: {meta.data.last_data_update ? dateTime(meta.data.last_data_update) : "sem dado"} (Brasília)</div>
            <div>Fonte: {meta.data.sources.join(" · ")}</div>
          </>
        )}
      </footer>
    </div>
  );
}
