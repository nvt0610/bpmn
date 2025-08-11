import session from "express-session";
import Keycloak from "keycloak-connect";
import keycloakConfig from "./keycloak-config.js";

const memoryStore = new session.MemoryStore();
const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

export { keycloak, memoryStore };
