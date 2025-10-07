import { NextFunction, Response } from "express";
import { prismaClient } from "../../../config/db";
import { AuthenticatedRequest } from "../../../lib/types/auth";
import * as crypto from "crypto";
import { formatDistanceToNow } from "date-fns";
import { Prisma, Profile as PrismaProfile } from "@prisma/client";

// Interfaces for profile outputs
interface CustomerProfile {
  name: string | null;
  phoneNumber: string | null;
  avatar: string | null;
  completedOrders: number;
  rating: number;
  yearsOnPlatform: number;
  verified: boolean;
  agentReviews: {
    total: number;
    reviews: {
      agentName: string | null;
      timestamp: string;
      rating: number;
      comment: string | null;
    }[];
  };
}

interface AgentProfile {
  name: string | null;
  phoneNumber: string | null;
  avatar: string | null;
  deliveries: number;
  rating: number;
  yearsOnPlatform: number;
  achievements: { badges: { name: string; awardedAt: string; criteria: string }[] };
  verified: boolean;
  customerReviews: {
    total: number;
    reviews: {
      customerName: string | null;
      timestamp: string;
      rating: number;
      comment: string | null;
    }[];
  };
  vendorServices: {
    id: string;
    name: string;
    description: string | null;
    pricePerUnit: number;
    deliveryCost: number | null;
  }[];
}

// Union type for profile to allow Prisma Profile or custom profiles
type ProfileUnion = PrismaProfile | CustomerProfile | AgentProfile | null;

// Utility function to serialize BigInt values
const serializeBigInt = (obj: any): any => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

// Utility function to calculate years on platform
const calculateYearsOnPlatform = (createdAt: Date): number => {
  const now = new Date();
  const diffInMs = now.getTime() - createdAt.getTime();
  return diffInMs / (1000 * 60 * 60 * 24 * 365.25); // Convert milliseconds to years
};

// Utility function to assign achievement badges for agents
const assignAchievementBadges = (
  profile: {
    deliveries: number;
    avgRating: number | null;
    ratingCount: number | null;
    fiveStarCount: number | null;
    createdAt: Date;
    achievements: any;
  }
): { badges: { name: string; awardedAt: string; criteria: string }[] } => {
  const badges = profile.achievements?.badges || [];
  const yearsOnPlatform = calculateYearsOnPlatform(profile.createdAt);

  // Quick Delivery Vendor Award: 1000 deliveries, avg rating >= 4.5, 4+ years
  if (
    profile.deliveries >= 1000 &&
    (profile.avgRating ?? 0) >= 4.5 &&
    yearsOnPlatform >= 4 &&
    !badges.some((badge: any) => badge.name === "Quick Delivery Vendor Award")
  ) {
    badges.push({
      name: "Quick Delivery Vendor Award",
      awardedAt: new Date().toISOString(),
      criteria: "1000+ deliveries, 4.5+ average rating, 4+ years on platform",
    });
  }

  // Outstanding Review Award: 1000 5-star ratings
  if (
    (profile.fiveStarCount ?? 0) >= 1000 &&
    !badges.some((badge: any) => badge.name === "Outstanding Review Award")
  ) {
    badges.push({
      name: "Outstanding Review Award",
      awardedAt: new Date().toISOString(),
      criteria: "1000+ 5-star ratings",
    });
  }

  // Outstanding Vendor Award: 5000 deliveries, avg rating >= 4.8
  if (
    profile.deliveries >= 5000 &&
    (profile.avgRating ?? 0) >= 4.8 &&
    !badges.some((badge: any) => badge.name === "Outstanding Vendor Award")
  ) {
    badges.push({
      name: "Outstanding Vendor Award",
      awardedAt: new Date().toISOString(),
      criteria: "5000+ deliveries, 4.8+ average rating",
    });
  }

  return { badges };
};

