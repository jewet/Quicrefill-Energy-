"use strict";
exports.__esModule = true;
exports.requestIdMiddleware = void 0;
var uuid_1 = require("uuid");
function requestIdMiddleware(req, res, next) {
    req.requestId = uuid_1.v4();
    res.setHeader("X-Request-ID", req.requestId);
    next();
}
exports.requestIdMiddleware = requestIdMiddleware;
