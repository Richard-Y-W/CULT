import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/shell.css";
import { Shell } from "./app/Shell.js";
import { Home } from "./pages/Home.js";
import { Asset } from "./pages/Asset.js";
import { Portfolio } from "./pages/Portfolio.js";
import { Leaderboard } from "./pages/Leaderboard.js";
import { IndexPage } from "./pages/IndexPage.js";
import { Analyst } from "./pages/Analyst.js";
import { Quant } from "./pages/Quant.js";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="trade" element={<Navigate to="/" replace />} />
          <Route path="trade/:ticker" element={<Asset />} />
          <Route path="analyst" element={<Navigate to="/analyst/CRY" replace />} />
          <Route path="analyst/:ticker" element={<Analyst />} />
          <Route path="quant" element={<Quant />} />
          <Route path="quant/:ticker" element={<Quant />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="index/:ticker" element={<IndexPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
