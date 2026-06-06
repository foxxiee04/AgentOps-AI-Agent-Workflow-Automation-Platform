import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("audit")
@Controller("audit-logs")
export class AuditController {
  @Get()
  findAll() {
    return [
      {
        id: "audit_demo",
        action: "workflow.scaffolded",
        entityType: "workflow",
        entityId: "wf_lead_qualification",
        createdAt: new Date().toISOString()
      }
    ];
  }
}