// Fetch customer-specific profile
const getCustomerProfile = async (
  userId: string,
  roleName: string
): Promise<CustomerProfile | null> => {
  const profile = await prismaClient.profile.findFirst({
    where: {
      userId,
      role: { name: roleName },
    },
    include: {
      user: {
        select: {
          name: true,
          phoneNumber: true,
          avatar: true,
        },
      },
      savedAddresses: true,
      serviceOrders: {
        where: { userId },
        include: {
          reviews: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      customerReviews: {
        include: {
          giver: {
            select: {
              name: true,
            },
          },
        },
      },
      identityVerification: {
        select: {
          status: true,
        },
      },
    },
  });

  if (profile) {
    // Calculate years on platform
    const yearsOnPlatform = calculateYearsOnPlatform(profile.createdAt);

    // Check verification status (only identity verification required)
    const isVerified = profile.identityVerification?.status === "VERIFIED";

    // Calculate completed orders
    const completedOrders = profile.serviceOrders.filter(
      (order) => order.status === "DELIVERED"
    ).length;

    // Format agent reviews
    const agentReviews = profile.customerReviews.map((review) => ({
      agentName: review.giver.name,
      timestamp: formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }),
      rating: review.rating,
      comment: review.comment,
    }));

    return {
      name: profile.user.name,
      phoneNumber: profile.user.phoneNumber,
      avatar: profile.user.avatar,
      completedOrders,
      rating: profile.avgRating ?? 0.0,
      yearsOnPlatform,
      verified: isVerified,
      agentReviews: {
        total: profile.customerReviews.length,
        reviews: agentReviews,
      },
    };
  }

  return null;
};

// Fetch agent-specific profile (VENDOR role)
const getAgentProfile = async (
  userId: string,
  roleName: string
): Promise<AgentProfile | null> => {
  const profile = await prismaClient.profile.findFirst({
    where: {
      userId,
      role: { name: roleName },
    },
    include: {
      user: {
        select: {
          name: true,
          phoneNumber: true,
          avatar: true,
        },
      },
      services: true,
      serviceOrders: {
        include: {
          reviews: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      feedbackAsAgent: true,
      feedbackAsVendor: {
        include: {
          giver: {
            select: {
              name: true,
            },
          },
        },
      },
      deliveryReps: true,
      vendor: {
        include: {
          businessVerification: {
            select: {
              status: true,
            },
          },
        },
      },
      agents: true,
      infractionsAsAgent: true,
      infractionsAsVendor: true,
      appealsAsVendor: true,
      vendorWalletConfigs: true,
      serviceVerification: {
        select: {
          status: true,
        },
      },
      identityVerification: {
        select: {
          status: true,
        },
      },
    },
  });

  if (profile) {
    // Calculate years on platform
    const yearsOnPlatform = calculateYearsOnPlatform(profile.createdAt);

    // Assign achievement badges
    const achievements = assignAchievementBadges(profile);
    await prismaClient.profile.update({
      where: { id: profile.id },
      data: { achievements },
    });

    // Check verification status (vendor's business verification, agent's identity and service verification)
    const isVerified =
      profile.vendor?.businessVerification?.status === "APPROVED" &&
      profile.identityVerification?.status === "VERIFIED" &&
      profile.serviceVerification?.status === "APPROVED";

    // Fetch vendor's services
    const vendorServices = profile.vendorId
      ? await prismaClient.service.findMany({
          where: {
            vendorId: profile.vendorId,
          },
          select: {
            id: true,
            name: true,
            description: true,
            pricePerUnit: true,
            deliveryCost: true,
          },
        })
      : [];

    // Format customer reviews
    const customerReviews = profile.feedbackAsVendor.map((feedback) => ({
      customerName: feedback.giver.name,
      timestamp: formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true }),
      rating: feedback.rating,
      comment: feedback.comment,
    }));

    return {
      name: profile.user.name,
      phoneNumber: profile.user.phoneNumber,
      avatar: profile.user.avatar,
      deliveries: profile.deliveries,
      rating: profile.avgRating ?? 0.0,
      yearsOnPlatform,
      achievements,
      verified: isVerified,
      customerReviews: {
        total: profile.feedbackAsVendor.length,
        reviews: customerReviews,
      },
      vendorServices: vendorServices.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        pricePerUnit: Number(service.pricePerUnit),
        deliveryCost: service.deliveryCost ? Number(service.deliveryCost) : null,
      })),
    };
  }

  return null;
};

