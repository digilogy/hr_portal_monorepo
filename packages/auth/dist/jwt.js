"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAuthToken = signAuthToken;
exports.verifyAuthToken = verifyAuthToken;
exports.verifyLegacySetupToken = verifyLegacySetupToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("@hr-portal/config");
const JWT_SECRET = config_1.env.JWT_SECRET;
const SETUP_SECRET = config_1.env.JWT_SECRET + "_setup";
function signAuthToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}
function verifyAuthToken(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
function verifyLegacySetupToken(token) {
    return jsonwebtoken_1.default.verify(token, SETUP_SECRET);
}
//# sourceMappingURL=jwt.js.map