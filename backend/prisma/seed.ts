import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password@123", 10);

  // 1 Admin
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@velozity.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  // 2 Project Managers
  const pm1 = await prisma.user.create({
    data: {
      name: "Project Manager One",
      email: "pm1@velozity.com",
      passwordHash,
      role: "PROJECT_MANAGER",
    },
  });

  const pm2 = await prisma.user.create({
    data: {
      name: "Project Manager Two",
      email: "pm2@velozity.com",
      passwordHash,
      role: "PROJECT_MANAGER",
    },
  });

  // 4 Developers
  const developers = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      prisma.user.create({
        data: {
          name: `Developer ${i + 1}`,
          email: `developer${i + 1}@velozity.com`,
          passwordHash,
          role: "DEVELOPER",
        },
      })
    )
  );

  // 3 Projects
  const project1 = await prisma.project.create({
    data: {
      name: "E-Commerce Platform",
      description: "Build a modern e-commerce platform.",
      clientName: "Acme Corporation",
      createdById: pm1.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Mobile Banking App",
      description: "Develop a secure mobile banking application.",
      clientName: "FinTech Solutions",
      createdById: pm2.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: "Marketing Dashboard",
      description: "Create analytics and marketing dashboards.",
      clientName: "Growth Labs",
      createdById: admin.id,
    },
  });

  // Project membership
  await prisma.projectMember.createMany({
    data: [
      { projectId: project1.id, userId: pm1.id },
      { projectId: project1.id, userId: developers[0].id },
      { projectId: project1.id, userId: developers[1].id },

      { projectId: project2.id, userId: pm2.id },
      { projectId: project2.id, userId: developers[2].id },
      { projectId: project2.id, userId: developers[3].id },

      { projectId: project3.id, userId: admin.id },
      { projectId: project3.id, userId: developers[0].id },
      { projectId: project3.id, userId: developers[2].id },
    ],
  });

  // Helper for tasks
  const createTasks = async (
    projectId: string,
    creatorId: string,
    assignedDevelopers: typeof developers
  ) => {
    const tasks = [];

    for (let i = 0; i < 6; i++) {
      const task = await prisma.task.create({
        data: {
          projectId,
          createdById: creatorId,
          assigneeId: assignedDevelopers[i % assignedDevelopers.length].id,
          title: `Task ${i + 1}`,
          description: `Development task ${i + 1}`,
          status:
            i === 0
              ? "TODO"
              : i === 1
                ? "IN_PROGRESS"
                : i === 2
                  ? "IN_REVIEW"
                  : i === 3
                    ? "DONE"
                    : "TODO",
          priority:
            i === 0
              ? "CRITICAL"
              : i === 1
                ? "HIGH"
                : i === 2
                  ? "MEDIUM"
                  : "LOW",
          dueDate:
            i === 4
              ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        },
      });

      tasks.push(task);
    }

    return tasks;
  };

  const tasks1 = await createTasks(project1.id, pm1.id, [
    developers[0],
    developers[1],
  ]);

  const tasks2 = await createTasks(project2.id, pm2.id, [
    developers[2],
    developers[3],
  ]);

  const tasks3 = await createTasks(project3.id, admin.id, [
    developers[0],
    developers[2],
  ]);

  // Additional overdue task
  await prisma.task.create({
    data: {
      projectId: project1.id,
      createdById: pm1.id,
      assigneeId: developers[0].id,
      title: "Overdue Payment Integration",
      description: "This task is intentionally overdue for testing.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // Existing activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        projectId: project1.id,
        userId: pm1.id,
        taskId: tasks1[0].id,
        type: "TASK_CREATED",
        metadata: { message: "Task created" },
      },
      {
        projectId: project1.id,
        userId: developers[0].id,
        taskId: tasks1[1].id,
        type: "TASK_STATUS_CHANGED",
        metadata: {
          from: "TODO",
          to: "IN_PROGRESS",
        },
      },
      {
        projectId: project2.id,
        userId: pm2.id,
        taskId: tasks2[0].id,
        type: "TASK_ASSIGNED",
        metadata: {
          assignedTo: developers[2].email,
        },
      },
      {
        projectId: project2.id,
        userId: developers[3].id,
        taskId: tasks2[1].id,
        type: "TASK_UPDATED",
        metadata: {
          field: "priority",
          value: "HIGH",
        },
      },
      {
        projectId: project3.id,
        userId: admin.id,
        taskId: tasks3[0].id,
        type: "TASK_CREATED",
        metadata: { message: "Task created" },
      },
    ],
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: developers[0].id,
        type: "TASK_ASSIGNED",
        message: "You have been assigned a new task.",
        data: { projectId: project1.id },
      },
      {
        userId: developers[2].id,
        type: "TASK_ASSIGNED",
        message: "You have been assigned a new task.",
        data: { projectId: project2.id },
      },
    ],
  });

  console.log("✅ Seed completed successfully");
  console.log("Users created: 7");
  console.log("Projects created: 3");
  console.log("Tasks created: 19");
  console.log("Overdue tasks: 2+");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });