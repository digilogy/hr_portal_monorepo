"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailLog = exports.EmailType = exports.EmailStatus = void 0;
const typeorm_1 = require("typeorm");
var EmailStatus;
(function (EmailStatus) {
    EmailStatus["QUEUED"] = "queued";
    EmailStatus["PROCESSING"] = "processing";
    EmailStatus["SENT"] = "sent";
    EmailStatus["FAILED"] = "failed";
})(EmailStatus || (exports.EmailStatus = EmailStatus = {}));
var EmailType;
(function (EmailType) {
    EmailType["PIN_SETUP"] = "pin_setup";
    EmailType["PIN_RESET"] = "pin_reset";
})(EmailType || (exports.EmailType = EmailType = {}));
let EmailLog = class EmailLog {
    id;
    toEmail;
    subject;
    emailType;
    payload;
    status;
    attemptCount;
    maxAttempts;
    errorMessage;
    sesMessageId;
    sentAt;
    nextRetryAt;
    createdAt;
    updatedAt;
};
exports.EmailLog = EmailLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], EmailLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmailLog.prototype, "toEmail", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmailLog.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: EmailType }),
    __metadata("design:type", String)
], EmailLog.prototype, "emailType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "json", nullable: true }),
    __metadata("design:type", Object)
], EmailLog.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: EmailStatus,
        default: EmailStatus.QUEUED,
    }),
    __metadata("design:type", String)
], EmailLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], EmailLog.prototype, "attemptCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 3 }),
    __metadata("design:type", Number)
], EmailLog.prototype, "maxAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: "text" }),
    __metadata("design:type", String)
], EmailLog.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailLog.prototype, "sesMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: "datetime" }),
    __metadata("design:type", Date)
], EmailLog.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: "datetime" }),
    __metadata("design:type", Date)
], EmailLog.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EmailLog.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EmailLog.prototype, "updatedAt", void 0);
exports.EmailLog = EmailLog = __decorate([
    (0, typeorm_1.Entity)("email_log")
], EmailLog);
//# sourceMappingURL=EmailLog.js.map