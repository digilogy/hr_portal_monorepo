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
exports.SystemNotice = void 0;
const typeorm_1 = require("typeorm");
/** Single-row table holding the portal-wide maintenance / announcement banner. */
let SystemNotice = class SystemNotice {
    id;
    message;
    type;
    isActive;
    updatedBy;
    createdAt;
    updatedAt;
};
exports.SystemNotice = SystemNotice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SystemNotice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "" }),
    __metadata("design:type", String)
], SystemNotice.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", default: "warning" }),
    __metadata("design:type", String)
], SystemNotice.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], SystemNotice.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], SystemNotice.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SystemNotice.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], SystemNotice.prototype, "updatedAt", void 0);
exports.SystemNotice = SystemNotice = __decorate([
    (0, typeorm_1.Entity)("system_notice")
], SystemNotice);
//# sourceMappingURL=SystemNotice.js.map