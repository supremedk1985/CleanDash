import { createApp } from "vue";
import App from "./App.vue";
import "./tailwind.css";
// Roboto (Apache 2.0), bundled: the dashboard looks the same on every device, also without internet
import "@fontsource/roboto/latin-300.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@mdi/font/css/materialdesignicons.min.css";
import "primeicons/primeicons.css";
// Weather Icons 2.0.10 (SIL OFL 1.1), bundled locally: a wall tablet may have no internet
import "./assets-vendor/weather-icons/css/weather-icons.min.css";
import "./style.css";
import { leerlaufStarten } from "./lib/idle";

import Card from "./compat/primevue/Card.vue";
import Button from "./compat/primevue/Button.vue";
import Dialog from "./compat/primevue/Dialog.vue";
import ProgressBar from "./compat/primevue/ProgressBar.vue";
import Slider from "./compat/primevue/Slider.vue";
import ToggleButton from "./compat/primevue/ToggleButton.vue";

// The kitchen tiles use these PrimeVue components without importing them; CleanDash provides look-alikes.
const app = createApp(App);
for (const [name, c] of Object.entries({ Card, card: Card, Button, Dialog, ProgressBar, Slider, ToggleButton })) app.component(name, c);
app.mount("#app");
leerlaufStarten();
