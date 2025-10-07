import { format } from 'date-fns';
import { OrderStatus } from '@prisma/client';

// Generate unique customer reference
export const generateCustomerReference = async (): Promise<string> => {
  const { nanoid } = await import('nanoid');
  return `CUST-${nanoid(12)}`;
};

// Format date to "12th Feb, 2022 3:45 PM"
export const formatOrderDate = (date: Date): string => {
  return format(date, "do MMM, yyyy h:mm a");
};

// Map order status to display text
export const mapOrderStatus = (status: OrderStatus): string => {
  switch (status) {
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'Out for Delivery';
    case OrderStatus.DELIVERED:
      return 'Delivered';
    case OrderStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status.replace(/_/g, ' ');
  }
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

// Estimate travel time (assuming average speed of 40 km/h)
export const estimateTravelTime = (distance: number): string => {
  const speed = 40; // km/h
  const hours = distance / speed;
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  const roundedHours = Math.floor(hours);
  const minutes = Math.round((hours - roundedHours) * 60);
  return `${roundedHours} hr ${minutes} min`;
};