"use strict";
exports.__esModule = true;
exports.estimateTravelTime = exports.calculateDistance = exports.mapOrderStatus = exports.formatOrderDate = exports.generateCustomerReference = void 0;
var nanoid_1 = require("nanoid");
var date_fns_1 = require("date-fns");
var client_1 = require("@prisma/client");
// Generate unique customer reference
exports.generateCustomerReference = function () {
    return "CUST-" + nanoid_1.nanoid(12);
};
// Format date to "12th Feb, 2022 3:45 PM"
exports.formatOrderDate = function (date) {
    return date_fns_1.format(date, "do MMM, yyyy h:mm a");
};
// Map order status to display text
exports.mapOrderStatus = function (status) {
    switch (status) {
        case client_1.OrderStatus.OUT_FOR_DELIVERY:
            return 'Out for Delivery';
        case client_1.OrderStatus.DELIVERED:
            return 'Delivered';
        case client_1.OrderStatus.CANCELLED:
            return 'Cancelled';
        default:
            return status.replace(/_/g, ' ');
    }
};
// Calculate distance between two coordinates (Haversine formula)
exports.calculateDistance = function (lat1, lon1, lat2, lon2) {
    var R = 6371; // Earth's radius in km
    var dLat = (lat2 - lat1) * (Math.PI / 180);
    var dLon = (lon2 - lon1) * (Math.PI / 180);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
};
// Estimate travel time (assuming average speed of 40 km/h)
exports.estimateTravelTime = function (distance) {
    var speed = 40; // km/h
    var hours = distance / speed;
    if (hours < 1) {
        var minutes_1 = Math.round(hours * 60);
        return minutes_1 + " min";
    }
    var roundedHours = Math.floor(hours);
    var minutes = Math.round((hours - roundedHours) * 60);
    return roundedHours + " hr " + minutes + " min";
};
