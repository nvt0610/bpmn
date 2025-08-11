export default {
  "realm": "myrealm",
  "auth-server-url": "http://localhost:8080/",
  "ssl-required": "external",
  "resource": "my-app",       // clientId của bạn
  "bearer-only": true,       // ✅ API chỉ nhận Bearer token, không redirect
  "public-client": true,
  "confidential-port": 0
}