export const Me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Validate authenticated user
    if (!req.user || !req.user.id || !req.user.role) {
      return res.status(401).json({
        success: false,
        status: "error",
        statusCode: 401,
        message: "Unauthorized: No user authenticated",
      });
    }

    // Get user role name from database
    const role = await prismaClient.role.findUnique({
      where: { name: req.user.role },
    });
    if (!role) {
      return res.status(400).json({
        success: false,
        status: "error",
        statusCode: 400,
        message: "Invalid user role",
      });
    }
    const userRole = role.name;

    // Fetch user with profile and related data
    const userProfile = await prismaClient.user.findUnique({
      where: {
        id: req.user.id,
      },
      include: {
        role: true,
        profile: {
          where: {
            role: { name: userRole },
          },
          include: {
            services: userRole === "VENDOR",
            serviceOrders: {
              include: {
                reviews: {
                  include: {
                    user: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
              where: userRole === "CUSTOMER" ? { userId: req.user.id } : undefined,
            },
            customerReviews: {
              include: {
                giver: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            feedbackAsAgent: userRole === "VENDOR",
            feedbackAsVendor: {
              include: {
                giver: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            deliveryReps: userRole === "VENDOR",
            vendor: {
              include: {
                businessVerification: {
                  select: {
                    status: true,
                  },
                },
              },
            },
            agents: userRole === "VENDOR",
            infractionsAsAgent: userRole === "VENDOR",
            infractionsAsVendor: userRole === "VENDOR",
            appealsAsVendor: userRole === "VENDOR",
            vendorWalletConfigs: userRole === "VENDOR",
            savedAddresses: true,
            identityVerification: {
              select: {
                status: true,
              },
            },
            serviceVerification: userRole === "VENDOR",
          },
        },
        wallet: true,
        notificationPreferences: true,
        ratings: true,
        receivedFeedback: {
          include: {
            giver: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }) as { profile: ProfileUnion } | null; // Explicitly type profile as ProfileUnion

    // Handle user not found
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        status: "error",
        statusCode: 404,
        message: "User not found",
      });
    }

    // Create profile for CUSTOMER if none exists
    if (userRole === "CUSTOMER" && !userProfile.profile) {
      await prismaClient.profile.create({
        data: {
          id: crypto.randomUUID(),
          userId: req.user.id,
          roleId: (await prismaClient.role.findUnique({ where: { name: "CUSTOMER" } }))!.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: null,
          isWebEnabled: false,
          deliveries: 0,
          walletBalance: 0.0,
          businessVerificationStatus: "PENDING",
          identityVerificationStatus: "PENDING",
          serviceVerificationStatus: "PENDING",
          rating: 0.0,
          yearsOnPlatform: 0.0,
          fiveStarRatingsCount: 0,
        } as Prisma.ProfileUncheckedCreateInput,
      });

      // Re-fetch user with the new profile
      const updatedUserProfile = await prismaClient.user.findUnique({
        where: {
          id: req.user.id,
        },
        include: {
          role: true,
          profile: {
            where: {
              role: { name: "CUSTOMER" },
            },
            include: {
              serviceOrders: {
                include: {
                  reviews: {
                    include: {
                      user: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
                where: { userId: req.user.id },
              },
              customerReviews: {
                include: {
                  giver: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              savedAddresses: true,
              identityVerification: {
                select: {
                  status: true,
                },
              },
            },
          },
          wallet: true,
          notificationPreferences: true,
          ratings: true,
          receivedFeedback: {
            include: {
              giver: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }) as { profile: ProfileUnion } | null; // Explicitly type profile as ProfileUnion

      if (!updatedUserProfile) {
        return res.status(404).json({
          success: false,
          status: "error",
          statusCode: 404,
          message: "Failed to fetch user after profile creation",
        });
      }

      // Fetch customer-specific profile
      updatedUserProfile.profile = await getCustomerProfile(req.user.id, "CUSTOMER");

      // Serialize BigInt fields and return response
      const serializedProfile = serializeBigInt(updatedUserProfile);
      return res.status(200).json({
        success: true,
        status: "success",
        statusCode: 200,
        data: serializedProfile,
      });
    }

    // Update profile based on role
    if (userProfile.profile) {
      if (userRole === "VENDOR") {
        userProfile.profile = await getAgentProfile(req.user.id, "VENDOR");
      } else if (userRole === "CUSTOMER") {
        userProfile.profile = await getCustomerProfile(req.user.id, "CUSTOMER");
      }
    }

    // Serialize BigInt fields and return response
    const serializedProfile = serializeBigInt(userProfile);
    return res.status(200).json({
      success: true,
      status: "success",
      statusCode: 200,
      data: serializedProfile,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    next({
      message: `Failed to fetch user profile: ${errorMessage}`,
      statusCode: 500,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};