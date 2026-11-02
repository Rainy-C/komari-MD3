import { html } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import dashboard from "@material-design-icons/svg/outlined/dashboard.svg?raw";
import settings from "@material-design-icons/svg/outlined/settings.svg?raw";
import refresh from "@material-design-icons/svg/outlined/refresh.svg?raw";
import search from "@material-design-icons/svg/outlined/search.svg?raw";
import back from "@material-design-icons/svg/outlined/arrow_back.svg?raw";
import server from "@material-design-icons/svg/outlined/dns.svg?raw";
import chevron from "@material-design-icons/svg/outlined/chevron_right.svg?raw";
import close from "@material-design-icons/svg/outlined/close.svg?raw";
import moon from "@material-design-icons/svg/outlined/dark_mode.svg?raw";
import sun from "@material-design-icons/svg/outlined/light_mode.svg?raw";
import system from "@material-design-icons/svg/outlined/contrast.svg?raw";
import admin from "@material-design-icons/svg/outlined/admin_panel_settings.svg?raw";
import down from "@material-design-icons/svg/outlined/south.svg?raw";
import up from "@material-design-icons/svg/outlined/north.svg?raw";
import error from "@material-design-icons/svg/outlined/error_outline.svg?raw";
import check from "@material-design-icons/svg/outlined/check.svg?raw";
const paths = {
  dashboard,
  settings,
  refresh,
  search,
  back,
  server,
  chevron,
  close,
  moon,
  sun,
  system,
  admin,
  down,
  up,
  error,
  check,
};
export function icon(name: keyof typeof paths) {
  return html`<span class="icon" aria-hidden="true"
    >${unsafeSVG(paths[name])}</span
  >`;
}
