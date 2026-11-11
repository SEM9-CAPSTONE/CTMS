import { CreateTrekkingRouteDto } from "./create-trekking-route.dto";

/** Complete replacement of editable metadata; lifecycle fields remain server-owned. */
export class UpdateTrekkingRouteDto extends CreateTrekkingRouteDto {}
