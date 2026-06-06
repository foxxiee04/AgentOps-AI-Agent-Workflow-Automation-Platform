import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { WorkspaceRole } from "@agentops/shared";
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
  private readonly workspaces: WorkspaceRecord[] = [
    {
      id: "ws_demo",
      name: "AgentOps Demo",
      slug: "agentops-demo",
      ownerId: "user_demo",
      plan: "FREE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  private readonly members: WorkspaceMemberRecord[] = [
    {
      id: "wsm_demo_owner",
      workspaceId: "ws_demo",
      userId: "user_demo",
      email: "demo@agentops.local",
      role: "OWNER",
      joinedAt: new Date().toISOString()
    }
  ];

  findAll() {
    return this.workspaces;
  }

  create(dto: CreateWorkspaceDto) {
    const workspace: WorkspaceRecord = {
      id: `ws_${randomUUID()}`,
      name: dto.name,
      slug: dto.slug,
      ownerId: "user_demo",
      plan: "FREE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.workspaces.push(workspace);
    return workspace;
  }

  findOne(id: string) {
    const workspace = this.workspaces.find((candidate) => candidate.id === id);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
    return workspace;
  }

  update(id: string, dto: UpdateWorkspaceDto) {
    const workspace = this.findOne(id);
    Object.assign(workspace, dto, { updatedAt: new Date().toISOString() });
    return workspace;
  }

  invite(id: string, dto: InviteWorkspaceMemberDto) {
    this.findOne(id);
    const member: WorkspaceMemberRecord = {
      id: `wsm_${randomUUID()}`,
      workspaceId: id,
      userId: `invited_${Buffer.from(dto.email).toString("base64url").slice(0, 8)}`,
      email: dto.email,
      role: dto.role,
      joinedAt: new Date().toISOString()
    };
    this.members.push(member);
    return { invitationStatus: "mock_invited", member };
  }

  membersForWorkspace(id: string) {
    this.findOne(id);
    return this.members.filter((member) => member.workspaceId === id);
  }

  updateMemberRole(id: string, memberId: string, dto: UpdateWorkspaceMemberRoleDto) {
    this.findOne(id);
    const member = this.members.find((candidate) => candidate.workspaceId === id && candidate.id === memberId);
    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }
    member.role = dto.role;
    return member;
  }
}

