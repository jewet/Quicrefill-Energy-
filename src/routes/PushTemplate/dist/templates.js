"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var express_1 = require("express");
var client_1 = require("@prisma/client");
var authentication_1 = require("../../middlewares/authentication");
var EventTypeDictionary_1 = require("../../utils/EventTypeDictionary");
var router = express_1["default"].Router();
var prisma = new client_1.PrismaClient();
/**
 * @swagger
 * components:
 *   schemas:
 *     PushTemplate:
 *       type: object
 *       required:
 *         - name
 *         - title
 *         - body
 *         - roles
 *         - updatedBy
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the push template
 *           example: "New Order Notification"
 *         title:
 *           type: string
 *           description: The title of the push notification
 *           example: "New Order Placed"
 *         body:
 *           type: string
 *           description: The body content of the push notification
 *           example: "Your order #{orderId} has been placed successfully."
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *             enum: [CUSTOMER, VENDOR, DELIVERY_REP, ADMIN, MANAGER, SUPERVISOR]
 *           description: List of user roles eligible to receive the notification
 *           example: ["CUSTOMER", "VENDOR"]
 *         eventTypeId:
 *           type: string
 *           description: The ID of the associated event type (optional)
 *           example: "event_12345"
 *         updatedBy:
 *           type: string
 *           description: The ID of the user who created or updated the template
 *           example: "user_67890"
 *         isActive:
 *           type: boolean
 *           description: Whether the template is active
 *           example: true
 *     PushTemplateResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *           example: "Push template created"
 *         template:
 *           $ref: '#/components/schemas/PushTemplate'
 *     PushTemplateListResponse:
 *       type: array
 *       items:
 *         type: object
 *         properties:
 *           id:
 *             type: string
 *             description: The ID of the push template
 *             example: "template_12345"
 *           name:
 *             type: string
 *             description: The name of the push template
 *             example: "New Order Notification"
 *           title:
 *             type: string
 *             description: The title of the push notification
 *             example: "New Order Placed"
 *           body:
 *             type: string
 *             description: The body content of the push notification
 *             example: "Your order #{orderId} has been placed successfully."
 *           roles:
 *             type: array
 *             items:
 *               type: string
 *               enum: [CUSTOMER, VENDOR, DELIVERY_REP, ADMIN, MANAGER, SUPERVISOR]
 *             description: List of user roles eligible to receive the notification
 *             example: ["CUSTOMER", "VENDOR"]
 *           eventTypeId:
 *             type: string
 *             description: The ID of the associated event type
 *             example: "event_12345"
 *           updatedBy:
 *             type: string
 *             description: The ID of the user who updated the template
 *             example: "user_67890"
 *           isActive:
 *             type: boolean
 *             description: Whether the template is active
 *             example: true
 *           eventType:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the event type
 *                 example: "event_12345"
 *               name:
 *                 type: string
 *                 description: The name of the event type
 *                 example: "NEW_ORDER"
 *           user:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the user who updated the template
 *                 example: "user_67890"
 *               name:
 *                 type: string
 *                 description: The name of the user who updated the template
 *                 example: "John Doe"
 *     DeleteResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *           example: "Push template deleted"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message describing the issue
 *           example: "Missing required fields"
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
/**
 * @swagger
 * /templates/push:
 *   post:
 *     summary: Create a new push template
 *     tags: [PushTemplates]
 *     description: Creates a new push notification template. Requires ADMIN, MANAGER, or SUPERVISOR role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PushTemplate'
 *     responses:
 *       201:
 *         description: Push template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PushTemplateResponse'
 *       400:
 *         description: Invalid request payload, eventTypeId, updatedBy, or roles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient role permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/push", authentication_1.authorizeRoles([client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.SUPERVISOR]), function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, title, body, roles, eventTypeId, updatedBy, _b, isActive, eventType, applicableRoles_1, invalidRoles, template, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 5, , 6]);
                _a = req.body, name = _a.name, title = _a.title, body = _a.body, roles = _a.roles, eventTypeId = _a.eventTypeId, updatedBy = _a.updatedBy, _b = _a.isActive, isActive = _b === void 0 ? true : _b;
                // Validate inputs
                if (!name || !title || !body || !(roles === null || roles === void 0 ? void 0 : roles.length) || !updatedBy) {
                    res.status(400).json({ error: "Missing required fields" });
                    return [2 /*return*/];
                }
                if (!eventTypeId) return [3 /*break*/, 2];
                return [4 /*yield*/, prisma.eventType.findUnique({ where: { id: eventTypeId } })];
            case 1:
                eventType = _c.sent();
                if (!eventType) {
                    res.status(400).json({ error: "Invalid eventTypeId" });
                    return [2 /*return*/];
                }
                applicableRoles_1 = EventTypeDictionary_1.RoleEventApplicability[eventType.name] || [];
                invalidRoles = roles.filter(function (role) { return !applicableRoles_1.includes(role); });
                if (invalidRoles.length) {
                    res.status(400).json({
                        error: "Roles " + invalidRoles.join(", ") + " are not applicable for event type " + eventType.name
                    });
                    return [2 /*return*/];
                }
                _c.label = 2;
            case 2: return [4 /*yield*/, prisma.user.findUnique({ where: { id: updatedBy } })];
            case 3:
                if (!(_c.sent())) {
                    res.status(400).json({ error: "Invalid updatedBy user ID" });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma.pushTemplate.create({
                        data: {
                            name: name,
                            title: title,
                            body: body,
                            roles: roles,
                            eventTypeId: eventTypeId,
                            updatedBy: updatedBy,
                            isActive: isActive
                        }
                    })];
            case 4:
                template = _c.sent();
                res.status(201).json({ message: "Push template created", template: template });
                return [3 /*break*/, 6];
            case 5:
                error_1 = _c.sent();
                next(error_1); // Pass errors to Express error handler
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /templates/push/{id}:
 *   put:
 *     summary: Update an existing push template
 *     tags: [PushTemplates]
 *     description: Updates a push notification template by ID. Requires ADMIN, MANAGER, or SUPERVISOR role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the push template to update
 *         example: "template_12345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PushTemplate'
 *     responses:
 *       200:
 *         description: Push template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PushTemplateResponse'
 *       400:
 *         description: Invalid request payload, eventTypeId, updatedBy, or roles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient role permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Push template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/push/:id", authentication_1.authorizeRoles([client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.SUPERVISOR]), function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var id, _a, name, title, body, roles, eventTypeId, updatedBy, isActive, eventType, applicableRoles_2, invalidRoles, template, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                id = req.params.id;
                _a = req.body, name = _a.name, title = _a.title, body = _a.body, roles = _a.roles, eventTypeId = _a.eventTypeId, updatedBy = _a.updatedBy, isActive = _a.isActive;
                // Validate inputs
                if (!name || !title || !body || !(roles === null || roles === void 0 ? void 0 : roles.length) || !updatedBy) {
                    res.status(400).json({ error: "Missing required fields" });
                    return [2 /*return*/];
                }
                if (!eventTypeId) return [3 /*break*/, 2];
                return [4 /*yield*/, prisma.eventType.findUnique({ where: { id: eventTypeId } })];
            case 1:
                eventType = _b.sent();
                if (!eventType) {
                    res.status(400).json({ error: "Invalid eventTypeId" });
                    return [2 /*return*/];
                }
                applicableRoles_2 = EventTypeDictionary_1.RoleEventApplicability[eventType.name] || [];
                invalidRoles = roles.filter(function (role) { return !applicableRoles_2.includes(role); });
                if (invalidRoles.length) {
                    res.status(400).json({
                        error: "Roles " + invalidRoles.join(", ") + " are not applicable for event type " + eventType.name
                    });
                    return [2 /*return*/];
                }
                _b.label = 2;
            case 2: return [4 /*yield*/, prisma.user.findUnique({ where: { id: updatedBy } })];
            case 3:
                if (!(_b.sent())) {
                    res.status(400).json({ error: "Invalid updatedBy user ID" });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma.pushTemplate.update({
                        where: { id: id },
                        data: {
                            name: name,
                            title: title,
                            body: body,
                            roles: roles,
                            eventTypeId: eventTypeId,
                            updatedBy: updatedBy,
                            isActive: isActive
                        }
                    })];
            case 4:
                template = _b.sent();
                res.status(200).json({ message: "Push template updated", template: template });
                return [3 /*break*/, 6];
            case 5:
                error_2 = _b.sent();
                next(error_2);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /templates/push:
 *   get:
 *     summary: List push templates
 *     tags: [PushTemplates]
 *     description: Retrieves a list of active push notification templates, optionally filtered by eventTypeId or role. Requires ADMIN, MANAGER, or SUPERVISOR role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventTypeId
 *         schema:
 *           type: string
 *         description: Filter templates by event type ID
 *         example: "event_12345"
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, VENDOR, DELIVERY_REP, ADMIN, MANAGER, SUPERVISOR]
 *         description: Filter templates by role
 *         example: "CUSTOMER"
 *     responses:
 *       200:
 *         description: List of push templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PushTemplateListResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient role permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/push", authentication_1.authorizeRoles([client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.SUPERVISOR]), function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, eventTypeId, role, templates, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.query, eventTypeId = _a.eventTypeId, role = _a.role;
                return [4 /*yield*/, prisma.pushTemplate.findMany({
                        where: {
                            eventTypeId: eventTypeId ? String(eventTypeId) : undefined,
                            roles: role ? { has: role } : undefined,
                            isActive: true
                        },
                        include: { eventType: true, user: { select: { id: true, name: true } } }
                    })];
            case 1:
                templates = _b.sent();
                res.status(200).json(templates);
                return [3 /*break*/, 3];
            case 2:
                error_3 = _b.sent();
                next(error_3);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /templates/push/{id}:
 *   delete:
 *     summary: Delete a push template
 *     tags: [PushTemplates]
 *     description: Deletes a push notification template by ID. Requires ADMIN, MANAGER, or SUPERVISOR role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the push template to delete
 *         example: "template_12345"
 *     responses:
 *       200:
 *         description: Push template deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient role permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Push template not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router["delete"]("/push/:id", authentication_1.authorizeRoles([client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.SUPERVISOR]), function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var id, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                return [4 /*yield*/, prisma.pushTemplate["delete"]({ where: { id: id } })];
            case 1:
                _a.sent();
                res.status(200).json({ message: "Push template deleted" });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                next(error_4);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports["default"] = router;
