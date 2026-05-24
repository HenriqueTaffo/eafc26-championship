import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App.jsx";
import "./styles/app.scss";

import "../js/config.js";
import "../js/data.js";
import "../js/utils.js";
import "../js/ui.js";
import "../js/clubs.js";
import "../js/api.js";
import "../js/auth.js";
import "../js/standings.js";
import "../js/calendar.js";
import "../js/cups.js";
import "../js/transfers.js";
import "../js/events.js";
import "../js/players.js";
import "../js/experience.js";
import "../js/governance.js";
import "../js/forms.js";
import "../js/main.js";

const root = createRoot(document.getElementById("root"));
flushSync(() => root.render(React.createElement(App)));
