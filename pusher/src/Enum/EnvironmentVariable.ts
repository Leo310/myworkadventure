const SECRET_KEY = process.env.SECRET_KEY || "yourSecretKey";
const ALLOW_ARTILLERY = process.env.ALLOW_ARTILLERY ? process.env.ALLOW_ARTILLERY == "true" : false;
const API_URL = process.env.API_URL || "";
const ADMIN_API_URL = process.env.ADMIN_API_URL || "";
const ADMIN_URL = process.env.ADMIN_URL || "";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "";
export const ADMIN_SOCKETS_TOKEN = process.env.ADMIN_SOCKETS_TOKEN || "";
const CPU_OVERHEAT_THRESHOLD = Number(process.env.CPU_OVERHEAT_THRESHOLD) || 80;
const PUSHER_HTTP_PORT = parseInt(process.env.PUSHER_HTTP_PORT || "8080") || 8080;
export const SOCKET_IDLE_TIMER = parseInt(process.env.SOCKET_IDLE_TIMER as string) || 120; // maximum time (in second) without activity before a socket is closed. Should be greater than 60 seconds in order to cope for Chrome intensive throttling (https://developer.chrome.com/blog/timer-throttling-in-chrome-88/#intensive-throttling)

export const FRONT_URL = process.env.FRONT_URL || "https://play.herginnies.world";
export const OPID_CLIENT_ID = process.env.OPID_CLIENT_ID || "";
export const OPID_CLIENT_SECRET = process.env.OPID_CLIENT_SECRET || "";
export const OPID_CLIENT_ISSUER = process.env.OPID_CLIENT_ISSUER || "";
export const OPID_CLIENT_REDIRECT_URL = process.env.OPID_CLIENT_REDIRECT_URL || FRONT_URL + "/jwt";
export const OPID_PROFILE_SCREEN_PROVIDER = process.env.OPID_PROFILE_SCREEN_PROVIDER || ADMIN_URL + "/profile";
export const OPID_SCOPE = process.env.OPID_SCOPE || "openid email";
export const OPID_USERNAME_CLAIM = process.env.OPID_USERNAME_CLAIM || "username";
export const OPID_LOCALE_CLAIM = process.env.OPID_LOCALE_CLAIM || "locale";
export const DISABLE_ANONYMOUS: boolean = process.env.DISABLE_ANONYMOUS === "true";
export const PROMETHEUS_AUTHORIZATION_TOKEN = process.env.PROMETHEUS_AUTHORIZATION_TOKEN;
export const EJABBERD_DOMAIN: string = process.env.EJABBERD_DOMAIN || "ejabberd";
export const EJABBERD_URI: string = process.env.EJABBERD_URI || "ejabberd:5380";
export const EJABBERD_JWT_SECRET: string = process.env.EJABBERD_JWT_SECRET || "yourSecretKey";

// If set to the string "true", the /openapi route will return the OpenAPI definition and the swagger-ui/ route will display the documentation
export const ENABLE_OPENAPI_ENDPOINT = process.env.ENABLE_OPENAPI_ENDPOINT === "true";

// The URL to use if the user is visiting the first time and hitting the "/" route.
export const START_ROOM_URL: string = process.env.START_ROOM_URL || "/_/global/maps.herginnies.world/InnoCenterPOT/map.json";

export {
    SECRET_KEY,
    API_URL,
    ADMIN_API_URL,
    ADMIN_URL,
    ADMIN_API_TOKEN,
    ALLOW_ARTILLERY,
    CPU_OVERHEAT_THRESHOLD,
    PUSHER_HTTP_PORT,
};
