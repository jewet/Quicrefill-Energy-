import { PrismaClient } from '@prisma/client';

// Sample gas stations data for testing
export const dummyGasStations = [
    {
        id: 1,
        name: "Shell Downtown",
        location: "123 Main St",
        price: 2.99,
        rating: 4.5,
        estimatedDeliveryTime: "20-30 mins",
        status: "OPEN",
        proximity: 0,
        serviceType: "Gas",
        latitude: 6.5244,
        longitude: 3.3792
    },
    {
        id: 2,
        name: "Total Station Ikeja",
        location: "45 Allen Avenue",
        price: 3.15,
        rating: 4.2,
        estimatedDeliveryTime: "15-25 mins",
        status: "OPEN",
        serviceType: "Gas",
        latitude: 6.6018,
        longitude: 3.3515
    },
    {
        id: 3,
        name: "Mobil Lekki",
        location: "789 Admiralty Way",
        price: 3.05,
        rating: 4.7,
        estimatedDeliveryTime: "25-35 mins",
        serviceType: "Gas",
        latitude: 6.4281,
        longitude: 3.4164
    }
];

interface Coordinates {
    latitude: number;
    longitude: number;
}

interface GasStation {
    serviceType: string;
    id: number;
    name: string;
    location: string;
    price: number;
    rating: number;
    estimatedDeliveryTime: string;
    status: string;
    proximity: number;
    latitude: number;
    longitude: number;
}

export class GeoUtils {
    private static readonly EARTH_RADIUS_KM = 6371;

    /**
     * Calculate distance between two points using Haversine formula
     */
    static calculateHaversineDistance(
        point1: Coordinates,
        point2: Coordinates
    ): number {
        const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

        const dLat = toRadians(point2.latitude - point1.latitude);
        const dLon = toRadians(point2.longitude - point1.longitude);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                 Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
                 Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return this.EARTH_RADIUS_KM * c;
    }

    /**
     * Get nearby gas stations using dummy data (for testing)
     */
    static getNearbyStationsTest(
        customerLocation: Coordinates,
        radiusKm: number = 30
    ): GasStation[] {
        const stationsWithDistance = dummyGasStations.map(station => {
            const distance = this.calculateHaversineDistance(
                customerLocation,
                { latitude: station.latitude, longitude: station.longitude }
            );
            return {
                ...station,
                proximity: parseFloat(distance.toFixed(2)),
                status: station.status || "UNKNOWN"
            };
        });

        return stationsWithDistance
            .filter(station => station.proximity <= radiusKm)
            .sort((a, b) => a.proximity - b.proximity);
    }

    /**
     * Get nearby gas stations using PostGIS (for production)
     */
    static async getNearbyStationsPostGIS(
        prisma: PrismaClient,
        customerLocation: Coordinates,
        radiusKm: number = 30
    ) {
        const stations = await prisma.$queryRaw`
            SELECT *,
                ST_Distance(
                    ST_MakePoint(longitude, latitude)::geography,
                    ST_MakePoint(${customerLocation.longitude}, ${customerLocation.latitude})::geography
                ) / 1000 as distance_km
            FROM "GasStation"
            WHERE ST_DWithin(
                ST_MakePoint(longitude, latitude)::geography,
                ST_MakePoint(${customerLocation.longitude}, ${customerLocation.latitude})::geography,
                ${radiusKm * 1000}
            )
            ORDER BY distance_km;
        `;

        return stations;
    }
}