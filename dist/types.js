"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryError = void 0;
class TelemetryError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'TelemetryError';
    }
}
exports.TelemetryError = TelemetryError;
