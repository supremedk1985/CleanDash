import { createApp } from "vue";
import App from "./App.vue";
import "./tailwind.css";
// Roboto (Apache 2.0), bundled: the dashboard looks the same on every device, also without internet
import "@fontsource/roboto/latin-300.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@mdi/font/css/materialdesignicons.min.css";
// Weather Icons 2.0.10 (SIL OFL 1.1), bundled locally: a wall tablet may have no internet
import "./assets-vendor/weather-icons/css/weather-icons.min.css";
import "./style.css";
import { leerlaufStarten } from "./lib/idle";

createApp(App).mount("#app");
leerlaufStarten();
