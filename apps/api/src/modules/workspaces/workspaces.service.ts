import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { WorkspaceRole } from "@agentops/shared";
import { DemoDataService, demoUserId } from "../../common/infrastructure/demo-data.service";
import { PrismaService } from "../../common/infrastructure/prisma.service";
import type { CreateWorkspaceDto, InviteWorkspaceMemberDto, UpdateWorkspaceDto, UpdateWorkspaceMemberRoleDto } from "./dto";

type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceMemberRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
};

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemoDataService) private readonly demoData: DemoDataService
  ) {}

  async findAll(userId?: string) {
    await this.demoData.ensureDemoWorkspace();
    const workspaces = await this.prisma.client.workspace.findMany({
      where: userId ? { members: { some: { userId } } } : undefined,
      orderBy: { createdAt: "asc" }
    });
    return workspaces.map((workspace) => this.toWorkspaceRecord(workspace));
  }

  async create(dto: CreateWorkspaceDto, ownerId: string = demoUserId) {
    await this.demoData.ensureDemoWorkspace();
    const workspace = await this.prisma.client.workspace.create({
      data: {
        id: `ws_${randomUUID()}`,
        name: dto.name,
        slug: dto.slug,
        ownerId,
        plan: "FREE",
        members: {
          create: {
            id: `wsm_${randomUUID()}`,
            userId: ownerId,
            role: "OWNER"
          }
        }
      }
    });

    return this.toWorkspaceRecord(workspace);
  }

  async findOne(id: string) {
    await this.demoData.ensureDemoWorkspace();
    return this.toWorkspaceRecord(await this.findWorkspaceRecord(id));
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    await this.demoData.ensureDemoWorkspace();
    await this.findWorkspaceRecord(id);
    const workspace = await this.prisma.client.workspace.update({
      where: { id },
      data: dto
    });

    return this.toWorkspaceRecord(workspace);
  }

  async invite(id: string, dto: InviteWorkspaceMemberDto) {
    await this.demoData.ensureDemoWorkspace();
    await this.findWorkspaceRecord(id);
    const user = await this.prisma.client.user.upsert({
      where: { email: dto.email },
      update: {},
      create: {
        id: `invited_${Buffer.from(dto.email).toString("base64url").slice(0, 12)}`,
        email: dto.email,
        name: dto.email.split("@")[0],
        passwordHash: "invited-user-password-disabled"
      }
    });
    const member = await this.prisma.client.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId: user.id
        }
      },
      update: {
        role: dto.role
      },
      create: {
        id: `wsm_${randomUUID()}`,
        workspaceId: id,
        userId: user.id,
        role: dto.role
      },
      include: { user: true }
    });

    return { invitationStatus: "persisted_invite", member: this.toWorkspaceMemberRecord(member) };
  }

  async membersForWorkspace(id: string) {
    await this.demoData.ensureDemoWorkspace();
    await this.findWorkspaceRecord(id);
    const members = await this.prisma.client.workspaceMember.findMany({
      where: { workspaceId: id },
      include: { user: true },
      orderBy: { joinedAt: "asc" }
    });

    return members.map((member) => this.toWorkspaceMemberRecord(member));
  }

  async updateMemberRole(id: string, memberId: string, dto: UpdateWorkspaceMemberRoleDto) {
    await this.demoData.ensureDemoWorkspace();
    await this.findWorkspaceRecord(id);
    const existing = await this.prisma.client.workspaceMember.findUnique({ where: { id: memberId } });
    if (!existing || existing.workspaceId !== id) {
      throw new NotFoundException("Workspace member not found");
    }

    const member = await this.prisma.client.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: { user: true }
    });

    return this.toWorkspaceMemberRecord(member);
  }

  private async findWorkspaceRecord(id: string) {
    const workspace = await this.prisma.client.workspace.findUnique({ where: { id } });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }

  private toWorkspaceRecord(workspace: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    plan: string;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceRecord {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.ownerId,
      plan: workspace.plan,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString()
    };
  }

  private toWorkspaceMemberRecord(member: {
    id: string;
    workspaceId: string;
    userId: string;
    role: string;
    joinedAt: Date;
    user: { email: string };
  }): WorkspaceMemberRecord {
    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      email: member.user.email,
      role: member.role as WorkspaceRole,
      joinedAt: member.joinedAt.toISOString()
    };
  }
}
