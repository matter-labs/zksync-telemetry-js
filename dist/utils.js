"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInteractive = isInteractive;
exports.isCiEnvironment = isCiEnvironment;
exports.promptYesNo = promptYesNo;
const tty_1 = require("tty");
const readline_sync_1 = __importDefault(require("readline-sync"));
function isInteractive() {
    return ((0, tty_1.isatty)(process.stdin.fd) && (0, tty_1.isatty)(process.stdout.fd) && !isCiEnvironment());
}
function isCiEnvironment() {
    return Boolean(process.env.CI ||
        process.env.CONTINUOUS_INTEGRATION ||
        process.env.BUILD_NUMBER ||
        process.env.GITHUB_ACTIONS);
}
function promptYesNo(prompt) {
    const answer = readline_sync_1.default.question(`${prompt} (y/n) `);
    return answer.toLowerCase().startsWith('y');
}
