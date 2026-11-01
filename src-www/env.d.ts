/// <reference types="vite/client" />
/// <reference types="@iobroker/types" />
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
declare const __APP_VERSION__: string;
