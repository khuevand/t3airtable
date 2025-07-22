import { PrismaClient } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

export const syncClerkUserToDatabase = async (clerkUserId: string) => {
  const userExists = await prisma.user.findUnique({
    where: { id: clerkUserId },
  });

  if (userExists) return userExists;

  const clerkUser = await (await clerkClient()).users.getUser(clerkUserId);
  const name = clerkUser.username || clerkUser.firstName || "unknown";
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";

  const newUser = await prisma.user.create({
    data: {
      id: clerkUserId,
      name,
      email,
    },
  });

  return newUser;
};
