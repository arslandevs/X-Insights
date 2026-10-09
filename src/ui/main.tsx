if (location.search.includes("popup=1")) document.documentElement.classList.add("popup");
import { render } from "preact";
import { App } from "./App";

render(<App />, document.getElementById("app")!);

// Tells the service worker that a panel is on screen (it opens a window if none answers).
const alive = new BroadcastChannel("xi");
alive.onmessage = (e) => e.data?.type === "panel-ping" && alive.postMessage({ type: "panel-alive" });
alive.postMessage({ type: "panel-alive" });
