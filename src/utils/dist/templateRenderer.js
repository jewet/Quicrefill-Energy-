"use strict";
exports.__esModule = true;
exports.renderTemplate = void 0;
var handlebars_1 = require("handlebars");
exports.renderTemplate = function (template, dynamicData, channel) {
    try {
        var content = "";
        var title = void 0;
        if (channel === "EMAIL" && "htmlContent" in template) {
            var compiled = handlebars_1["default"].compile(template.htmlContent);
            content = compiled(dynamicData);
            title = template.subject;
        }
        else if (channel === "SMS" && "content" in template) {
            var compiled = handlebars_1["default"].compile(template.content);
            content = compiled(dynamicData);
        }
        else if (channel === "PUSH" && "title" in template && "body" in template) {
            var compiledTitle = handlebars_1["default"].compile(template.title);
            var compiledBody = handlebars_1["default"].compile(template.body);
            content = compiledBody(dynamicData);
            title = compiledTitle(dynamicData);
        }
        else {
            throw new Error("No content defined for channel " + channel);
        }
        return { content: content, title: title };
    }
    catch (error) {
        throw new Error("Template rendering failed: " + error.message);
    }
};
