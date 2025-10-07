import { PrismaClient } from '.prisma/client';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import fs from 'fs';

// Function to generate a random, secure password
function generateRandomPassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + specialChars;

  let password = '';
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to randomize character positions
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

// Function to generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const prisma = new PrismaClient();

async function main() {
  // Drop all tables in reverse dependency order to avoid foreign key constraint errors
  console.log('Dropping all tables...');
  await prisma.$executeRaw`TRUNCATE TABLE public."AccountDeletionRequest" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Appeal" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."AppInstallation" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."AuditLog" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."BankCard" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."BusinessVerification" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."CartItem" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Cart" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ChurnInsight" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Complaint" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ContactOption" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."CrashReport" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."CustomerAddress" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Dispute" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."EmailSettings" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."EmailTemplate" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."EventTypeRole" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Favorite" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Feedback" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."FraudAlert" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."IdentityVerificationStatusHistory" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."IdentityVerification" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Infraction" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."License" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."NotificationLog" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."NotificationPreference" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."OrderItem" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."OrderReview" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."OrderStatusHistory" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Otp" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."PayOnDeliveryOrder" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Payment" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ProductOrder" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Report" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Reward" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."RewardRule" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."RolePrivilege" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ServiceOrderStatusHistory" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ServiceOrder" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ServiceReview" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ServiceVerification" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Session" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."SMSSettings" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."SMSTemplate" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Staff" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."SubAccount" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Transfer" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Vehicle" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."VendorWalletConfig" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."VirtualAccount" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."VoucherUsage" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Voucher" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."WalletSettings" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."WalletTransaction" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."WebhookAttempt" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Webhook" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Withdrawal" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."QuicrifillWithdrawal" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."QuicrifillWallet" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Wallet" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Service" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Product" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Accessory" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."BVNVerification" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Profile" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Zone" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."City" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Lga" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."State" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Country" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ProductType" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."ServiceType" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Category" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."PaymentConfig" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."PaymentProvider" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."AdminSettings" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."WithdrawalLimit" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Rating" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."User" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."Role" CASCADE;`;
  await prisma.$executeRaw`TRUNCATE TABLE public."EventType" CASCADE;`;
  console.log('All tables dropped successfully');

  // Seed Roles
  const roles = [
    { name: 'CUSTOMER', description: 'Customer role for placing orders' },
    { name: 'DELIVERY_AGENT', description: 'Delivery agent for handling deliveries' },
    { name: 'VENDOR', description: 'Vendor role for managing services and products' },
    { name: 'ADMIN', description: 'Administrator with full system access' },
    { name: 'MANAGER', description: 'Manager overseeing operations' },
    { name: 'SUPERVISOR', description: 'Supervisor monitoring team activities' },
    { name: 'FINANCE_MANAGER', description: 'Manages financial transactions' },
    { name: 'STAFF', description: 'General staff member' },
    { name: 'SERVICE_REP', description: 'Customer service representative' },
  ];

  for (const role of roles) {
    await prisma.role.create({
      data: {
        id: uuidv4(),
        name: role.name,
        description: role.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  console.log('Roles seeded successfully');

  // Seed Service Types
  const serviceTypes = [
    { name: 'GAS_SUPPLY', description: 'Supply of cooking gas' },
    { name: 'PETROL_SUPPLY', description: 'Supply of petrol fuel' },
    { name: 'DIESEL_SUPPLY', description: 'Supply of diesel fuel' },
    { name: 'ELECTRICITY_SUPPLY', description: 'Electricity bill payments and services' },
    { name: 'SOLAR_PANEL_INSTALLATION', description: 'Installation of solar panels' },
    { name: 'SOLAR_BATTERY_MAINTENANCE', description: 'Maintenance of solar batteries' },
    { name: 'EV_CHARGING_STATION', description: 'Electric vehicle charging services' },
    { name: 'EV_BATTERY_REPLACEMENT', description: 'Replacement of EV batteries' },
    { name: 'SOLAR_INVERTER_REPAIR', description: 'Repair of solar inverters' },
    { name: 'BIOFUEL_SUPPLY', description: 'Supply of biofuel' },
    { name: 'KEROSENE_SUPPLY', description: 'Supply of kerosene fuel' },
    { name: 'SOLAR_SYSTEM_DESIGN', description: 'Design of solar energy systems' },
    { name: 'EV_MAINTENANCE', description: 'Maintenance services for electric vehicles' },
    { name: 'ENERGY_AUDIT', description: 'Energy consumption auditing services' },
  ];

  for (const serviceType of serviceTypes) {
    await prisma.serviceType.create({
      data: {
        id: uuidv4(),
        name: serviceType.name,
        description: serviceType.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  console.log('Service Types seeded successfully');

  // Seed Categories
  const categories = [
    { name: 'SOLAR_PANELS', description: 'Solar panels for energy generation' },
    { name: 'EV_CHARGERS', description: 'Chargers for electric vehicles' },
    { name: 'GAS_CYLINDERS', description: 'Cylinders for storing cooking gas' },
    { name: 'PETROL_PUMPS', description: 'Pumps for dispensing petrol' },
    { name: 'DIESEL_FILTERS', description: 'Filters for diesel fuel systems' },
    { name: 'SOLAR_BATTERIES', description: 'Batteries for solar energy storage' },
    { name: 'INVERTERS', description: 'Inverters for solar power systems' },
    { name: 'EV_BATTERIES', description: 'Batteries for electric vehicles' },
    { name: 'FUEL_NOZZLES', description: 'Nozzles for fuel dispensing' },
    { name: 'SOLAR_CONTROLLERS', description: 'Charge controllers for solar systems' },
    { name: 'GAS_REGULATORS', description: 'Regulators for gas supply systems' },
    { name: 'PETROL_CANS', description: 'Containers for petrol storage' },
    { name: 'SOLAR_MOUNTING_KITS', description: 'Mounting kits for solar panels' },
    { name: 'EV_CABLES', description: 'Cables for EV charging' },
  ];

  const createdCategories = [];
  for (const category of categories) {
    const createdCategory = await prisma.category.create({
      data: {
        id: uuidv4(),
        name: category.name,
        description: category.description,
        imageUrl: 'https://via.placeholder.com/150',
        active: true,
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    createdCategories.push(createdCategory);
  }
  console.log('Categories seeded successfully');

  // Seed Product Types
  const productTypes = [
    { name: 'Monocrystalline Solar Panels', description: 'High-efficiency solar panels', categoryName: 'SOLAR_PANELS' },
    { name: 'Level 2 EV Chargers', description: 'Fast chargers for EVs', categoryName: 'EV_CHARGERS' },
    { name: 'LPG Cylinders', description: 'Cylinders for liquefied petroleum gas', categoryName: 'GAS_CYLINDERS' },
    { name: 'Manual Petrol Pumps', description: 'Manual pumps for petrol', categoryName: 'PETROL_PUMPS' },
    { name: 'Diesel Fuel Filters', description: 'Filters for diesel engines', categoryName: 'DIESEL_FILTERS' },
    { name: 'Lithium Solar Batteries', description: 'Batteries for solar storage', categoryName: 'SOLAR_BATTERIES' },
    { name: 'Pure Sine Wave Inverters', description: 'Inverters for solar systems', categoryName: 'INVERTERS' },
    { name: 'Lithium-ion EV Batteries', description: 'Batteries for electric vehicles', categoryName: 'EV_BATTERIES' },
    { name: 'Automatic Fuel Nozzles', description: 'Nozzles for fuel dispensing', categoryName: 'FUEL_NOZZLES' },
    { name: 'MPPT Solar Controllers', description: 'Maximum power point tracking controllers', categoryName: 'SOLAR_CONTROLLERS' },
    { name: 'High-Pressure Gas Regulators', description: 'Regulators for gas systems', categoryName: 'GAS_REGULATORS' },
    { name: 'Portable Petrol Cans', description: 'Cans for petrol storage', categoryName: 'PETROL_CANS' },
    { name: 'Adjustable Solar Mounting Kits', description: 'Mounting kits for solar panels', categoryName: 'SOLAR_MOUNTING_KITS' },
    { name: 'Type 2 EV Charging Cables', description: 'Cables for EV charging stations', categoryName: 'EV_CABLES' },
  ];

  for (const productType of productTypes) {
    const category = createdCategories.find((c) => c.name === productType.categoryName);
    if (category) {
      await prisma.productType.create({
        data: {
          id: uuidv4(),
          name: productType.name,
          description: productType.description,
          categoryId: category.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }
  console.log('Product Types seeded successfully');

  // Seed Users with Roles, Random Passwords, OTPs, and Email Verification
  const userTemplates = [
    {
      baseEmail: 'customer@example.com',
      baseUsername: 'customer',
      roleName: 'CUSTOMER',
      count: 7,
      names: [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Mary', lastName: 'Jane' },
        { firstName: 'Peter', lastName: 'Parker' },
        { firstName: 'Susan', lastName: 'Storm' },
        { firstName: 'David', lastName: 'Smith' },
        { firstName: 'Lisa', lastName: 'Brown' },
        { firstName: 'James', lastName: 'Wilson' },
      ],
    },
    {
      baseEmail: 'agent@example.com',
      baseUsername: 'agent',
      roleName: 'DELIVERY_AGENT',
      count: 7,
      names: [
        { firstName: 'Jane', lastName: 'Smith' },
        { firstName: 'Tom', lastName: 'Hanks' },
        { firstName: 'Emma', lastName: 'Watson' },
        { firstName: 'Chris', lastName: 'Evans' },
        { firstName: 'Anna', lastName: 'Taylor' },
        { firstName: 'Mark', lastName: 'Johnson' },
        { firstName: 'Laura', lastName: 'Davis' },
      ],
    },
    {
      baseEmail: 'vendor@example.com',
      baseUsername: 'vendor',
      roleName: 'VENDOR',
      count: 7,
      names: [
        { firstName: 'Alice', lastName: 'Brown' },
        { firstName: 'Bob', lastName: 'Miller' },
        { firstName: 'Clara', lastName: 'Davis' },
        { firstName: 'Daniel', lastName: 'Wilson' },
        { firstName: 'Eve', lastName: 'Moore' },
        { firstName: 'Frank', lastName: 'Taylor' },
        { firstName: 'Grace', lastName: 'Lee' },
      ],
    },
    {
      baseEmail: 'admin@example.com',
      baseUsername: 'admin',
      roleName: 'ADMIN',
      count: 7,
      names: [
        { firstName: 'Bob', lastName: 'Johnson' },
        { firstName: 'Sarah', lastName: 'Williams' },
        { firstName: 'Michael', lastName: 'Brown' },
        { firstName: 'Emily', lastName: 'Jones' },
        { firstName: 'William', lastName: 'Garcia' },
        { firstName: 'Sophia', lastName: 'Martinez' },
        { firstName: 'Henry', lastName: 'Lopez' },
      ],
    },
    {
      baseEmail: 'manager@example.com',
      baseUsername: 'manager',
      roleName: 'MANAGER',
      count: 7,
      names: [
        { firstName: 'Emma', lastName: 'Davis' },
        { firstName: 'Liam', lastName: 'Rodriguez' },
        { firstName: 'Olivia', lastName: 'Hernandez' },
        { firstName: 'Noah', lastName: 'Gonzalez' },
        { firstName: 'Ava', lastName: 'Wilson' },
        { firstName: 'James', lastName: 'Anderson' },
        { firstName: 'Isabella', lastName: 'Thomas' },
      ],
    },
    {
      baseEmail: 'supervisor@example.com',
      baseUsername: 'supervisor',
      roleName: 'SUPERVISOR',
      count: 7,
      names: [
        { firstName: 'Michael', lastName: 'Wilson' },
        { firstName: 'Charlotte', lastName: 'Moore' },
        { firstName: 'Ethan', lastName: 'Taylor' },
        { firstName: 'Mia', lastName: 'Anderson' },
        { firstName: 'Alexander', lastName: 'Thomas' },
        { firstName: 'Harper', lastName: 'Jackson' },
        { firstName: 'Benjamin', lastName: 'White' },
      ],
    },
    {
      baseEmail: 'finance@example.com',
      baseUsername: 'finance',
      roleName: 'FINANCE_MANAGER',
      count: 7,
      names: [
        { firstName: 'Sarah', lastName: 'Taylor' },
        { firstName: 'Lucas', lastName: 'Martin' },
        { firstName: 'Amelia', lastName: 'Thompson' },
        { firstName: 'Oliver', lastName: 'Garcia' },
        { firstName: 'Evelyn', lastName: 'Martinez' },
        { firstName: 'Jack', lastName: 'Robinson' },
        { firstName: 'Lily', lastName: 'Clark' },
      ],
    },
    {
      baseEmail: 'staff@example.com',
      baseUsername: 'staff',
      roleName: 'STAFF',
      count: 1,
      names: [{ firstName: 'Thomas', lastName: 'Harris' }],
    },
    {
      baseEmail: 'servicerep@example.com',
      baseUsername: 'servicerep',
      roleName: 'SERVICE_REP',
      count: 1,
      names: [{ firstName: 'Nancy', lastName: 'Lewis' }],
    },
  ];

  const userCredentials = [];
  for (const userTemplate of userTemplates) {
    const role = await prisma.role.findUnique({ where: { name: userTemplate.roleName } });
    if (role) {
      for (let i = 0; i < userTemplate.count; i++) {
        const user = userTemplate.names[i];
        const email = userTemplate.count === 1 ? userTemplate.baseEmail : `${userTemplate.baseUsername}${i + 1}@example.com`;
        const username = userTemplate.count === 1 ? userTemplate.baseUsername : `${userTemplate.baseUsername}${i + 1}`;
        const randomPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const otp = generateOTP();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const phoneNumber = `+234${Math.floor(100000000 + Math.random() * 900000000)}`;

        // Determine email verification status based on role
        const isAdminOrVendor = ['ADMIN', 'VENDOR'].includes(userTemplate.roleName);

        const userData = await prisma.user.create({
          data: {
            id: uuidv4(),
            email,
            username,
            firstName: user.firstName,
            lastName: user.lastName,
            name: `${user.firstName} ${user.lastName}`,
            roleId: role.id,
            password: hashedPassword,
            phoneNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
            isVendor: userTemplate.roleName === 'VENDOR',
            isAdmin: userTemplate.roleName === 'ADMIN',
            isDeliveryAgent: userTemplate.roleName === 'DELIVERY_AGENT',
            emailVerified: isAdminOrVendor, // Only Admins and Vendors are email verified
          },
        });

        // Create OTP for email verification
        await prisma.otp.create({
          data: {
            id: uuidv4(),
            code: hashedOtp,
            userId: userData.id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiration
            transactionReference: uuidv4(),
            email: userData.email,
            medium: ['EMAIL'],
            verified: isAdminOrVendor, // Admins and Vendors have verified OTPs
            attempts: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            eventType: 'EMAIL_VERIFICATION',
            verifiedAt: isAdminOrVendor ? new Date() : null,
          },
        });

        console.log(`User ${email} created with password: ${randomPassword}, OTP: ${otp}`);
        userCredentials.push({ email, password: randomPassword, otp });
      }
    }
  }
  console.log('Users seeded successfully with OTPs and email verification statuses');

  // Save user credentials and OTPs to a file for reference
  fs.writeFileSync('user-credentials.json', JSON.stringify(userCredentials, null, 2));
  console.log('User credentials and OTPs saved to user-credentials.json');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });