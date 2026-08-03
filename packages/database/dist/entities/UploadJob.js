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
exports.UploadJob = exports.UploadJobStatus = void 0;
const typeorm_1 = require("typeorm");
const UploadLog_1 = require("./UploadLog");
var UploadJobStatus;
(function (UploadJobStatus) {
    UploadJobStatus["QUEUED"] = "queued";
    UploadJobStatus["PROCESSING"] = "processing";
    UploadJobStatus["COMPLETED"] = "completed";
    UploadJobStatus["FAILED"] = "failed";
})(UploadJobStatus || (exports.UploadJobStatus = UploadJobStatus = {}));
let UploadJob = class UploadJob {
    id;
    fileName;
    filePath;
    status;
    totalRows;
    successCount;
    failureCount;
    errorMessage;
    logs;
    createdAt;
    updatedAt;
};
exports.UploadJob = UploadJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], UploadJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UploadJob.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UploadJob.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: UploadJobStatus,
        default: UploadJobStatus.QUEUED,
    }),
    __metadata("design:type", String)
], UploadJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], UploadJob.prototype, "totalRows", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], UploadJob.prototype, "successCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], UploadJob.prototype, "failureCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: "text" }),
    __metadata("design:type", String)
], UploadJob.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UploadLog_1.UploadLog, (log) => log.job, { cascade: true }),
    __metadata("design:type", Array)
], UploadJob.prototype, "logs", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UploadJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UploadJob.prototype, "updatedAt", void 0);
exports.UploadJob = UploadJob = __decorate([
    (0, typeorm_1.Entity)("upload_job")
], UploadJob);
//# sourceMappingURL=UploadJob.js.map