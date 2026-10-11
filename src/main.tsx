import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CommunityProvider } from "./context/Community";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CommunityProvider>
        <App />
      </CommunityProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
