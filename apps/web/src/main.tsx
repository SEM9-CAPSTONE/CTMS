import React from "react";
import ReactDOM from "react-dom/client";
import { initAuthSessionSync } from "./core/api/authSessionSync";
import { AppRoutes } from "./routes";
import "./index.css";

import { ToastProvider } from "./shared/components/Toast";

// CTMS-04-T02, DG-04: register the cross-tab session-sync `storage`
// listener exactly once, for the lifetime of the page. Plain module-level
// call, not a React effect -- DG-02 ruled out a Context/state-management
// framework for this story, so there is no component whose lifecycle
// should own it, and nothing here ever needs to be torn down.
initAuthSessionSync();

const rootElement = document.getElementById("root");

if (rootElement) {
	ReactDOM.createRoot(rootElement).render(
		<React.StrictMode>
			<ToastProvider>
				<AppRoutes />
			</ToastProvider>
		</React.StrictMode>
	);
}
