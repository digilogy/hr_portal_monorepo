"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_DOMAINS = void 0;
exports.isDomainAllowed = isDomainAllowed;
exports.ALLOWED_DOMAINS = [
    "casagrand.co.in",
    "casagrandcontracts.com",
    "digilogy.co",
    "casagrandtravelogy.co.in",
];
function isDomainAllowed(email) {
    const domain = email.split("@")[1];
    return exports.ALLOWED_DOMAINS.includes(domain);
}
//# sourceMappingURL=index.js.map