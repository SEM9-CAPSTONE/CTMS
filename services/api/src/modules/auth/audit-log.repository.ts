import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { AuditLog } from "./entities/audit-log.entity";

@Injectable()
export class AuditLogRepository extends Repository<AuditLog> {}
