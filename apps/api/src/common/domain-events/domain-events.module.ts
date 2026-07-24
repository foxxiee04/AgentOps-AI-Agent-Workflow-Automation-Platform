import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { DomainEventsService } from "./domain-events.service";

@Module({
  imports: [InfrastructureModule],
  providers: [DomainEventsService],
  exports: [DomainEventsService]
})
export class DomainEventsModule {}
