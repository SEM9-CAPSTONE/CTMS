import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Reusable primitive for BR-201 ("every function requiring authentication
 * may only be performed when the user has a valid login session"). CTMS-03
 * builds this foundation only — it is deliberately NOT attached to any
 * controller/route in this story. CTMS-04 onward apply it to protected
 * endpoints as those stories introduce them.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
